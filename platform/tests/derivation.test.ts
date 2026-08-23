/**
 * Non-negotiable #0 and #1 -- level derivation, the higher-of rule, and every minimum
 * condition. This is the test that matters most: a wrong level is the failure this
 * platform exists to prevent.
 */

import { describe, expect, it } from 'vitest';
import { bandForScore, deriveLevel } from '../lib/rules/derive';
import { MINIMUM_CONDITIONS, BANDS, DOMAINS } from '../lib/rules/load';
import type { DomainAnswers, MinimumConditionInputs } from '../lib/rules/types';

/** Nine domains all answered `score`. */
const answersAll = (score: 0 | 1 | 2): DomainAnswers => Array(9).fill(score);

/** Nine answers summing to `total`, so a band can be targeted precisely. */
function answersTotalling(total: number): DomainAnswers {
  const out: (0 | 1 | 2)[] = Array(9).fill(0);
  let left = total;
  for (let i = 0; i < 9 && left > 0; i += 1) {
    const take = Math.min(2, left) as 0 | 1 | 2;
    out[i] = take;
    left -= take;
  }
  if (left > 0) throw new Error(`Cannot reach ${total} with nine domains scored 0-2`);
  return out;
}

/** Inputs captured, with nothing triggering a minimum condition. */
const benignInputs: MinimumConditionInputs = {
  expectedMaxSimultaneousAttendance: 500,
  eventDisciplines: [],
  courseDistanceKm: null,
  venueLicensedCapacity: 200,
  venueIsNightclubOrDanceVenue: false,
  venueRegularlyHostsOrganizedEvents: false,
};

describe('the data itself', () => {
  it('carries nine domains of three options', () => {
    expect(DOMAINS).toHaveLength(9);
    for (const d of DOMAINS) expect(d.options).toHaveLength(3);
  });

  it('carries ten minimum conditions', () => {
    expect(MINIMUM_CONDITIONS).toHaveLength(10);
  });

  it('bands cover 0 to 18 with no gap and no overlap', () => {
    const sorted = [...BANDS].sort((a, b) => a.minScore - b.minScore);
    expect(sorted[0]!.minScore).toBe(0);
    expect(sorted[sorted.length - 1]!.maxScore).toBe(18);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]!.minScore).toBe(sorted[i - 1]!.maxScore + 1);
    }
  });

  it('every score 0-18 lands in exactly one band', () => {
    for (let s = 0; s <= 18; s += 1) {
      const matches = BANDS.filter((b) => s >= b.minScore && s <= b.maxScore);
      expect(matches, `score ${s}`).toHaveLength(1);
    }
  });
});

describe('score bands', () => {
  it.each([
    [0, 1],
    [5, 1],
    [6, 2],
    [11, 2],
    [12, 3],
    [18, 3],
  ])('score %i is band level %i', (score, level) => {
    expect(bandForScore(score)).toBe(level);
  });
});

describe('the higher-of rule', () => {
  it('takes the score when it is higher, and says so', () => {
    const r = deriveLevel({ answers: answersAll(2), inputs: benignInputs });
    expect(r.scoreTotal).toBe(18);
    expect(r.scoreBandLevel).toBe(3);
    expect(r.minimumConditionLevel).toBeNull();
    expect(r.finalLevel).toBe(3);
    expect(r.governedBy).toBe('score');
  });

  it('takes the minimum condition when it is higher, and says so', () => {
    // Scores 0 -- band Level 1 -- but 25,000 people forces Level 3.
    const r = deriveLevel({
      answers: answersAll(0),
      inputs: { ...benignInputs, expectedMaxSimultaneousAttendance: 25_000 },
    });
    expect(r.scoreBandLevel).toBe(1);
    expect(r.minimumConditionLevel).toBe(3);
    expect(r.finalLevel).toBe(3);
    expect(r.governedBy).toBe('minimumCondition');
  });

  it('reports both when they agree', () => {
    // Score 9 is band Level 2; a nightclub licensed for 1,200 also forces Level 2.
    const r = deriveLevel({
      answers: answersTotalling(9),
      inputs: {
        ...benignInputs,
        venueIsNightclubOrDanceVenue: true,
        venueLicensedCapacity: 1_200,
      },
    });
    expect(r.scoreBandLevel).toBe(2);
    expect(r.minimumConditionLevel).toBe(2);
    expect(r.finalLevel).toBe(2);
    expect(r.governedBy).toBe('both');
  });

  it('always reports both results, so an organizer can see why', () => {
    const r = deriveLevel({
      answers: answersTotalling(9),
      inputs: { ...benignInputs, expectedMaxSimultaneousAttendance: 25_000 },
    });
    // Scored 9 -- Level 2 -- but lands at Level 3. Both numbers must be visible.
    expect(r.scoreTotal).toBe(9);
    expect(r.scoreBandLevel).toBe(2);
    expect(r.minimumConditionLevel).toBe(3);
    expect(r.finalLevel).toBe(3);
    expect(r.triggeredConditions.map((c) => c.key)).toContain('att3');
  });

  it('never returns a level below either result', () => {
    for (let total = 0; total <= 18; total += 1) {
      const r = deriveLevel({
        answers: answersTotalling(total),
        inputs: { ...benignInputs, expectedMaxSimultaneousAttendance: 25_000 },
      });
      expect(r.finalLevel).toBeGreaterThanOrEqual(r.scoreBandLevel!);
      expect(r.finalLevel).toBeGreaterThanOrEqual(r.minimumConditionLevel!);
    }
  });
});

