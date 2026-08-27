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
import lifecycleJson from './data/lifecycle.json';
import planJson from './data/plan.json';
import type { Level } from './types';
import type { RequirementRow } from './requirements';

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
          // Write mode is complete by WRITTEN text alone: a coverage confirmation
          // belongs to the attach route and does not survive switching modes.
          const s = plan.sections[String(i + 1)];
          return Boolean(s?.text && s.text.trim() !== '');
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
  /** 'cancelled' closes the record: nothing further files. Defaults to active. */
  lifecycle?: 'active' | 'cancelled' | 'postponed';
  organizationStatus: 'none' | 'pending' | 'recorded' | 'returned';
  /** doc_key -> attached (system and platform docs report their own completeness). */
  documentState: Record<string, boolean>;
  /** Named EMS providers and their answers. */
  providers: { name: string; status: 'nominated' | 'confirmed' | 'declined' | 'withdrawn' | 'removed'; declaration: 'none' | 'draft' | 'signed' }[];
  /** The Event Medical Director invitation, when the level requires one. */
  director: { status: 'nominated' | 'confirmed' | 'declined' | 'withdrawn' | 'removed' } | null;
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
  | 'declarationsIncomplete'
  | 'eventCancelled';

export interface SubmissionBlocker {
  kind: BlockerKind;
  /** For documentMissing: the catalogue key, so a caller can tell an ATTACHED
   *  document from one COMPLETED on the platform (the plan, the compliance form). */
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
}

