import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Account } from '../lib/auth';
const session = vi.hoisted(() => ({ account: null as Account | null }));
vi.mock('../lib/auth', () => ({ currentAccount: async () => session.account }));
import { getDb } from '../lib/db';
import { acknowledgeTour } from '../app/tour-actions';
const folder = mkdtempSync(join(tmpdir(), 'moph-tour-'));
beforeAll(() => {
  const path = join(folder, 'test.db');
  // A pre-tour database: migration must not interrupt its existing real users.
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE, password_hash TEXT, display_name TEXT NOT NULL, initials TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    INSERT INTO accounts(login,display_name,role) VALUES ('existing_real','Existing user','organizer');`);
  old.close();
  vi.stubEnv('DATABASE_PATH', path);
});
afterAll(() => { getDb().close(); vi.unstubAllEnvs(); rmSync(folder, { recursive: true, force: true }); });
const pending = (id: number) => (getDb().prepare('SELECT tour_pending FROM accounts WHERE id=?').get(id) as {tour_pending:number}).tour_pending;
test('new real accounts receive the tour; seeded demonstration accounts do not', () => {
  for (const role of ['organizer','ems','director','reviewer','ministry_admin','platform_owner','order']) {
    const id = Number(getDb().prepare('INSERT INTO accounts (login,display_name,role) VALUES (?,?,?)').run(`tour_${role}`,role,role).lastInsertRowid);
    expect(pending(id)).toBe(1);
  }
  const demo = getDb().prepare('SELECT id FROM accounts WHERE is_demo=1').all() as {id:number}[];
  expect(demo.length).toBeGreaterThan(0);
  expect(demo.every(a => pending(a.id) === 0)).toBe(true);
});
test('only the signed-in account can acknowledge its tour; anonymous calls do nothing', async () => {
  session.account=null;
  expect(await acknowledgeTour()).toBe(false);
  const rows = getDb().prepare("SELECT id,role,login FROM accounts WHERE login IN ('tour_organizer','tour_ems') ORDER BY id").all() as Pick<Account,'id'|'role'|'login'>[];
  session.account={...rows[0]!,displayName:'Test',initials:'T',isDemo:false};
  expect(await acknowledgeTour()).toBe(true);
  expect(pending(rows[0]!.id)).toBe(0);
  expect(pending(rows[1]!.id)).toBe(1);
  expect(await acknowledgeTour()).toBe(true);
  expect(pending(rows[0]!.id)).toBe(0);
});

test('migration leaves existing real accounts out of automatic onboarding', () => {
  const row = getDb().prepare("SELECT id FROM accounts WHERE login='existing_real'").get() as {id:number};
  expect(pending(row.id)).toBe(0);
});
