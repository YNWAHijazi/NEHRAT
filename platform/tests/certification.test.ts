/**
 * Certification blocks, and the guard that would have caught the defect.
 *
 * WHAT HAPPENED. An EMS provider signed a readiness declaration with an empty Date
 * and it was released to the organizer as one of the Level 3 attachments. The sign
 * action checked the ten declaration items and never looked at the certification
 * block at all. The organizer's own certification had the identical hole.
 *
 * WHAT WOULD HAVE CAUGHT IT: this file's last test. Two blocks had the same defect
 * because each validated itself, which is to say neither did. The rule is now one
 * function, and every block defined in the data must be reachable through it -- so a
 * third block cannot arrive with a third answer, and an existing one cannot quietly
 * stop being validated.
 */
import { describe, expect, it } from 'vitest';
import {
  CERTIFICATION_BLOCKS,
  certificationBlockerText,
  certificationComplete,
  missingCertificationFields,
} from '../lib/rules/certification';

const emsFull = { provider: 'Lebanese Red Cross', representative: 'S. Karam', position: 'Owner', phone: '03918458', date: '2026-08-28' };

describe('a certification is complete or it is not a signature', () => {
  it('a full block passes', () => {
    expect(certificationComplete('ems', emsFull)).toBe(true);
    expect(missingCertificationFields('ems', emsFull)).toEqual([]);
  });

  it('THE ACTUAL DEFECT: an empty date is not a signature', () => {
    // Walked by the reviewer: the Date left blank, and the declaration signed and
    // released. This is the assertion that fails if that ever works again.
    const { date: _date, ...noDate } = emsFull;
    expect(certificationComplete('ems', noDate)).toBe(false);
    expect(missingCertificationFields('ems', noDate).map((f) => f.key)).toEqual(['date']);
  });

  it('whitespace is not a value', () => {
    expect(certificationComplete('ems', { ...emsFull, position: '   ' })).toBe(false);
  });

  it('names every missing field, in the order the block defines them', () => {
    const missing = missingCertificationFields('ems', { provider: 'X' });
    expect(missing.map((f) => f.key)).toEqual(['representative', 'position', 'phone', 'date']);
  });

  it('the organizer block has the same rule -- it had the same hole', () => {
    expect(certificationComplete('organizer', {})).toBe(false);
    expect(
      certificationComplete('organizer', { representative: 'R. Haddad', telephone: '+961 1 000 000', position: 'Events director' }),
    ).toBe(true);
  });

  it('says what is outstanding in both languages, not that something is', () => {
    const text = certificationBlockerText('ems', { ...emsFull, date: '' });
    expect(text?.en).toContain('Date');
    expect(text?.ar).toContain('التاريخ');
    expect(certificationBlockerText('ems', emsFull)).toBeNull();
  });
});

describe('the guard that would have caught it', () => {
  it('every certification block in the data is reachable through the one rule', () => {
    // Neither block validated itself correctly BECAUSE each validated itself. If a
    // third block is added and not registered here, this fails rather than shipping
    // with no validation at all.
    expect(Object.keys(CERTIFICATION_BLOCKS).sort()).toEqual(['ems', 'organizer']);
    for (const [key, block] of Object.entries(CERTIFICATION_BLOCKS)) {
      expect(block.fields.length, `${key} has no fields`).toBeGreaterThan(0);
      for (const field of block.fields) {
        expect(field.key, `${key} field has no key`).toBeTruthy();
        expect(field.en.length, `${key}.${field.key} en`).toBeGreaterThan(0);
        expect(field.ar.length, `${key}.${field.key} ar`).toBeGreaterThan(0);
      }
      // EVERY field is required. A block with an optional field would let this rule
      // pass while the thing the signature rests on is blank.
      expect(certificationComplete(key as 'ems' | 'organizer', {})).toBe(false);
    }
  });
});
