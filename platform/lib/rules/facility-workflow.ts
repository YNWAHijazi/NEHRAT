import type { NextStep, RailStage } from './rail';
import facilityJson from './data/facility.json';

/**
 * The PAD facility record in the format of the event and hosting-venue records (owner,
 * 9 October 2026): a one-page intake, then one record page. While the registration is
 * open the page is a vertical step path -- AEDs, responsible contact, cardiac emergency
 * response plan, review and register; once registered the same address is the page the
 * facility is managed from. Everything here is plain data in, plain data out: the page
 * reads the facts from the database and draws what these functions return.
 */

/** Whether the facility's category requires an AED, does not, or awaits a Ministry review (lib/facility-gis facilityAedStatus). */
export type FacilityAedRequirement = 'required' | 'notRequired' | 'review';

export interface FacilityRegistrationFacts {
  /** Coverage ended by the Ministry: the record is read-only. */
  archived: boolean;
  /** The facility's map pin is recorded and confirmed. */
  mapConfirmed: boolean;
  aedRequirement: FacilityAedRequirement;
  /** AEDs on the registry. */
  deviceCount: number;
  /** Registered AEDs not operational, or not accessible during operating hours. */
  devicesNotReady: number;
  /** The one responsible contact has a name or position, a telephone and an email. */
  contactComplete: boolean;
  /** A readiness confirmation has been recorded at least once -- the act that completed the registration. */
  confirmationRecorded: boolean;
  /** The latest readiness confirmation still matches the facility and AED details. */
  confirmationCurrent: boolean;
}

/** The four items the registration needs; the certificate's one gate. Keys predate the record page and stay. */
export type FacilityCheckKey = 'details' | 'devices' | 'persons' | 'confirmation';
export interface FacilityCheck { key: FacilityCheckKey; en: string; ar: string; done: boolean }

/** The AED item: none owed where the category does not require one, and every registered AED ready. */
export function facilityDevicesDone(f: FacilityRegistrationFacts): boolean {
  return (f.aedRequirement !== 'required' || f.deviceCount > 0) && f.devicesNotReady === 0;
}

export function facilityRegistrationChecks(f: FacilityRegistrationFacts): FacilityCheck[] {
  return [
    { key: 'details', en: 'Facility map', ar: 'خريطة المنشأة', done: f.mapConfirmed },
    { key: 'devices', en: 'AEDs recorded and available', ar: 'الأجهزة مسجّلة ومتاحة', done: facilityDevicesDone(f) },
    { key: 'persons', en: 'Responsible contact', ar: 'جهة الاتصال المسؤولة', done: f.contactComplete },
    { key: 'confirmation', en: 'Readiness confirmation', ar: 'تأكيد الجاهزية', done: f.confirmationCurrent },
  ];
}

/** Every item complete: the registration certificate issues. */
export function facilityChecksComplete(f: FacilityRegistrationFacts): boolean {
  return facilityRegistrationChecks(f).every((c) => c.done);
}

/**
 * Which page the record address shows. A facility is REGISTERED once its first readiness
 * confirmation is recorded -- the server records one only when every other item is
 * complete -- and it stays registered: relocating an AED or editing the details makes the
 * confirmation stale and withholds the certificate, but the facility is managed, not
 * registered again. An archived record is read on the management page, read-only.
 */
export function facilityRecordMode(f: FacilityRegistrationFacts): 'register' | 'manage' {
  return f.archived || f.confirmationRecorded ? 'manage' : 'register';
}

/** The record's status, in the header. The cardiac-arrest instrument prescribes no outcome labels; these are plain record states. */
export function facilityStatusLabel(f: FacilityRegistrationFacts): { en: string; ar: string } {
  if (f.archived) return { en: 'No longer covered', ar: 'لم تعد مشمولة' };
  if (facilityRecordMode(f) === 'register') return { en: 'Registration in progress', ar: 'التسجيل قيد الإنجاز' };
  return facilityChecksComplete(f) ? { en: 'Registered', ar: 'مُسجَّلة' } : { en: 'Registered · action needed', ar: 'مُسجَّلة · إجراء مطلوب' };
}

/* ---------------- the step path while the registration is open ---------------- */

