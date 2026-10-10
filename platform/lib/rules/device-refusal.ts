/**
 * Why an AED record was not saved, by field (owner, 10 October 2026: a refused save "didn't
 * tell me what's wrong ... it just refreshed and cleared it"). The server returns the code;
 * the form shows the sentence under its Save button and keeps what was typed.
 */
import { UPLOADS_CONTENT } from './uploads';

export type DeviceRefusal = 'details' | 'details-identification' | 'details-location' | 'details-pin' | 'details-representative'
  | 'details-check-date' | 'details-pad-expiry' | 'details-battery';

const MESSAGES: Record<DeviceRefusal, { en: string; ar: string }> = {
  'details-identification': { en: 'Not saved: add the barcode, QR code or serial number.', ar: 'لم يُحفظ: أضيفوا الرمز الشريطي أو رمز QR أو الرقم التسلسلي.' },
  'details-location': { en: 'Not saved: add the exact location within the facility.', ar: 'لم يُحفظ: أضيفوا الموقع الدقيق داخل المنشأة.' },
  'details-pin': { en: 'Not saved: place the AED’s pin on the map, or choose that it uses the site’s pin.', ar: 'لم يُحفظ: ضعوا علامة الجهاز على الخريطة، أو اختاروا أن يستخدم علامة الموقع.' },
  'details-representative': { en: 'Not saved: add the name of the person confirming this record.', ar: 'لم يُحفظ: أضيفوا اسم الشخص الذي يؤكد هذا السجل.' },
  'details-check-date': { en: 'Not saved: enter the date of this readiness check. It cannot be in the future.', ar: 'لم يُحفظ: أدخلوا تاريخ فحص الجاهزية هذا. ولا يمكن أن يكون في المستقبل.' },
  'details-pad-expiry': { en: 'Not saved: enter the electrode-pad expiry date printed on the pads.', ar: 'لم يُحفظ: أدخلوا تاريخ انتهاء صلاحية الأقطاب المطبوع عليها.' },
  'details-battery': { en: 'Not saved: the battery date is not a valid date. Leave it empty if it is not available.', ar: 'لم يُحفظ: تاريخ البطارية غير صالح. اتركوه فارغاً إن لم يكن متوفراً.' },
  details: { en: 'Not saved: this device record could not be found. Reload the page and try again.', ar: 'لم يُحفظ: تعذّر العثور على سجل الجهاز. أعيدوا تحميل الصفحة وحاولوا مجدداً.' },
};

/** The sentence for a refusal code; null for a code that is not a device refusal. */
export function deviceRefusalMessage(code: string | null | undefined): { en: string; ar: string } | null {
  if (!code) return null;
  if (code in MESSAGES) return MESSAGES[code as DeviceRefusal];
  // A refused photo: its own sentence, as the upload picker words it.
  const c = UPLOADS_CONTENT.copy;
  if (code === 'photo-tooLarge') return { en: c.tooLargeEn.replace('{max}', UPLOADS_CONTENT.maxBytesLabel), ar: c.tooLargeAr.replace('{max}', UPLOADS_CONTENT.maxBytesLabel) };
  if (code === 'photo-empty') return { en: c.emptyEn, ar: c.emptyAr };
  if (code.startsWith('photo-')) return { en: c.notImageEn, ar: c.notImageAr };
  return null;
}
