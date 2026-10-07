/**
 * The Submit gate's vocabulary and the document catalogue.
 *
 * SPEC 5b: disabled with the reason, naming the specific item. Since the single record
 * page (2026-10-07) the requirement blockers come from lib/rules/record-requirements.ts
 * over the catalogue; this module keeps the document catalogue (the attachment keys the
 * serving route and the reviewer read), the compliance statements' completeness, the
 * legacy plan-completeness rule (read by the migration and the reviewer of records filed
 * before the record page), and the fee's place in the gate. Filing inside the lead time
 * is NOT a blocker: Protocol 8.4 accepts an expedited submission and waives nothing.
 */

import attachmentsCatalog from './data/attachments-catalog.json';
import complianceJson from './data/compliance-form.json';
import lifecycleJson from './data/lifecycle.json';
import planJson from './data/plan.json';
import type { Level } from './types';
import { planRequirement, planSectionsForLevel } from './plan-responsibility';

export interface CatalogDocument {
  key: string;
  en: string;
  ar: string;
  minLevel: number;
  maxLevel?: number;
  system?: boolean;
  platform?: boolean;
  attach?: boolean;
  thirdParty?: boolean;
  optional?: boolean;
  retired?: boolean;
  noteEn?: string;
  noteAr?: string;
}

/** The documents the level requires, in catalog order. */
export function documentsForLevel(level: Level, planRequested = false): CatalogDocument[] {
  return (attachmentsCatalog.documents as CatalogDocument[]).filter(
    (d) => !d.retired && d.minLevel <= level && (!d.maxLevel || level <= d.maxLevel),
  ).map(d => d.key === 'plan' ? { ...d, optional: planRequirement(level, planRequested) !== 'required' } : d);
}

/**
 * The Section A declarations the level actually renders. The completeness count MUST
 * come from here and nowhere else: a hard-coded count once demanded a seventh tick the
 * form never showed below Level 3, and filing was silently impossible at Levels 1 and 2.
 */
export function applicableDeclarations(level: Level): { en: string; ar: string; minLevel: number }[] {
  return (complianceJson.sectionA as { en: string; ar: string; minLevel: number }[]).filter(
    (d) => d.minLevel <= level,
  );
}

export function declarationsAreComplete(
  ticked: Record<string, boolean> | null,
  level: Level,
): boolean {
  if (!ticked) return false;
  return applicableDeclarations(level).every((_, i) => ticked[String(i)] === true);
}

export interface PlanShape {
  mode: 'write' | 'attach';
  attachedFile: string | null;
  attachedHasFile?: boolean;
  sections: Record<string, { text?: string; covered?: boolean }>;
  majorIncident: Record<string, { covered?: boolean }>;
}

/**
 * The legacy plan is complete when all applicable sections are addressed AND, at Level
 * 3, every one of the eleven major-incident items is confirmed (Protocol 12). Records
 * filed before the record page are read with this rule; new records resolve the plan
 * from the catalogue.
 */
export function planIsComplete(plan: PlanShape | null, level: Level): boolean {
  if (!plan || planSectionsForLevel(level).length === 0) return false;
  const sectionsDone =
    plan.mode === 'attach'
      ? plan.attachedFile !== null && plan.attachedHasFile !== false &&
        planSectionsForLevel(level).every(({ n }) => plan.sections[String(n)]?.covered === true)
      : planSectionsForLevel(level).map(({ n }) => {
          const s = plan.sections[String(n)];
          return Boolean(s?.text && s.text.trim() !== '');
        }).every(Boolean);
  if (!sectionsDone) return false;
  if (level === 3) {
    return (planJson.majorIncidentItems as { n: number }[]).every(
      (item) => plan.majorIncident[String(item.n)]?.covered === true,
    );
  }
  return true;
}

export type BlockerKind =
  | 'organizationPending'
  | 'documentMissing'
  | 'providerUnanswered'
  | 'declarationUnsigned'
  | 'directorMissing'
  | 'directorUnanswered'
  | 'declarationsIncomplete'
  | 'certificationIncomplete'
  | 'feeUnpaid'
  | 'eventCancelled'
  /** A catalogue requirement that is not complete; docKey carries its stable key. */
  | 'requirementIncomplete';

export interface SubmissionBlocker {
  kind: BlockerKind;
  /** The catalogue key (or, on a legacy document blocker, the document key). */
  docKey?: string;
  /** The specific item, named (SPEC 5b). */
  itemEn: string;
  itemAr: string;
}

export interface SubmissionGate {
  canFile: boolean;
  blockers: SubmissionBlocker[];
  /**
   * Protocol 8.4: the standard timeline cannot reasonably be met. Not a blocker --
   * the submission proceeds, marked expedited, and expedited review waives nothing.
   */
  expedited: boolean;
  /**
   * The state between complete and filed: everything the level requires is in
   * place and only the fee's payment is outstanding. False whenever anything
   * else still blocks -- a package that is not complete is not awaiting payment.
   */
  awaitingPayment: boolean;
}

/** The one blocker a cancelled lifecycle raises, in the instrument's words. */
export const CANCELLED_BLOCKER: { en: string; ar: string } = {
  en: lifecycleJson.blockerCancelledEn,
  ar: lifecycleJson.blockerCancelledAr,
};

/**
 * THE FEE, LAST: awaiting payment is the state between complete and filed, so it is
 * true only when the fee blocker stands alone. Null fee means none is in force --
 * the shipped state, since the capability ships off.
 */
export function withFeeBlocker(
  blockers: readonly SubmissionBlocker[],
  fee: { amount: string; currency: string; paid: boolean } | null,
): { blockers: SubmissionBlocker[]; awaitingPayment: boolean } {
  const otherwiseComplete = blockers.length === 0;
  const out = [...blockers];
  if (fee && !fee.paid) {
    out.push({
      kind: 'feeUnpaid',
      itemEn: `Application fee — awaiting payment: ${fee.amount} ${fee.currency}`,
      itemAr: `رسم الطلب — بانتظار السداد: ${fee.amount} ${fee.currency}`,
    });
  }
  return { blockers: out, awaitingPayment: otherwiseComplete && fee !== null && !fee.paid };
}

/**
 * One catalogue entry by key, for surfaces that name a document outside a level's
 * own list -- a Ministry-required measure may name any catalogue document.
 */
export function catalogueEntry(key: string): { key: string; en: string; ar: string } | null {
  const doc = (attachmentsCatalog.documents as { key: string; en: string; ar: string }[]).find(
    (d) => d.key === key,
  );
  return doc ? { key: doc.key, en: doc.en, ar: doc.ar } : null;
}