export function submissionGate(facts: SubmissionFacts): SubmissionGate {
  const blockers: SubmissionBlocker[] = [];
  if (facts.lifecycle === 'cancelled') {
    blockers.push({
      kind: 'eventCancelled',
      itemEn: lifecycleJson.blockerCancelledEn,
      itemAr: lifecycleJson.blockerCancelledAr,
    });
  }

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
      blockers.push({ kind: 'documentMissing', docKey: doc.key, itemEn: doc.en, itemAr: doc.ar });
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

/* ---------------- the one next action ---------------- */

export type NextActionKind =
  | 'organizationPending'
  | 'documents'
  | 'plan'
  | 'declarations'
  | 'director'
  | 'waitingOnOthers'
  | 'ready';

export interface NextAction {
  kind: NextActionKind;
  /** Where the single button goes, relative to the event. */
  href: 'requirements' | 'submit' | 'organization' | 'plan';
  /** brand when it is time to file; accent while anything is outstanding. */
  tone: 'brand' | 'accent';
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  buttonEn: string;
  buttonAr: string;
}

/**
 * ONE thing to do, derived from the SAME blockers the Submit gate names -- so the
 * panel can never disagree with the screen it sends you to.
 *
 * The order is the order a person can act in: what the Ministry owes first (nothing
 * the organizer can do), then the organizer's own work, then what is owed by someone
 * else, then filing. The waiting state matters most: a page full of amber otherwise
 * gives no way to tell that the amber is somebody else's move.
 */
export function nextAction(blockers: readonly SubmissionBlocker[]): NextAction {
  const has = (k: BlockerKind): boolean => blockers.some((b) => b.kind === k);
  const count = (...kinds: BlockerKind[]): number =>
    blockers.filter((b) => kinds.includes(b.kind)).length;

  if (has('organizationPending')) {
    return {
      kind: 'organizationPending',
      href: 'organization',
      tone: 'accent',
      titleEn: 'Wait for the Ministry to record the organization',
      titleAr: 'انتظروا تسجيل الوزارة للمؤسسة',
      bodyEn:
        'Nothing is owed by you meanwhile. Everything on this event can be prepared now; only filing waits for the organization to be recorded.',
      bodyAr:
        'لا شيء مستحق عليكم في هذه الأثناء. يمكن إعداد كل ما يخص هذه الفعالية الآن؛ والتقديم وحده ينتظر تسجيل المؤسسة.',
      buttonEn: 'Open the organization',
      buttonAr: 'فتح المؤسسة',
    };
  }

  // A missing document is not always something you ATTACH: the plan and the compliance
  // form are completed on the platform. Naming the wrong verb sends the organizer to a
  // screen with no control on it.
  const missingKeys = blockers.filter((b) => b.kind === 'documentMissing').map((b) => b.docKey);
  const attachable = missingKeys.filter(
    (k) => (attachmentsCatalog.documents as CatalogDocument[]).find((d) => d.key === k)?.attach === true,
  ).length;
  if (attachable > 0) {
    return {
      kind: 'documents',
      href: 'requirements',
      tone: 'accent',
      titleEn: attachable === 1 ? 'Attach the outstanding document' : `Attach the ${attachable} outstanding documents`,
      titleAr: attachable === 1 ? 'أرفقوا المستند غير المقدَّم' : `أرفقوا المستندات غير المقدَّمة (${attachable})`,
      bodyEn:
        attachable === 1
          ? 'Everything else on this event can wait. The submission cannot be filed until it is attached.'
          : 'Everything else on this event can wait. The submission cannot be filed until they are attached.',
      bodyAr:
        attachable === 1
          ? 'كل ما عدا ذلك في هذه الفعالية يمكن أن ينتظر. ولا يمكن تقديم الملف قبل إرفاقه.'
          : 'كل ما عدا ذلك في هذه الفعالية يمكن أن ينتظر. ولا يمكن تقديم الملف قبل إرفاقها.',
      buttonEn: 'Open the documents',
      buttonAr: 'فتح المستندات',
    };
  }

  if (missingKeys.includes('plan')) {
    return {
      kind: 'plan',
      href: 'plan',
      tone: 'accent',
      titleEn: 'Write the event health and medical plan',
      titleAr: 'اكتبوا خطة التأهب الصحي والطبي للفعالية',
      bodyEn:
        'Everything else on this event can wait. Write the plan on the platform or attach one you already hold; the submission cannot be filed without it.',
      bodyAr:
        'كل ما عدا ذلك يمكن أن ينتظر. اكتبوا الخطة على المنصة أو أرفقوا خطة تملكونها؛ ولا يمكن تقديم الملف من دونها.',
      buttonEn: 'Open the plan',
      buttonAr: 'فتح الخطة',
    };
  }

  if (has('directorMissing')) {
    return {
      kind: 'director',
      href: 'requirements',
      tone: 'accent',
      titleEn: 'Name the Event Medical Director',
      titleAr: 'سمّوا المدير الطبي للفعالية',
      bodyEn:
        'Everything else on this event can wait. A Level 3 package cannot be filed without a licensed physician named as Event Medical Director.',
      bodyAr:
        'كل ما عدا ذلك يمكن أن ينتظر. لا يمكن تقديم ملف المستوى 3 من دون طبيب مرخّص مُسمّى مديراً طبياً للفعالية.',
      buttonEn: 'Open the named parties',
      buttonAr: 'فتح الأطراف المُسمّاة',
    };
  }

  const waiting = count('providerUnanswered', 'directorUnanswered', 'declarationUnsigned');
  if (waiting > 0) {
    return {
      kind: 'waitingOnOthers',
      href: 'requirements',
      tone: 'accent',
      titleEn:
        waiting === 1
          ? 'Wait for the named provider to answer'
          : 'Wait for the named providers to answer',
      titleAr: waiting === 1 ? 'انتظروا ردّ الجهة المُسمّاة' : 'انتظروا ردّ الجهات المُسمّاة',
      bodyEn:
        'Nothing is owed by you meanwhile. A nomination is not a confirmation, and the submission cannot be filed until each named provider has answered.',
      bodyAr:
        'لا شيء مستحق عليكم في هذه الأثناء. فالترشيح ليس تأكيداً، ولا يمكن تقديم الملف قبل أن تُجيب كل جهة مُسمّاة.',
      buttonEn: 'Open the named providers',
      buttonAr: 'فتح الجهات المُسمّاة',
    };
  }

  if (has('declarationsIncomplete')) {
    return {
      kind: 'declarations',
      href: 'submit',
      tone: 'accent',
      titleEn: 'Complete the compliance and submission form',
      titleAr: 'أكملوا نموذج الامتثال والتقديم',
      bodyEn:
        'Everything else on this event is in place. The form is completed on the platform, not attached.',
      bodyAr:
        'كل ما عدا ذلك في هذه الفعالية مستوفى. ويُستكمل النموذج على المنصة ولا يُرفَق.',
      buttonEn: 'Open the form',
      buttonAr: 'فتح النموذج',
    };
  }

  return {
    kind: 'ready',
    href: 'submit',
    tone: 'brand',
    titleEn: 'File the submission',
    titleAr: 'قدّموا الملف',
    bodyEn: 'Everything the level requires is in place.',
    bodyAr: 'كل ما يقتضيه المستوى مستوفى.',
    buttonEn: 'Open the submission package',
    buttonAr: 'فتح حزمة التقديم',
  };
}

/** The certify-to rows, split the way a reader needs them: what always applies, and what this level added. */
export function certifyRowGroups(rows: readonly RequirementRow[]): {
  everyLevel: RequirementRow[];
  addedOrRaised: RequirementRow[];
} {
  return {
    everyLevel: rows.filter((r) => !r.raised),
    addedOrRaised: rows.filter((r) => r.raised),
  };
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
