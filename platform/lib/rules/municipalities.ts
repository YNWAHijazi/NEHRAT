/**
 * THE MUNICIPALITY LIST (owner, 9 October 2026): a searchable list, each option in the page's
 * language, both names stored. The list is data (lib/rules/data/municipalities.json) and stays
 * empty until the official list arrives; while it is empty every municipality field stays a typed field.
 * Plain TypeScript: no React, no next/*.
 */
import data from './data/municipalities.json';

export interface Municipality {
  en: string;
  ar: string;
  districtEn?: string;
  districtAr?: string;
}

const LIST = (data.municipalities as Municipality[]).filter((m) => m.en.trim() && m.ar.trim());

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
    const names = [m.en, m.ar, m.districtEn ?? '', m.districtAr ?? ''].map(foldForSearch);
    if (names.slice(0, 2).some((n) => n.startsWith(q))) starts.push(m);
    else if (names.some((n) => n.includes(q))) contains.push(m);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** The list entry a stored name names, in either language; null for a typed name not in the list. */
export function municipalityNamed(list: readonly Municipality[], name: string): Municipality | null {
  const n = foldForSearch(name);
  if (!n) return null;
  return list.find((m) => foldForSearch(m.en) === n || foldForSearch(m.ar) === n) ?? null;
}

/** Several municipalities are stored as one line, English names joined by commas. */
export function splitMunicipalities(stored: string): string[] {
  return stored.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
}
