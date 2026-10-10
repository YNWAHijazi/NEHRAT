/** Shared labels for event entry and review; stored keys stay unchanged. */
export const EVENT_TYPES: {
  key: string;
  en: string;
  ar: string;
  disciplines: readonly string[];
  nightclub: boolean;
}[] = [
  { key: 'running', en: 'Running event', ar: 'فعالية جري', disciplines: ['running'], nightclub: false },
  { key: 'cycling', en: 'Cycling race', ar: 'سباق دراجات', disciplines: ['cycling'], nightclub: false },
  { key: 'triathlon', en: 'Triathlon', ar: 'سباق ثلاثي (ترياتلون)', disciplines: ['triathlon'], nightclub: false },
  { key: 'open_water', en: 'Open-water swimming', ar: 'سباحة في المياه المفتوحة', disciplines: ['open_water_swimming'], nightclub: false },
  { key: 'boxing', en: 'Boxing', ar: 'ملاكمة', disciplines: ['boxing'], nightclub: false },
  { key: 'kickboxing', en: 'Kickboxing', ar: 'كيك بوكسينغ', disciplines: ['kickboxing'], nightclub: false },
  { key: 'muay_thai', en: 'Muay Thai', ar: 'مواي تاي', disciplines: ['muay_thai'], nightclub: false },
  { key: 'mma', en: 'Mixed martial arts', ar: 'فنون قتالية مختلطة', disciplines: ['mixed_martial_arts'], nightclub: false },
  { key: 'motor', en: 'Motor racing', ar: 'سباق سيارات', disciplines: ['motor_racing'], nightclub: false },
  { key: 'other_sport', en: 'Another sporting event', ar: 'فعالية رياضية أخرى', disciplines: [], nightclub: false },
  { key: 'nightclub', en: 'Event at a nightclub or dance venue', ar: 'فعالية في ملهى ليلي أو صالة رقص', disciplines: [], nightclub: true },
  { key: 'concert', en: 'Concert, festival or performance', ar: 'حفلة أو مهرجان أو عرض', disciplines: [], nightclub: false },
  { key: 'gathering', en: 'Conference, exhibition or ceremony', ar: 'مؤتمر أو معرض أو مراسم', disciplines: [], nightclub: false },
  { key: 'other', en: 'Something else', ar: 'شيء آخر', disciplines: [], nightclub: false },
];

/** The floor-carrying disciplines, for the "also includes" row. */
export const EXTRA_DISCIPLINES: { key: string; en: string; ar: string }[] = [
  { key: 'running', en: 'Running', ar: 'جري' },
  { key: 'cycling', en: 'Cycling', ar: 'دراجات' },
  { key: 'triathlon', en: 'Triathlon', ar: 'ترياتلون' },
  { key: 'open_water_swimming', en: 'Open-water swimming', ar: 'سباحة في المياه المفتوحة' },
  { key: 'boxing', en: 'Boxing', ar: 'ملاكمة' },
  { key: 'kickboxing', en: 'Kickboxing', ar: 'كيك بوكسينغ' },
  { key: 'muay_thai', en: 'Muay Thai', ar: 'مواي تاي' },
  { key: 'mixed_martial_arts', en: 'Mixed martial arts', ar: 'فنون قتالية مختلطة' },
  { key: 'motor_racing', en: 'Motor racing', ar: 'سباق سيارات' },
];

/**
 * DOMAIN 2 FROM THE EVENT TYPE (owner, 10 October 2026: "event activity is asked again after an
 * organizer chooses event type"). Where the type, with any added activity, answers the question
 * without doubt, the answer is filled in for the organizer, who can still change it:
 *  - any endurance or combat discipline (the list domain 2's top option names) answers 2;
 *  - a concert, festival or performance answers 1; a conference, exhibition or ceremony answers 0.
 * Another sporting event, a nightclub event and "something else" can fall under more than one
 * option, so they are left for the organizer. Null when the type does not decide it.
 */
export function activityAnswerForType(typeKey: string, disciplines: readonly string[]): 0 | 1 | 2 | null {
  if (disciplines.length > 0) return 2;
  if (typeKey === 'concert') return 1;
  if (typeKey === 'gathering') return 0;
  return null;
}

/**
 * An Arabic name holds Arabic letters (owner, 10 October 2026: "don't allow foreign characters"):
 * Arabic script, digits, spaces and ordinary punctuation. Any Latin or other letter refuses it.
 */
export function isArabicName(value: string): boolean {
  return !/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF0-9\s.,:;!?()\[\]"'«»\-–—/&+#@%]/.test(value);
}
