/**
 * THE MUNICIPALITY LIST (owner, 9 October 2026): the owner's seven governorate files, English
 * only, word order restored. The fixture below exists only for these tests -- it is not the list
 * and nothing reads it.
 */
import { describe, expect, it } from 'vitest';
import { foldForSearch, municipalityLabel, municipalityList, municipalityNamed, searchMunicipalities, splitMunicipalities, type Municipality } from '../lib/rules/municipalities';

const FIXTURE: Municipality[] = [
  { en: 'Beirut', ar: 'بيروت' },
  { en: 'Baabda', ar: 'بعبدا' },
  { en: 'Saida', ar: 'صيدا' },
  { en: 'Zahle', ar: 'زحلة' },
];

describe('the municipality list', () => {
  it("carries the owner's lists with the word order restored, and invents no Arabic", () => {
    const list = municipalityList();
    expect(list.length).toBeGreaterThan(700);
    // The files reversed every multi-word name ("Aakrine Ain"); no name may end on a leading particle.
    // Deir Qanoun Ras Al Ain (Sour) ends on "Ain" in its own right.
    expect(list.filter((m) => m.en !== 'Deir Qanoun Ras Al Ain' && / (Al|Ain|Deir|Beit|Kafr|Kfar|El)$/.test(m.en.replace(/ \(.*\)$/, '')))).toEqual([]);
    expect(list.find((m) => m.en === 'Ain Aakrine')?.districtEn).toBe('Koura');
    expect(list.some((m) => m.districtEn === 'El Chouf')).toBe(true);
    expect(list.some((m) => m.en === 'Beirut')).toBe(true);
    expect(list.some((m) => /Welcome|located in/.test(m.en))).toBe(false);
    expect(list.every((m) => !m.ar)).toBe(true);
    expect(new Set(list.map((m) => m.en)).size).toBe(list.length);
  });

  it('shows the English name on the Arabic page while the Arabic names are pending', () => {
    expect(municipalityLabel({ en: 'Jounieh' }, 'ar')).toBe('Jounieh');
    expect(municipalityLabel({ en: 'Jounieh', ar: 'جونيه' }, 'ar')).toBe('جونيه');
  });

  it('finds a municipality by its English or Arabic name, starts-with first', () => {
    expect(searchMunicipalities(FIXTURE, 'b').map((m) => m.en)).toEqual(['Beirut', 'Baabda']);
    expect(searchMunicipalities(FIXTURE, 'بعب').map((m) => m.en)).toEqual(['Baabda']);
    expect(searchMunicipalities(FIXTURE, 'ida').map((m) => m.en)).toEqual(['Saida']);
    expect(searchMunicipalities(FIXTURE, '').length).toBe(4);
  });

  it('folds the letter variants people type interchangeably', () => {
    expect(foldForSearch('زحله')).toBe(foldForSearch('زحلة'));
    expect(foldForSearch('Zahlé')).toBe('zahle');
    expect(searchMunicipalities(FIXTURE, 'زحله').map((m) => m.en)).toEqual(['Zahle']);
  });

  it('reads a stored name in either language, and several stored as one line', () => {
    expect(municipalityNamed(FIXTURE, 'صيدا')?.en).toBe('Saida');
    expect(municipalityNamed(FIXTURE, 'beirut')?.ar).toBe('بيروت');
    expect(municipalityNamed(FIXTURE, 'Somewhere else')).toBeNull();
    expect(splitMunicipalities('Beirut, Baabda')).toEqual(['Beirut', 'Baabda']);
    expect(splitMunicipalities('بيروت، بعبدا')).toEqual(['بيروت', 'بعبدا']);
    expect(splitMunicipalities('')).toEqual([]);
  });
});
