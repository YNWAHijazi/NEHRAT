/**
 * The lay one-line explanation of a derived level.
 *
 * The partner review replaced the organizer-facing ten-condition checklist with "the
 * result and one line why" -- the full derivation detail stays on the Ministry reviewer's
 * screen, not the organizer's. This is that line, derived from the same LevelDerivation
 * the screens already hold, so the sentence can never disagree with the level.
 *
 * Every string comes from minimum-conditions.json: a governing condition brings its own
 * reasonEn/reasonAr (living beside the threshold it describes, so a Ministry threshold
 * edit updates number and sentence in one row), and the score/both templates are the
 * file's `reasons` object. Nothing here is copy in code.
 */

import { DOMAIN_COUNT, LEVEL_REASON_TEMPLATES, MAX_SCORE_PER_DOMAIN, MINIMUM_CONDITIONS } from './load';
import type { LevelDerivation } from './types';

export interface LevelWhy {
  /** "Because ..." -- the single lay sentence under the level. */
  reason: { en: string; ar: string } | null;
  /** Both results and which governed, compact (non-negotiable 1 still reports both). */
  comparison: { en: string; ar: string } | null;
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
}

export function levelWhy(
  derivation: LevelDerivation,
  pickedDisciplines?: readonly string[],
): LevelWhy {
  if (derivation.finalLevel === null) return { reason: null, comparison: null };
  const t = LEVEL_REASON_TEMPLATES;

  let reason: { en: string; ar: string } | null = null;
  if (derivation.governedBy === 'minimumCondition' || derivation.governedBy === 'both') {
    // The condition that set the floor: highest level among those that fired.
    const candidates = derivation.triggeredConditions
      .filter((c) => c.level === derivation.minimumConditionLevel)
      .map((c) => MINIMUM_CONDITIONS.find((m) => m.key === c.key))
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
    let governing = candidates[0];
    // Say the thing the organizer picked (partner ruling): when several
    // discipline-keyed conditions tie at the governing level, the one matching the
    // earliest-picked discipline names the reason -- a triathlon reads "a triathlon",
    // not the open-water category it also satisfies. A condition not keyed on a
    // discipline (attendance, capacity) keeps its precedence untouched.
    const disciplineIndex = (cond: NonNullable<typeof governing>): number | null => {
      const clause = cond.derivation.all?.find((cl) => cl.input === 'eventDisciplines');
      if (!clause || !Array.isArray(clause.value)) return null;
      const values = clause.value as readonly string[];
      const i = (pickedDisciplines ?? []).findIndex((d) => values.includes(d));
      return i === -1 ? null : i;
    };
    if (governing && pickedDisciplines && pickedDisciplines.length > 0 && disciplineIndex(governing) !== null) {
      governing = candidates.reduce((best, c) => {
        const bi = disciplineIndex(best);
        const ci = disciplineIndex(c);
        return ci !== null && (bi === null || ci < bi) ? c : best;
      }, governing);
    }
    if (governing) reason = { en: governing.reasonEn, ar: governing.reasonAr };
  }
  if (derivation.governedBy === 'score' || (reason === null && derivation.scoreTotal !== null)) {
    reason = {
      en: fill(t.scoreEn, { score: derivation.scoreTotal ?? 0 }),
      ar: fill(t.scoreAr, { score: derivation.scoreTotal ?? 0 }),
    };
  }

  // The points figure travels with the points ("Points: Level 2 (9 of 18)"), not as a
  // trailing bracket the screens append -- partner ruling on the derivation line.
  const points = {
    score: derivation.scoreTotal ?? '—',
    max: DOMAIN_COUNT * MAX_SCORE_PER_DOMAIN,
  };
  const comparison =
    derivation.minimumConditionLevel !== null
      ? {
          en: fill(t.comparisonEn, { scoreLevel: derivation.scoreBandLevel ?? '—', conditionLevel: derivation.minimumConditionLevel, ...points }),
          ar: fill(t.comparisonAr, { scoreLevel: derivation.scoreBandLevel ?? '—', conditionLevel: derivation.minimumConditionLevel, ...points }),
        }
      : {
          en: fill(t.scoreOnlyEn, { scoreLevel: derivation.scoreBandLevel ?? '—', ...points }),
          ar: fill(t.scoreOnlyAr, { scoreLevel: derivation.scoreBandLevel ?? '—', ...points }),
        };

  return { reason, comparison };
}
