/**
 * Telephone numbers as one stored string, "+961 3 123 456", entered as a country code
 * chosen from a list and the number typed beside it (owner, 9 October 2026: "why say
 * with country code... make the country code a dropdown and they add it"). Plain
 * TypeScript: the field, the server and the tests read the same list and the same rules.
 */

export interface CountryCode { code: string; iso: string; en: string; ar: string }

/** Lebanon first; then the region; then the countries a Lebanese organizer most often deals with. */
export const COUNTRY_CODES: readonly CountryCode[] = [
  { code: '+961', iso: 'LB', en: 'Lebanon', ar: 'لبنان' },
  { code: '+963', iso: 'SY', en: 'Syria', ar: 'سوريا' },
  { code: '+962', iso: 'JO', en: 'Jordan', ar: 'الأردن' },
  { code: '+964', iso: 'IQ', en: 'Iraq', ar: 'العراق' },
  { code: '+357', iso: 'CY', en: 'Cyprus', ar: 'قبرص' },
  { code: '+20', iso: 'EG', en: 'Egypt', ar: 'مصر' },
  { code: '+966', iso: 'SA', en: 'Saudi Arabia', ar: 'السعودية' },
  { code: '+971', iso: 'AE', en: 'United Arab Emirates', ar: 'الإمارات العربية المتحدة' },
  { code: '+974', iso: 'QA', en: 'Qatar', ar: 'قطر' },
  { code: '+965', iso: 'KW', en: 'Kuwait', ar: 'الكويت' },
  { code: '+973', iso: 'BH', en: 'Bahrain', ar: 'البحرين' },
  { code: '+968', iso: 'OM', en: 'Oman', ar: 'عُمان' },
  { code: '+90', iso: 'TR', en: 'Türkiye', ar: 'تركيا' },
  { code: '+33', iso: 'FR', en: 'France', ar: 'فرنسا' },
  { code: '+44', iso: 'GB', en: 'United Kingdom', ar: 'المملكة المتحدة' },
  { code: '+49', iso: 'DE', en: 'Germany', ar: 'ألمانيا' },
  { code: '+39', iso: 'IT', en: 'Italy', ar: 'إيطاليا' },
  { code: '+34', iso: 'ES', en: 'Spain', ar: 'إسبانيا' },
  { code: '+41', iso: 'CH', en: 'Switzerland', ar: 'سويسرا' },
  { code: '+32', iso: 'BE', en: 'Belgium', ar: 'بلجيكا' },
  { code: '+1', iso: 'US', en: 'United States and Canada', ar: 'الولايات المتحدة وكندا' },
  { code: '+55', iso: 'BR', en: 'Brazil', ar: 'البرازيل' },
  { code: '+61', iso: 'AU', en: 'Australia', ar: 'أستراليا' },
  { code: '+225', iso: 'CI', en: 'Côte d’Ivoire', ar: 'ساحل العاج' },
];

export const DEFAULT_COUNTRY_CODE = '+961';

/** Western digits for Arabic-Indic and Extended Arabic-Indic digits. */
function westernDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * A stored number split into its country code and the rest, for the field to show. A
 * number with no recognisable code keeps everything in the number box under Lebanon.
 */
export function splitPhone(stored: string): { code: string; national: string } {
  const v = westernDigits(stored).trim();
  if (v.startsWith('+') || v.startsWith('00')) {
    const plus = v.startsWith('00') ? `+${v.slice(2)}` : v;
    const compact = plus.replace(/[\s().-]/g, '');
    // Longest code first, so +1 never swallows +12x and +96x never reads as +9.
    const hit = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length).find((c) => compact.startsWith(c.code));
    if (hit) {
      // Step past the "+" and the code's digits (spaces between them allowed); keep the person's own spacing after.
      const digits = hit.code.length - 1;
      let i = 1;
      for (let seen = 0; i < plus.length && seen < digits; i += 1) if (/\d/.test(plus[i]!)) seen += 1;
      return { code: hit.code, national: plus.slice(i).trim() };
    }
  }
  return { code: DEFAULT_COUNTRY_CODE, national: v };
}

/**
 * The one stored string. A trunk 0 typed out of habit ("03 123 456") is dropped after a
 * code that does not use one internationally; Italy keeps its leading 0. Empty number,
 * empty result -- an optional telephone stays unset.
 */
export function joinPhone(code: string, national: string): string {
  let n = westernDigits(national).trim().replace(/[^\d\s().-]/g, '').trim();
  if (n === '') return '';
  if (code !== '+39') n = n.replace(/^0+/, '').trim();
  return `${code} ${n}`.trim();
}
