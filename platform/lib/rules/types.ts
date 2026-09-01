/**
 * Types for the derivation and gating module.
 *
 * This file, and every file in lib/rules/, is plain TypeScript. No React, no next/*,
 * no server-only imports. It is callable from a screen, a route handler and a test alike.
 */

export type Level = 1 | 2 | 3;

/** The nine domains, each answered 0, 1 or 2. Index 0 is domain 1. */
export type DomainAnswers = readonly (0 | 1 | 2 | null)[];

/**
 * Values captured as data, not inferred from a domain answer.
 *
 * Non-negotiable #0: domain 1's top option is "10,000 persons or more", which spans both
 * the Level 2 floor (10,000-19,999) and the Level 3 floor (20,000+). Domain 2's top option
 * bundles six disciplines carrying different floors. Neither domain answer can resolve a
 * floor on its own, so the floor resolves from these fields.
 */
export interface MinimumConditionInputs {
  /** Everyone present at the same time: participants, attendees, staff, performers, contractors, volunteers. */
  expectedMaxSimultaneousAttendance: number | null;
  /** Structured disciplines, e.g. ["running"], ["triathlon"], ["boxing"]. */
  eventDisciplines: readonly string[];
  /** Required when eventDisciplines includes "running". Blank on a marathon returns Level 2. */
  courseDistanceKm: number | null;
  venueLicensedCapacity: number | null;
  // venueRegularlyHostsOrganizedEvents left this contract with the recur condition
  // (partner ruling, English governs). The venue INSTRUMENT still asks it -- on the
  // venue record, where it belongs -- and stored assessment JSON from before the
  // ruling carries the old key harmlessly.
  venueIsNightclubOrDanceVenue: boolean | null;
}

export interface DerivationInput {
  answers: DomainAnswers;
  inputs: MinimumConditionInputs;
}

export interface TriggeredCondition {
  key: string;
  level: Level;
  en: string;
  ar: string;
}

/** Which of the two results produced the final level. */
export type GovernedBy = 'score' | 'minimumCondition' | 'both';

export interface LevelDerivation {
  /** Sum of the nine domain answers, 0-18. Null while any domain is unanswered. */
  scoreTotal: number | null;
  /** The band the score falls in. Null while the assessment is incomplete. */
  scoreBandLevel: Level | null;
  /** The highest level forced by a minimum condition, or null if none is triggered. */
  minimumConditionLevel: Level | null;
  /** Every condition that fired, so the organizer can see why. */
  triggeredConditions: readonly TriggeredCondition[];
  /** The higher of the two. Null while the assessment is incomplete. */
  finalLevel: Level | null;
  /** Which result governed. Null while incomplete. */
  governedBy: GovernedBy | null;
  /** Fields the organizer still owes before a level can be derived. */
  missingInputs: readonly string[];
  complete: boolean;
}

export type ComparisonOperator = 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'isTrue' | 'includesAny';

export interface PredicateClause {
  input: keyof MinimumConditionInputs;
  op: ComparisonOperator;
  value?: number | string | readonly string[];
}

export interface Predicate {
  all?: readonly PredicateClause[];
  any?: readonly PredicateClause[];
}
