/**
 * The expedited flag reaches the console (register closure, 2026-09-03).
 * Derived and stored at filing since the gate existed (Protocol 8.4: the
 * standard timeline cannot reasonably be met; the submission proceeds, marked,
 * and expedited review waives nothing) -- and no reviewer surface ever read
 * it. submissionForReview now carries it; this pins the carry at the database,
 * because no seeded submission is expedited and an e2e walk would have to
 * build a whole late filing to see one chip.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const DB_PATH = join(tmpdir(), `nehrat-expedited-${process.pid}.db`);

beforeAll(() => {
  process.env['DATABASE_PATH'] = DB_PATH;
});

afterAll(() => {
  rmSync(DB_PATH, { force: true });
  rmSync(`${DB_PATH}-wal`, { force: true });
  rmSync(`${DB_PATH}-shm`, { force: true });
});

describe('expedited reaches the reviewer', () => {
  it('submissionForReview carries the stored flag, both ways', async () => {
    const { getDb } = await import('../lib/db');
    const { submissionForReview } = await import('../lib/queries');
    const db = getDb();
    db.prepare(`INSERT INTO accounts (login, display_name, role, is_demo) VALUES ('exp_org', 'Expedited Org', 'organizer', 0)`).run();
    const accountId = (db.prepare(`SELECT id FROM accounts WHERE login = 'exp_org'`).get() as { id: number }).id;
    db.prepare(`INSERT INTO events (id, account_id, name_en, name_ar, filed, is_demo) VALUES ('EV-9901', ?, 'Late Filing', 'تقديم متأخر', 1, 0)`).run(accountId);
    db.prepare(`INSERT INTO events (id, account_id, name_en, name_ar, filed, is_demo) VALUES ('EV-9902', ?, 'Timely Filing', 'تقديم في مهلته', 1, 0)`).run(accountId);
    db.prepare(`INSERT INTO submissions (event_id, declarations, insurance, filed_at, expedited) VALUES ('EV-9901', '[]', '{}', '2026-08-13 09:00', 1)`).run();
    db.prepare(`INSERT INTO submissions (event_id, declarations, insurance, filed_at, expedited) VALUES ('EV-9902', '[]', '{}', '2026-08-13 09:00', 0)`).run();

    expect(submissionForReview(false, 'EV-9901')?.expedited).toBe(true);
    expect(submissionForReview(false, 'EV-9902')?.expedited).toBe(false);
  });
});
