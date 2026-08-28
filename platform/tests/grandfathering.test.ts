/**
 * A new requirement and the submissions that predate it.
 *
 * MINISTRY RULING, 2026-08-29, and the middle case is the one that matters: a
 * submission filed before the requirement existed and NOT yet determined is asked for
 * the new document through the ordinary revision route, never blocked silently. An
 * organizer discovering on their own screen that a filed submission has become
 * unfileable, with no message and no route, is the failure the rule exists to prevent.
 */
import { describe, expect, it } from 'vitest';
import { blocksFiling, documentEffectiveFrom, grandfatherState } from '../lib/rules/grandfathering';

const EFFECTIVE = '2026-08-28';

describe('the effective date is configured, not the deploy date', () => {
  it('the document carries its own date', () => {
    // A requirement that begins when the software happens to ship is a requirement
    // nobody can plan for, and it makes the regulation a property of the release.
    expect(documentEffectiveFrom('insuranceEvidence')).toBe(EFFECTIVE);
  });

  it('a document with no date has always applied', () => {
    expect(documentEffectiveFrom('siteMap')).toBeNull();
    expect(grandfatherState('siteMap', { today: '2020-01-01', filedAt: null, determined: false })).toBe('applies');
  });
});

describe('how a new requirement lands', () => {
  const on = (filedAt: string | null, determined: boolean, today = '2026-09-01') =>
    grandfatherState('insuranceEvidence', { today, filedAt, determined });

  it('before its effective date it is in force for nobody', () => {
    expect(on(null, false, '2026-08-01')).toBe('notYetInForce');
    expect(blocksFiling('insuranceEvidence', { today: '2026-08-01', filedAt: null, determined: false })).toBe(false);
  });

  it('an unfiled submission is subject to it like any other', () => {
    expect(on(null, false)).toBe('applies');
    expect(blocksFiling('insuranceEvidence', { today: '2026-09-01', filedAt: null, determined: false })).toBe(true);
  });

  it('a submission filed and DETERMINED before it stands', () => {
    // Reopening settled determinations to collect a document that did not exist when
    // they were made would unsettle every filing every time an annex changes.
    expect(on('2026-08-01', true)).toBe('standsDetermined');
    expect(blocksFiling('insuranceEvidence', { today: '2026-09-01', filedAt: '2026-08-01', determined: true })).toBe(false);
  });

  it('a submission filed and NOT determined is asked, never blocked', () => {
    // THE CASE THE RULING IS ABOUT. The reviewer records a revision outcome and the
    // organizer is told what is missing; the gate does not refuse them in silence.
    expect(on('2026-08-01', false)).toBe('askOnRevision');
    expect(blocksFiling('insuranceEvidence', { today: '2026-09-01', filedAt: '2026-08-01', determined: false })).toBe(false);
  });

  it('a submission filed ON the effective date is subject to it', () => {
    // The boundary: "from that date forward" includes the date itself.
    expect(on(EFFECTIVE, false)).toBe('applies');
  });

  it('only "applies" ever blocks filing', () => {
    const states: [string | null, boolean][] = [[null, false], ['2026-08-01', true], ['2026-08-01', false], [EFFECTIVE, false]];
    for (const [filedAt, determined] of states) {
      const facts = { today: '2026-09-01', filedAt, determined };
      expect(blocksFiling('insuranceEvidence', facts)).toBe(grandfatherState('insuranceEvidence', facts) === 'applies');
    }
  });
});
