import type { Level } from './types';
import type { NextStep, RailStage } from './rail';
import ministryJson from './data/ministry.json';

/**
 * The venue workflow's vocabulary. Since the single record page (2026-10-07) the
 * venue's requirement rows come from the SAME catalogue and resolver as an event's
 * (lib/rules/record-requirements.ts, service 'venue'); what stays here is the package
 * lifecycle, the checks the submit action re-runs, the next step and the rail.
 */

/** draft and submitted are internal states; revision, incomplete and accepted carry the
 *  Ministry's recorded outcome, so the operator is told the outcome that was recorded. */
export type VenuePackageStatus = 'draft' | 'submitted' | 'revision' | 'incomplete' | 'accepted';

export function venuePackageEditable(status: VenuePackageStatus, archived: boolean) { return !archived && (status === 'draft' || status === 'revision' || status === 'incomplete'); }
const outcome = (key: 'incomplete' | 'revision' | 'satisfied') => {
  const o = ministryJson.outcomes.find((x) => x.key === key)!;
  return { en: o.en, ar: o.ar };
};
/** The Ministry's three outcomes are the compliance form's own words, as on events. */
export const VENUE_STATUS: Record<VenuePackageStatus, { en: string; ar: string }> = {
  draft: { en: 'In preparation', ar: 'قيد التحضير' },
  submitted: { en: 'Submitted — under review', ar: 'مقدَّم — قيد المراجعة' },
  revision: outcome('revision'),
  incomplete: outcome('incomplete'),
  accepted: outcome('satisfied'),
};
/** The package status a Ministry decision leaves behind. */
export function venueStatusForDecision(decision: 'satisfied' | 'revision' | 'incomplete'): VenuePackageStatus {
  return decision === 'satisfied' ? 'accepted' : decision;
}

/* ---------------- the venue workspace: checks, next step, progress ---------------- */

export type VenueCheckTarget = 'details' | 'assessment' | 'team' | 'requirements' | 'fee';
export interface VenueCheck { key: string; en: string; ar: string; done: boolean; target: VenueCheckTarget }

export interface VenuePackageFacts {
  editable: boolean;
  status: VenuePackageStatus;
  detailsDone: boolean;
  assessmentDone: boolean;
  level: Level | null;
  assessmentVersion: number | null;
  pendingInvitations: readonly { name: string; token: string }[];
  /** Whether any EMS agency or Director has been invited (nominated or confirmed). */
  medicalTeamLinked?: boolean;
  /**
   * The resolver's pre-event rows for this venue, by catalogue key. clinical: nobody on
   * the organizer's side can enter it. awaitingInvitation: the row completes from an
   * invitation reply, so there is nothing on it for the organizer to do but wait.
   */
  requirements: readonly { key: string; en: string; ar: string; optional: boolean; done: boolean; clinical: boolean; awaitingInvitation?: boolean }[];
  fee: { amount: string; currency: string; paid: boolean } | null;
  submittedAt: string | null;
  validUntil: string | null;
}

/**
 * What a venue package needs before it can be submitted -- one list, read by the
 * record page's final review and re-checked by the submit action, so the two cannot
 * disagree. The declaration is a field on the form and is checked there.
 */
export function venueSubmissionChecks(f: VenuePackageFacts): { required: VenueCheck[]; optional: VenueCheck[]; remaining: number; requirementsRemaining: number; canSubmit: boolean } {
  const required: VenueCheck[] = [
    { key: 'details', en: 'Venue details and map pin', ar: 'تفاصيل الموقع وعلامة الخريطة', done: f.detailsDone, target: 'details' },
    { key: 'assessment', en: 'Annual assessment', ar: 'التقييم السنوي', done: f.assessmentDone, target: 'assessment' },
    ...f.pendingInvitations.map((i) => ({ key: i.token, en: `Response from ${i.name}`, ar: `ردّ ${i.name}`, done: false, target: 'team' as const })),
    ...f.requirements.filter((r) => !r.optional).map((r) => ({ key: r.key, en: r.en, ar: r.ar, done: r.done, target: 'requirements' as const })),
    ...(f.fee ? [{ key: 'fee', en: `Fee: ${f.fee.amount} ${f.fee.currency}`, ar: `الرسم: ${f.fee.amount} ${f.fee.currency}`, done: f.fee.paid, target: 'fee' as const }] : []),
  ];
  const optional: VenueCheck[] = f.requirements.filter((r) => r.optional).map((r) => ({ key: r.key, en: r.en, ar: r.ar, done: r.done, target: 'requirements' as const }));
  const remaining = required.filter((c) => !c.done).length;
  // The requirements stage's own count: the rows and the replies they wait on, not details or the fee.
  // A package the Ministry holds or has accepted owes nothing more in this cycle.
  const requirementsRemaining = f.editable ? required.filter((c) => (c.target === 'requirements' || c.target === 'team') && !c.done).length : 0;
  return { required, optional, remaining, requirementsRemaining, canSubmit: f.editable && remaining === 0 };
}

