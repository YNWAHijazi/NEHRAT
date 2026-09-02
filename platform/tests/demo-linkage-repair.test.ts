/**
 * The counterparty linkage, and the standing databases that predate it.
 *
 * The partner review reported the EMS demonstration dashboard empty: "outstanding /
 * complete rows are currently not showing." The rendering path was correct; the
 * database was not. The invitation→account linkage entered the seeder after the
 * accounts and invitations did, and the seeder's guard returns on the first seeded
 * login it finds — so any database provisioned before the linkage keeps test_ems and
 * test_director with zero linked nominations forever. No migration backfilled it, and
 * the provisioning command refused to touch an already-provisioned instance.
 *
 * The repair is linkDemonstrationCounterparties: idempotent, guarded on
 * account_id IS NULL, run from the seeder's early-return path (so a standing local
 * database heals on boot) and from demo:bootstrap (so a deployed instance heals on
 * re-provisioning). These tests hold the repair to its guard: it restores the seeded
 * linkage, and it never clobbers a row a walkthrough has since acted on.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const DB_PATH = join(tmpdir(), `nehrat-linkage-${process.pid}.db`);

let db: DatabaseSync;
let seedDemonstration: (db: DatabaseSync) => void;
let linkDemonstrationCounterparties: (db: DatabaseSync) => number;

const TOKENS = [
  'demo-lrc-beirut-0418',
  'demo-lrc-baalbeck-0362',
  'demo-director-0362',
  'demo-director-0244',
] as const;

function linkedCount(): number {
  const marks = TOKENS.map(() => '?').join(', ');
  return (
    db
      .prepare(`SELECT COUNT(*) AS n FROM invitations WHERE token IN (${marks}) AND account_id IS NOT NULL`)
      .get(...TOKENS) as { n: number }
  ).n;
}

beforeAll(async () => {
  process.env['DATABASE_PATH'] = DB_PATH;
  const { getDb } = await import('../lib/db');
  const seed = await import('../lib/demo-seed');
  seedDemonstration = seed.seedDemonstration;
  linkDemonstrationCounterparties = seed.linkDemonstrationCounterparties;
  db = getDb();
  if ((db.prepare(`SELECT COUNT(*) AS n FROM accounts WHERE is_demo = 1`).get() as { n: number }).n === 0) {
    seedDemonstration(db);
  }
});

afterAll(() => {
  try {
    db.close();
  } catch {
    // already closed
  }
  rmSync(DB_PATH, { force: true });
  rmSync(`${DB_PATH}-wal`, { force: true });
  rmSync(`${DB_PATH}-shm`, { force: true });
});

describe('the counterparty linkage repair', () => {
  it('a fresh seed links all four counterparty nominations', () => {
    expect(linkedCount()).toBe(4);
    // The Baalbeck declaration arrives signed — the complete-row half of the
    // demonstration dashboard depends on it.
    const baalbeck = db
      .prepare(`SELECT declaration, signed_at FROM invitations WHERE token = 'demo-lrc-baalbeck-0362'`)
      .get() as { declaration: string; signed_at: string | null };
    expect(baalbeck.declaration).toBe('signed');
    expect(baalbeck.signed_at).not.toBeNull();
  });

  it('re-running the seeder on a pre-linkage database restores the linkage — the reported defect', () => {
    // Simulate the database the partner walked: accounts and invitations present,
    // linkage absent, declaration never signed.
    const marks = TOKENS.map(() => '?').join(', ');
    db.prepare(`UPDATE invitations SET account_id = NULL WHERE token IN (${marks})`).run(...TOKENS);
    db.prepare(
      `UPDATE invitations SET declaration = 'none', declaration_items = '[]', certification = '{}', signed_at = NULL
       WHERE token = 'demo-lrc-baalbeck-0362'`,
    ).run();
    expect(linkedCount()).toBe(0);

    // The seeder's guard path — what runs on every boot of a standing database.
    seedDemonstration(db);

    expect(linkedCount()).toBe(4);
    const baalbeck = db
      .prepare(`SELECT declaration FROM invitations WHERE token = 'demo-lrc-baalbeck-0362'`)
      .get() as { declaration: string };
    expect(baalbeck.declaration).toBe('signed');
  });

  it('never clobbers a row a walkthrough has acted on', () => {
    // A linked row somebody has since modified stays modified: the repair's guard is
    // account_id IS NULL, not the token.
    db.prepare(`UPDATE invitations SET certification = '{"sentinel":true}' WHERE token = 'demo-lrc-baalbeck-0362'`).run();

    const changed = linkDemonstrationCounterparties(db);

    expect(changed).toBe(0);
    const after = db
      .prepare(`SELECT certification FROM invitations WHERE token = 'demo-lrc-baalbeck-0362'`)
      .get() as { certification: string };
    expect(JSON.parse(after.certification)).toEqual({ sentinel: true });
  });
});
