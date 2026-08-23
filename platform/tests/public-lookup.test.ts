/**
 * Non-negotiable #5 and #5b, enforced on the server.
 *
 * The lookup returns four fields. Nothing else LEAVES the server -- not merely nothing
 * else renders. And the endpoint must not answer an incrementing sequence.
 */

import { describe, expect, it } from 'vitest';
import {
  PUBLIC_LOOKUP_FIELDS,
  projectPublicLookup,
  resolvePublicLookup,
  NOT_FOUND,
  type SubmissionRecord,
} from '../lib/rules/public-lookup';

const record: SubmissionRecord = {
  referenceNumber: 'MOPH-EV-2026-0362',
  eventName: 'Beirut Coastal 12K',
  level: 2,
  status: 'Health and medical preparedness requirements satisfied',
  isDemo: false,
  eventStartDate: '2026-10-01',
  // Everything below must never leave the server.
  organizerEmail: 'organizer@example.org',
  organizerPhone: '+961 1 000 000',
  assessmentAnswers: [2, 1, 0, 1, 1, 0, 0, 1, 0],
  attachments: ['risk-assessment.pdf'],
  internalNotes: 'Awaiting attestation',
};

describe('the field limit', () => {
  it('is four fields', () => {
    expect([...PUBLIC_LOOKUP_FIELDS]).toEqual(['exists', 'eventName', 'level', 'status']);
  });

  it('returns exactly those four keys and no others', () => {
    const result = projectPublicLookup(record);
    expect(Object.keys(result).sort()).toEqual([...PUBLIC_LOOKUP_FIELDS].sort());
  });

  it('leaks no contact detail, document or assessment answer', () => {
    const serialised = JSON.stringify(projectPublicLookup(record));
    for (const secret of [
      'organizer@example.org',
      '+961 1 000 000',
      'risk-assessment.pdf',
      'Awaiting attestation',
      'assessmentAnswers',
    ]) {
      expect(serialised, `${secret} left the server`).not.toContain(secret);
    }
  });

  it('cannot leak a field added to the record later', () => {
    const widened = { ...record, newlyAddedSecret: 'must not appear' } as SubmissionRecord;
    const serialised = JSON.stringify(projectPublicLookup(widened));
    expect(serialised).not.toContain('must not appear');
    expect(Object.keys(projectPublicLookup(widened))).toHaveLength(4);
  });
});

describe('enumeration', () => {
  const find = (ref: string): SubmissionRecord | null =>
    ref === record.referenceNumber ? record : null;

  it('refuses a caller holding only a reference number', () => {
    expect(resolvePublicLookup({ referenceNumber: 'MOPH-EV-2026-0362' }, find)).toEqual(NOT_FOUND);
  });

  it('answers a caller who also knows the event date', () => {
    const result = resolvePublicLookup(
      { referenceNumber: 'MOPH-EV-2026-0362', eventStartDate: '2026-10-01' },
      find,
    );
    expect(result.exists).toBe(true);
    expect(result.eventName).toBe('Beirut Coastal 12K');
    expect(result.level).toBe(2);
  });

  it('is indistinguishable between a wrong second factor and a missing record', () => {
    const wrongFactor = resolvePublicLookup(
      { referenceNumber: 'MOPH-EV-2026-0362', eventStartDate: '2026-01-01' },
      find,
    );
    const missing = resolvePublicLookup(
      { referenceNumber: 'MOPH-EV-2026-9999', eventStartDate: '2026-10-01' },
      find,
    );
    expect(wrongFactor).toEqual(missing);
    expect(wrongFactor).toEqual(NOT_FOUND);
  });

  it('does not resolve a demonstration submission', () => {
    const demo = { ...record, isDemo: true };
    const result = resolvePublicLookup(
      { referenceNumber: demo.referenceNumber, eventStartDate: demo.eventStartDate },
      () => demo,
    );
    expect(result).toEqual(NOT_FOUND);
  });

  it('walking a sequence yields nothing', () => {
    const hits = Array.from({ length: 500 }, (_, i) =>
      resolvePublicLookup(
        { referenceNumber: `MOPH-EV-2026-${String(i).padStart(4, '0')}` },
        find,
      ),
    ).filter((r) => r.exists);
    expect(hits).toEqual([]);
  });
});
