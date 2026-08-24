/**
 * The Submit gate: every blocker named, none invented.
 *
 * SPEC 5b: disabled with the reason, naming the specific item. The blockers are facts
 * about the record -- organization state, unattached documents, unanswered named
 * parties, the missing Director at Level 3 -- and this module is the only place that
 * derives them. Filing inside the lead time is NOT a blocker: Protocol 8.4 accepts an
 * expedited submission and waives nothing; the result flags it instead.
 */

import attachmentsCatalog from './data/attachments-catalog.json';
import complianceJson from './data/compliance-form.json';
import planJson from './data/plan.json';
import type { Level } from './types';

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
  noteEn?: string;
  noteAr?: string;
}

/** The documents the level requires, in catalog order. */
export function documentsForLevel(level: Level): CatalogDocument[] {
  return (attachmentsCatalog.documents as CatalogDocument[]).filter(
    (d) => d.minLevel <= level && (!d.maxLevel || level <= d.maxLevel),
  );
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
  sections: Record<string, { text?: string; covered?: boolean }>;
  majorIncident: Record<string, { covered?: boolean }>;
}

/**
 * The plan is complete when all sixteen sections are addressed AND, at Level 2 and 3,
 * every one of the eleven major-incident items is confirmed (Protocol 12). The eleven
 * are not decoration on section 12 -- an unconfirmed item blocks filing.
 */
export function planIsComplete(plan: PlanShape | null, level: Level): boolean {
  if (!plan) return false;
  const sectionsDone =
    plan.mode === 'attach'
      ? plan.attachedFile !== null &&
        Array.from({ length: 16 }, (_, i) => plan.sections[String(i + 1)]?.covered === true).every(Boolean)
      : Array.from({ length: 16 }, (_, i) => {
          const s = plan.sections[String(i + 1)];
          return Boolean(s?.text && s.text.trim() !== '') || s?.covered === true;
        }).every(Boolean);
  if (!sectionsDone) return false;
  if (level >= 2) {
    return (planJson.majorIncidentItems as { n: number }[]).every(
      (item) => plan.majorIncident[String(item.n)]?.covered === true,
    );
  }
  return true;
}

export interface SubmissionFacts {
  level: Level;
  organizationStatus: 'none' | 'pending' | 'recorded';
  /** doc_key -> attached (system and platform docs report their own completeness). */
  documentState: Record<string, boolean>;
  /** Named EMS providers and their answers. */
  providers: { name: string; status: 'nominated' | 'confirmed' | 'declined'; declaration: 'none' | 'draft' | 'signed' }[];
  /** The Event Medical Director invitation, when the level requires one. */
  director: { status: 'nominated' | 'confirmed' | 'declined' } | null;
  /** All eight applicable declarations ticked on the compliance form. */
  declarationsComplete: boolean;
  /** Today vs the filing deadline (Asia/Beirut dates, YYYY-MM-DD). */
  today: string;
  filingDeadline: string | null;
}

export type BlockerKind =
  | 'organizationPending'
  | 'documentMissing'
  | 'providerUnanswered'
  | 'declarationUnsigned'
  | 'directorMissing'
  | 'directorUnanswered'
  | 'declarationsIncomplete';

export interface SubmissionBlocker {
  kind: BlockerKind;
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
}

export function submissionGate(facts: SubmissionFacts): SubmissionGate {
  const blockers: SubmissionBlocker[] = [];

  if (facts.organizationStatus !== 'recorded') {
    blockers.push({
      kind: 'organizationPending',
      itemEn: 'Your organization is pending Ministry registration',
      itemAr: 'تسجيل مؤسستكم قيد الاستكمال لدى الوزارة',
    });
  }

  for (const doc of documentsForLevel(facts.level)) {
    if (doc.optional) continue;
    if (!facts.documentState[doc.key]) {
      blockers.push({ kind: 'documentMissing', itemEn: doc.en, itemAr: doc.ar });
    }
  }

  for (const p of facts.providers) {
    if (p.status === 'nominated') {
      blockers.push({
        kind: 'providerUnanswered',
        itemEn: `${p.name} — a nomination is not a confirmation`,
        itemAr: `${p.name} — الترشيح ليس تأكيداً`,
      });
    }
    if (facts.level === 3 && p.status === 'confirmed' && p.declaration !== 'signed') {
      blockers.push({
        kind: 'declarationUnsigned',
        itemEn: `${p.name} — readiness declaration not yet signed`,
        itemAr: `${p.name} — لم يُوقَّع إقرار الجاهزية بعد`,
      });
    }
  }

  if (facts.level === 3) {
    if (!facts.director) {
      blockers.push({
        kind: 'directorMissing',
        itemEn: 'Event Medical Director — the Level 3 package cannot be filed without one',
        itemAr: 'المدير الطبي للفعالية — لا يمكن تقديم ملف المستوى 3 من دونه',
      });
    } else if (facts.director.status !== 'confirmed') {
      blockers.push({
        kind: 'directorUnanswered',
        itemEn: 'Event Medical Director — nominated but has not accepted',
        itemAr: 'المدير الطبي للفعالية — مُرشَّح ولم يقبل بعد',
      });
    }
  }

  if (!facts.declarationsComplete) {
    blockers.push({
      kind: 'declarationsIncomplete',
      itemEn: 'The compliance declarations are not all confirmed',
      itemAr: 'لم تُؤكَّد جميع إقرارات الامتثال',
    });
  }

  const expedited =
    facts.filingDeadline !== null && facts.today > facts.filingDeadline;

  return { canFile: blockers.length === 0, blockers, expedited };
}
