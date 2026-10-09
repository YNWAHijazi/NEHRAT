import type { NextStep, RailStage } from './rail';
import facilityJson from './data/facility.json';
import {
  siteAedsDone,
  siteSubmissionSummary,
  sitePlanComplete,
  siteStatusLabel,
  siteSubmitBlockers,
  type SiteStatusKey,
  type SiteSubmissionFacts,
} from './site';

/**
 * THE FACILITY/SITE RECORD (owner decision, 9 October 2026; latest revision, sections 1-14):
 * a one-page intake, then one record page. While the registration is in preparation the page
 * is a vertical step path -- basic site infrastructure, AEDs, the cardiac emergency response
 * plan, the readiness confirmation, supporting evidence, review and submit -- and
 * "Submit Facility/Site registration to MOPH" ends it. From the first submission the same
 * address is the site's dashboard, with tabs. Plain data in, plain data out: the page reads
 * the facts from the database and draws what these functions return.
 */

/** Whether the facility's category requires an AED, does not, or awaits a Ministry review (lib/facility-gis facilityAedStatus). */
export type FacilityAedRequirement = 'required' | 'notRequired' | 'review';

export interface FacilityRegistrationFacts {
  /** Coverage ended by the Ministry: the record is read-only. */
  archived: boolean;
  /** The site's map pin is recorded and confirmed. */
  mapConfirmed: boolean;
  aedRequirement: FacilityAedRequirement;
  /** AEDs on the registry. */
  deviceCount: number;
  /** Registered AEDs not operational, or not accessible during operating hours. */
  devicesNotReady: number;
  /** The one responsible contact has a name or position, a telephone and an email. */
  contactComplete: boolean;
  /** A readiness confirmation has been recorded at least once. */
  confirmationRecorded: boolean;
  /** The latest readiness confirmation still matches the site and AED details. */
  confirmationCurrent: boolean;
  /** Name, operating organization, address, municipality, hours, telephone, email, and the capacity where the category needs it. */
  profileComplete: boolean;
  /** The main EMS entrance and the EMS number the site uses. */
  emsAccessComplete: boolean;
  /** Anything recorded under basic site infrastructure, or a layout map. Optional. */
  infrastructureRecorded: boolean;
  /** Supporting evidence documents. Optional. */
  documentCount: number;
  /** AED photographs. Optional. */
  photoCount: number;
  /** The capacity category does not reach the recorded capacity. */
  outsideCategory: boolean;
  /** Submissions to the Ministry, every version. */
  submissionCount: number;
  /** The site status (lib/rules/site.ts siteStatus). */
  status: SiteStatusKey;
  /** The Ministry has accepted some version: the record is the site's dashboard from then on. */
  everAccepted: boolean;
  /** With the Ministry and not yet accepted: read-only, as a filed event is (lib/rules/site.ts siteRecordLocked). */
  locked: boolean;
}

/** The facts the review page and its blockers read. */
export function submissionFacts(f: FacilityRegistrationFacts): SiteSubmissionFacts {
  return {
    profileComplete: f.profileComplete, mapConfirmed: f.mapConfirmed, contactComplete: f.contactComplete,
    emsAccessComplete: f.emsAccessComplete, aedRequired: f.aedRequirement === 'required',
    deviceCount: f.deviceCount, devicesNotReady: f.devicesNotReady,
    confirmationRecorded: f.confirmationRecorded, confirmationCurrent: f.confirmationCurrent,
    infrastructureRecorded: f.infrastructureRecorded, documentCount: f.documentCount, photoCount: f.photoCount,
    outsideCategory: f.outsideCategory,
  };
}

/** The AED item: none owed where the category does not require one, and every registered AED ready. */
export function facilityDevicesDone(f: FacilityRegistrationFacts): boolean {
  return siteAedsDone(submissionFacts(f));
}

/** The readiness confirmation can be recorded once the map, the contact and the required AEDs are complete. */
export function facilityConfirmationReady(f: FacilityRegistrationFacts): boolean {
  return f.mapConfirmed && f.contactComplete && facilityDevicesDone(f);
}

/** Everything the review page needs is complete: the submit button is live. */
export function facilityReadyToSubmit(f: FacilityRegistrationFacts): boolean {
  return siteSubmitBlockers(submissionFacts(f)).length === 0;
}

/**
 * Which page the record address shows -- the event's journey, screen for screen (owner,
 * 9 October 2026): the record page with its step path while the registration is prepared,
 * submitted, under review or returned for information; the site's dashboard once the
 * Ministry has accepted it -- and it stays there: a later change is maintenance, not a new
 * registration (revision section 14). An archived record is read on the dashboard.
 */
