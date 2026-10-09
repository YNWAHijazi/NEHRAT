import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, joinPhone, splitPhone } from '../lib/phone';
import { validPhone } from '../lib/email-verification';
import { normalizePhone, plausiblePhone } from '../lib/rules/venue-intake';

describe('telephone: a country code from a list and the number beside it (owner, 9 October 2026)', () => {
  it('Lebanon is first and the default', () => {
    expect(COUNTRY_CODES[0]!.code).toBe('+961');
    expect(DEFAULT_COUNTRY_CODE).toBe('+961');
    expect(new Set(COUNTRY_CODES.map((c) => c.code)).size).toBe(COUNTRY_CODES.length);
    for (const c of COUNTRY_CODES) { expect(c.en.trim()).not.toBe(''); expect(c.ar).toMatch(/[؀-ۿ]/); }
  });
  it('joins the code and the number, dropping a trunk 0 typed out of habit', () => {
    expect(joinPhone('+961', '03 123 456')).toBe('+961 3 123 456');
    expect(joinPhone('+961', '٠٣ ١٢٣ ٤٥٦')).toBe('+961 3 123 456');
    expect(joinPhone('+33', '06 12 34 56 78')).toBe('+33 6 12 34 56 78');
    expect(joinPhone('+39', '06 1234 5678')).toBe('+39 06 1234 5678');
    expect(joinPhone('+961', '   ')).toBe('');
  });
  it('splits a stored number back into its code and the rest, longest code first', () => {
    expect(splitPhone('+961 3 123 456')).toEqual({ code: '+961', national: '3 123 456' });
    expect(splitPhone('00961 3 123 456')).toEqual({ code: '+961', national: '3 123 456' });
    expect(splitPhone('+1 212 555 0100')).toEqual({ code: '+1', national: '212 555 0100' });
    expect(splitPhone('+9613111111')).toEqual({ code: '+961', national: '3111111' });
    expect(splitPhone('03 123 456')).toEqual({ code: '+961', national: '03 123 456' });
    expect(splitPhone('')).toEqual({ code: '+961', national: '' });
  });
  it('what the field stores passes every server check that reads a telephone', () => {
    for (const v of [joinPhone('+961', '03 123 456'), joinPhone('+44', '7700 900123'), joinPhone('+971', '50 123 4567')]) {
      expect(validPhone(v)).toBe(true);
      expect(plausiblePhone(normalizePhone(v))).toBe(true);
    }
  });
});
