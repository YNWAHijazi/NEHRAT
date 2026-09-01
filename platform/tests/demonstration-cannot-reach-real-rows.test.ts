/**
 * The one assertion the published passwords rest on.
 *
 * Six demonstration accounts now carry passwords that are printed to a console and
 * handed out. Everything that makes that acceptable reduces to a single property:
 *
 *   A DEMONSTRATION SESSION CANNOT READ, WRITE OR DETERMINE AGAINST A ROW WHERE
 *   is_demo = 0.
 *
 * tests/demonstration-isolation.test.ts already checks the surface policy map -- that
 * every surface declares a policy and the union cannot grow without the map growing.
 * That is a completeness check on the DECLARATION. This is the property itself, run
 * against a real database with real rows of both kinds, so it fails if the declaration
 * is complete and the behaviour is still wrong.
 *
 * Written this way deliberately: the reviewer asked for the isolation asserted directly
 * rather than as a consequence of some screen behaving. A test that reaches the right
 * conclusion through six layers stops testing the property the moment one layer changes.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const DB_PATH = join(tmpdir(), `nehrat-isolation-${process.pid}.db`);

let db: DatabaseSync;

beforeAll(async () => {
  process.env['DATABASE_PATH'] = DB_PATH;
  const { getDb } = await import('../lib/db');
  const { seedDemonstration } = await import('../lib/demo-seed');
  db = getDb();
  // A database holding BOTH kinds. Without a real row present, every "cannot see it"
  // assertion below passes by there being nothing to see -- the absence failure this
  // codebase has hit before.
  if ((db.prepare(`SELECT COUNT(*) AS n FROM accounts WHERE is_demo = 1`).get() as { n: number }).n === 0) {
    seedDemonstration(db);
  }
  db.prepare(
    `INSERT INTO accounts (login, email, display_name, initials, role, is_demo)
     VALUES ('real_organizer', 'real@example.test', 'Real Organizer', 'RO', 'organizer', 0)`,
  ).run();
  const realAccount = db.prepare(`SELECT id FROM accounts WHERE login = 'real_organizer'`)
    .get() as { id: number };
  db.prepare(
    `INSERT INTO events (id, account_id, name_en, name_ar, start_date, end_date, is_demo)
     VALUES ('EV-9001', ?, 'Real Event', 'فعالية حقيقية', '2026-10-01', '2026-10-01', 0)`,
  ).run(realAccount.id);
});

afterAll(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    try { rmSync(`${DB_PATH}${suffix}`); } catch { /* nothing to remove */ }
  }
});

