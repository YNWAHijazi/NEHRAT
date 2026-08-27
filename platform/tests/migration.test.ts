/**
 * THE MIGRATION PATH NO TEST COULD REACH.
 *
 * Every other suite seeds a FRESH database, where the rebuild branches never run --
 * so a rebuild that destroyed every existing database passed a fully green suite.
 * It did exactly that: widening the invitations CHECK meant copy-drop-rename, and
 * DROP TABLE invitations is itself a foreign-key violation while shared_documents
 * holds live invitation tokens. The exec threw mid-transaction, the transaction
 * stayed open, and every later request died on "database is locked" -- reporting a
 * lock instead of the cause.
 *
 * This test builds a genuine PRE-migration database -- old CHECK constraints, real
 * child rows -- and runs the real migrate() over it. It asserts the four things a
 * rebuild must guarantee: the constraint widened, every row survived, no foreign
 * key was left dangling, and no scratch table was left behind.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.resetModules();
});

/**
 * Runs the REAL migrate(), through getDb, against the given file.
 */
async function migrateReal(path: string): Promise<void> {
  vi.resetModules();
  process.env['DATABASE_PATH'] = path;
  const { getDb } = await import('../lib/db');
  getDb();
}

/**
 * A database as it stood BEFORE the widening.
 *
 * Built by seeding the CURRENT schema and then DOWNGRADING the two tables under
 * test -- which is exactly how the reviewer's database got into this state, and
 * keeps the fixture from drifting: a hand-written copy of the schema would rot
 * against lib/db.ts within a slice. The downgrade preserves every row, so the
 * rebuild is exercised against real seeded data including the shared_documents
 * rows that make invitations undroppable.
 */
async function legacyDatabase(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'moph-migration-'));
  temporaryDirectories.push(dir);
  const path = join(dir, 'legacy.db');
  await migrateReal(path);

  const d = new DatabaseSync(path);
  d.exec('PRAGMA foreign_keys = OFF');
  d.exec(`
    BEGIN;
    CREATE TABLE invitations_old (
      token TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      kind TEXT NOT NULL CHECK (kind IN ('ems','director')),
      name_en TEXT NOT NULL, name_ar TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'nominated' CHECK (status IN ('nominated','confirmed','declined')),
      declaration TEXT NOT NULL DEFAULT 'none' CHECK (declaration IN ('none','draft','signed')),
      account_id INTEGER REFERENCES accounts(id),
      response_note TEXT NOT NULL DEFAULT '',
      ops_detail TEXT NOT NULL DEFAULT '{}',
      declaration_items TEXT NOT NULL DEFAULT '[]',
      certification TEXT NOT NULL DEFAULT '{}',
      signed_at TEXT,
      invited_at TEXT NOT NULL DEFAULT (datetime('now')),
      answered_at TEXT
    );
    INSERT INTO invitations_old SELECT token, event_id, kind, name_en, name_ar, email, status, declaration, account_id, response_note, ops_detail, declaration_items, certification, signed_at, invited_at, answered_at FROM invitations;
    DROP TABLE invitations;
    ALTER TABLE invitations_old RENAME TO invitations;

    CREATE TABLE organizations_old (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL UNIQUE REFERENCES accounts(id),
      name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('none','pending','recorded')),
      recorded_at TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO organizations_old SELECT id, account_id, name_en, name_ar, status, recorded_at, is_demo FROM organizations;
    DROP TABLE organizations;
    ALTER TABLE organizations_old RENAME TO organizations;
    COMMIT;
  `);
  d.exec('PRAGMA foreign_keys = ON');
  d.close();
  return path;
}

describe('migrating a database that predates the widened constraints', () => {
  it('widens both CHECKs, keeps every row, and leaves no dangling key', async () => {
    const path = await legacyDatabase();
    const before = new DatabaseSync(path);
    const countBefore = (table: string): number =>
      (before.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
    const invitationsBefore = countBefore('invitations');
    const sharedBefore = countBefore('shared_documents');
    const organizationsBefore = countBefore('organizations');
    before.close();

    await migrateReal(path);

    const d = new DatabaseSync(path);
    const schemaOf = (name: string): string =>
      (d.prepare(`SELECT sql FROM sqlite_master WHERE name = ?`).get(name) as { sql: string }).sql;

    // The constraints widened -- the whole point of the rebuild.
    expect(schemaOf('invitations')).toContain("'withdrawn'");
    expect(schemaOf('invitations')).toContain("'removed'");
    expect(schemaOf('organizations')).toContain("'returned'");

    // Every row survived, parent AND child. The counts come from the seeder, so
    // they are asserted as "more than none and unchanged by the rebuild" rather
    // than pinned to a demonstration figure that will move.
    const count = (table: string): number =>
      (d.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
    expect(count('invitations')).toBe(invitationsBefore);
    expect(count('shared_documents')).toBe(sharedBefore);
    expect(count('organizations')).toBe(organizationsBefore);
    expect(invitationsBefore).toBeGreaterThan(0);
    expect(sharedBefore).toBeGreaterThan(0);

    // The child still points at a real parent: a rebuild that silently orphaned
    // shared_documents would pass every other assertion here.
    expect(d.prepare(`PRAGMA foreign_key_check`).all()).toEqual([]);

    // And no scratch table survived the rebuild.
    const scratch = d.prepare(`SELECT name FROM sqlite_master WHERE name LIKE '%_next'`).all();
    expect(scratch).toEqual([]);
    d.close();
  });

  it('is idempotent: migrating an already-migrated database changes nothing', async () => {
    const path = await legacyDatabase();
    await migrateReal(path);
    const first = new DatabaseSync(path);
    const schemaBefore = (first.prepare(`SELECT sql FROM sqlite_master WHERE name = 'invitations'`).get() as { sql: string }).sql;
    const rowsBefore = (first.prepare(`SELECT count(*) AS n FROM invitations`).get() as { n: number }).n;
    first.close();

    await migrateReal(path);
    const after = new DatabaseSync(path);
    const schemaAfter = (after.prepare(`SELECT sql FROM sqlite_master WHERE name = 'invitations'`).get() as { sql: string }).sql;
    expect(schemaAfter).toBe(schemaBefore);
    expect((after.prepare(`SELECT count(*) AS n FROM invitations`).get() as { n: number }).n).toBe(rowsBefore);
    expect(after.prepare(`PRAGMA foreign_key_check`).all()).toEqual([]);
    after.close();
  });

  it('leaves the database USABLE, not locked, after migrating', async () => {
    // The failure mode that made this urgent: a throw inside the transaction left
    // it open, and the next write reported "database is locked" rather than the
    // real error. A write must succeed immediately after the migration.
    const path = await legacyDatabase();
    await migrateReal(path);
    const d = new DatabaseSync(path);
    const token = (d.prepare(`SELECT token FROM invitations LIMIT 1`).get() as { token: string }).token;
    d.exec(`UPDATE invitations SET status = 'withdrawn', closed_at = '2026-08-28' WHERE token = '${token}'`);
    const row = d.prepare(`SELECT status FROM invitations WHERE token = ?`).get(token) as { status: string };
    expect(row.status).toBe('withdrawn');
    d.close();
  });
});
