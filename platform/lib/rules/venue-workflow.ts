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

/**
 * HOSTING VENUE REGISTRATION IS REPLACED BY FACILITY/SITE REGISTRATION (owner, 9 October 2026).
 * No venue is an active regulatory entity: every venue package is history and takes no edit,
 * whatever its status. Kept as a rule, not deleted, so every caller that asks still gets one answer.
 */
export const VENUE_SERVICE_RETIRED = true;

export function venuePackageEditable(status: VenuePackageStatus, archived: boolean) {
  if (VENUE_SERVICE_RETIRED) return false;
  return !archived && (status === 'draft' || status === 'revision' || status === 'incomplete');
}
const outcome = (key: 'incomplete' | 'revision' | 'satisfied') => {
  const o = ministryJson.outcomes.find((x) => x.key === key)!;
  return { en: o.en, ar: o.ar };
};
/**
 * The plain status an operator reads on the venue's pages and the dashboard (owner
 * direction, 2026-10-07): the same five labels as an event's. VENUE_STATUS below keeps
 * the outcomes' own words for where a determination is shown.
 */
export function venueStatusLabel(status: VenuePackageStatus): { en: string; ar: string } {
  const r = ministryJson.recordStatus;
  const pick = status === 'draft' ? r.preparing : status === 'submitted' ? r.inProcess : status === 'revision' ? r.modificationsRequested : status === 'incomplete' ? r.moreInformation : r.certificateReady;
  return { en: pick.en, ar: pick.ar };
}
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

/**
 * Hosting Venue Registration, revised logic (8 October 2026): venue profile -> annual
 * assessment -> venue infrastructure and access -> linked PAD and AED information ->
 * review and submit -> annual venue certificate. The operator fills every step; no EMS
 * agency, Medical Director or medical plan is part of a venue registration.
 */
export const VENUE_PAD_KEY = 'V7';

/** The operator's declaration, as signed on Submit and shown read-only once filed. */
export const VENUE_DECLARATION = {
  en: 'I confirm these details and documents are accurate and cover the venue’s routine operations.',
  ar: 'أؤكّد أن هذه البيانات والمستندات صحيحة وتشمل التشغيل الاعتيادي للموقع.',
};

export type VenueCheckTarget = 'details' | 'assessment' | 'requirements' | 'fee';
export interface VenueCheck { key: string; en: string; ar: string; done: boolean; target: VenueCheckTarget }

export interface VenuePackageFacts {
  editable: boolean;
  status: VenuePackageStatus;
  detailsDone: boolean;
  assessmentDone: boolean;
  level: Level | null;
  assessmentVersion: number | null;
  /** The resolver's rows for this venue, by catalogue key. */
  requirements: readonly { key: string; en: string; ar: string; optional: boolean; done: boolean }[];
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
    { key: 'details', en: 'Venue profile and map pin', ar: 'ملف الموقع وعلامة الخريطة', done: f.detailsDone, target: 'details' },
    { key: 'assessment', en: 'Annual assessment', ar: 'التقييم السنوي', done: f.assessmentDone, target: 'assessment' },
    ...f.requirements.filter((r) => !r.optional).map((r) => ({ key: r.key, en: r.en, ar: r.ar, done: r.done, target: 'requirements' as const })),
    ...(f.fee ? [{ key: 'fee', en: `Fee: ${f.fee.amount} ${f.fee.currency}`, ar: `الرسم: ${f.fee.amount} ${f.fee.currency}`, done: f.fee.paid, target: 'fee' as const }] : []),
  ];
  const optional: VenueCheck[] = f.requirements.filter((r) => r.optional).map((r) => ({ key: r.key, en: r.en, ar: r.ar, done: r.done, target: 'requirements' as const }));
  const remaining = required.filter((c) => !c.done).length;
  // The requirement steps' own count, not details or the fee. A package the Ministry holds or has accepted owes nothing more in this cycle.
  const requirementsRemaining = f.editable ? required.filter((c) => c.target === 'requirements' && !c.done).length : 0;
  return { required, optional, remaining, requirementsRemaining, canSubmit: f.editable && remaining === 0 };
}

/* The venue's next step left with the venue service (owner, 9 October 2026): a venue has no next step. */

