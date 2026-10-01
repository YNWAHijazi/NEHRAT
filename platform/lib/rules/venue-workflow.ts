import { requirementsForLevel, type RequirementRow } from './requirements';
import type { Level } from './types';
import type { NextStep, RailStage } from './rail';
import ministryJson from './data/ministry.json';
/** draft and submitted are internal states; revision, incomplete and accepted carry the
 *  Ministry's recorded outcome, so the operator is told the outcome that was recorded. */
export type VenuePackageStatus = 'draft' | 'submitted' | 'revision' | 'incomplete' | 'accepted';
export type VenueAnswer = Record<string, string>;
export type VenueAnswers = Record<string, VenueAnswer>;
export type VenueField = { key: string; en: string; ar: string; source?: 'organizer' | 'director' | 'ems' | 'author' };
const f = (key:string,en:string,ar:string,source?:VenueField['source']):VenueField => ({key,en,ar,...(source?{source}:{})});
const FIELDS: Record<number, VenueField[]> = {
  1:[f('name','Contact name','اسم جهة الاتصال','organizer'),f('phone','Phone number','رقم الهاتف','organizer')],
  3:[f('name','Medical Director name','اسم المدير الطبي','director'),f('license','Medical licence number','رقم ترخيص الطبيب','director'),f('phone','Phone number','رقم الهاتف','director')],
  4:[f('team','First-aid staffing','أفراد فريق الإسعافات الأولية'),f('coverage','Where and when is the team available?','أين ومتى يتوفر الفريق؟')],
  5:[f('agency','EMS agency','جهة الإسعاف','ems'),f('teams','Team numbers and staffing','عدد الفرق وأفرادها'),f('contact','EMS contact','جهة الاتصال بالإسعاف','ems')],
  6:[f('location','Treatment post location','موقع نقطة العلاج'),f('staff','Staff and opening hours','العاملون وساعات العمل')],
  7:[f('agency','EMS agency','جهة الإسعاف','ems'),f('phone','EMS contact number','رقم الاتصال بالإسعاف','ems'),f('arrangements','Ambulance coverage and transport arrangements','التغطية الإسعافية وترتيبات النقل')],
  8:[f('location','AED locations','مواقع أجهزة إزالة الرجفان'),f('responders','Trained responders and how to reach them','المستجيبون المدرّبون وكيفية الاتصال بهم')],
  9:[f('supplies','Available supplies and storage locations','المستلزمات المتاحة وأماكن حفظها'),f('responsible','Who checks the supplies?','من يتفقّد المستلزمات؟')],
  10:[f('entrance','Emergency vehicle entrance','مدخل مركبات الطوارئ'),f('access','How is access kept clear?','كيف يُحافظ على خلوّ طريق الدخول؟')],
  11:[f('route','Patient access and removal route','مسار الوصول إلى المريض ونقله'),f('support','Who helps move patients safely?','من يساعد في نقل المرضى بأمان؟')],
  12:[f('hospital','Receiving hospital or emergency department','المستشفى أو قسم الطوارئ المستقبل'),f('contact','Contact details and coordination','بيانات الاتصال والتنسيق')],
  14:[f('channel','Main communication method','وسيلة الاتصال الرئيسية'),f('backup','Backup if it fails','البديل عند تعطلها')],
  15:[f('lead','Medical command lead','مسؤول القيادة الطبية','director'),f('contact','How will the team report medical issues to you?','كيف يبلّغكم الفريق بالمشكلات الطبية؟')],
  16:[f('steps','What happens in a major emergency?','ما الخطوات عند حدوث طارئ كبير؟'),f('authority','Who calls for extra help or stops activities?','من يطلب دعماً إضافياً أو يوقف الأنشطة؟')],
  17:[f('insurer','Insurer and policy number','شركة التأمين ورقم البوليصة'),f('coverage','Who is covered and for which dates?','من تشملهم التغطية وما مدتها؟')],
  18:[f('procedure','How will providers record care and hand over to EMS? Do not enter patient details.','كيف توثّق الجهات الرعاية وتسلّم المرضى للإسعاف؟ لا تدخلوا بيانات المرضى.')],
  2:[f('preparedBy','Prepared by','أعدّها','author'),],
  20:[f('agencies','EMS agency','جهة الإسعاف','author')],
};
export type VenueEditor = 'organizer' | 'ems' | 'director';
/** Revised Annex B plus the owner's assignment of clinical entry to medical partners. */
export function venueRequirementEditors(n:number,level:Level):VenueEditor[] {
 if(n===1||n===3||(n===7&&level===1))return []; // Derived contact / accepted licensed appointment.
 if(n===10||n===17)return ['organizer'];
 if(n===15)return ['director'];
 if(n===20)return ['ems']; // Each participating EMS agency signs its own declaration.
 if(n===2)return ['ems','director'];
 if(level===1 && [4,7,9,11,14,16].includes(n))return ['organizer','ems','director'];
 return ['ems','director'];
}
export interface VenueRequirement extends RequirementRow { fields: VenueField[]; optional: boolean; fileRequired: boolean; done: boolean }
/** Routine-session readiness only. Actual post-event reports stay attached to their events. */
export function venueRequirements(level:Level, answers:VenueAnswers, files:ReadonlySet<string>):VenueRequirement[] {
 return requirementsForLevel(level).filter(r=>r.n!==19).map(r=>({ ...r, fields:venueFieldsForLevel(r.n,level), optional:(r.n===2&&level===2)||(r.n===6&&level===2)||(r.n===8&&level===1),
 fileRequired:[2,17,20].includes(r.n), done: venueFieldsForLevel(r.n,level).every(f=>Boolean(answers[String(r.n)]?.[f.key]?.trim())) && (![2,17,20].includes(r.n)||files.has(String(r.n))) }));
}
export function venuePackageEditable(status:VenuePackageStatus, archived:boolean) { return !archived && (status==='draft'||status==='revision'||status==='incomplete'); }
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

