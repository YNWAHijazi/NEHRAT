/**
 * Evaluates the derivation predicates held in lib/rules/data/minimum-conditions.json.
 *
 * The operators are code. The thresholds they compare against are data. A Ministry
 * change to "20,000 or more" is an edit to the JSON, not to this file.
 */

import type {
  MinimumConditionInputs,
  Predicate,
  PredicateClause,
} from './types';

/** An input that has not been captured yet. Distinct from a captured false or zero. */
function isUnset(value: unknown): boolean {
  return value === null || value === undefined;
}

/**
 * Evaluates one clause.
 *
 * Returns null when the input it needs has not been captured. An unset input is not a
 * false condition -- it is an unanswered question, and the caller reports it as missing
 * rather than silently deriving a lower level from it.
 */
export function evaluateClause(
  clause: PredicateClause,
  inputs: MinimumConditionInputs,
): boolean | null {
  const actual = inputs[clause.input];

  if (clause.op === 'includesAny') {
    const expected = clause.value;
    if (!Array.isArray(expected)) return null;
    if (!Array.isArray(actual)) return null;
    return expected.some((v) => (actual as readonly string[]).includes(v));
  }

  if (clause.op === 'isTrue') {
    if (isUnset(actual)) return null;
    return actual === true;
  }

  if (isUnset(actual)) return null;
  if (typeof actual !== 'number') return null;
  const expected = clause.value;
  if (typeof expected !== 'number') return null;

  switch (clause.op) {
    case 'gte':
      return actual >= expected;
    case 'lte':
      return actual <= expected;
    case 'gt':
      return actual > expected;
    case 'lt':
      return actual < expected;
    case 'eq':
      return actual === expected;
    default: {
      const exhaustive: never = clause.op;
      throw new Error(`Unknown operator: ${String(exhaustive)}`);
    }
  }
}

export interface PredicateResult {
  /** True when the condition fires. */
  fired: boolean;
  /** Inputs the predicate needed but did not have. */
  missing: readonly string[];
}

/**
 * Evaluates a predicate.
 *
 * `all` requires every clause. `any` requires at least one. A clause whose input is unset
 * is reported as missing and, in an `all`, prevents the condition from firing -- the
 * deliberate conservative choice, because the alternative is deriving a level from a
 * question the organizer has not answered.
 */
export function evaluatePredicate(
  predicate: Predicate,
  inputs: MinimumConditionInputs,
): PredicateResult {
  const missing: string[] = [];

  const run = (clauses: readonly PredicateClause[]): (boolean | null)[] =>
    clauses.map((clause) => {
      const result = evaluateClause(clause, inputs);
      if (result === null && !missing.includes(clause.input)) missing.push(clause.input);
      return result;
    });

  if (predicate.all && predicate.all.length > 0) {
    const results = run(predicate.all);
    // A definite false settles it: the condition does not fire, and nothing is missing
    // that would change that.
    if (results.some((r) => r === false)) return { fired: false, missing: [] };
    if (results.some((r) => r === null)) return { fired: false, missing };
    return { fired: true, missing: [] };
  }

  if (predicate.any && predicate.any.length > 0) {
    const results = run(predicate.any);
    if (results.some((r) => r === true)) return { fired: true, missing: [] };
    if (results.some((r) => r === null)) return { fired: false, missing };
    return { fired: false, missing: [] };
  }

  throw new Error('Predicate must carry a non-empty `all` or `any`.');
}
