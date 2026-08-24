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
      email TEXT UNIQUE,
      -- scrypt, formatted salt:hash (lib/password.ts). Null only on demonstration
      -- accounts, which sign in from the demonstration panel, never with credentials.
      password_hash TEXT,
      display_name TEXT NOT NULL,
      initials TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('organizer','ems','director','response','reviewer','ministry_admin','platform_owner')),
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Reset links: single-use, expiring. The note on the reset card is a promise this
    -- table keeps: expires_at is one hour from issue, used_at marks consumption.
    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      used_at TEXT
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
      recorded_at TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,             -- record identifier, EV-0418
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      start_date TEXT,                 -- YYYY-MM-DD
      end_date TEXT,                   -- YYYY-MM-DD
      -- Annex A Part A: the event-information fields beyond the derivation inputs
      event_type TEXT NOT NULL DEFAULT '',
      venue_route TEXT NOT NULL DEFAULT '',
      municipalities TEXT NOT NULL DEFAULT '',
      opening_time TEXT NOT NULL DEFAULT '',
      closing_time TEXT NOT NULL DEFAULT '',
      expected_participants INTEGER,
      expected_spectators INTEGER,
      expected_staff INTEGER,
      previous_edition INTEGER NOT NULL DEFAULT 0,
      recurring_fixed_venue INTEGER NOT NULL DEFAULT 0,
      -- Set when the event's venue is itself a registered covered facility (ROADMAP 2e).
      -- The 12 reference block renders only where this is set; otherwise nothing renders
      -- and the organizer is NOT prompted to register it.
      venue_facility_id TEXT REFERENCES facilities(id),
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
      -- which version of the instrument scored it (product spec 9.2)
      nehrat_tool_version TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (event_id, version)
    );

    -- One row per attached document; the catalog is lib/rules/data/attachments-catalog.json.
    CREATE TABLE IF NOT EXISTS event_attachments (
      event_id TEXT NOT NULL REFERENCES events(id),
      doc_key TEXT NOT NULL,
      file_name TEXT NOT NULL,
      attached_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (event_id, doc_key)
    );

    -- Nomination, never self-registration: the token is the invitation (unguessable,
    -- never sequential). kind: ems | director. States per SPEC: nominated -> confirmed/declined;
    -- declarations draft -> signed (Level 3 EMS only).
    CREATE TABLE IF NOT EXISTS invitations (
      token TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      kind TEXT NOT NULL CHECK (kind IN ('ems','director')),
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'nominated' CHECK (status IN ('nominated','confirmed','declined')),
      declaration TEXT NOT NULL DEFAULT 'none' CHECK (declaration IN ('none','draft','signed')),
      invited_at TEXT NOT NULL DEFAULT (datetime('now')),
      answered_at TEXT
    );

    -- The plan: write-here or attach-a-document; sixteen sections either written or
    -- confirmed covered; the eleven major-incident items ride as JSON.
    CREATE TABLE IF NOT EXISTS plans (
      event_id TEXT PRIMARY KEY REFERENCES events(id),
      mode TEXT NOT NULL DEFAULT 'write' CHECK (mode IN ('write','attach')),
      -- The organizer's own confirmation that referenced facility arrangements remain
      -- accessible and operational throughout the event. Not inherited (SPEC 2e).
      ref_confirmed INTEGER NOT NULL DEFAULT 0,
      sections TEXT NOT NULL DEFAULT '{}',   -- JSON: { [n]: { text?, covered? } }
      attached_file TEXT,
      major_incident TEXT NOT NULL DEFAULT '{}', -- JSON: { [n]: { covered } }
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS submissions (
      event_id TEXT PRIMARY KEY REFERENCES events(id),
      declarations TEXT NOT NULL DEFAULT '{}', -- JSON: { [index]: true }
      insurance TEXT NOT NULL DEFAULT '{}',    -- JSON: insurer/policy/coverage/evidence
      representative TEXT NOT NULL DEFAULT '',
      telephone TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT '',
      expedited INTEGER NOT NULL DEFAULT 0,    -- Protocol 8.4: filed inside the lead time
      filed_at TEXT,
      moph_reference TEXT
    );

    CREATE TABLE IF NOT EXISTS material_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL REFERENCES events(id),
      aspects TEXT NOT NULL,                   -- JSON: aspect keys
      description TEXT NOT NULL,
      effective_date TEXT NOT NULL DEFAULT '',
      reported_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Protocol 13: the 24-hour serious-incident notification. A separate obligation
    -- from the post-event report; filing the report does not satisfy it.
    CREATE TABLE IF NOT EXISTS serious_incident_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL REFERENCES events(id),
      notified_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS post_event_reports (
      event_id TEXT PRIMARY KEY REFERENCES events(id),
      activity TEXT NOT NULL DEFAULT '{}',     -- JSON: the seven aggregate figures
      significant TEXT NOT NULL DEFAULT '{}',  -- JSON: { [key]: true }
      lessons_none INTEGER NOT NULL DEFAULT 0,
      lessons_text TEXT NOT NULL DEFAULT '',
      organizer_signed_at TEXT,
      director_signed_at TEXT,
      submitted_at TEXT
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
