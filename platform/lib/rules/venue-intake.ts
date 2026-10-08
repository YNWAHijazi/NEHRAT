export const VENUE_TYPES = [
 {key:'conference',en:'Conference or exhibition centre',ar:'مركز مؤتمرات أو معارض'},
 {key:'hall',en:'Event or banquet hall',ar:'قاعة فعاليات أو حفلات'},
 {key:'stadium',en:'Stadium or sports arena',ar:'ملعب أو صالة رياضية'},
 {key:'theatre',en:'Theatre or concert venue',ar:'مسرح أو موقع حفلات موسيقية'},
 {key:'outdoor',en:'Outdoor event space',ar:'مساحة خارجية للفعاليات'},
 {key:'hotel',en:'Hotel or resort event space',ar:'مساحة فعاليات في فندق أو منتجع'},
 {key:'nightclub',en:'Nightclub or dance venue',ar:'ملهى ليلي أو مكان للرقص'},
 {key:'other',en:'Other',ar:'نوع آخر'},
] as const;
// Geographic choices, not regulatory thresholds. Sources recorded in acceptance notes.
export const VENUE_DISTRICTS = [
 {en:'Beirut',ar:'بيروت'}, {en:'Akkar',ar:'عكار'}, {en:'Aley',ar:'عاليه'}, {en:'Baabda',ar:'بعبدا'},
 {en:'Baalbek',ar:'بعلبك'}, {en:'Batroun',ar:'البترون'}, {en:'Bint Jbeil',ar:'بنت جبيل'}, {en:'Bsharri',ar:'بشري'},
 {en:'Chouf',ar:'الشوف'}, {en:'Hasbaya',ar:'حاصبيا'}, {en:'Hermel',ar:'الهرمل'}, {en:'Jbeil',ar:'جبيل'},
 {en:'Jezzine',ar:'جزين'}, {en:'Keserwan',ar:'كسروان'}, {en:'Koura',ar:'الكورة'}, {en:'Marjayoun',ar:'مرجعيون'},
 {en:'Matn',ar:'المتن'}, {en:'Miniyeh-Danniyeh',ar:'المنية الضنية'}, {en:'Nabatieh',ar:'النبطية'}, {en:'Rashaya',ar:'راشيا'},
 {en:'Saida',ar:'صيدا'}, {en:'Tripoli',ar:'طرابلس'}, {en:'Tyre',ar:'صور'}, {en:'West Bekaa',ar:'البقاع الغربي'},
 {en:'Zahle',ar:'زحلة'}, {en:'Zgharta',ar:'زغرتا'},
] as const;

/** The venue type's label in both languages; a free-text "other" type is shown as entered. */
export function venueTypeLabel(category: string | null | undefined): { en: string; ar: string } {
  const known = VENUE_TYPES.find((t) => t.key === category);
  return known ? { en: known.en, ar: known.ar } : { en: category || '—', ar: category || '—' };
}

/** The district as the reader's language names it; the record stores the English name. */
export function venueDistrictLabel(stored: string | null | undefined): { en: string; ar: string } {
  const known = VENUE_DISTRICTS.find((d) => d.en === stored);
  return known ? { en: known.en, ar: known.ar } : { en: stored || '', ar: stored || '' };
}

/**
 * A telephone number as people type it: Arabic-Indic and Persian digits become Western
 * digits, runs of spaces collapse, and nothing else changes. Validation happens after.
 */
export function normalizePhone(raw: string): string {
  return raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, ' ')
    .trim();
}

/** A telephone number as stored: an optional +, then digits with the usual separators, at least seven digits. */
export const PHONE_SHAPE = /^\+?[0-9 ()./-]{7,24}$/;
export function plausiblePhone(phone: string): boolean {
  const MIN_DIGITS = 7;
  return PHONE_SHAPE.test(phone) && (phone.match(/[0-9]/g) ?? []).length >= MIN_DIGITS;
}
