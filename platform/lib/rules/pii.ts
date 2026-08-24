/**
 * Personal-name detection for narrative fields.
 *
 * Non-negotiable #7 (facility incident report) and Protocol 14 (the post-event report
 * carries aggregate data and no unnecessary personally identifiable information). The
 * check is deliberately conservative: it looks for honorific-plus-name shapes and
 * "name is/was" patterns in both languages, not every capitalized word -- a screen that
 * cries wolf on "Beirut Marathon" gets ignored.
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

export function detectPersonalName(text: string): boolean {
  return PATTERNS.some((p) => p.test(text));
}
