/**
 * A NEW REQUIREMENT AND THE SUBMISSIONS THAT PREDATE IT.
 *
 * MINISTRY RULING, 2026-08-29. A newly required document applies from its effective
 * date forward. Precisely:
 *
 *   - A submission already FILED AND DETERMINED stands. The Ministry reached a
 *     determination on the package as it was, the organizer has acted on it, and
 *     reopening settled determinations to collect a document that did not exist when
 *     they were made would unsettle every filing every time an annex changes.
 *
 *   - A submission FILED AND NOT YET DETERMINED is asked for the new document through
 *     the ORDINARY REVISION ROUTE -- the reviewer records "additional information or
 *     revision required", the organizer is told what is missing, and they refile. It
 *     is NOT blocked silently. That distinction is the whole ruling: the organizer
 *     discovering on their own screen that a filed submission has become unfileable,
 *     with no message and no route, is the failure this rule exists to prevent.
 *
 *   - A submission NOT YET FILED is subject to the requirement like any other.
 *
 * THE EFFECTIVE DATE IS CONFIGURED, NOT THE DEPLOY DATE. A requirement that begins
 * when the software happens to ship is a requirement nobody can plan for, and it makes
 * the regulation a property of the release schedule. It lives beside the document in
 * the attachments catalogue, where the Ministry sets it.
 *
 * WHY THIS IS A RULE AND NOT A MIGRATION. A migration decides once, at deploy, and
 * leaves nothing to read afterwards. This is asked every time a gate is computed, so
 * the answer stays visible and stays correct for filings made in between.
 */

import catalogJson from './data/attachments-catalog.json';

export type GrandfatherState =
  /** The requirement applies. */
  | 'applies'
  /** In force, but this submission predates it and has been determined: it stands. */
  | 'standsDetermined'
  /** In force, this submission predates it and awaits determination: ask via revision. */
  | 'askOnRevision'
  /** Not yet in force for anyone. */
  | 'notYetInForce';

export interface GrandfatherFacts {
  /** Today, on the Beirut review clock. */
  readonly today: string;
  /** When the submission was filed, or null if it has not been. */
  readonly filedAt: string | null;
  /** Whether any determination has been recorded on it. */
  readonly determined: boolean;
}

/** The effective date the Ministry set for a document, or null if it has always applied. */
export function documentEffectiveFrom(docKey: string): string | null {
  const doc = (catalogJson.documents as { key: string; effectiveFrom?: string }[]).find(
    (d) => d.key === docKey,
  );
  return doc?.effectiveFrom ?? null;
}

/**
 * How a newly required document lands on one submission.
 *
 * Dates compare as ISO strings, which is a total order for the format this build uses
 * everywhere. They are Asia/Beirut dates from the review clock, never the browser's.
 */
export function grandfatherState(docKey: string, facts: GrandfatherFacts): GrandfatherState {
  const from = documentEffectiveFrom(docKey);
  if (from === null) return 'applies';
  if (facts.today < from) return 'notYetInForce';
  // Filed before the requirement existed.
  if (facts.filedAt !== null && facts.filedAt < from) {
    return facts.determined ? 'standsDetermined' : 'askOnRevision';
  }
  return 'applies';
}

/** Does this document block filing for this submission? */
export function blocksFiling(docKey: string, facts: GrandfatherFacts): boolean {
  const state = grandfatherState(docKey, facts);
  // Only 'applies' gates. A submission that predates the requirement is never blocked
  // by it -- it is asked, by a reviewer, through the route that already exists.
  return state === 'applies';
}