/** Contact and acceptance are managed once, in Medical team. */
export function venueFieldsForLevel(requirement:number,level:Level):VenueField[] {
 const fields=FIELDS[requirement]??[];
 return requirement===7&&level===1?fields.filter(f=>f.key!=='arrangements'):fields;
}
export function venueRequirementIsClinical(requirement:number,level:Level) {
 return !venueRequirementEditors(requirement,level).includes('organizer') && ![1,3].includes(requirement) && !(requirement===7&&level===1);
}
export function venueLocalEmsContactApplies(level:Level|null,hasEmsInvitation:boolean) { return level===1&&!hasEmsInvitation; }


/* ---------------- the venue workspace: checks, next step, progress ---------------- */

export type VenueCheckTarget = 'details' | 'assessment' | 'team' | 'requirements' | 'fee';
export interface VenueCheck { key: string; en: string; ar: string; done: boolean; target: VenueCheckTarget; n?: number }

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
  /** awaitingInvitation: the row completes from an invitation reply (the Director's acceptance, a
   *  Level 1 EMS agency's), so there is nothing on it for the organizer to do but wait. */
  requirements: readonly { n: number; en: string; ar: string; optional: boolean; done: boolean; clinical: boolean; awaitingInvitation?: boolean }[];
  fee: { amount: string; currency: string; paid: boolean } | null;
  submittedAt: string | null;
  validUntil: string | null;
}

/**
 * What a venue package needs before it can be submitted -- one list, read by the
 * submit screen and re-checked by the submit action, so the two cannot disagree.
 * The declaration is a field on the form and is checked there.
 */
export function venueSubmissionChecks(f: VenuePackageFacts): { required: VenueCheck[]; optional: VenueCheck[]; remaining: number; requirementsRemaining: number; canSubmit: boolean } {
  const required: VenueCheck[] = [
    { key: 'details', en: 'Venue details and map pin', ar: 'تفاصيل الموقع وعلامة الخريطة', done: f.detailsDone, target: 'details' },
    { key: 'assessment', en: 'Annual assessment', ar: 'التقييم السنوي', done: f.assessmentDone, target: 'assessment' },
    ...f.pendingInvitations.map((i) => ({ key: i.token, en: `Response from ${i.name}`, ar: `ردّ ${i.name}`, done: false, target: 'team' as const })),
    ...f.requirements.filter((r) => !r.optional).map((r) => ({ key: String(r.n), en: r.en, ar: r.ar, done: r.done, target: 'requirements' as const, n: r.n })),
    ...(f.fee ? [{ key: 'fee', en: `Fee: ${f.fee.amount} ${f.fee.currency}`, ar: `الرسم: ${f.fee.amount} ${f.fee.currency}`, done: f.fee.paid, target: 'fee' as const }] : []),
  ];
  const optional: VenueCheck[] = f.requirements.filter((r) => r.optional).map((r) => ({ key: String(r.n), en: r.en, ar: r.ar, done: r.done, target: 'requirements' as const, n: r.n }));
  const remaining = required.filter((c) => !c.done).length;
  // The requirements stage's own count: the rows and the replies they wait on, not details or the fee.
  // A package the Ministry holds or has accepted owes nothing more in this cycle.
  const requirementsRemaining = f.editable ? required.filter((c) => (c.target === 'requirements' || c.target === 'team') && !c.done).length : 0;
  return { required, optional, remaining, requirementsRemaining, canSubmit: f.editable && remaining === 0 };
}

