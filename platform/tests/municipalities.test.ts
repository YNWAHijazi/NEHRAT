/**
 * THE MUNICIPALITY LIST (owner, 9 October 2026): the owner's seven governorate files, word order
 * restored, corrected, with drafted Arabic names. The fixture below exists only for these tests -- it is not the list
 * and nothing reads it.
 */
import { describe, expect, it } from 'vitest';
import { foldForSearch, municipalityKey, municipalityLabel, municipalityList, municipalityNamed, searchMunicipalities, splitMunicipalities, type Municipality } from '../lib/rules/municipalities';

const FIXTURE: Municipality[] = [
  { en: 'Beirut', ar: 'بيروت' },
  { en: 'Baabda', ar: 'بعبدا' },
  { en: 'Saida', ar: 'صيدا' },
  { en: 'Zahle', ar: 'زحلة' },
];

describe('the municipality list', () => {
  it("carries the owner's lists with the word order restored, every entry in both languages", () => {
    const list = municipalityList();
    expect(list.length).toBeGreaterThan(700);
    // The files reversed every multi-word name ("Aakrine Ain"); no name may end on a leading particle.
    // Deir Qanoun Ras Al Ain (Sour) ends on "Ain" in its own right.
    expect(list.filter((m) => m.en !== 'Deir Qanoun Ras Al Ain' && / (Al|Ain|Deir|Beit|Kafr|Kfar|El)$/.test(m.en.replace(/ \(.*\)$/, '')))).toEqual([]);
    expect(list.find((m) => m.en === 'Ain Aakrine')?.districtEn).toBe('Koura');
    expect(list.some((m) => m.districtEn === 'Chouf')).toBe(true);
    expect(list.some((m) => m.en === 'Beirut')).toBe(true);
    expect(list.some((m) => /Welcome|located in/.test(m.en))).toBe(false);
    // The Arabic names are drafted (owner: "Can't you just translate them"), every entry carries one,
    // and doubtful drafts are marked for the Ministry's check.
    expect(list.every((m) => /[\u0600-\u06FF]/.test(m.ar ?? '') && /[\u0600-\u06FF]/.test(m.districtAr ?? ''))).toBe(true);
    expect(list.find((m) => m.en === 'Jounieh')?.ar).toBe('جونية');
    expect(list.find((m) => m.en === 'Byblos')?.ar).toBe('جبيل');
    // A name never carries its district in brackets; the district shows once, beside it (owner, 10 October 2026).
    expect(list.filter((m) => /\(|\)/.test(m.en) || /\(|\)/.test(m.ar ?? '')).map((m) => m.en)).toEqual([]);
    expect(list.find((m) => m.en === 'Aaba' && m.districtEn === 'Koura')?.ar).toBe('عابا');
    // A name stored with the bracket before the change still resolves to its district's entry.
    expect(municipalityNamed(list, 'Aaba (Nabatieh)')?.districtEn).toBe('Nabatieh');
    expect(municipalityNamed(list, 'عابا (الكورة)')?.districtEn).toBe('Koura');
    expect(searchMunicipalities(list, 'زحلة')[0]?.en).toBe('Zahle');
    // Same-named towns in two districts are two entries, told apart by the district.
    expect(new Set(list.map(municipalityKey)).size).toBe(list.length);
  });

  it('carries the main municipalities, by their common names (owner: "as long as the main ones are there")', () => {
    const list = municipalityList();
    const main = ['Beirut', 'Tripoli', 'Saida', 'Tyre', 'Zahle', 'Jounieh', 'Byblos', 'Baabda', 'Aley', 'Nabatieh', 'Baalbek', 'Hermel', 'Halba',
      'Zgharta-Ehden', 'Bcharre', 'Batroun', 'Amioun', 'Minieh', 'Jezzine - Ain Majdeline', 'Bint Jbeil', 'Jdeidet Marjayoun', 'Hasbaya', 'Rashaya', 'Joub Jannine',
      'Chtaura', 'Deir el Qamar', 'Damour', 'Choueifat', 'Hadath', 'Jdeideh-Bouchrieh-Sed', 'Bourj Hammoud', 'Sin el Fil'];
    expect(main.filter((n) => !list.some((m) => m.en === n))).toEqual([]);
    // The clear errors in the files are gone.
    expect(list.some((m) => ['Zahl', 'ta Zahl', 'Sidon'].includes(m.en.replace(/ \(.*\)$/, '')))).toBe(false);
    // Found by the spelling people use, or the files' own.
    for (const [typed, name] of [['Sour', 'Tyre'], ['Jbeil', 'Byblos'], ['Sidon', 'Saida'], ['Bsharri', 'Bcharre'], ['Zahleh', 'Zahle'], ['Qab Elias', 'Qab Elias - Wadi El Delm'], ['Jezzine', 'Jezzine - Ain Majdeline']]) {
      expect(municipalityNamed(list, typed!)?.en, typed).toBe(name);
      expect(searchMunicipalities(list, typed!)[0]?.en, typed).toBe(name);
    }
  });

  it('falls back to the English name for a typed entry that has no Arabic', () => {
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
