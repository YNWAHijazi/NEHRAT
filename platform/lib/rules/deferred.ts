/**
 * WHAT IS DELIBERATELY NOT BUILT, and why — recorded so it reads as a decision rather
 * than as an omission.
 *
 * The difference matters more than it sounds. An absent feature with no record looks
 * identical to a feature somebody forgot, and the Ministry cannot tell them apart by
 * looking. Anything here was considered, was decided against for a stated reason, and
 * has a named condition under which it would be built.
 *
 * This is data, not prose in a document, so the acceptance report renders it rather
 * than restating it — a second copy of a decision drifts from the first.
 */

export interface DeferredItem {
  key: string;
  en: string;
  ar: string;
  /** Why it is not built. Not an apology: a reason. */
  reasonEn: string;
  reasonAr: string;
  /** What would have to be true for it to be built. */
  conditionEn: string;
  conditionAr: string;
}

export const DEFERRED: readonly DeferredItem[] = [
  {
    key: 'assistance',
    en: 'The assistance layer',
    ar: 'طبقة المساعدة',
    reasonEn:
      'The product specification describes assistants that help an organizer through the assessment and help a reviewer read a submission. The regulation does not require them, and nothing in a Ministry review depends on one: every determination in this platform is reached by a person reading a record. Building them would mean deciding what an assistant may see — an organizer’s answers, a reviewer’s notes, a patient-free incident narrative — and that is a data question, not a feature question.',
    reasonAr:
      'تصف مواصفات المنتج مساعدين يعينان المنظّم في التقييم ويعينان المراجع في قراءة التقديم. ولا يستلزمهما النظام، ولا يتوقف أي شيء في مراجعة الوزارة على واحد منهما: فكل نتيجة في هذه المنصة يتوصل إليها شخص يقرأ سجلاً. وبناؤهما يعني البتّ في ما يجوز للمساعد الاطلاع عليه — إجابات المنظّم وملاحظات المراجع وسرد حادثة خالٍ من بيانات المرضى — وهذه مسألة بيانات لا مسألة ميزة.',
    conditionEn:
      'A Ministry decision on what an assistant may read, and on whether anything an assistant produces may appear on a regulatory record. Sequenced after the Ministry console, which is now built.',
    conditionAr:
      'قرار من الوزارة بشأن ما يجوز للمساعد قراءته، وبشأن ما إذا كان يجوز لأي شيء ينتجه المساعد أن يظهر في سجل تنظيمي. ويأتي تسلسله بعد لوحة الوزارة، وقد بُنيت.',
  },
  {
    key: 'commercial',
    en: 'Fee, vendor and advertising capability',
    ar: 'إمكانات الرسوم والموردين والإعلانات',
    reasonEn:
      'The product specification requires the capability to exist. The Lebanon instrument charges no fee and the copy rules forbid a commercial register, so the capability ships behind feature flags and is off. Nothing commercial renders anywhere, and every screen that mentions cost says: Fee: None.',
    reasonAr:
      'تستلزم مواصفات المنتج وجود هذه الإمكانات. ولا يفرض الصك اللبناني أي رسم، وتمنع قواعد الصياغة أي سجل تجاري، فتُشحن الإمكانات خلف مفاتيح تشغيل وهي مطفأة. ولا يظهر أي محتوى تجاري في أي مكان، وكل شاشة تذكر الكلفة تقول: الرسم لا يوجد.',
    conditionEn:
      'A Ministry decision that a fee exists. Until then the flags stay off and the capability is capability, not content.',
    conditionAr:
      'قرار من الوزارة بوجود رسم. وإلى ذلك الحين تبقى المفاتيح مطفأة وتبقى الإمكانات إمكانات لا محتوى.',
  },
];
