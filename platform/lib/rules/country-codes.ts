/** Every country calling code (owner, 10 October 2026: "put them all"): Lebanon first, then by English name. */
import countryCodes from './data/country-codes.json';

export interface CountryCode { code: string; iso: string; en: string; ar: string }

export const COUNTRY_CODES: readonly CountryCode[] = countryCodes.countries;
