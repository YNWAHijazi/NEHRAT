/**
 * The public reference lookup endpoint.
 *
 * Non-negotiable #5, enforced at the wire: the response body carries the four permitted
 * fields and nothing else. The projection in lib/rules/public-lookup.ts is the only way
 * a body is built, and its output is returned directly.
 *
 * Non-negotiable #5b: without the second factor (the event start date) the endpoint
 * answers a uniform not-found, so an incrementing sequence yields nothing. A per-client
 * rate limit backs that; both mechanisms are recorded in lib/rules/public-lookup.ts as a
 * decision for the Ministry to ratify.
 *
 * Demonstration submissions never resolve here (lib/rules/scope.ts).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '../../../../lib/db';
import {
  resolvePublicLookup,
  NOT_FOUND,
  type SubmissionRecord,
} from '../../../../lib/rules/public-lookup';
import type { Level } from '../../../../lib/rules/types';
import { MINISTRY_CONTENT } from '../../../../lib/rules/ministry';
import { derivedLevelFor, latestOutcomeFor } from '../../../../lib/queries';

// Per-client rate limit: a small fixed window, in memory. The values are deployment
// configuration in spirit; they live here until a config layer exists in Slice 6.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, { windowStart: number; count: number }>();

function rateLimited(clientKey: string): boolean {
  const now = Date.now();
  const entry = hits.get(clientKey);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(clientKey, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function findByReference(reference: string): SubmissionRecord | null {
  const row = getDb()
    .prepare(
      `SELECT e.id, e.moph_reference, e.name_en, e.start_date, e.is_demo, e.demo_level, e.demo_state_en
       FROM events e WHERE e.moph_reference = ?`,
    )
    .get(reference) as
    | {
        id: string;
        moph_reference: string;
        name_en: string;
        start_date: string | null;
        is_demo: number;
        demo_level: number | null;
        demo_state_en: string | null;
      }
    | undefined;
  if (!row) return null;
  // The same precedence as the organizer's own screens: a recorded outcome wins,
  // so the public register never disagrees with the dashboard on the same event.
  const outcome = latestOutcomeFor(row.id);
  const outcomeLabel = outcome
    ? MINISTRY_CONTENT.outcomes.find((o) => o.key === outcome)?.en
    : undefined;
  return {
    referenceNumber: row.moph_reference,
    eventName: row.name_en,
    // No derivable level is NOT Level 1 (non-negotiable 0): the register reports the
    // absence rather than inventing the lowest band.
    level: derivedLevelFor(row.id),
    status: outcomeLabel ?? row.demo_state_en ?? 'Submission received but incomplete',
    isDemo: row.is_demo === 1,
    eventStartDate: row.start_date ?? '',
  };
}

export function GET(request: NextRequest): NextResponse {
  const clientKey =
    request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'local';
  if (rateLimited(clientKey)) {
    // The rate-limited answer is the same shape as a miss: nothing about the register
    // leaks through the limiter, including whether the limit was the reason.
    return NextResponse.json(NOT_FOUND, { status: 429 });
  }

  const reference = request.nextUrl.searchParams.get('reference') ?? '';
  const eventStartDate = request.nextUrl.searchParams.get('eventStartDate') ?? undefined;

  const result = resolvePublicLookup(
    eventStartDate ? { referenceNumber: reference, eventStartDate } : { referenceNumber: reference },
    findByReference,
  );
  return NextResponse.json(result);
}