/**
 * The one task the venue record leads with; null once the package is with the Ministry
 * or done. href is a route under the venue ('details', 'assessment', 'team') or an
 * anchor on the record page itself ('#req-B4', '#final-review').
 */
export function venueNextAction(f: VenuePackageFacts): NextStep | null {
  if (!f.editable) return null;
  const returned = f.status === 'revision' || f.status === 'incomplete';
  if (!f.detailsDone) {
    return { kind: 'details', href: 'details', tone: 'accent',
      titleEn: 'Complete the venue details', titleAr: 'إكمال تفاصيل الموقع',
      bodyEn: 'Add the responsible person, the district and the map pin.', bodyAr: 'أضيفوا الشخص المسؤول والقضاء وعلامة الخريطة.',
      buttonEn: 'Open details', buttonAr: 'فتح التفاصيل' };
  }
  if (!f.assessmentDone) {
    return { kind: 'assessment', href: 'assessment', tone: 'accent',
      titleEn: 'Complete the assessment', titleAr: 'إكمال التقييم',
      bodyEn: 'Assess one routine operating session. The level sets the requirements.', bodyAr: 'قيّموا جلسة تشغيل اعتيادية واحدة. يحدّد المستوى المتطلبات.',
      buttonEn: 'Open the assessment', buttonAr: 'فتح التقييم' };
  }
  const { remaining } = venueSubmissionChecks(f);
  const mine = f.requirements.filter((r) => !r.optional && !r.done && !r.clinical && !r.awaitingInvitation);
  const yours = mine.length;
  const medical = f.requirements.filter((r) => !r.optional && !r.done && r.clinical).length;
  // The medical items cannot start until someone is invited to do them, so that comes first.
  if (medical > 0 && !f.medicalTeamLinked) {
    return { kind: 'team', href: 'team', tone: 'accent',
      titleEn: 'Invite your medical team', titleAr: 'ادعوا فريقكم الطبي',
      bodyEn: `They complete ${medical} of the ${medical + yours} remaining requirements.`,
      bodyAr: `يستكمل الفريق ${medical} من أصل ${medical + yours} من المتطلبات المتبقية.`,
      buttonEn: 'Open medical team', buttonAr: 'فتح الفريق الطبي' };
  }
  if (yours > 0) {
    return { kind: 'requirements', href: `#req-${mine[0]!.key}`, tone: 'accent',
      titleEn: returned ? 'Update the requirements and resubmit' : yours === 1 ? 'Complete your 1 requirement' : `Complete your ${yours} requirements`,
      titleAr: returned ? 'حدّثوا المتطلبات وأعيدوا التقديم' : `أكملوا ${arabicCount(yours, { one: 'متطلبكم الوحيد', two: 'متطلبَيكم', few: 'من متطلباتكم', many: 'من متطلباتكم' })}`,
      bodyEn: medical > 0 ? `Your medical team completes the other ${medical}.` : 'Then review and submit at the foot of this page.',
      bodyAr: medical > 0 ? `يستكمل فريقكم الطبي المتطلبات الأخرى (${medical}).` : 'ثم راجعوا وقدّموا في أسفل هذه الصفحة.',
      buttonEn: `Open ${mine[0]!.en}`, buttonAr: `فتح ${mine[0]!.ar}` };
  }
  if (f.pendingInvitations.length > 0) {
    return { kind: 'waitingOnOthers', href: 'team', tone: 'accent',
      titleEn: 'Waiting for your medical team to reply', titleAr: 'بانتظار ردّ فريقكم الطبي',
      bodyEn: 'Invitations with no reply hold up the submission. Withdraw one to invite someone else.', bodyAr: 'الدعوات التي لم يُرد عليها تؤخّر التقديم. اسحبوا الدعوة لدعوة طرف آخر.',
      buttonEn: 'View medical team', buttonAr: 'عرض الفريق الطبي' };
  }
  if (medical > 0) {
    const first = f.requirements.find((r) => !r.optional && !r.done && r.clinical)!;
    return { kind: 'waitingOnOthers', href: `#req-${first.key}`, tone: 'accent',
      titleEn: 'Medical items pending', titleAr: 'البنود الطبية قيد الإنجاز',
      bodyEn: 'Your Medical Director or EMS agency completes the remaining items on this page.', bodyAr: 'يستكمل المدير الطبي أو جهة الإسعاف البنود المتبقية في هذه الصفحة.',
      buttonEn: 'View the items', buttonAr: 'عرض البنود' };
  }
  if (remaining > 0) {
    return { kind: 'awaitingPayment', href: '#final-review', tone: 'accent',
      titleEn: 'Awaiting payment', titleAr: 'بانتظار الدفع',
      bodyEn: 'Everything the level requires is in place. Payment must be recorded before you can submit.', bodyAr: 'كل ما يتطلبه المستوى مستوفى. يجب تسجيل الدفع قبل التقديم.',
      buttonEn: 'Review submission', buttonAr: 'مراجعة ملف التقديم' };
  }
  return { kind: 'submit', href: '#final-review', tone: 'brand',
    titleEn: returned ? 'Ready to resubmit' : 'Ready to submit', titleAr: returned ? 'جاهز لإعادة التقديم' : 'جاهز للتقديم',
    bodyEn: 'Everything the level requires is in place.', bodyAr: 'كل ما يتطلبه المستوى مستوفى.',
    buttonEn: 'Review and submit', buttonAr: 'المراجعة والتقديم' };
}

