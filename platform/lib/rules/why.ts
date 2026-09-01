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

import { LEVEL_REASON_TEMPLATES, MINIMUM_CONDITIONS } from './load';
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

export function levelWhy(derivation: LevelDerivation): LevelWhy {
  if (derivation.finalLevel === null) return { reason: null, comparison: null };
  const t = LEVEL_REASON_TEMPLATES;

  let reason: { en: string; ar: string } | null = null;
  if (derivation.governedBy === 'minimumCondition' || derivation.governedBy === 'both') {
    // The condition that set the floor: highest level among those that fired.
    const governing = derivation.triggeredConditions
      .filter((c) => c.level === derivation.minimumConditionLevel)
      .map((c) => MINIMUM_CONDITIONS.find((m) => m.key === c.key))
      .find((c) => c !== undefined);
    if (governing) reason = { en: governing.reasonEn, ar: governing.reasonAr };
  }
  if (derivation.governedBy === 'score' || (reason === null && derivation.scoreTotal !== null)) {
    reason = {
      en: fill(t.scoreEn, { score: derivation.scoreTotal ?? 0 }),
      ar: fill(t.scoreAr, { score: derivation.scoreTotal ?? 0 }),
    };
  }

  const comparison =
    derivation.minimumConditionLevel !== null
      ? {
          en: fill(t.comparisonEn, { scoreLevel: derivation.scoreBandLevel ?? '—', conditionLevel: derivation.minimumConditionLevel }),
          ar: fill(t.comparisonAr, { scoreLevel: derivation.scoreBandLevel ?? '—', conditionLevel: derivation.minimumConditionLevel }),
        }
      : {
          en: fill(t.scoreOnlyEn, { scoreLevel: derivation.scoreBandLevel ?? '—' }),
          ar: fill(t.scoreOnlyAr, { scoreLevel: derivation.scoreBandLevel ?? '—' }),
        };

  return { reason, comparison };
}