export type FacilityStepKey = 'aeds' | 'contact' | 'plan' | 'review';
export interface FacilityStep {
  key: FacilityStepKey;
  /** The id the step's card carries; the same id is the section's on the management page. */
  anchor: string;
  en: string;
  ar: string;
  state: 'complete' | 'pending' | 'final';
  stateEn: string;
  stateAr: string;
}

const COMPLETE = { stateEn: 'Complete', stateAr: 'مكتمل' };
const PENDING = { stateEn: 'Pending', stateAr: 'قيد الانتظار' };

/** What the AED step's state line says while it is open. */
function aedPending(f: FacilityRegistrationFacts): { stateEn: string; stateAr: string } {
  if (f.devicesNotReady > 0) return { stateEn: 'An AED is not ready', stateAr: 'جهاز غير جاهز' };
  if (f.aedRequirement === 'required' && f.deviceCount === 0) return { stateEn: 'No AED registered', stateAr: 'لم يُسجَّل أي جهاز' };
  return PENDING;
}

/** The four steps, in the order the owner set: AEDs, responsible contact, response plan, review and register. */
export function facilityRegistrationSteps(f: FacilityRegistrationFacts): FacilityStep[] {
  const devices = facilityDevicesDone(f);
  return [
    { key: 'aeds', anchor: 'aeds', en: 'AEDs', ar: 'أجهزة إزالة الرجفان', state: devices ? 'complete' : 'pending', ...(devices ? COMPLETE : aedPending(f)) },
    { key: 'contact', anchor: 'contact', en: 'Responsible contact', ar: 'جهة الاتصال المسؤولة', state: f.contactComplete ? 'complete' : 'pending', ...(f.contactComplete ? COMPLETE : PENDING) },
    { key: 'plan', anchor: 'plan', en: facilityJson.planTitle.en, ar: facilityJson.planTitle.ar, state: f.confirmationCurrent ? 'complete' : 'pending', ...(f.confirmationCurrent ? COMPLETE : PENDING) },
    { key: 'review', anchor: 'final-review', en: 'Review and register', ar: 'المراجعة والتسجيل', state: 'final', stateEn: '', stateAr: '' },
  ];
}

/** The step the page opens on: the one a redirect named, else the first still open, else the review. */
export function facilityInitialStep(f: FacilityRegistrationFacts, requested: string | null | undefined): FacilityStepKey {
  const steps = facilityRegistrationSteps(f);
  const named = steps.find((s) => s.key === requested);
  if (named) return named.key;
  return (steps.find((s) => s.state === 'pending') ?? steps[steps.length - 1]!).key;
}

/**
 * The items still open before the registration can be completed, for the review step's
 * list -- every check but the confirmation itself, which is that step's own act.
 */
export function facilityRemainingBeforeConfirmation(f: FacilityRegistrationFacts): FacilityCheck[] {
  return facilityRegistrationChecks(f).filter((c) => c.key !== 'confirmation' && !c.done);
}

/**
 * The one task the record leads with; null when nothing is owed. href is an anchor on the
 * record page ('#aeds', '#contact', '#plan') or 'profile', the details edit screen.
 */