/** The one task the venue overview leads with; null once the package is with the Ministry or done. */
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
  const yours = f.requirements.filter((r) => !r.optional && !r.done && !r.clinical && !r.awaitingInvitation).length;
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
    return { kind: 'requirements', href: 'requirements', tone: 'accent',
      titleEn: returned ? 'Update the requirements and resubmit' : yours === 1 ? 'Complete your 1 requirement' : `Complete your ${yours} requirements`,
      titleAr: returned ? 'حدّثوا المتطلبات وأعيدوا التقديم' : `أكملوا ${arabicCount(yours, { one: 'متطلبكم الوحيد', two: 'متطلبَيكم', few: 'من متطلباتكم', many: 'من متطلباتكم' })}`,
      bodyEn: medical > 0 ? `Your medical team completes the other ${medical}.` : 'Then review and submit.',
      bodyAr: medical > 0 ? `يستكمل فريقكم الطبي المتطلبات الأخرى (${medical}).` : 'ثم راجعوا الملف وقدّموه.',
      buttonEn: 'Open requirements', buttonAr: 'فتح المتطلبات' };
  }
  if (f.pendingInvitations.length > 0) {
    return { kind: 'waitingOnOthers', href: 'team', tone: 'accent',
      titleEn: 'Waiting for your medical team to reply', titleAr: 'بانتظار ردّ فريقكم الطبي',
      bodyEn: 'Invitations with no reply hold up the submission. Withdraw one to invite someone else.', bodyAr: 'الدعوات التي لم يُرد عليها تؤخّر التقديم. اسحبوا الدعوة لدعوة طرف آخر.',
      buttonEn: 'View medical team', buttonAr: 'عرض الفريق الطبي' };
  }
  if (medical > 0) {
    return { kind: 'waitingOnOthers', href: 'requirements', tone: 'accent',
      titleEn: 'Medical items pending', titleAr: 'البنود الطبية قيد الانتظار',
      bodyEn: 'Your Medical Director or EMS agency completes the remaining items.', bodyAr: 'يستكمل المدير الطبي أو جهة الإسعاف البنود المتبقية.',
      buttonEn: 'View requirements', buttonAr: 'عرض المتطلبات' };
  }
  if (remaining > 0) {
    return { kind: 'awaitingPayment', href: 'submit', tone: 'accent',
      titleEn: 'Awaiting payment', titleAr: 'بانتظار الدفع',
      bodyEn: 'Everything the level requires is in place. Payment must be recorded before you can submit.', bodyAr: 'كل ما يتطلبه المستوى مستوفى. يجب تسجيل الدفع قبل التقديم.',
      buttonEn: 'Review submission', buttonAr: 'مراجعة ملف التقديم' };
  }
  return { kind: 'submit', href: 'submit', tone: 'brand',
    titleEn: returned ? 'Ready to resubmit' : 'Ready to submit', titleAr: returned ? 'جاهز لإعادة التقديم' : 'جاهز للتقديم',
    bodyEn: 'Everything the level requires is in place.', bodyAr: 'كل ما يتطلبه المستوى مستوفى.',
    buttonEn: 'Review submission', buttonAr: 'مراجعة ملف التقديم' };
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
      metaAr: withMinistry && f.submittedAt ? `\u2066${f.submittedAt.slice(0, 10)}\u2069` : returned ? 'قدّموا الملف المحدَّث' : '' },
    f.status === 'accepted'
      ? { k: 'done', en: 'Ministry outcome', ar: 'نتيجة الوزارة', metaEn: f.validUntil ? `${status.en} · valid until ${f.validUntil}` : status.en, metaAr: f.validUntil ? `${status.ar} · صالحة حتى \u2066${f.validUntil}\u2069` : status.ar }
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
 * A row that completes from an invitation reply rather than from anything the organizer
 * enters: the Medical Director row while a Director is nominated, and at Level 1 the EMS
 * row while an agency is nominated. The organizer's only move is to wait (or withdraw).
 */
export function venueRowAwaitsInvitation(n: number, level: Level | null, nominated: { director: boolean; ems: boolean }): boolean {
  return (n === 3 && nominated.director) || (n === 7 && level === 1 && nominated.ems);
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