export function facilityRecordMode(f: FacilityRegistrationFacts): 'register' | 'manage' {
  return f.archived || f.everAccepted ? 'manage' : 'register';
}

/** The record's status, in the header: the site status, product-defined (revision section 11). */
export function facilityStatusLabel(f: FacilityRegistrationFacts): { en: string; ar: string } {
  return siteStatusLabel(f.status);
}

/* ---------------- the step path while the registration is in preparation ---------------- */

export type FacilityStepKey = 'infrastructure' | 'aeds' | 'plan' | 'confirmation' | 'evidence' | 'review';
export interface FacilityStep {
  key: FacilityStepKey;
  /** The id the step's card carries. */
  anchor: string;
  en: string;
  ar: string;
  state: 'complete' | 'pending' | 'notProvided' | 'final';
  /** Optional steps are never a blocker (revision sections 3 and 7). */
  optional: boolean;
  stateEn: string;
  stateAr: string;
}

const COMPLETE = { stateEn: 'Complete', stateAr: 'مكتمل' };
const PENDING = { stateEn: 'Pending', stateAr: 'قيد الانتظار' };
const OPTIONAL = { stateEn: 'Optional', stateAr: 'اختياري' };

/** What the AED step's state line says while it is open. */
function aedPending(f: FacilityRegistrationFacts): { stateEn: string; stateAr: string } {
  if (f.devicesNotReady > 0) return { stateEn: 'An AED is not ready', stateAr: 'جهاز غير جاهز' };
  if (f.aedRequirement === 'required' && f.deviceCount === 0) return { stateEn: 'No AED registered', stateAr: 'لم يُسجَّل أي جهاز' };
  return PENDING;
}

/**
 * The six steps: the required ones first (AEDs, plan, readiness confirmation), then the two the
 * revision makes optional (section 3: infrastructure "should not create new regulatory
 * blockers"; section 7: "Supporting evidence -- optional"), then review and submit. The
 * revision numbers infrastructure before the AEDs; its own end-to-end flow (section 15) runs
 * AEDs, plan, confirmation, then the optional uploads -- and an event's record lists its
 * recommended steps last, so an optional step never sits above a required one (owner, 9 October 2026).
 */
export function facilityRegistrationSteps(f: FacilityRegistrationFacts): FacilityStep[] {
  const s = facilityJson.site.steps;
  const devices = facilityDevicesDone(f);
  const plan = sitePlanComplete(submissionFacts(f));
  const evidence = f.documentCount + f.photoCount > 0;
  return [
    { key: 'aeds', anchor: 'aeds', en: s.aeds.en, ar: s.aeds.ar, optional: false,
      ...(devices ? { state: 'complete' as const, ...COMPLETE } : { state: 'pending' as const, ...aedPending(f) }) },
    { key: 'plan', anchor: 'plan', en: facilityJson.planTitle.en, ar: facilityJson.planTitle.ar, optional: false,
      ...(plan ? { state: 'complete' as const, ...COMPLETE } : { state: 'pending' as const, ...PENDING }) },
    { key: 'confirmation', anchor: 'confirmation-step', en: s.confirmation.en, ar: s.confirmation.ar, optional: false,
      ...(f.confirmationCurrent ? { state: 'complete' as const, ...COMPLETE }
        : f.confirmationRecorded ? { state: 'pending' as const, stateEn: 'To be confirmed again', stateAr: 'يلزم تأكيدها مجدداً' }
          : { state: 'pending' as const, ...PENDING }) },
    { key: 'infrastructure', anchor: 'infrastructure', en: s.infrastructure.en, ar: s.infrastructure.ar, optional: true,
      ...(f.infrastructureRecorded ? { state: 'complete' as const, ...COMPLETE } : { state: 'notProvided' as const, ...OPTIONAL }) },
    { key: 'evidence', anchor: 'evidence', en: s.evidence.en, ar: s.evidence.ar, optional: true,
      ...(evidence ? { state: 'complete' as const, ...COMPLETE } : { state: 'notProvided' as const, ...OPTIONAL }) },
    { key: 'review', anchor: 'final-review', en: s.review.en, ar: s.review.ar, optional: false, state: 'final', stateEn: '', stateAr: '' },
  ];
}

/**
 * The step the page opens on: the one a redirect named; otherwise the first required step
 * still open, else the review.
 */
export function facilityInitialStep(f: FacilityRegistrationFacts, requested: string | null | undefined): FacilityStepKey {
  const steps = facilityRegistrationSteps(f);
  const named = steps.find((s) => s.key === requested);
  if (named) return named.key;
  return (steps.find((s) => s.state === 'pending') ?? steps[steps.length - 1]!).key;
}