/** The six-stage venue rail, drawn by the same component as the event rail. */
export function venueRailStages(f: VenuePackageFacts): { stage: number; stages: RailStage[] } {
  const returned = f.status === 'revision' || f.status === 'incomplete';
  const withMinistry = f.status === 'submitted' || f.status === 'accepted';
  const infrastructure = f.requirements.filter((r) => r.key !== VENUE_PAD_KEY && !r.optional);
  const infrastructureLeft = infrastructure.filter((r) => !r.done).length;
  const pad = f.requirements.find((r) => r.key === VENUE_PAD_KEY);
  // Once the Ministry has the package, everything before it is complete by definition -- a certified
  // venue never reads "Stage 1" because a field added after its certificate is empty.
  const done = withMinistry
    ? [true, true, true, true, true, f.status === 'accepted']
    : [f.detailsDone, f.assessmentDone, f.assessmentDone && infrastructure.length > 0 && infrastructureLeft === 0, Boolean(pad?.done), false, false];
  const first = done.findIndex((d) => !d);
  const stage = first < 0 ? done.length : first + 1;
  const k = (i: number): RailStage['k'] => (done[i] ? 'done' : i === first ? (returned && (i === 2 || i === 3) ? 'returned' : 'current') : 'todo');
  const status = VENUE_STATUS[f.status];
  const stages: RailStage[] = [
    { k: k(0), en: 'Venue profile', ar: 'ملف الموقع', metaEn: done[0] ? '' : 'Contact and map pin', metaAr: done[0] ? '' : 'بيانات الاتصال وعلامة الخريطة' },
    { k: k(1), en: 'Annual assessment', ar: 'التقييم السنوي',
      metaEn: f.assessmentDone && f.level ? `Level ${f.level} · Version ${f.assessmentVersion}` : 'Not yet complete',
      metaAr: f.assessmentDone && f.level ? `المستوى ${f.level} · النسخة ${f.assessmentVersion}` : 'لم يكتمل بعد' },
    { k: k(2), en: 'Infrastructure and access', ar: 'البنية والوصول',
      metaEn: done[2] ? '' : f.assessmentDone ? `${infrastructureLeft} remaining` : '',
      metaAr: done[2] ? '' : f.assessmentDone ? `${infrastructureLeft} متبقٍ` : '' },
    { k: k(3), en: 'AEDs', ar: 'أجهزة إزالة الرجفان', metaEn: '', metaAr: '' },
    { k: k(4), en: 'Review and submit', ar: 'المراجعة والتقديم',
      metaEn: withMinistry && f.submittedAt ? f.submittedAt.slice(0, 10) : returned ? 'Submit the updated package' : '',
      metaAr: withMinistry && f.submittedAt ? `⁦${f.submittedAt.slice(0, 10)}⁩` : returned ? 'قدّموا الملف المحدَّث' : '' },
    f.status === 'accepted'
      ? { k: 'done', en: 'Annual certificate', ar: 'الشهادة السنوية', metaEn: f.validUntil ? `Valid until ${f.validUntil}` : status.en, metaAr: f.validUntil ? `صالحة حتى ⁦${f.validUntil}⁩` : status.ar }
      : returned
        ? { k: 'done', en: 'Annual certificate', ar: 'الشهادة السنوية', metaEn: status.en, metaAr: status.ar }
        : { k: k(5), en: 'Annual certificate', ar: 'الشهادة السنوية', metaEn: 'Waiting for the Ministry', metaAr: 'بانتظار الوزارة' },
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
  if (input.status === 'submitted') return { ...venueStatusLabel('submitted'), tone: 'pending' };
  if (input.status === 'revision' || input.status === 'incomplete') return { ...venueStatusLabel(input.status), tone: 'pending' };
  if (input.validUntil && input.validUntil < input.today) return { en: `Certificate expired ${input.validUntil}`, ar: `انتهت الشهادة في ⁦${input.validUntil}⁩`, tone: 'bad' };
  if (input.validUntil) return { en: `Certificate valid until ${input.validUntil}`, ar: `الشهادة صالحة حتى ⁦${input.validUntil}⁩`, tone: 'done' };
  return input.status === 'draft' ? { ...venueStatusLabel('draft'), tone: 'muted' } : { en: 'No certificate yet', ar: 'لا شهادة بعد', tone: 'muted' };
}