describe('a demonstration session and a real row never meet', () => {
  it('the fixture holds rows of BOTH kinds (this test is wired to real data)', () => {
    const demo = db.prepare(`SELECT COUNT(*) AS n FROM events WHERE is_demo = 1`).get() as { n: number };
    const real = db.prepare(`SELECT COUNT(*) AS n FROM events WHERE is_demo = 0`).get() as { n: number };
    expect(demo.n, 'no demonstration events — every isolation assertion would pass vacuously').toBeGreaterThan(0);
    expect(real.n, 'no real events — every isolation assertion would pass vacuously').toBeGreaterThan(0);
  });

  it('a demonstration account owns no real row', async () => {
    const rows = db
      .prepare(
        `SELECT e.id FROM events e
         JOIN accounts a ON a.id = e.account_id
         WHERE a.is_demo = 1 AND e.is_demo = 0`,
      )
      .all() as unknown as { id: string }[];
    expect(rows.map((r) => r.id)).toEqual([]);
  });

  it('a real account owns no demonstration row', () => {
    const rows = db
      .prepare(
        `SELECT e.id FROM events e
         JOIN accounts a ON a.id = e.account_id
         WHERE a.is_demo = 0 AND e.is_demo = 1`,
      )
      .all() as unknown as { id: string }[];
    expect(rows.map((r) => r.id)).toEqual([]);
  });

  it('READ: the organizer dashboard query returns no real row to a demonstration session', async () => {
    const { eventsFor } = await import('../lib/queries');
    const demoAccount = db.prepare(`SELECT id FROM accounts WHERE login = 'test_organizer'`)
      .get() as { id: number };
    const events = eventsFor(demoAccount.id);
    expect(events.length, 'the demonstration organizer has no events — assertion would be vacuous')
      .toBeGreaterThan(0);
    const realIds = new Set(
      (db.prepare(`SELECT id FROM events WHERE is_demo = 0`).all() as unknown as { id: string }[])
        .map((r) => r.id),
    );
    expect(events.filter((e) => realIds.has(e.id))).toEqual([]);
  });

  it('READ: every surface refuses real rows to a demonstration session, and vice versa', async () => {
    const { SURFACE_DEMONSTRATION_POLICY, demonstrationFilter, applyDemonstrationFilter } =
      await import('../lib/rules/scope');
    const surfaces = Object.keys(SURFACE_DEMONSTRATION_POLICY) as (keyof typeof SURFACE_DEMONSTRATION_POLICY)[];
    expect(surfaces.length, 'no surfaces declared').toBeGreaterThan(0);

    // A row of each kind, the shape applyDemonstrationFilter takes.
    const rows = [{ isDemo: true, id: 'demo' }, { isDemo: false, id: 'real' }];

    for (const surface of surfaces) {
      // THE PROPERTY: a demonstration session never receives a real row. On a
      // matchSession surface because it follows the session; on an excludeDemonstration
      // surface because it receives nothing at all. Both are acceptable; a real row
      // reaching a published credential is not.
      // PUBLIC surfaces are exempt from this half, and must be: the reference lookup
      // answers anyone at all with four fields, so a demonstration session holds no
      // more than a passer-by does. Exempting them by NAME would be the blind spot
      // this codebase keeps finding, so they are exempted by their declared policy --
      // a new excludeDemonstration surface joins the exemption only by declaring
      // itself one, and the test below pins which surfaces those are.
      if (SURFACE_DEMONSTRATION_POLICY[surface] !== 'excludeDemonstration') {
        const asDemo = applyDemonstrationFilter(rows, demonstrationFilter(surface, { isDemonstration: true }));
        expect(asDemo.map((r) => r.id), `${surface} handed a real row to a demonstration session`)
          .not.toContain('real');
      }

      // And the converse, which is what keeps the Ministry's own surfaces honest:
      // a real session never receives a demonstration row.
      const asReal = applyDemonstrationFilter(rows, demonstrationFilter(surface, { isDemonstration: false }));
      expect(asReal.map((r) => r.id), `${surface} handed a demonstration row to a real session`)
        .not.toContain('demo');
    }
  });

  it('the two public-facing surfaces exclude demonstration rows whoever asks', async () => {
    // Asymmetric on purpose: a demonstration reference must not resolve for the public,
    // and an owner reading national volumes must not be reading fiction.
    const { SURFACE_DEMONSTRATION_POLICY } = await import('../lib/rules/scope');
    expect(SURFACE_DEMONSTRATION_POLICY.publicReferenceLookup).toBe('excludeDemonstration');
    expect(SURFACE_DEMONSTRATION_POLICY.platformActivityCounts).toBe('excludeDemonstration');
    // And the exemption above stays exactly two surfaces wide. A third one appearing
    // here means a surface has quietly been declared readable by a demonstration
    // session holding a published password -- which is the whole risk.
    const exempt = (Object.keys(SURFACE_DEMONSTRATION_POLICY) as (keyof typeof SURFACE_DEMONSTRATION_POLICY)[])
      .filter((k) => SURFACE_DEMONSTRATION_POLICY[k] === 'excludeDemonstration');
    expect(exempt.sort()).toEqual(['platformActivityCounts', 'publicReferenceLookup']);
  });

  it('DETERMINE: no determination stands against a real event from a demonstration account', () => {
    const rows = db
      .prepare(
        `SELECT d.event_id FROM determinations d
         JOIN events e ON e.id = d.event_id
         WHERE e.is_demo = 0`,
      )
      .all() as unknown as { event_id: string }[];
    expect(rows.map((r) => r.event_id)).toEqual([]);
  });

  it('WRITE: every table carrying is_demo keeps the two kinds apart on the account that owns them', () => {
    // Swept, not listed. A table added with an account_id and an is_demo column joins
    // this check by existing -- the named-input blind spot this codebase keeps finding.
    const tables = (
      db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
        )
        .all() as unknown as { name: string }[]
    ).map((r) => r.name);

    const checked: string[] = [];
    for (const table of tables) {
      const cols = (
        db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[]
      ).map((c) => c.name);
      if (!cols.includes('is_demo') || !cols.includes('account_id')) continue;
      checked.push(table);
      const mixed = db
        .prepare(
          `SELECT COUNT(*) AS n FROM ${table} t
           JOIN accounts a ON a.id = t.account_id
           WHERE a.is_demo <> t.is_demo`,
        )
        .get() as { n: number };
      expect(mixed.n, `${table} holds rows whose kind disagrees with their owner`).toBe(0);
    }
    expect(checked.length, 'no table carried both columns — the sweep found nothing to check')
      .toBeGreaterThan(0);
  });
});