/**
 * The one task the record leads with; null when nothing is owed. href is an anchor on the
 * record page ('#aeds'), a tab of the dashboard ('?tab=history#requests'), or 'profile' /
 * 'profile#contact', the details edit screen.
 */
export function facilityNextAction(f: FacilityRegistrationFacts): NextStep | null {
  if (f.archived) return null;
  if (facilityRecordMode(f) === 'register') {
    // With the Ministry: the record page shows the under-review card instead (as the event's does).
    if (f.locked) return null;
    if (f.status === 'informationRequired') {
      return { kind: 'information', href: '#final-review', tone: 'accent',
        titleEn: 'Answer the Ministry’s request', titleAr: 'الرد على طلب الوزارة',
        bodyEn: 'The Ministry asked for more information or a correction. The record is open again: update it, then submit the revised registration.',
        bodyAr: 'طلبت الوزارة معلومات إضافية أو تصحيحاً. السجل مفتوح مجدداً: حدّثوه ثم قدّموا التسجيل المعدَّل.',
        buttonEn: 'Open the review', buttonAr: 'فتح المراجعة' };
    }
    if (!f.mapConfirmed || !f.profileComplete || f.outsideCategory) {
      return { kind: 'details', href: 'profile', tone: 'accent',
        titleEn: 'Complete the site profile', titleAr: 'إكمال ملف الموقع',
        bodyEn: 'Edit the site details: the operating organization, the capacity where the category needs it, and the pin on the map.',
        bodyAr: 'عدّلوا تفاصيل الموقع: الجهة المشغّلة، والسعة حيث تتطلبها الفئة، والعلامة على الخريطة.',
        buttonEn: 'Edit the site details', buttonAr: 'تعديل تفاصيل الموقع' };
    }
    if (!facilityDevicesDone(f)) return aedsStep(f, '#aeds');
    if (!f.contactComplete || !f.emsAccessComplete) {
      return { kind: 'contact', href: 'profile#contact', tone: 'accent',
        titleEn: 'Complete the contact and EMS access', titleAr: 'إكمال جهة الاتصال ووصول خدمات الطوارئ الطبية',
        bodyEn: 'One responsible person or position with a telephone and an email, the main EMS entrance and the EMS number the site uses.',
        bodyAr: 'شخص أو مسمى وظيفي مسؤول مع رقم هاتف وبريد إلكتروني، والمدخل الرئيسي لخدمات الطوارئ الطبية ورقمها المعتمد لدى الموقع.',
        buttonEn: 'Edit the site details', buttonAr: 'تعديل تفاصيل الموقع' };
    }
    if (!f.confirmationCurrent) {
      return { kind: 'confirmation', href: '#confirmation-step', tone: 'accent',
        titleEn: 'Record the readiness confirmation', titleAr: 'تسجيل تأكيد الجاهزية',
        bodyEn: 'Confirm the six readiness arrangements and the date of the latest drill. The facility representative signs it.',
        bodyAr: 'أكّدوا ترتيبات الجاهزية الستة وتاريخ آخر تمرين. ويوقّعه ممثل المنشأة.',
        buttonEn: 'Open the readiness confirmation', buttonAr: 'فتح تأكيد الجاهزية' };
    }
    return { kind: 'submit', href: '#final-review', tone: 'brand',
      titleEn: 'Review and submit the registration', titleAr: 'مراجعة التسجيل وتقديمه',
      bodyEn: 'Every required item is complete. Check the summary, then submit the registration to the Ministry.',
      bodyAr: 'اكتملت كل البنود المطلوبة. راجعوا الملخص ثم قدّموا التسجيل إلى الوزارة.',
      buttonEn: 'Open the review', buttonAr: 'فتح المراجعة' };
  }
  if (f.status === 'informationRequired') {
    return { kind: 'information', href: '?tab=overview#resubmit', tone: 'accent',
      titleEn: 'Answer the Ministry’s request', titleAr: 'الرد على طلب الوزارة',
      bodyEn: 'The Ministry asked for more information or a correction. Update the record, then submit the updated registration.',
      bodyAr: 'طلبت الوزارة معلومات إضافية أو تصحيحاً. حدّثوا السجل ثم قدّموا التسجيل المحدَّث.',
      buttonEn: 'Open the request', buttonAr: 'فتح الطلب' };
  }
  if (f.status === 'correctiveActionRequired') {
    return { kind: 'corrective', href: '?tab=history#requests', tone: 'accent',
      titleEn: 'Answer the corrective action', titleAr: 'الرد على الإجراء التصحيحي',
      bodyEn: 'Correct the deficiency the Ministry named, then record what was done with any evidence. The Ministry closes the action once it has verified it.',
      bodyAr: 'صحّحوا النقص الذي حدّدته الوزارة، ثم سجّلوا ما تم مع أي دليل. وتُقفل الوزارة الإجراء بعد التحقق منه.',
      buttonEn: 'Open the corrective action', buttonAr: 'فتح الإجراء التصحيحي' };
  }
  if (!facilityDevicesDone(f)) return aedsStep(f, '?tab=aeds');
  if (!f.confirmationCurrent) {
    return { kind: 'confirmation', href: '?tab=readiness#confirmation', tone: 'accent',
      titleEn: 'Confirm readiness again', titleAr: 'تأكيد الجاهزية مجدداً',
      bodyEn: 'The site or AED details changed after the last readiness confirmation. Record it again.',
      bodyAr: 'تغيّرت بيانات الموقع أو الأجهزة بعد آخر تأكيد للجاهزية. سجّلوه مجدداً.',
      buttonEn: 'Open the readiness confirmation', buttonAr: 'فتح تأكيد الجاهزية' };
  }
  return null;
}

