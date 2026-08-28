/**
 * Re-seeds the development database, KEEPING A COPY OF THE OLD ONE.
 *
 * WHY THIS EXISTS. The seeder only runs on an empty database, so picking up new
 * seed data means deleting var/dev.db -- and doing that by hand with `rm` destroyed
 * a reviewer's credentialed accounts and a real filed event they were mid-walk on.
 * Nothing warned and nothing could be recovered.
 *
 * Re-seeding a dev database is routine. Destroying the real rows a person put in it
 * is not, and the difference is one copy. This snapshots to var/backups/ first,
 * every time, and prints where it went.
 *
 *   npm run db:reseed
 *
 * It carries the credentialed accounts across -- the email-bearing, non-demonstration
 * ones a reviewer signs in with, minted out of band because nothing in the product
 * creates a Ministry account. Everything else is rebuilt by the seeder.
 *
 * THIS IS A .ts RUN THROUGH tsx, not a .mjs. The first version was .mjs, imported
 * lib/db for the schema, and died on its extensionless imports -- AFTER it had
 * already deleted the database. The backup is what saved it. Running through tsx
 * resolves the app's own module graph, so the restore step cannot half-run.
 */

import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { getDb } from '../lib/db';

if (process.env['NODE_ENV'] === 'production') {
  process.stderr.write('Refusing to run: this rebuilds a database and is disabled in production.\n');
  process.exit(1);
}

const DB = process.env['DATABASE_PATH'] ?? 'var/dev.db';

interface CarriedAccount {
  login: string;
  email: string;
  password_hash: string;
  display_name: string;
  initials: string;
  role: string;
  credential_licence: string | null;
}

let carried: CarriedAccount[] = [];

if (existsSync(DB)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join('var', 'backups');
  mkdirSync(backupDir, { recursive: true });
  const backup = join(backupDir, `dev-${stamp}.db`);

  // Checkpoint the WAL first, or the copy is missing the most recent writes.
  const live = new DatabaseSync(DB);
  live.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  carried = live
    .prepare(
      `SELECT login, email, password_hash, display_name, initials, role, credential_licence
       FROM accounts WHERE email IS NOT NULL AND is_demo = 0`,
    )
    .all() as unknown as CarriedAccount[];
  live.close();

  copyFileSync(DB, backup);
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${DB}${suffix}`, { force: true });
  process.stdout.write(`Backed up to ${backup}\n`);
} else {
  process.stdout.write(`No database at ${DB}; nothing to back up.\n`);
}

// getDb creates the schema, runs the migrations and seeds the demonstration rows.
const next = getDb();

if (carried.length > 0) {
  const insert = next.prepare(
    `INSERT INTO accounts (login, email, password_hash, display_name, initials, role, is_demo, credential_licence)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT (login) DO NOTHING`,
  );
  for (const a of carried) {
    insert.run(a.login, a.email, a.password_hash, a.display_name, a.initials, a.role, a.credential_licence ?? null);
  }
  process.stdout.write(`Carried ${carried.length} credentialed account(s) across, passwords unchanged.\n`);
}

const events = next.prepare(`SELECT count(*) AS c FROM events`).get() as { c: number };
process.stdout.write(`Re-seeded: ${events.c} demonstration events.\n`);
