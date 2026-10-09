/**
 * THE MUNICIPALITY LIST (owner, 9 October 2026). The official list is sent by the owner; until
 * then it is empty and every municipality field stays a typed field. The fixture below exists only
 * for these tests -- it is not the list and nothing reads it.
 */
import { describe, expect, it } from 'vitest';
import { foldForSearch, municipalityList, municipalityNamed, searchMunicipalities, splitMunicipalities, type Municipality } from '../lib/rules/municipalities';

const FIXTURE: Municipality[] = [
  { en: 'Beirut', ar: 'بيروت' },
  { en: 'Baabda', ar: 'بعبدا' },
  { en: 'Saida', ar: 'صيدا' },
  { en: 'Zahle', ar: 'زحلة' },
];

describe('the municipality list', () => {
  it('ships empty: no municipality is invented before the official list arrives', () => {
    expect(municipalityList()).toEqual([]);
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
