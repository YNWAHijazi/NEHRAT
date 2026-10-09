import type { NextStep, RailStage } from './rail';
import facilityJson from './data/facility.json';
import {
  siteAedsDone,
  siteMaySubmit,
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
 * Which page the record address shows. The site is in preparation until it is first
 * submitted to the Ministry; from then on it is managed from its dashboard -- and stays
 * there: a later change is maintenance, not a new registration (revision section 14). An
 * archived record is read on the dashboard, read-only.
 */
export function facilityRecordMode(f: FacilityRegistrationFacts): 'register' | 'manage' {
  return f.archived || f.submissionCount > 0 ? 'manage' : 'register';
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

/** The six steps, in the revision's order: infrastructure, AEDs, plan, readiness confirmation, evidence, review and submit. */
export function facilityRegistrationSteps(f: FacilityRegistrationFacts): FacilityStep[] {
  const s = facilityJson.site.steps;
  const devices = facilityDevicesDone(f);
  const plan = sitePlanComplete(submissionFacts(f));
  const evidence = f.documentCount + f.photoCount > 0;
  return [
    { key: 'infrastructure', anchor: 'infrastructure', en: s.infrastructure.en, ar: s.infrastructure.ar, optional: true,
      ...(f.infrastructureRecorded ? { state: 'complete' as const, ...COMPLETE } : { state: 'notProvided' as const, ...OPTIONAL }) },
    { key: 'aeds', anchor: 'aeds', en: s.aeds.en, ar: s.aeds.ar, optional: false,
      ...(devices ? { state: 'complete' as const, ...COMPLETE } : { state: 'pending' as const, ...aedPending(f) }) },
    { key: 'plan', anchor: 'plan', en: facilityJson.planTitle.en, ar: facilityJson.planTitle.ar, optional: false,
      ...(plan ? { state: 'complete' as const, ...COMPLETE } : { state: 'pending' as const, ...PENDING }) },
    { key: 'confirmation', anchor: 'confirmation-step', en: s.confirmation.en, ar: s.confirmation.ar, optional: false,
      ...(f.confirmationCurrent ? { state: 'complete' as const, ...COMPLETE }
        : f.confirmationRecorded ? { state: 'pending' as const, stateEn: 'To be confirmed again', stateAr: 'يلزم تأكيدها مجدداً' }
          : { state: 'pending' as const, ...PENDING }) },
    { key: 'evidence', anchor: 'evidence', en: s.evidence.en, ar: s.evidence.ar, optional: true,
      ...(evidence ? { state: 'complete' as const, ...COMPLETE } : { state: 'notProvided' as const, ...OPTIONAL }) },
    { key: 'review', anchor: 'final-review', en: s.review.en, ar: s.review.ar, optional: false, state: 'final', stateEn: '', stateAr: '' },
  ];
}

/**
 * The step the page opens on: the one a redirect named; a new record on its first step;
 * otherwise the first required step still open, else the review.
 */
export function facilityInitialStep(f: FacilityRegistrationFacts, requested: string | null | undefined): FacilityStepKey {
  const steps = facilityRegistrationSteps(f);
  const named = steps.find((s) => s.key === requested);
  if (named) return named.key;
  if (!f.infrastructureRecorded && f.deviceCount === 0 && !f.confirmationRecorded) return 'infrastructure';
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

/** The registration rail, drawn by the same component as the event rail. */
export function facilityRailStages(f: FacilityRegistrationFacts): { stage: number; stages: RailStage[] } {
  const facts = submissionFacts(f);
  const done = [f.profileComplete && f.mapConfirmed && f.contactComplete && f.emsAccessComplete, facilityDevicesDone(f), sitePlanComplete(facts), f.confirmationCurrent, f.submissionCount > 0];
  const first = done.findIndex((d) => !d);
  const stage = first < 0 ? done.length : first + 1;
  const k = (i: number): RailStage['k'] => (done[i] ? 'done' : i === first ? 'current' : 'todo');
  const aedsMeta = f.deviceCount > 0
    ? { metaEn: `${f.deviceCount} registered`, metaAr: `${f.deviceCount} مسجّل` }
    : f.aedRequirement === 'required' ? { metaEn: 'An AED is required', metaAr: 'يلزم توفير جهاز' }
      : f.aedRequirement === 'review' ? { metaEn: 'Ministry review', metaAr: 'مراجعة الوزارة' } : { metaEn: '', metaAr: '' };
  const submittable = siteMaySubmit(f.status);
  return {
    stage,
    stages: [
      { k: k(0), en: 'Site profile', ar: 'ملف الموقع', metaEn: '', metaAr: '' },
      { k: k(1), en: 'AEDs', ar: 'أجهزة إزالة الرجفان', ...aedsMeta },
      { k: k(2), en: 'Response plan', ar: 'خطة الاستجابة', metaEn: '', metaAr: '' },
      { k: k(3), en: 'Readiness confirmation', ar: 'تأكيد الجاهزية', metaEn: '', metaAr: '' },
      { k: k(4), en: 'Submitted to the Ministry', ar: 'مقدَّم إلى الوزارة', metaEn: submittable ? 'Reviewed by the Ministry once submitted' : '', metaAr: submittable ? 'تراجعه الوزارة بعد تقديمه' : '' },
    ],
  };
}
