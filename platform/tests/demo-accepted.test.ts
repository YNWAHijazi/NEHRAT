/**
 * THE ACCEPTED EXAMPLES (owner, 10 October 2026: "one event and one site as accepted by the
 * Ministry so I can see how it looks"). Read back the way the screens read them: the site's
 * status, certificate and plan; the event's level, filing, outcome and its stage at the site.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('../lib/auth', () => ({ currentAccount: async () => null, organizationFor: () => null }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); }, notFound: () => { throw new Error('notFound'); } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getDb } from '../lib/db';
import { ACCEPTED_EVENT_NAME, ACCEPTED_SITE_NAME, seedAcceptedExamples } from '../lib/demo-accepted';
import { facilityRegistrationFacts } from '../lib/facility-registration';
import { siteEventReceipt, siteEventsFor, siteStatusFor } from '../lib/site-registration';
import { eventRecordRequirements } from '../lib/record-facts';
import { siteCertificateAvailable, sitePlanComplete } from '../lib/rules/site';
import { submissionFacts } from '../lib/rules/facility-workflow';

const folder = mkdtempSync(join(tmpdir(), 'moph-accepted-'));
beforeAll(() => { vi.stubEnv('DATABASE_PATH', join(folder, 'test.db')); vi.stubEnv('REVIEW_CLOCK', '2026-08-13'); getDb(); });
afterAll(() => { getDb().close(); vi.unstubAllEnvs(); rmSync(folder, { recursive: true, force: true }); });

describe('the accepted demonstration site and event', () => {
  it('adds both once, on the demonstration organizer, as demonstration rows', () => {
    const db = getDb();
    const first = seedAcceptedExamples(db, '2026-08-13');
    expect(first.added).toHaveLength(2);
    expect(seedAcceptedExamples(db, '2026-08-13').added).toEqual([]);
    const owner = (db.prepare(`SELECT id FROM accounts WHERE login = 'test_organizer'`).get() as { id: number }).id;
    expect(db.prepare('SELECT account_id, is_demo FROM facilities WHERE name_en = ?').all(ACCEPTED_SITE_NAME)).toEqual([{ account_id: owner, is_demo: 1 }]);
    expect(db.prepare('SELECT account_id, is_demo FROM events WHERE name_en = ?').all(ACCEPTED_EVENT_NAME)).toEqual([{ account_id: owner, is_demo: 1 }]);
  });

  it('the site reads Readiness current, with its plan complete and the certificate available', () => {
    const db = getDb();
    const { id } = db.prepare('SELECT id FROM facilities WHERE name_en = ?').get(ACCEPTED_SITE_NAME) as { id: string };
    const facts = facilityRegistrationFacts(id);
    expect(siteStatusFor(id)).toBe('readinessCurrent');
    expect(facts.everAccepted).toBe(true);
    expect(facts.confirmationCurrent).toBe(true);
    expect(facts.deviceCount).toBe(2);
    expect(facts.devicesNotReady).toBe(0);
    expect(sitePlanComplete(submissionFacts(facts))).toBe(true);
    expect(siteCertificateAvailable(facts.status)).toBe(true);
  });

  it('the event is Level 1, filed with every organizer requirement answered, and its outcome is satisfied', () => {
    const db = getDb();
    const e = db.prepare('SELECT id, account_id, filed, moph_reference, site_id FROM events WHERE name_en = ?').get(ACCEPTED_EVENT_NAME) as { id: string; account_id: number; filed: number; moph_reference: string; site_id: string };
    expect(e.filed).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM event_site_confirmations WHERE event_id = ?').get(e.id)).toEqual({ n: 1 });
    expect(e.moph_reference).toBe(e.id);
    const record = eventRecordRequirements(e.account_id, e.id)!;
    expect(record.level).toBe(1);
    // Everything owed before the event is complete; only what is owed after it ("later") remains.
    expect(record.instances.filter((i) => i.state !== 'complete' && i.state !== 'later').map((i) => i.key)).toEqual([]);
    expect(db.prepare('SELECT outcome FROM determinations WHERE event_id = ?').all(e.id)).toEqual([{ outcome: 'satisfied' }]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM requirement_snapshots WHERE record_kind = ? AND record_id = ?').get('event', e.id)).toEqual({ n: 1 });
    // At the site it reads Scheduled, with its receipt.
    const { id: facilityId } = db.prepare('SELECT id FROM facilities WHERE name_en = ?').get(ACCEPTED_SITE_NAME) as { id: string };
    expect(siteEventsFor(e.account_id, e.site_id, true).find((r) => r.id === e.id)?.stage).toBe('scheduled');
    expect(siteEventReceipt(facilityId, e.id)?.reference).toBe(e.id);
  });
});
