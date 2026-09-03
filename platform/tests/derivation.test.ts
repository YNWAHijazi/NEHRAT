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
};

describe('the data itself', () => {
  it('carries nine domains of three options', () => {
    expect(DOMAINS).toHaveLength(9);
    for (const d of DOMAINS) expect(d.options).toHaveLength(3);
  });

  it('carries the nine minimum conditions of the English issue', () => {
    // Nine, not ten: the earlier build carried the union of the two issues, and the
    // partner ruling (English governs, 2026-09-01) removed the Arabic issue's
    // recurring-venue generalization of the nightclub row. The exact difference is
    // pinned in tests/reference-drift.test.ts (RULINGS).
    expect(MINIMUM_CONDITIONS).toHaveLength(9);
    expect(MINIMUM_CONDITIONS.some((c) => c.key === 'recur')).toBe(false);
    expect(MINIMUM_CONDITIONS.some((c) => c.key === 'club')).toBe(true);
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
    run: { eventDisciplines: ['running'], courseDistanceKm: 10 },
    run21: { eventDisciplines: ['running'], courseDistanceKm: 21.1 },
    tri: { eventDisciplines: ['triathlon'] },
    open: { eventDisciplines: ['open_water_swimming'] },
    combat: { eventDisciplines: ['boxing'] },
    motor: { eventDisciplines: ['motor_racing'] },
  };

  it('has a case for all nine', () => {
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
  it('exposes no OPERATION that sets, chooses, assigns or overrides', async () => {
    // Narrowed to callables, and here is why rather than because it was in the way.
    // The pattern is a verb test applied to names, and a name can be a noun:
    // ASSIGNABLE_ROLES is a list of the roles an administrator may grant, and a list
    // cannot set anything. Requiring a FUNCTION keeps exactly the property this
    // guards -- lib/rules derives, and nothing in it performs an assignment -- while
    // no longer reporting a constant for its part of speech.
    const rules = (await import('../lib/rules/index')) as Record<string, unknown>;
    const setters = Object.keys(rules).filter(
      (k) => /^(set|choose|assign|override)/i.test(k) && typeof rules[k] === 'function',
    );
    expect(setters).toEqual([]);
  });

  it('and no CONSTANT smuggles a level in under one of those names either', async () => {
    // The narrowing above is only safe while non-callables named that way have
    // nothing to do with levels. This is the other half of the pair.
    const rules = (await import('../lib/rules/index')) as Record<string, unknown>;
    const suspicious = Object.keys(rules).filter(
      (k) => /^(set|choose|assign|override)/i.test(k) && /level/i.test(k),
    );
    expect(suspicious).toEqual([]);
  });

  it('the guard is looking at a real module', () => {
    // A test asserting an empty list passes just as well against an empty module.
    return import('../lib/rules/index').then((rules) => {
      expect(Object.keys(rules).length).toBeGreaterThan(50);
    });
  });
});

describe('Annex A Part F, verbatim from each issue', () => {
  it('carries the statement exactly, and the AR divergence is recorded, not reconciled', async () => {
    const { PART_F } = await import('../lib/rules/load');
    // EN issue, line 144 of source-documents/en/02.
    expect(PART_F.statementEn).toBe('I certify that the information provided in this assessment is complete and accurate.');
    // ENGLISH GOVERNS (partner ruling, 2026-09-03): the rendered Arabic carries
    // the Arabic issue's wording for the limbs the English also has, and nothing
    // more. The Arabic issue's extra qualifiers are RECORDED as a set-aside and
    // must never migrate back into the rendered statement.
    expect(PART_F.statementAr).toBe('أقر بأن المعلومات الواردة في هذا التقييم كاملة ودقيقة.');
    const setAside = (PART_F as unknown as { setAsideAr: { text: string; noteEn: string } }).setAsideAr;
    expect(setAside.text).toBe('وصحيحة بحسب علمي');
    expect(setAside.noteEn).toContain('English-governs');
    expect(PART_F.statementAr).not.toContain(setAside.text);
    expect(PART_F.titleEn).toBe('Part F — Organizer Declaration');
    expect(PART_F.titleAr).toBe('الجزء و — إقرار المنظم');
    for (const key of ['organizer', 'representative', 'position', 'date'] as const) {
      expect(PART_F.labels[key].en.trim().length).toBeGreaterThan(0);
      expect(PART_F.labels[key].ar.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('English governs, everywhere — the standing ruling (2026-09-03)', () => {
  it('no rendered string carries an Arabic-issue extra limb, and every set-aside is recorded', async () => {
    const compliance = (await import('../lib/rules/data/compliance-form.json')).default as {
      sectionB: { items: { en: string; ar: string; setAsideAr?: string }[] };
    };
    const item7 = compliance.sectionB.items[6]!;
    const item10 = compliance.sectionB.items[9]!;
    expect(item7.ar).not.toContain('التنسيق');
    expect(item7.setAsideAr).toContain('وتحديد وسيلة الاتصال');
    expect(item10.ar).not.toContain('جاهزيتها');
    expect(item10.setAsideAr).toContain('وأكدت جاهزيتها');

    const matrix = (await import('../lib/rules/data/requirements-matrix.json')).default as unknown as {
      requirements: { n?: number; number?: number; en: string; ar: string; setAsideAr?: string; setAsideEn?: string }[];
    };
    const row = (n: number) => matrix.requirements.find((r) => (r.n ?? r.number) === n)!;
    expect(row(7).ar).toBe('ترتيبات سيارات الإسعاف');
    expect(row(7).setAsideAr).toContain('والنقل');
    // Row 13: the built ENGLISH had carried the Arabic issue's extra limb too.
    // The English issue reads "notified" alone, and now so does the build.
    expect(row(13).en).toBe('Participating EMS provider notified');
    expect(row(13).setAsideEn).toContain('coordinated');
    expect(row(13).ar).not.toContain('التنسيق');
    expect(row(15).ar).not.toContain('محددة');
  });
});
