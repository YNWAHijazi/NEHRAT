/**
 * Personal-name detection for narrative fields.
 *
 * Non-negotiable #7 (facility incident report) and Protocol 14 (the post-event report
 * carries aggregate data and no unnecessary personally identifiable information).
 *
 * Non-negotiable #7 is absolute, so the detector errs toward flagging: alongside the
 * precise shapes (honorific + name, "patient X", "named X"), any bare pair of
 * capitalized words is treated as a personal name unless either word is ordinary
 * domain vocabulary (places, organizations, facilities, dates). "Ali Hassan collapsed"
 * is the canonical narrative that must never pass; "Beirut Marathon" and "Municipal
 * Stadium" must. A proper-noun venue name that trips the gate is the acceptable cost:
 * the screen says to write the role instead, which is the right instruction anyway.
 *
 * Honest limitation: Arabic has no capitalization, so a bare Arabic name outside the
 * declared shapes (اسمه فلان، السيد فلان) is not machine-detectable here; the no-name
 * instruction on the form carries that case.
 */

const PATTERNS: RegExp[] = [
  // Honorific followed by a capitalized name: Mr Haddad, Dr. Sara K...
  /\b(?:Mr|Mrs|Ms|Miss|Dr|Nurse|Patient)\.?\s+[A-Z][a-z]+/,
  // "the patient, <Name> <Name>," shapes
  /\bpatient(?:'s)?\s+(?:name\s+(?:is|was)\s+)?[A-Z][a-z]+\s+[A-Z][a-z]+/,
  // named X Y (two capitalized words after "named")
  /\bnamed\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/,
  // Arabic honorifics: السيد / السيدة / الدكتور / الدكتورة / المريض اسمه...
  /(?:السيد|السيدة|الآنسة|الدكتور|الدكتورة)\s+\S+/,
  /(?:اسم المريض|اسمه|اسمها)\s+\S+/,
];

/**
 * Capitalized words that are ordinary vocabulary in these narratives, not given
 * names: a pair containing any of them is not treated as a personal name.
 */
const DOMAIN_WORDS = new Set(
  [
    // articles/prepositions/sentence machinery that capitalize at sentence start
    'The', 'A', 'An', 'In', 'On', 'At', 'After', 'Before', 'During', 'When', 'While',
    'This', 'That', 'These', 'Those', 'It', 'He', 'She', 'They', 'We', 'One', 'Two', 'Three',
    'No', 'Not', 'Nothing', 'None',
    // places and facility vocabulary
    'North', 'South', 'East', 'West', 'Main', 'New', 'Old', 'Upper', 'Lower',
    'Stadium', 'Hall', 'Club', 'Center', 'Centre', 'Complex', 'Arena', 'Field', 'Court',
    'Pool', 'Deck', 'Gate', 'Stand', 'Track', 'Gym', 'Campus', 'Building', 'Floor', 'Room',
    'Street', 'Road', 'Avenue', 'Square', 'Corniche', 'Waterfront', 'Municipal', 'National',
    'University', 'School', 'College', 'Hospital', 'Clinic', 'Academy',
    // events and organizations
    'Marathon', 'Festival', 'Race', 'Run', 'Cup', 'League', 'Team', 'Tournament', 'Championship',
    'Ministry', 'Public', 'Health', 'Red', 'Cross', 'Crescent', 'Civil', 'Defense', 'Defence',
    'Emergency', 'Department', 'Medical', 'Event', 'First', 'Aid', 'Response', 'Readiness',
    'Sports', 'Summer', 'Winter', 'Spring', 'Autumn',
    // Lebanese places
    'Lebanon', 'Lebanese', 'Beirut', 'Tripoli', 'Saida', 'Sidon', 'Tyre', 'Sour', 'Jounieh',
    'Byblos', 'Jbeil', 'Baalbeck', 'Baalbek', 'Zahle', 'Batroun', 'Aley', 'Nabatieh',
    // dates
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December',
  ].map((w) => w.toLowerCase()),
);

function barePairLooksLikeName(text: string): boolean {
  for (const m of text.matchAll(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g)) {
    const first = m[1]!.toLowerCase();
    const second = m[2]!.toLowerCase();
    if (!DOMAIN_WORDS.has(first) && !DOMAIN_WORDS.has(second)) return true;
  }
  return false;
}

export function detectPersonalName(text: string): boolean {
  return PATTERNS.some((p) => p.test(text)) || barePairLooksLikeName(text);
}
