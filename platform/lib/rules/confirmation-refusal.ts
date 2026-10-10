/**
 * Why a readiness confirmation was not recorded, each reason by name (owner, 10 October 2026:
 * "when I press Record the readiness confirmation, it just restarts"). The server returns every
 * reason that applies; the form lists them under its button and keeps what was ticked and typed.
 */
export type ConfirmationRefusal =
  | 'checks' | 'drill-missing' | 'drill-future' | 'drill-old' | 'representative'
  | 'map' | 'contact' | 'aeds-none' | 'aeds-not-ready';

const MESSAGES: Record<ConfirmationRefusal, { en: string; ar: string }> = {
  checks: { en: 'Tick every confirmation. Each one confirms an arrangement that is in place.', ar: 'أكّدوا كل بند. يؤكد كل بند ترتيباً قائماً.' },
  'drill-missing': { en: 'Enter the date of the latest drill. A date shown in grey is a placeholder, not an entry.', ar: 'أدخلوا تاريخ آخر تمرين. التاريخ الظاهر باللون الرمادي مثال وليس إدخالاً.' },
  'drill-future': { en: 'The drill date is in the future. Enter the date the latest drill took place.', ar: 'تاريخ التمرين في المستقبل. أدخلوا تاريخ آخر تمرين جرى فعلاً.' },
  'drill-old': { en: 'The latest drill is more than 12 months old. A drill within the last 12 months is needed.', ar: 'مضى على آخر تمرين أكثر من 12 شهراً. يلزم تمرين خلال آخر 12 شهراً.' },
  representative: { en: 'Enter the facility representative’s name or position.', ar: 'أدخلوا اسم ممثل المنشأة أو مسمّاه الوظيفي.' },
  map: { en: 'Place the site’s pin on the map, on the site details page.', ar: 'ضعوا علامة الموقع على الخريطة، في صفحة تفاصيل الموقع.' },
  contact: { en: 'Complete the responsible facility contact: name or position, telephone and email.', ar: 'أكملوا جهة الاتصال المسؤولة في المنشأة: الاسم أو المسمى الوظيفي والهاتف والبريد الإلكتروني.' },
  'aeds-none': { en: 'Register at least one AED: this site requires one.', ar: 'سجّلوا جهازاً واحداً على الأقل: يلزم هذا الموقع جهاز.' },
  'aeds-not-ready': { en: 'An AED is recorded as not operational or not accessible during operating hours. Update it on the AED step first.', ar: 'جهاز مسجَّل على أنه غير صالح للعمل أو غير متاح خلال ساعات العمل. حدّثوه في خطوة الأجهزة أولاً.' },
};

export function isConfirmationRefusal(code: string): code is ConfirmationRefusal {
  return code in MESSAGES;
}

/** The sentences for the reasons, in the order given; unknown codes are dropped. */
export function confirmationRefusalMessages(codes: readonly string[]): ({ code: ConfirmationRefusal } & { en: string; ar: string })[] {
  return codes.filter(isConfirmationRefusal).map((code) => ({ code, ...MESSAGES[code] }));
}

/**
 * The form's own reasons -- the ticks, the drill date and the representative -- from plain
 * values. `today` is Asia/Beirut (ISO). The server adds the site's own (map, contact, AEDs).
 */
export function confirmationFormRefusals(input: { checks: Record<string, boolean>; checkKeys: readonly string[]; drill: string; representative: string; today: string }): ConfirmationRefusal[] {
  const out: ConfirmationRefusal[] = [];
  if (!input.checkKeys.every((k) => input.checks[k])) out.push('checks');
  const drill = input.drill.trim();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(drill) && Number.isFinite(Date.parse(drill)) && new Date(drill).toISOString().slice(0, 10) === drill;
  if (!valid) out.push('drill-missing');
  else {
    const priorYear = new Date(`${input.today}T12:00:00Z`);
    priorYear.setUTCFullYear(priorYear.getUTCFullYear() - 1);
    if (drill > input.today) out.push('drill-future');
    else if (drill < priorYear.toISOString().slice(0, 10)) out.push('drill-old');
  }
  if (!input.representative.trim()) out.push('representative');
  return out;
}