export function facilityNextAction(f: FacilityRegistrationFacts): NextStep | null {
  if (f.archived) return null;
  const managing = facilityRecordMode(f) === 'manage';
  if (!f.mapConfirmed) {
    return { kind: 'details', href: 'profile', tone: 'accent',
      titleEn: 'Confirm the facility map pin', titleAr: 'تأكيد موقع المنشأة على الخريطة',
      bodyEn: 'Edit the facility details and confirm the pin on the map.', bodyAr: 'عدّلوا تفاصيل المنشأة وأكّدوا العلامة على الخريطة.',
      buttonEn: 'Edit the facility details', buttonAr: 'تعديل تفاصيل المنشأة' };
  }
  if (!facilityDevicesDone(f)) {
    const notReady = f.devicesNotReady > 0;
    return { kind: 'aeds', href: '#aeds', tone: 'accent',
      titleEn: notReady ? 'Update the AED status' : 'Register the facility’s AEDs', titleAr: notReady ? 'تحديث حالة الأجهزة' : 'تسجيل أجهزة المنشأة',
      bodyEn: notReady ? 'Every registered AED must be operational and accessible during operating hours.' : 'Record each AED with its exact location. The facility representative confirms each record.',
      bodyAr: notReady ? 'يجب أن يكون كل جهاز مسجَّل صالحاً للتشغيل ومتاحاً خلال ساعات العمل.' : 'سجّلوا كل جهاز مع موقعه الدقيق. ويؤكد ممثل المنشأة كل سجل.',
      buttonEn: 'Open the AEDs', buttonAr: 'فتح الأجهزة' };
  }
  if (!f.contactComplete) {
    return { kind: 'contact', href: '#contact', tone: 'accent',
      titleEn: 'Add the responsible contact', titleAr: 'إضافة جهة الاتصال المسؤولة',
      bodyEn: 'One named person or position, with a telephone and an email.', bodyAr: 'شخص واحد أو مسمى وظيفي واحد، مع رقم هاتف وبريد إلكتروني.',
      buttonEn: 'Open the responsible contact', buttonAr: 'فتح جهة الاتصال المسؤولة' };
  }
  if (!f.confirmationCurrent) {
    return managing
      ? { kind: 'confirmation', href: '#plan', tone: 'accent',
          titleEn: 'Confirm the updated response plan', titleAr: 'تأكيد خطة الاستجابة المحدّثة',
          bodyEn: 'The facility or AED details changed after the last readiness confirmation. The certificate is withheld until it is recorded again.',
          bodyAr: 'تغيّرت بيانات المنشأة أو الأجهزة بعد آخر تأكيد للجاهزية. وتُحجب الشهادة إلى أن يُسجَّل التأكيد مجدداً.',
          buttonEn: 'Open the response plan', buttonAr: 'فتح خطة الاستجابة' }
      : { kind: 'confirmation', href: '#plan', tone: 'brand',
          titleEn: 'Confirm the response plan and register', titleAr: 'تأكيد خطة الاستجابة والتسجيل',
          bodyEn: 'Confirm the readiness arrangements in the plan, then complete the registration in the last step.',
          bodyAr: 'أكّدوا ترتيبات الجاهزية في الخطة، ثم أكملوا التسجيل في الخطوة الأخيرة.',
          buttonEn: 'Open the response plan', buttonAr: 'فتح خطة الاستجابة' };
  }
  return null;
}

/** The registration rail, drawn by the same component as the event and venue rails. */
export function facilityRailStages(f: FacilityRegistrationFacts): { stage: number; stages: RailStage[] } {
  const complete = facilityChecksComplete(f);
  const done = [f.mapConfirmed, facilityDevicesDone(f), f.contactComplete, f.confirmationCurrent, complete];
  const first = done.findIndex((d) => !d);
  const stage = first < 0 ? done.length : first + 1;
  const k = (i: number): RailStage['k'] => (done[i] ? 'done' : i === first ? 'current' : 'todo');
  const aedsMeta = f.deviceCount > 0
    ? { metaEn: `${f.deviceCount} registered`, metaAr: `${f.deviceCount} مسجّل` }
    : f.aedRequirement === 'required' ? { metaEn: 'An AED is required', metaAr: 'يلزم توفير جهاز' }
      : f.aedRequirement === 'review' ? { metaEn: 'Ministry review', metaAr: 'مراجعة الوزارة' } : { metaEn: '', metaAr: '' };
  return {
    stage,
    stages: [
      { k: k(0), en: 'Facility profile', ar: 'ملف المنشأة', metaEn: done[0] ? '' : 'Map pin', metaAr: done[0] ? '' : 'العلامة على الخريطة' },
      { k: k(1), en: 'AEDs', ar: 'أجهزة إزالة الرجفان', ...aedsMeta },
      { k: k(2), en: 'Responsible contact', ar: 'جهة الاتصال المسؤولة', metaEn: '', metaAr: '' },
      { k: k(3), en: 'Response plan', ar: 'خطة الاستجابة', metaEn: '', metaAr: '' },
      { k: k(4), en: 'Registration certificate', ar: 'شهادة التسجيل', metaEn: complete ? 'Issued' : 'Issued when every step is complete', metaAr: complete ? 'صادرة' : 'تصدر عند اكتمال كل الخطوات' },
    ],
  };
}
