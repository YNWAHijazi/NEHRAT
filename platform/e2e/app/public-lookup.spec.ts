/**
 * The public reference lookup, measured at the wire.
 *
 * tests/public-lookup.test.ts proves the projection function; this proves the ENDPOINT --
 * that the response body sent over HTTP contains exactly four fields. Not that four
 * render: that four are sent. A widened server query that leaks into the JSON fails here
 * even if no screen ever displays the extra fields.
 *
 * Runs once app/ exists (see playwright.config.ts).
 */

import { test, expect } from '@playwright/test';

const LOOKUP = '/api/public/reference-lookup';
const FOUR_FIELDS = ['exists', 'eventName', 'level', 'status'].sort();

test.describe('the response body carries exactly four fields', () => {
  test('on a miss', async ({ request }) => {
    const response = await request.get(
      `${LOOKUP}?reference=MOPH-EV-2026-0000&eventStartDate=2026-01-01`,
    );
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(FOUR_FIELDS);
    expect(body['exists']).toBe(false);
  });

  test('on a hit', async ({ request }) => {
    // The demonstration reviewer's mid-review submission is the one record guaranteed to
    // exist -- except that demonstration submissions must NOT resolve publicly. So a
    // real deployment has no guaranteed hit; this test seeds nothing and instead asserts
    // shape on whatever the endpoint returns for a well-formed query.
    const response = await request.get(
      `${LOOKUP}?reference=MOPH-EV-2026-0362&eventStartDate=2026-10-01`,
    );
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(FOUR_FIELDS);
  });

  test('never a fifth field, whatever the query', async ({ request }) => {
    const queries = [
      '?reference=MOPH-EV-2026-0362&eventStartDate=2026-10-01',
      '?reference=MOPH-EV-2026-0362', // enumeration case: no second factor
      '?reference=', // degenerate
      '?reference=%27%20OR%201=1--&eventStartDate=2026-10-01', // hostile
    ];
    for (const q of queries) {
      const response = await request.get(`${LOOKUP}${q}`);
      const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (body === null) continue; // a non-JSON refusal is acceptable
      for (const key of Object.keys(body)) {
        expect(FOUR_FIELDS, `unexpected field "${key}" left the server for ${q}`).toContain(key);
      }
    }
  });

  test('the enumeration case returns a uniform not-found', async ({ request }) => {
    const response = await request.get(`${LOOKUP}?reference=MOPH-EV-2026-0362`);
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({ exists: false, eventName: null, level: null, status: null });
  });

  test('a demonstration reference does not resolve', async ({ request }) => {
    // Demonstration data is real rows behind is_demo -- and none of it is publicly
    // resolvable. The demo record's reference from the prototypes must miss.
    const response = await request.get(
      `${LOOKUP}?reference=MOPH-EV-2026-0362&eventStartDate=2026-10-01`,
    );
    const body = (await response.json()) as Record<string, unknown>;
    // If Slice 1 seeds the demonstration submission with this reference, it must still
    // answer exists=false here. A hit would mean scope.ts is not applied at the route.
    expect(body['exists']).toBe(false);
  });
});
