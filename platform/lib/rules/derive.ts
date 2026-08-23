/**
 * Level derivation.
 *
 * Nine domains scored 0-2, total 0-18, banded. Ten minimum conditions attached to
 * attendance figures, disciplines and venue facts. The final level is the HIGHER of the
 * two results, and the caller is told which one governed.
 *
 * Non-negotiable #1: the level is derived, never chosen. Nothing in this module accepts
 * a level as input, and nothing returns a setter.
 */

import {
  BANDS,
  DOMAIN_COUNT,
  MAX_SCORE_PER_DOMAIN,
  MINIMUM_CONDITIONS,
} from './load';
import { evaluatePredicate } from './predicate';
import type {
  DerivationInput,
  GovernedBy,
  Level,
  LevelDerivation,
  TriggeredCondition,
} from './types';

/** The band a total score falls in. */
export function bandForScore(total: number): Level {
  const band = BANDS.find((b) => total >= b.minScore && total <= b.maxScore);
  if (!band) {
    throw new Error(
      `Score ${total} falls outside every configured band. Check lib/rules/data/levels.json.`,
    );
  }
  return band.level;
}

/** Every minimum condition that fires, and the inputs still owed. */
export function evaluateMinimumConditions(
  inputs: DerivationInput['inputs'],
): { triggered: readonly TriggeredCondition[]; missing: readonly string[] } {
  const triggered: TriggeredCondition[] = [];
  const missing: string[] = [];

  for (const condition of MINIMUM_CONDITIONS) {
    const result = evaluatePredicate(condition.derivation, inputs);
    if (result.fired) {
      triggered.push({
        key: condition.key,
        level: condition.level,
        en: condition.en,
        ar: condition.ar,
      });
    }
    for (const m of result.missing) {
      if (!missing.includes(m)) missing.push(m);
    }
  }

  return { triggered, missing };
}

/**
 * Derives the event level.
 *
 * Returns both results and which governed, because an organizer who scored 9 and lands at
 * Level 3 must be able to see why. Returns an incomplete result rather than guessing when
 * a domain is unanswered or a required figure is not captured.
 */
export function deriveLevel(input: DerivationInput): LevelDerivation {
  const { answers, inputs } = input;

  const answered = answers.slice(0, DOMAIN_COUNT);
  const allAnswered =
    answered.length === DOMAIN_COUNT && answered.every((a) => a !== null);

  const { triggered, missing: conditionMissing } = evaluateMinimumConditions(inputs);

  const minimumConditionLevel: Level | null = triggered.length
    ? (Math.max(...triggered.map((t) => t.level)) as Level)
    : null;

  const missingInputs: string[] = [...conditionMissing];
  if (!allAnswered) {
    answered.forEach((a, i) => {
      if (a === null) missingInputs.push(`domain${i + 1}`);
    });
    if (answered.length < DOMAIN_COUNT) {
      for (let i = answered.length; i < DOMAIN_COUNT; i += 1) {
        missingInputs.push(`domain${i + 1}`);
      }
    }
  }

  if (!allAnswered) {
    return {
      scoreTotal: null,
      scoreBandLevel: null,
      minimumConditionLevel,
      triggeredConditions: triggered,
      finalLevel: null,
      governedBy: null,
      missingInputs,
      complete: false,
    };
  }

  const scoreTotal = answered.reduce<number>((sum, a) => sum + (a ?? 0), 0);
  const maxPossible = DOMAIN_COUNT * MAX_SCORE_PER_DOMAIN;
  if (scoreTotal < 0 || scoreTotal > maxPossible) {
    throw new Error(`Score ${scoreTotal} is outside 0-${maxPossible}.`);
  }
  const scoreBandLevel = bandForScore(scoreTotal);

  // An outstanding required figure blocks derivation even with every domain answered.
  // This is the marathon case: nine answers, no course distance, and the honest answer
  // is "we cannot derive a level yet", not "Level 2".
  if (missingInputs.length > 0) {
    return {
      scoreTotal,
      scoreBandLevel,
      minimumConditionLevel,
      triggeredConditions: triggered,
      finalLevel: null,
      governedBy: null,
      missingInputs,
      complete: false,
    };
  }

  const finalLevel = (
    minimumConditionLevel === null
      ? scoreBandLevel
      : Math.max(scoreBandLevel, minimumConditionLevel)
  ) as Level;

  let governedBy: GovernedBy;
  if (minimumConditionLevel === null || scoreBandLevel > minimumConditionLevel) {
    governedBy = 'score';
  } else if (minimumConditionLevel > scoreBandLevel) {
    governedBy = 'minimumCondition';
  } else {
    governedBy = 'both';
  }

  return {
    scoreTotal,
    scoreBandLevel,
    minimumConditionLevel,
    triggeredConditions: triggered,
    finalLevel,
    governedBy,
    missingInputs: [],
    complete: true,
  };
}