/** The five-stage venue rail, drawn by the same component as the event rail. */
export function venueRailStages(f: VenuePackageFacts): { stage: number; stages: RailStage[] } {
  const requirementsLeft = f.editable ? venueSubmissionChecks(f).requirementsRemaining : 0;
  const returned = f.status === 'revision' || f.status === 'incomplete';
  const withMinistry = f.status === 'submitted' || f.status === 'accepted';
  const requirementsDone = f.assessmentDone && requirementsLeft === 0 && f.requirements.length > 0;
  // Once the Ministry has the package, everything before it is complete by definition -- a certified
  // venue never reads "Stage 1" because a field added after its certificate is empty.
  const done = withMinistry
    ? [true, true, true, true, f.status === 'accepted']
    : [f.detailsDone, f.assessmentDone, requirementsDone, false, false];
  const first = done.findIndex((d) => !d);
  const stage = first < 0 ? done.length : first + 1;
  const k = (i: number): RailStage['k'] => (done[i] ? 'done' : i === first ? (returned && i === 2 ? 'returned' : 'current') : 'todo');
  const status = VENUE_STATUS[f.status];
  const stages: RailStage[] = [
    { k: k(0), en: 'Venue details', ar: 'تفاصيل الموقع', metaEn: done[0] ? '' : 'Contact and map pin', metaAr: done[0] ? '' : 'بيانات الاتصال وعلامة الخريطة' },
    { k: k(1), en: 'Assessment', ar: 'التقييم',
      metaEn: f.assessmentDone && f.level ? `Level ${f.level} · Version ${f.assessmentVersion}` : 'Not yet complete',
      metaAr: f.assessmentDone && f.level ? `المستوى ${f.level} · النسخة ${f.assessmentVersion}` : 'لم يكتمل بعد' },
    { k: k(2), en: 'Requirements', ar: 'المتطلبات',
      metaEn: done[2] ? '' : f.assessmentDone ? `${requirementsLeft} remaining` : '',
      metaAr: done[2] ? '' : f.assessmentDone ? `${requirementsLeft} متبقٍ` : '' },
    { k: k(3), en: 'Submitted', ar: 'التقديم',
      metaEn: withMinistry && f.submittedAt ? f.submittedAt.slice(0, 10) : returned ? 'Submit the updated package' : '',
      metaAr: withMinistry && f.submittedAt ? `⁦${f.submittedAt.slice(0, 10)}⁩` : returned ? 'قدّموا الملف المحدَّث' : '' },
    f.status === 'accepted'
      ? { k: 'done', en: 'Ministry outcome', ar: 'نتيجة الوزارة', metaEn: f.validUntil ? `${status.en} · valid until ${f.validUntil}` : status.en, metaAr: f.validUntil ? `${status.ar} · صالحة حتى ⁦${f.validUntil}⁩` : status.ar }
      : returned
        ? { k: 'done', en: 'Ministry outcome', ar: 'نتيجة الوزارة', metaEn: status.en, metaAr: status.ar }
        : { k: k(4), en: 'Ministry outcome', ar: 'نتيجة الوزارة', metaEn: 'Waiting for the Ministry', metaAr: 'بانتظار الوزارة' },
  ];
  return { stage, stages };
}

/**
 * An Arabic count phrase: the singular for one, the dual for two, the plural for
 * three to ten, the accusative singular from eleven. The English says "N items".
 */
export function arabicCount(n: number, forms: { one: string; two: string; few: string; many: string }): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n >= 3 && n <= 10) return `${n} ${forms.few}`;
  return `${n} ${forms.many}`;
}

/**
 * How a venue reads on the Ministry's register: its package state first (with the Ministry,
 * returned), then its certificate. A submitted venue is never "assessment pending".
 */
export function venueRegisterState(input: { status: VenuePackageStatus | null; validUntil: string | null; today: string }): { en: string; ar: string; tone: 'pending' | 'done' | 'bad' | 'muted' } {
  if (input.status === 'submitted') return { ...VENUE_STATUS.submitted, tone: 'pending' };
  if (input.status === 'revision' || input.status === 'incomplete') return { ...VENUE_STATUS[input.status], tone: 'pending' };
  if (input.validUntil && input.validUntil < input.today) return { en: `Certificate expired ${input.validUntil}`, ar: `انتهت الشهادة في ⁦${input.validUntil}⁩`, tone: 'bad' };
  if (input.validUntil) return { en: `Certificate valid until ${input.validUntil}`, ar: `الشهادة صالحة حتى ⁦${input.validUntil}⁩`, tone: 'done' };
  return input.status === 'draft' ? { ...VENUE_STATUS.draft, tone: 'muted' } : { en: 'No certificate yet', ar: 'لا شهادة بعد', tone: 'muted' };
}
