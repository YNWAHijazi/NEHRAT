/**
 * Certification blocks: the fields a signature is made with, and whether they are there.
 *
 * WHAT WENT WRONG. An EMS provider signed a readiness declaration with an empty Date
 * and the declaration was released to the organizer. The sign action checked the ten
 * declaration items and NEVER LOOKED AT THE CERTIFICATION BLOCK AT ALL -- the fields
 * were collected, stored and rendered, and nothing anywhere asserted they had values.
 * The organizer's own certification had the identical hole: a submission could be
 * filed with no authorized representative named.
 *
 * A certification is the point at which a person attaches their name to a regulatory
 * statement. A block with an empty name, an empty position or an empty date is not a
 * signature; it is a record that somebody pressed a button.
 *
 * ONE RULE FOR EVERY BLOCK, which is the actual fix. Two blocks had the same defect
 * because each validated itself, which is to say neither did. Everything that signs
 * now asks this module, and tests/certification.test.ts asserts that every block
 * defined in the data is reachable through it -- so a third block cannot be added
 * with a third answer.
 *
 * THE POST-EVENT REPORT IS DELIBERATELY NOT HERE. Its signatures are marks, not field
 * blocks: the organizer and the Director each sign, and there is nothing to fill in.
 * It was checked for the same hole and does not have one.
 */

import complianceJson from './data/compliance-form.json';
import rolesJson from './data/roles.json';
import type { BilingualField } from './content';

export type CertificationBlockKey = 'organizer' | 'ems';

export interface CertificationBlock {
  key: CertificationBlockKey;
  /** Every field is required. A certification has no optional part. */
  fields: readonly BilingualField[];
  en: string;
  ar: string;
}

export const CERTIFICATION_BLOCKS: Record<CertificationBlockKey, CertificationBlock> = {
  organizer: {
    key: 'organizer',
    fields: complianceJson.organizerCertification.fields as readonly BilingualField[],
    en: 'Organizer certification',
    ar: 'تصديق المنظِّم',
  },
  ems: {
    key: 'ems',
    fields: rolesJson.ems.certificationFields as readonly BilingualField[],
    en: 'EMS provider certification',
    ar: 'تصديق مزوّد الإسعاف',
  },
};

/**
 * The fields of a block that have no value, IN THE ORDER THE BLOCK DEFINES THEM.
 *
 * Returned as the field definitions rather than as keys, so the caller can name what
 * is missing in both languages without re-deriving the labels. "Something is missing"
 * is not a message; "Date" is.
 */
export function missingCertificationFields(
  block: CertificationBlockKey,
  values: Readonly<Record<string, string | undefined>>,
): BilingualField[] {
  return CERTIFICATION_BLOCKS[block].fields.filter(
    (f) => (values[f.key] ?? '').trim() === '',
  );
}

/** Is this certification complete? Every field, no exceptions. */
export function certificationComplete(
  block: CertificationBlockKey,
  values: Readonly<Record<string, string | undefined>>,
): boolean {
  return missingCertificationFields(block, values).length === 0;
}

/** One sentence naming what is outstanding, for a gate that has to say why. */
export function certificationBlockerText(
  block: CertificationBlockKey,
  values: Readonly<Record<string, string | undefined>>,
): { en: string; ar: string } | null {
  const missing = missingCertificationFields(block, values);
  if (missing.length === 0) return null;
  const def = CERTIFICATION_BLOCKS[block];
  return {
    en: `${def.en} — not complete: ${missing.map((f) => f.en).join(', ')}`,
    ar: `${def.ar} — غير مكتمل: ${missing.map((f) => f.ar).join('، ')}`,
  };
}
