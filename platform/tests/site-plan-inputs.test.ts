/**
 * The cardiac emergency response plan has no fields of its own (owner, 10 October 2026: "it
 * doesn't need any input? what does it need to become complete?"). The step lists what it is
 * built from, and it is complete exactly when every listed input is in.
 */
import { describe, expect, it } from 'vitest';
import { sitePlanComplete, sitePlanInputs, type SiteSubmissionFacts } from '../lib/rules/site';

const complete: SiteSubmissionFacts = {
  profileComplete: true, mapConfirmed: true, contactComplete: true, emsAccessComplete: true, aedRequired: true, deviceCount: 1, devicesNotReady: 0,
  confirmationRecorded: false, confirmationCurrent: false, infrastructureRecorded: false, documentCount: 0, photoCount: 0, outsideCategory: false,
};

describe('what the plan is built from', () => {
  it('lists five inputs, in both languages, all in for a complete record', () => {
    const inputs = sitePlanInputs(complete);
    expect(inputs.map((i) => i.key)).toEqual(['profile', 'map', 'emsAccess', 'contact', 'aeds']);
    expect(inputs.every((i) => i.done && i.en && i.ar)).toBe(true);
    expect(sitePlanComplete(complete)).toBe(true);
  });

  it('names the one missing input: a site without its map pin', () => {
    const f = { ...complete, mapConfirmed: false };
    expect(sitePlanInputs(f).filter((i) => !i.done).map((i) => i.key)).toEqual(['map']);
    expect(sitePlanComplete(f)).toBe(false);
  });

  it('each input alone holds the plan back', () => {
    const cases: [Partial<SiteSubmissionFacts>, string][] = [
      [{ profileComplete: false }, 'profile'], [{ emsAccessComplete: false }, 'emsAccess'],
      [{ contactComplete: false }, 'contact'], [{ deviceCount: 0 }, 'aeds'], [{ devicesNotReady: 1 }, 'aeds'],
    ];
    for (const [change, key] of cases) {
      const f = { ...complete, ...change };
      expect(sitePlanInputs(f).filter((i) => !i.done).map((i) => i.key)).toEqual([key]);
      expect(sitePlanComplete(f)).toBe(false);
    }
  });

  it('where no AED is required, none registered is not missing', () => {
    const f = { ...complete, aedRequired: false, deviceCount: 0 };
    expect(sitePlanComplete(f)).toBe(true);
    expect(sitePlanInputs(f).find((i) => i.key === 'aeds')!.en).toBe('Every registered AED ready');
  });
});
