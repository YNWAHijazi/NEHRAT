/**
 * THE MUNICIPALITY LIST (owner, 9 October 2026): a searchable list, each option in the page's
 * language, both names stored. The list is data (lib/rules/data/municipalities.json) and stays
 * empty until the official list arrives; while it is empty every municipality field stays a typed field. Arabic names may be pending: the English name then stands in.
 * Plain TypeScript: no React, no next/*.
 */
import data from './data/municipalities.json';

export interface Municipality {
  en: string;
  /** The Arabic name; absent while the Arabic list is pending -- the English name stands in. */
  ar?: string;
  districtEn?: string;
  districtAr?: string;
  governorateEn?: string;
  /** Other spellings the field also finds it by (the source files' own, a common English name). */
  aliases?: string[];
}

const LIST = (data.municipalities as Municipality[]).filter((m) => m.en.trim());

/** The name in a language: the Arabic name where the list carries one, else the English. */
export function municipalityLabel(m: Municipality, lang: 'en' | 'ar'): string {
  return lang === 'ar' && m.ar?.trim() ? m.ar : m.en;
}

/** The district in a language, falling back the same way. */
export function districtLabel(m: Municipality, lang: 'en' | 'ar'): string {
  return lang === 'ar' && m.districtAr?.trim() ? m.districtAr : m.districtEn ?? '';
}

export function municipalityList(): Municipality[] {
  return LIST;
}

/** Folds case, Latin accents and the Arabic letter variants people type interchangeably. */
export function foldForSearch(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/['’`‘-]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Options matching a query in either language: names that start with it first, then names that contain it. */
export function searchMunicipalities(list: readonly Municipality[], query: string, limit = 50): Municipality[] {
  const q = foldForSearch(query);
  if (!q) return list.slice(0, limit);
  const starts: Municipality[] = [];
  const contains: Municipality[] = [];
  for (const m of list) {
    const own = [m.en, m.ar ?? '', ...(m.aliases ?? [])].map(foldForSearch);
    const names = [...own, foldForSearch(m.districtEn ?? ''), foldForSearch(m.districtAr ?? '')];
    if (own.some((n) => n.startsWith(q))) starts.push(m);
    else if (names.some((n) => n.includes(q))) contains.push(m);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** The list entry a stored name names, in either language; null for a typed name not in the list. */
export function municipalityNamed(list: readonly Municipality[], name: string): Municipality | null {
  const n = foldForSearch(name);
  if (!n) return null;
  return list.find((m) => [m.en, m.ar ?? '', ...(m.aliases ?? [])].some((x) => x !== '' && foldForSearch(x) === n)) ?? null;
}

/** Several municipalities are stored as one line, English names joined by commas. */
export function splitMunicipalities(stored: string): string[] {
  return stored.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
}
