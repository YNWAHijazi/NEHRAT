/**
 * The data layer. node:sqlite (built into Node 22.5+), no ORM, no native build step.
 *
 * `is_demo` is a real column on every record-bearing table -- non-negotiable #8. The
 * demonstration accounts exist as real rows; what never runs in a deployed environment
 * is the seeder (see seedDemonstration and its guard).
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { seedDemonstration } from './demo-seed';

const DATA_DIR = join(process.cwd(), 'var');
const DB_PATH = process.env['DATABASE_PATH'] ?? join(DATA_DIR, 'dev.db');

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);

  // The seeder is forced off in deployed environments -- the guard is NODE_ENV, and
  // there is deliberately no environment variable that re-enables it in production.
  if (process.env.NODE_ENV !== 'production') {
    seedDemonstration(db);
  }
  return db;
}

function migrate(d: DatabaseSync): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      initials TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('organizer','ems','director','response','reviewer','ministry_admin','platform_owner')),
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL UNIQUE REFERENCES accounts(id),
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      -- none: nothing filed. pending: filed, awaiting Ministry recording. recorded.
      status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('none','pending','recorded')),
      is_demo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,             -- record identifier, EV-0418
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      start_date TEXT,                 -- YYYY-MM-DD
      end_date TEXT,                   -- YYYY-MM-DD
      moph_reference TEXT,             -- Ministry reference number, at submission only
      filed INTEGER NOT NULL DEFAULT 0,
      -- demonstration-only presentation state for records whose flow is a later slice
      demo_state_en TEXT, demo_state_ar TEXT,
      demo_due TEXT, demo_due_label_en TEXT, demo_due_label_ar TEXT,
      demo_stage INTEGER, demo_stage_en TEXT, demo_stage_ar TEXT,
      demo_stages TEXT, demo_span INTEGER, demo_level INTEGER,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL REFERENCES events(id),
      version INTEGER NOT NULL,
      answers TEXT NOT NULL,           -- JSON: (0|1|2|null)[9]
      inputs TEXT NOT NULL,            -- JSON: MinimumConditionInputs
      derivation TEXT NOT NULL,        -- JSON: LevelDerivation, computed at save
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (event_id, version)
    );

    CREATE TABLE IF NOT EXISTS venues (
      id TEXT PRIMARY KEY,             -- VN-0032
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
      level INTEGER, issued TEXT, valid_until TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS facilities (
      id TEXT PRIMARY KEY,             -- FC-0014
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
      category_en TEXT, category_ar TEXT,
      devices INTEGER NOT NULL DEFAULT 0,
      next_lapse TEXT,
      state_en TEXT, state_ar TEXT, state_kind TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      kind TEXT NOT NULL CHECK (kind IN ('needs_action','for_information')),
      subject_en TEXT NOT NULL, subject_ar TEXT NOT NULL,
      body_en TEXT NOT NULL, body_ar TEXT NOT NULL,
      record_route TEXT NOT NULL,      -- the record the obligation lives on
      sent_at TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0
    );
  `);
}

/** Next EV-nnnn style identifier. Sequential by design -- correct inside a session. */
export function nextRecordId(prefix: 'EV' | 'VN' | 'FC'): string {
  const d = getDb();
  const table = prefix === 'EV' ? 'events' : prefix === 'VN' ? 'venues' : 'facilities';
  const row = d
    .prepare(`SELECT id FROM ${table} WHERE id LIKE ? ORDER BY id DESC LIMIT 1`)
    .get(`${prefix}-%`) as { id: string } | undefined;
  const last = row ? Number.parseInt(row.id.slice(3), 10) : 0;
  return `${prefix}-${String(last + 1).padStart(4, '0')}`;
}
