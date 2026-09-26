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
import { certificationBlockerText } from './certification';
import { blocksFiling, type GrandfatherFacts } from './grandfathering';
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
        Array.from({ length: 16 }, (_, i) => i + 1).filter(n => level === 3 || n !== 12).every(n => plan.sections[String(n)]?.covered === true)
      : Array.from({ length: 16 }, (_, i) => i + 1).filter(n => level === 3 || n !== 12).map(n => {
          // Write mode is complete by WRITTEN text alone: a coverage confirmation
          // belongs to the attach route and does not survive switching modes.
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

export interface SubmissionFacts {
  level: Level;
  /** 'cancelled' closes the record: nothing further files. Defaults to active. */
  lifecycle?: 'active' | 'cancelled' | 'postponed';
  organizationStatus: 'none' | 'pending' | 'recorded' | 'returned';
  /** doc_key -> attached (system and platform docs report their own completeness). */
  documentState: Record<string, boolean>;
  /** The organizer certification's field values, for the completeness rule. */
  certification: Record<string, string>;
  /** When this submission was filed and whether it is determined, for the effective-date rule. */
  grandfather: GrandfatherFacts;
  /** Named EMS providers and their answers. */
  providers: { name: string; status: 'nominated' | 'confirmed' | 'declined' | 'withdrawn' | 'removed'; declaration: 'none' | 'draft' | 'signed' }[];
  /** The Event Medical Director invitation, when the level requires one. */
  director: { status: 'nominated' | 'confirmed' | 'declined' | 'withdrawn' | 'removed' } | null;
  /** All eight applicable declarations ticked on the compliance form. */
  declarationsComplete: boolean;
  /** Today vs the filing deadline (Asia/Beirut dates, YYYY-MM-DD). */
  today: string;
  filingDeadline: string | null;
  /**
   * The application fee in force and whether its payment is recorded. Null while
   * no fee is in force (capability off, unset, or zero) -- the shipped state.
   */
  fee: { amount: string; currency: string; paid: boolean } | null;
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
  /**
   * The state between complete and filed: everything the level requires is in
   * place and only the fee's payment is outstanding. False whenever anything
   * else still blocks -- a package that is not complete is not awaiting payment.
   */
  awaitingPayment: boolean;
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


  for (const doc of documentsForLevel(facts.level)) {
    if (doc.optional) continue;
    if (facts.documentState[doc.key]) continue;
    // A NEWLY REQUIRED DOCUMENT APPLIES FROM ITS EFFECTIVE DATE FORWARD (Ministry
    // ruling, 2026-08-29). A submission filed before the requirement existed is never
    // BLOCKED by it -- a determined one stands, and an undetermined one is asked
    // through the ordinary revision route. Blocking it here would leave an organizer
    // holding a filed submission that had silently become unfileable.
    if (!blocksFiling(doc.key, facts.grandfather)) continue;
    blockers.push({ kind: 'documentMissing', docKey: doc.key, itemEn: doc.en, itemAr: doc.ar });
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

  // THE ORGANIZER'S OWN CERTIFICATION had the same hole as the provider's: a
  // submission could be filed with no authorized representative named. The
  // declarations being ticked is not the same as the certification being made.
  const certification = certificationBlockerText('organizer', facts.certification);
  if (certification) {
    blockers.push({
      kind: 'certificationIncomplete',
      itemEn: certification.en,
      itemAr: certification.ar,
    });
  }

  if (!facts.declarationsComplete) {
    blockers.push({
      kind: 'declarationsIncomplete',
      itemEn: 'The compliance declarations are not all confirmed',
      itemAr: 'لم تُؤكَّد جميع إقرارات الامتثال',
    });
  }

  // THE FEE, LAST: awaiting payment is the state between complete and filed,
  // so it is true only when the fee blocker stands alone.
  const otherwiseComplete = blockers.length === 0;
  if (facts.fee && !facts.fee.paid) {
    blockers.push({
      kind: 'feeUnpaid',
      itemEn: `Application fee — awaiting payment: ${facts.fee.amount} ${facts.fee.currency}`,
      itemAr: `رسم الطلب — بانتظار السداد: ${facts.fee.amount} ${facts.fee.currency}`,
    });
  }

  const expedited =
    facts.filingDeadline !== null && facts.today > facts.filingDeadline;

  return {
    canFile: blockers.length === 0,
    blockers,
    expedited,
    awaitingPayment: otherwiseComplete && facts.fee !== null && !facts.fee.paid,
  };
}

/* ---------------- the one next action ---------------- */

export type NextActionKind =
  | 'organizationPending'
  | 'documents'
  | 'plan'
  | 'declarations'
  | 'director'
  | 'waitingOnOthers'
  | 'awaitingPayment'
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
 * Prioritize work the organizer can complete while external responses are pending.
 * Organization registration still blocks filing, not preparation.
 */
export function nextAction(blockers: readonly SubmissionBlocker[]): NextAction {
  const has = (k: BlockerKind): boolean => blockers.some((b) => b.kind === k);
  const count = (...kinds: BlockerKind[]): number =>
    blockers.filter((b) => kinds.includes(b.kind)).length;

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
      titleEn: attachable === 1 ? 'Upload 1 document' : `Upload ${attachable} documents`,
      titleAr: attachable === 1 ? 'رفع مستند واحد' : `رفع ${attachable} مستندات`,
      bodyEn:
        attachable === 1
          ? 'Upload the missing document to complete your submission package.'
          : 'Upload the missing documents to complete your submission package.',
      bodyAr:
        attachable === 1
          ? 'أرفقوا المستند الناقص لاستكمال حزمة التقديم.'
          : 'أرفقوا المستندات الناقصة لاستكمال حزمة التقديم.',
      buttonEn: 'Upload documents',
      buttonAr: 'رفع المستندات',
    };
  }

  if (missingKeys.includes('plan')) {
    return {
      kind: 'plan',
      href: 'plan',
      tone: 'accent',
      titleEn: 'Complete the medical plan',
      titleAr: 'أكملوا الخطة الطبية',
      bodyEn:
        'Write the plan here or upload an existing plan.',
      bodyAr:
        'اكتبوا الخطة هنا أو أرفقوا خطة موجودة لديكم.',
      buttonEn: 'Open the plan',
      buttonAr: 'فتح الخطة',
    };
  }

  if (has('directorMissing')) {
    return {
      kind: 'director',
      href: 'requirements',
      tone: 'accent',
      titleEn: 'Invite the Medical Director',
      titleAr: 'دعوة المدير الطبي للفعالية',
      bodyEn:
        'Nominate a licensed physician and share their invitation link. Their acceptance is required before submission.',
      bodyAr:
        'رشّحوا طبيباً مرخّصاً وشاركوا معه رابط الدعوة. يلزم قبوله قبل التقديم.',
      buttonEn: 'Open the named parties',
      buttonAr: 'فتح الأطراف المُسمّاة',
    };
  }

  if (has('declarationsIncomplete') || has('certificationIncomplete')) {
    return {
      kind: 'declarations',
      href: 'submit',
      tone: 'accent',
      titleEn: 'Complete the compliance and submission form',
      titleAr: 'أكملوا نموذج الامتثال والتقديم',
      bodyEn:
        'Complete the declarations and authorized representative’s details. Your entries save automatically.',
      bodyAr:
        'أكملوا الإقرارات وبيانات الممثّل المفوّض. تُحفظ إدخالاتكم تلقائياً.',
      buttonEn: 'Open the form',
      buttonAr: 'فتح النموذج',
    };
  }

  if (has('organizationPending')) {
    return {
      kind: 'organizationPending',
      href: 'organization',
      tone: 'accent',
      titleEn: 'Wait for the Ministry to record the organization',
      titleAr: 'انتظروا تسجيل الوزارة للمؤسسة',
      bodyEn:
        'Your preparation is complete. Organization registration is still required before submission.',
      bodyAr:
        'اكتمل إعدادكم للملف. لا يزال تسجيل المؤسسة مطلوباً قبل التقديم.',
      buttonEn: 'Open the organization',
      buttonAr: 'فتح المؤسسة',
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
          ? 'Follow up on the pending response'
          : 'Follow up on the pending responses',
      titleAr: waiting === 1 ? 'تابعوا الردّ المعلّق' : 'تابعوا الردود المعلّقة',
      bodyEn:
        'Your preparation is complete. Check the invitations and follow up with anyone whose response or declaration is pending.',
      bodyAr:
        'اكتمل إعدادكم للملف. راجعوا الدعوات وتابعوا مع كل جهة لا يزال ردّها أو إقرارها معلّقاً.',
      buttonEn: 'Open the named providers',
      buttonAr: 'فتح الجهات المُسمّاة',
    };
  }

  // The state between complete and filed: only the fee's payment is outstanding,
  // and it is not the organizer's move on the platform -- filing completes when
  // the payment is recorded.
  if (has('feeUnpaid')) {
    return {
      kind: 'awaitingPayment',
      href: 'submit',
      tone: 'accent',
      titleEn: 'Awaiting payment',
      titleAr: 'بانتظار السداد',
      bodyEn:
        'Everything the level requires is in place. The application fee is due, and filing completes when its payment is recorded.',
      bodyAr: 'كل ما يقتضيه المستوى مستوفى. ورسم الطلب مستحق، ويكتمل التقديم عند تسجيل سداده.',
      buttonEn: 'Review submission',
      buttonAr: 'مراجعة الملف',
    };
  }

  return {
    kind: 'ready',
    href: 'submit',
    tone: 'brand',
    titleEn: 'Ready to submit',
    titleAr: 'جاهز للتقديم',
    bodyEn: 'Everything the level requires is in place.',
    bodyAr: 'كل ما يقتضيه المستوى مستوفى.',
    buttonEn: 'Review submission',
    buttonAr: 'مراجعة الملف',
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