function aedsStep(f: FacilityRegistrationFacts, href: string): NextStep {
  const notReady = f.devicesNotReady > 0;
  return { kind: 'aeds', href, tone: 'accent',
    titleEn: notReady ? 'Update the AED status' : 'Register the site’s AEDs', titleAr: notReady ? 'تحديث حالة الأجهزة' : 'تسجيل أجهزة الموقع',
    bodyEn: notReady ? 'Every registered AED must be operational and accessible during operating hours.' : 'Record each AED with its exact location. The facility representative confirms each record.',
    bodyAr: notReady ? 'يجب أن يكون كل جهاز مسجَّل صالحاً للتشغيل ومتاحاً خلال ساعات العمل.' : 'سجّلوا كل جهاز مع موقعه الدقيق. ويؤكد ممثل المنشأة كل سجل.',
    buttonEn: 'Open the AEDs', buttonAr: 'فتح الأجهزة' };
}

/**
 * The registration rail, the event's stages for a site (PAD rules: no assessment and no
 * level; the post-event report is an event's, and the site's annual item is the drill):
 * site details, requirements, submit, Ministry review, ongoing readiness.
 */
export function facilityRailStages(f: FacilityRegistrationFacts): { stage: number; stages: RailStage[] } {
  const lines = siteSubmitBlockers(submissionFacts(f));
  const required = siteSubmissionSummaryCount(f);
  const complete = required.total - lines.length;
  const submitted = f.submissionCount > 0;
  const returned = f.status === 'informationRequired';
  const accepted = f.everAccepted;
  const stage = !submitted || returned ? 2 : !accepted ? 4 : 5;
  const status = siteStatusLabel(f.status);
  return {
    stage,
    stages: [
      { k: 'done', en: 'Site details', ar: 'بيانات الموقع', metaEn: '', metaAr: '' },
      stage === 2
        ? { k: returned ? 'returned' : 'current', en: 'Requirements', ar: 'المتطلبات', metaEn: `${complete} of ${required.total} complete`, metaAr: `اكتمل ${complete} من ${required.total}` }
        : { k: 'done', en: 'Requirements', ar: 'المتطلبات', metaEn: '', metaAr: '' },
      submitted && !returned
        ? { k: 'done', en: 'Submitted', ar: 'التقديم', metaEn: `Version ${f.submissionCount}`, metaAr: `النسخة ${f.submissionCount}` }
        : { k: 'todo', en: 'Submit', ar: 'التقديم', metaEn: '', metaAr: '' },
      accepted
        ? { k: 'done', en: 'Ministry review', ar: 'مراجعة الوزارة', metaEn: status.en, metaAr: status.ar }
        : { k: submitted && !returned ? 'current' : 'todo', en: 'Ministry review', ar: 'مراجعة الوزارة', metaEn: submitted && !returned ? 'Waiting for the Ministry' : 'After submission', metaAr: submitted && !returned ? 'بانتظار الوزارة' : 'بعد التقديم' },
      { k: accepted ? 'current' : 'todo', en: 'Ongoing readiness', ar: 'الجاهزية المستمرة', metaEn: 'The annual drill; no annual re-registration', metaAr: 'التمرين السنوي؛ دون إعادة تسجيل سنوية' },
    ],
  };
}

/** The required lines on the review page, for the rail's "n of m complete". */
function siteSubmissionSummaryCount(f: FacilityRegistrationFacts): { total: number } {
  return { total: siteSubmissionSummary(submissionFacts(f)).filter((l) => !l.optional).length };
}
