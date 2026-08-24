/**
 * Public reference lookup.
 *
 * Non-negotiable #5: the lookup returns four things and no more -- that a submission
 * exists, the event name, its level, and the current Ministry status. Never contact
 * details, never documents, never assessment answers.
 *
 * The limit is enforced HERE, on the server, by projection. Nothing else leaves the
 * server; it is not merely that nothing else renders. `projectPublicLookup` is the only
 * supported way to build the response, and the route handler returns its output directly.
 *
 * Non-negotiable #5b: the lookup must not be enumerable. Reference numbers are sequential
 * by design and the endpoint is unauthenticated by design, so the two together would let
 * anyone walk the national register.
 *
 * DECISION RECORD -- for the Ministry to ratify, not settled. SPEC 3a leaves the
 * mechanism open deliberately. The build's choice is two mechanisms paired:
 *
 *   1. A second factor: the event start date, known to the holder of the reference.
 *      Weak as a secret -- a festival's dates are public -- but it stops casual lookups
 *      and turns a sequence walk into a guess per reference.
 *   2. Rate limiting per client at the route handler, which stops the walk itself.
 *      The limit values live with the deployment configuration, not here.
 *
 * Neither alone is sufficient: the date because it is often public, the limit because a
 * distributed walk defeats a per-client counter. If the Ministry prefers a non-sequential
 * public token instead, this module is where the second factor is swapped out.
 */

import type { Level } from './types';
import { applyDemonstrationFilter, demonstrationFilter } from './scope';

/** The complete list. Adding a field here is a policy change, not a refactor. */
export const PUBLIC_LOOKUP_FIELDS = ['exists', 'eventName', 'level', 'status'] as const;

export type PublicLookupField = (typeof PUBLIC_LOOKUP_FIELDS)[number];

/** The three outcomes, plus the quiet internal states a public caller may be shown. */
export type PublicStatus = string;

export interface PublicLookupResult {
  readonly exists: boolean;
  readonly eventName: string | null;
  readonly level: Level | null;
  readonly status: PublicStatus | null;
}

/** Whatever the record layer holds. Deliberately wider than what may be returned. */
export interface SubmissionRecord {
  readonly referenceNumber: string;
  readonly eventName: string;
  readonly level: Level;
  readonly status: string;
  readonly isDemo: boolean;
  readonly eventStartDate: string; // YYYY-MM-DD, the second factor
  readonly [extra: string]: unknown;
}

/** A submission that does not exist, or a second factor that did not match. */
export const NOT_FOUND: PublicLookupResult = {
  exists: false,
  eventName: null,
  level: null,
  status: null,
};

/**
 * Builds the response.
 *
 * Explicit construction, not a delete-list over the record: a field added to
 * SubmissionRecord later cannot leak through, because nothing here copies unknown keys.
 */
export function projectPublicLookup(record: SubmissionRecord | null): PublicLookupResult {
  if (!record) return NOT_FOUND;
  const result: PublicLookupResult = {
    exists: true,
    eventName: record.eventName,
    level: record.level,
    status: record.status,
  };
  // The four-fields list GOVERNS the shape: a key that drifted in past the type
  // system (a spread, a wider object) is stripped before anything leaves.
  for (const key of Object.keys(result)) {
    if (!(PUBLIC_LOOKUP_FIELDS as readonly string[]).includes(key)) {
      delete (result as unknown as Record<string, unknown>)[key];
    }
  }
  return result;
}

export interface LookupQuery {
  readonly referenceNumber: string;
  /**
   * The second factor, known to the holder of the reference and not derivable from it.
   * Absent means the caller has only the number, which is exactly the enumeration case.
   */
  readonly eventStartDate?: string;
}

/**
 * Resolves a lookup, refusing the enumeration case.
 *
 * A caller holding only an incrementing reference number gets NOT_FOUND, which is
 * indistinguishable from a reference that does not exist. That is the point: the endpoint
 * must not answer a sequence.
 *
 * Demonstration submissions never resolve here -- see lib/rules/scope.ts.
 */
export function resolvePublicLookup(
  query: LookupQuery,
  findByReference: (reference: string) => SubmissionRecord | null,
): PublicLookupResult {
  if (!query.eventStartDate) return NOT_FOUND;

  const record = findByReference(query.referenceNumber);
  if (!record) return NOT_FOUND;
  if (applyDemonstrationFilter([record], demonstrationFilter('publicReferenceLookup', { isDemonstration: false })).length === 0) {
    return NOT_FOUND;
  }
  if (record.eventStartDate !== query.eventStartDate) return NOT_FOUND;

  return projectPublicLookup(record);
}
