import { requirementsForLevel, type RequirementRow } from './requirements';
import type { Level } from './types';
export type VenuePackageStatus = 'draft' | 'submitted' | 'revision' | 'accepted';
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
export function venuePackageEditable(status:VenuePackageStatus, archived:boolean) { return !archived && (status==='draft'||status==='revision'); }
export const VENUE_STATUS:Record<VenuePackageStatus,{en:string;ar:string}>={draft:{en:'In preparation',ar:'قيد التحضير'},submitted:{en:'Under Ministry review',ar:'قيد مراجعة الوزارة'},revision:{en:'Changes requested',ar:'تعديلات مطلوبة'},accepted:{en:'Requirements satisfied',ar:'المتطلبات مستوفاة'}};

/** Contact and acceptance are managed once, in Medical team. */
export function venueFieldsForLevel(requirement:number,level:Level):VenueField[] {
 const fields=FIELDS[requirement]??[];
 return requirement===7&&level===1?fields.filter(f=>f.key!=='arrangements'):fields;
}
export function venueRequirementIsClinical(requirement:number,level:Level) {
 return !venueRequirementEditors(requirement,level).includes('organizer') && ![1,3].includes(requirement) && !(requirement===7&&level===1);
}
export function venueLocalEmsContactApplies(level:Level|null,hasEmsInvitation:boolean) { return level===1&&!hasEmsInvitation; }