describe('every minimum condition fires from captured data', () => {
  const cases: Record<string, Partial<MinimumConditionInputs>> = {
    att2: { expectedMaxSimultaneousAttendance: 15_000 },
    att3: { expectedMaxSimultaneousAttendance: 20_000 },
    club: { venueIsNightclubOrDanceVenue: true, venueLicensedCapacity: 1_000 },
    recur: { venueRegularlyHostsOrganizedEvents: true, venueLicensedCapacity: 1_000 },
    run: { eventDisciplines: ['running'], courseDistanceKm: 10 },
    run21: { eventDisciplines: ['running'], courseDistanceKm: 21.1 },
    tri: { eventDisciplines: ['triathlon'] },
    open: { eventDisciplines: ['open_water_swimming'] },
    combat: { eventDisciplines: ['boxing'] },
    motor: { eventDisciplines: ['motor_racing'] },
  };

  it('has a case for all ten', () => {
    expect(Object.keys(cases).sort()).toEqual(
      MINIMUM_CONDITIONS.map((c) => c.key).sort(),
    );
  });

  for (const condition of MINIMUM_CONDITIONS) {
    it(`${condition.key} fires and forces at least level ${condition.level}`, () => {
      const r = deriveLevel({
        answers: answersAll(0),
        inputs: { ...benignInputs, ...cases[condition.key] },
      });
      expect(r.triggeredConditions.map((c) => c.key)).toContain(condition.key);
      expect(r.finalLevel).toBeGreaterThanOrEqual(condition.level);
    });
  }

  it('fires nothing when nothing applies', () => {
    const r = deriveLevel({ answers: answersAll(0), inputs: benignInputs });
    expect(r.triggeredConditions).toHaveLength(0);
    expect(r.minimumConditionLevel).toBeNull();
    expect(r.finalLevel).toBe(1);
  });
});

/**
 * Non-negotiable #0. The prototype used manual checkboxes for seven of the ten conditions.
 * These two are the ones that produce a silently wrong level.
 */
describe('the two derivation traps', () => {
  it('20,000 people is Level 3, not the Level 2 that domain 1 alone would give', () => {
    // Domain 1's top option is "10,000 persons or more" and spans both floors.
    const answers: DomainAnswers = [2, 0, 0, 0, 0, 0, 0, 0, 0];
    const r = deriveLevel({
      answers,
      inputs: { ...benignInputs, expectedMaxSimultaneousAttendance: 25_000 },
    });
    const keys = r.triggeredConditions.map((c) => c.key);
    expect(keys).toContain('att3');
    expect(keys).not.toContain('att2');
    expect(r.finalLevel).toBe(3);
  });

  it('splits 10,000-19,999 from 20,000+ on the number, not the domain answer', () => {
    const at19999 = deriveLevel({
      answers: answersAll(0),
      inputs: { ...benignInputs, expectedMaxSimultaneousAttendance: 19_999 },
    });
    expect(at19999.finalLevel).toBe(2);

    const at20000 = deriveLevel({
      answers: answersAll(0),
      inputs: { ...benignInputs, expectedMaxSimultaneousAttendance: 20_000 },
    });
    expect(at20000.finalLevel).toBe(3);
  });

  it('a 21.1 km course is Level 3', () => {
    const r = deriveLevel({
      answers: answersAll(0),
      inputs: { ...benignInputs, eventDisciplines: ['running'], courseDistanceKm: 21.1 },
    });
    expect(r.triggeredConditions.map((c) => c.key)).toContain('run21');
    expect(r.finalLevel).toBe(3);
  });

  it('a running event with no course distance does not silently return Level 2', () => {
    const r = deriveLevel({
      answers: answersAll(0),
      inputs: { ...benignInputs, eventDisciplines: ['running'], courseDistanceKm: null },
    });
    // The failure this platform exists to prevent: an unanswered field returning a level.
    expect(r.finalLevel).toBeNull();
    expect(r.complete).toBe(false);
    expect(r.missingInputs).toContain('courseDistanceKm');
  });

  it('does not demand a course distance from an event that is not a run', () => {
    const r = deriveLevel({
      answers: answersAll(0),
      inputs: { ...benignInputs, eventDisciplines: ['triathlon'] },
    });
    expect(r.missingInputs).not.toContain('courseDistanceKm');
    expect(r.complete).toBe(true);
  });
});

describe('incomplete assessments', () => {
  it('returns no level while a domain is unanswered', () => {
    const answers: DomainAnswers = [2, 2, null, 1, 1, 0, 0, 0, 0];
    const r = deriveLevel({ answers, inputs: benignInputs });
    expect(r.finalLevel).toBeNull();
    expect(r.complete).toBe(false);
    expect(r.missingInputs).toContain('domain3');
  });

  it('returns no level while the attendance figure is missing', () => {
    const r = deriveLevel({
      answers: answersAll(1),
      inputs: { ...benignInputs, expectedMaxSimultaneousAttendance: null },
    });
    expect(r.finalLevel).toBeNull();
    expect(r.missingInputs).toContain('expectedMaxSimultaneousAttendance');
  });
});

describe('the level is derived, never chosen', () => {
  it('exposes no way to set a level', async () => {
    const rules = await import('../lib/rules/index');
    const setters = Object.keys(rules).filter((k) => /^(set|choose|assign|override)/i.test(k));
    expect(setters).toEqual([]);
  });
});
