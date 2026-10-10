/**
 * Telephone numbers as one stored string, "+961 3 123 456", entered as a country code
 * chosen from a list and the number typed beside it (owner, 9 October 2026: "why say
 * with country code... make the country code a dropdown and they add it"). Plain
 * TypeScript: the field, the server and the tests read the same list and the same rules.
 */

import { COUNTRY_CODES, type CountryCode } from './rules/country-codes';

export { COUNTRY_CODES, type CountryCode };

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
