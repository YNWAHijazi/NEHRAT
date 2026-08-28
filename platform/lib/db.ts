/**
 * The data layer. node:sqlite (built into Node 22.5+), no ORM, no native build step.
 *
 * `is_demo` is a real column on every record-bearing table -- non-negotiable #8. The
 * demonstration accounts exist as real rows; what never runs in a deployed environment
 * is the seeder (see seedDemonstration and its guard).
 */

import { DatabaseSync } from 'node:sqlite';
import { nowStamp } from './clock';
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
  // now_stamp(): the review-clock-aware timestamp, registered as a SQL function so
  // every write can use it inline. Schema DEFAULTs cannot call it (SQLite restricts
  // defaults to built-ins), so write paths pass timestamps explicitly.
  db.function('now_stamp', () => nowStamp());
  migrate(db);

  // The seeder is forced off in deployed environments -- the guard is NODE_ENV, and
  // there is deliberately no environment variable that re-enables it in production.
  // BEFORE the seeder: triggers installed afterwards never see the rows it wrote, so
  // every seeded default kept the real clock while the gates ran on the review clock.
  stampDefaultsOnTheOneClock(db);
  if (process.env.NODE_ENV !== 'production') {
    seedDemonstration(db);
  }
  return db;
}

/**
 * ONE CLOCK. Date gates run on the Beirut review clock; schema DEFAULTs run on
 * SQLite's UTC datetime('now') and cannot call now_stamp(). These per-connection
 * triggers re-stamp any timestamp a DEFAULT just populated (recognised by being
 * within seconds of UTC now) onto now_stamp() -- the same clock as every gate.
 * Explicit values -- the seeder's historical dates, an app-passed stamp -- fall
 * outside the window and are never touched.
 */
function stampDefaultsOnTheOneClock(d: DatabaseSync): void {
  const defaulted: [string, string][] = [
    ['accounts', 'created_at'], ['password_resets', 'created_at'], ['sessions', 'created_at'],
    ['events', 'created_at'], ['assessments', 'created_at'], ['event_attachments', 'attached_at'],
    ['invitations', 'invited_at'], ['shared_documents', 'added_at'], ['fr_readiness', 'updated_at'],
    ['fr_reports', 'created_at'], ['role_profiles', 'updated_at'], ['event_governance', 'updated_at'],
    ['plans', 'updated_at'], ['submission_versions', 'archived_at'], ['material_changes', 'reported_at'],
    ['serious_incident_notifications', 'notified_at'], ['venues', 'created_at'],
    ['venue_assessments', 'created_at'], ['venue_changes', 'reported_at'], ['facilities', 'created_at'],
    ['facility_persons', 'updated_at'], ['facility_devices', 'updated_at'], ['facility_devices', 'created_at'],
    ['facility_device_updates', 'created_at'], ['facility_plan_confirmations', 'created_at'],
    ['facility_incidents', 'created_at'], ['facility_requests', 'created_at'],
    ['facility_interests', 'created_at'], ['review_state', 'updated_at'],
    ['determinations', 'recorded_at'], ['added_measures', 'recorded_at'],
    ['ministry_config', 'published_at'], ['facility_designations', 'designated_at'],
    ['enquiries', 'asked_at'],
  ];
  for (const [table, col] of defaulted) {
    d.exec(`
      CREATE TEMP TRIGGER IF NOT EXISTS one_clock_${table}_${col}
      AFTER INSERT ON ${table}
      FOR EACH ROW
      WHEN NEW.${col} >= datetime('now', '-2 seconds') AND NEW.${col} <= datetime('now', '+2 seconds')
      BEGIN
        UPDATE ${table} SET ${col} = now_stamp() WHERE rowid = NEW.rowid;
      END;
    `);
  }
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
      role TEXT NOT NULL CHECK (role IN ('organizer','ems','director','response','reviewer','inspector','ministry_admin','order','platform_owner')),
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
      -- returned: the Ministry returned it with a reason; the organizer edits and
      -- re-submits, which sets pending again.
      status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('none','pending','recorded','returned')),
      recorded_at TEXT,
      return_reason TEXT,
      returned_at TEXT,
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
      token TEXT PRIMARY KEY,          -- unguessable, never a sequential id (rule 6)
      event_id TEXT NOT NULL REFERENCES events(id),
      kind TEXT NOT NULL CHECK (kind IN ('ems','director')),
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      -- 'withdrawn': the organizer pulled an UNANSWERED nomination -- the token dies
      -- for registration, the nominee's page shows it withdrawn, and no material
      -- change arises because nothing was ever confirmed. 'removed': the organizer
      -- removed a CONFIRMED party -- a material change, the party is notified, and a
      -- filed submission owes a change report.
      status TEXT NOT NULL DEFAULT 'nominated' CHECK (status IN ('nominated','confirmed','declined','withdrawn','removed')),
      declaration TEXT NOT NULL DEFAULT 'none' CHECK (declaration IN ('none','draft','signed')),
      -- Slice 5: the counterparty's side of the nomination. The account links on
      -- acceptance; a decline carries its reason (a material change the organizer
      -- must report); a modification request keeps the nomination open with a note.
      account_id INTEGER REFERENCES accounts(id),
      response_note TEXT NOT NULL DEFAULT '',
      ops_detail TEXT NOT NULL DEFAULT '{}',      -- JSON: the Level 2 operational detail
      declaration_items TEXT NOT NULL DEFAULT '[]', -- JSON: ten booleans (draft state)
      certification TEXT NOT NULL DEFAULT '{}',   -- JSON: the provider certification block
      signed_at TEXT,
      invited_at TEXT NOT NULL DEFAULT (datetime('now')),
      answered_at TEXT,
      closed_at TEXT                   -- when withdrawn or removed, by the organizer
    );

    -- Shared documents between the organizer and ONE named provider: one list,
    -- visible to both sides of that pair, sent to the Ministry only if the
    -- organizer attaches it to the submission.
    CREATE TABLE IF NOT EXISTS shared_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invitation_token TEXT NOT NULL REFERENCES invitations(token),
      name_en TEXT NOT NULL, name_ar TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL CHECK (source IN ('organizer','provider','requested','missing')),
      file_name TEXT,
      meta_en TEXT NOT NULL DEFAULT '', meta_ar TEXT NOT NULL DEFAULT '',
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- First-response unit (cardiac-arrest instrument): its own account, no facility
    -- records, no event nominations. Readiness confirmations per group, and one
    -- dataset report per patient -- by the platform form or an attached
    -- patient-care report that captures everything required.
    CREATE TABLE IF NOT EXISTS fr_readiness (
      account_id INTEGER PRIMARY KEY REFERENCES accounts(id),
      confirmations TEXT NOT NULL DEFAULT '{}',   -- JSON: {equipment:[..],competence:[..],operational:[..]}
      signed_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fr_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      mode TEXT NOT NULL DEFAULT 'platform' CHECK (mode IN ('platform','attach')),
      attached_file TEXT,
      covered TEXT NOT NULL DEFAULT '{}',         -- JSON: section key -> covered by the attachment
      payload TEXT NOT NULL DEFAULT '{}',         -- JSON: section.field -> value
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- The provider / physician profile: completed once, reused across events.
    CREATE TABLE IF NOT EXISTS role_profiles (
      account_id INTEGER PRIMARY KEY REFERENCES accounts(id),
      fields TEXT NOT NULL DEFAULT '{}',          -- JSON: profile field key -> value
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- The Director's clinical-governance text. Written by the Director, rendered
    -- read-only in the organizer's plan (sections 10 and 12); the organizer cannot
    -- overwrite it.
    CREATE TABLE IF NOT EXISTS event_governance (
      event_id TEXT PRIMARY KEY REFERENCES events(id),
      sections TEXT NOT NULL DEFAULT '{}',        -- JSON: {clinical, command, incidentRole}
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- The plan: write-here or attach-a-document; sixteen sections either written or
    -- confirmed covered; the eleven major-incident items ride as JSON.
    CREATE TABLE IF NOT EXISTS plans (
      event_id TEXT PRIMARY KEY REFERENCES events(id),
      mode TEXT NOT NULL DEFAULT 'write' CHECK (mode IN ('write','attach')),
      -- The organizer's own confirmation that referenced facility arrangements remain
      -- accessible and operational throughout the event. Not inherited (SPEC 2e).
      ref_confirmed INTEGER NOT NULL DEFAULT 0,
      -- The two captured event facts the 12 shortfalls derive from (Slice 4).
      ref_admits_children INTEGER NOT NULL DEFAULT 0,
      ref_temporary_areas INTEGER NOT NULL DEFAULT 0,
      sections TEXT NOT NULL DEFAULT '{}',   -- JSON: { [n]: { text?, covered? } }
      attached_file TEXT,
      major_incident TEXT NOT NULL DEFAULT '{}', -- JSON: { [n]: { covered } }
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Every save archives the row it replaces: "prior versions remain readable" is a
    -- storage guarantee, not screen copy. Read newest-first for the history block.
    CREATE TABLE IF NOT EXISTS plan_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL REFERENCES events(id),
      version INTEGER NOT NULL,
      mode TEXT NOT NULL,
      ref_confirmed INTEGER NOT NULL,
      ref_admits_children INTEGER NOT NULL,
      ref_temporary_areas INTEGER NOT NULL,
      sections TEXT NOT NULL,
      attached_file TEXT,
      major_incident TEXT NOT NULL,
      saved_at TEXT NOT NULL
    );

    -- One CURRENT submission per event, versioned: a revision outcome reopens it, and
    -- re-filing archives the row it replaces into submission_versions. The reference
    -- number never changes across versions (the outcome notification says so).
    CREATE TABLE IF NOT EXISTS submissions (
      event_id TEXT PRIMARY KEY REFERENCES events(id),
      declarations TEXT NOT NULL DEFAULT '{}', -- JSON: { [index]: true }
      insurance TEXT NOT NULL DEFAULT '{}',    -- JSON: insurer/policy/coverage/evidence
      representative TEXT NOT NULL DEFAULT '',
      telephone TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT '',
      expedited INTEGER NOT NULL DEFAULT 0,    -- Protocol 8.4: filed inside the lead time
      filed_at TEXT,
      moph_reference TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS submission_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL REFERENCES events(id),
      version INTEGER NOT NULL,
      declarations TEXT NOT NULL,
      insurance TEXT NOT NULL,
      representative TEXT NOT NULL,
      telephone TEXT NOT NULL,
      position TEXT NOT NULL,
      expedited INTEGER NOT NULL,
      filed_at TEXT,
      archived_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    -- Protocol 13 p1: its own obligation with its own control, independent of the
    -- post-event report and available the moment the event starts. Type and time of
    -- occurrence are the whole record -- no narrative, no patient data.
    CREATE TABLE IF NOT EXISTS serious_incident_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL REFERENCES events(id),
      incident_type TEXT NOT NULL CHECK (incident_type IN ('arrest','death','major','interruption')),
      occurred_at TEXT NOT NULL,
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
      category TEXT NOT NULL DEFAULT '',
      address_municipality_en TEXT NOT NULL DEFAULT '',
      address_municipality_ar TEXT NOT NULL DEFAULT '',
      responsible_contact TEXT NOT NULL DEFAULT '',
      licensed_capacity INTEGER,
      regularly_hosts INTEGER NOT NULL DEFAULT 0,
      is_nightclub INTEGER NOT NULL DEFAULT 0,
      -- classification: derived by the engine at assessment, never entered
      level INTEGER, issued TEXT, valid_until TEXT,
      moph_reference TEXT,             -- MOPH-VN-yyyy-nnnn, at classification
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- One routine operating session per year; versioned, never edited in place.
    CREATE TABLE IF NOT EXISTS venue_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venue_id TEXT NOT NULL REFERENCES venues(id),
      version INTEGER NOT NULL,
      answers TEXT NOT NULL,
      inputs TEXT NOT NULL,
      derivation TEXT NOT NULL,
      nehrat_tool_version TEXT NOT NULL DEFAULT '',
      effective TEXT NOT NULL,         -- the Arabic issue: effective and expiry dates
      valid_until TEXT NOT NULL,
      representative TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (venue_id, version)
    );

    CREATE TABLE IF NOT EXISTS venue_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venue_id TEXT NOT NULL REFERENCES venues(id),
      aspects TEXT NOT NULL,
      description TEXT NOT NULL,
      effective_date TEXT NOT NULL DEFAULT '',
      reported_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- The facility service (Slice 4). The record id is FC-nnnn at creation; the
    -- profile is Annex B section 1; the category is a KEY into facility.json --
    -- its state chip and requirement rule derive at read, never stored.
    CREATE TABLE IF NOT EXISTS facilities (
      id TEXT PRIMARY KEY,             -- FC-0014
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
      category_key TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      municipality_en TEXT NOT NULL DEFAULT '',
      municipality_ar TEXT NOT NULL DEFAULT '',
      operating_hours TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      access_point TEXT NOT NULL DEFAULT '',
      ems_number TEXT NOT NULL DEFAULT '',
      -- Power two's evaluable fact: without a recorded capacity, a published
      -- public-venue threshold has nothing to bite on.
      licensed_capacity INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_demo INTEGER NOT NULL DEFAULT 0
    );

    -- One coordinator record referenced by every device record and the plan
    -- (ROADMAP 2d): a row per role, the coordinator unique per facility.
    CREATE TABLE IF NOT EXISTS facility_persons (
      facility_id TEXT NOT NULL REFERENCES facilities(id),
      role TEXT NOT NULL CHECK (role IN ('coordinator','alternate','emsGuide')),
      name_or_position TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (facility_id, role)
    );

    -- One record per device (Annex C). The label AED-001 is per facility.
    CREATE TABLE IF NOT EXISTS facility_devices (
      facility_id TEXT NOT NULL REFERENCES facilities(id),
      label TEXT NOT NULL,             -- AED-001
      identification TEXT NOT NULL DEFAULT '',   -- barcode, QR code or serial number
      location_en TEXT NOT NULL DEFAULT '',
      location_ar TEXT NOT NULL DEFAULT '',
      accessible_hours INTEGER NOT NULL DEFAULT 1,
      publicly_accessible INTEGER NOT NULL DEFAULT 0,
      pediatric TEXT NOT NULL DEFAULT 'no' CHECK (pediatric IN ('yes','no','na')),
      operational INTEGER NOT NULL DEFAULT 1,
      pad_expiry TEXT,
      battery_expiry TEXT,
      latest_check TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (facility_id, label)
    );

    -- Audit of the five Annex C purposes; signed by the FACILITY REPRESENTATIVE.
    CREATE TABLE IF NOT EXISTS facility_device_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT NOT NULL REFERENCES facilities(id),
      device_label TEXT NOT NULL,
      purpose TEXT NOT NULL,
      representative TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Annex B section 5: readiness confirmation. Signed by the COORDINATOR.
    CREATE TABLE IF NOT EXISTS facility_plan_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT NOT NULL REFERENCES facilities(id),
      checks TEXT NOT NULL,            -- JSON: planChecks keys -> boolean
      drill_date TEXT,
      coordinator TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Annex D. The payload is the full field set as JSON; the narrative is blocked
    -- at submission while a personal name is detected (non-negotiable 7).
    CREATE TABLE IF NOT EXISTS facility_incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT NOT NULL REFERENCES facilities(id),
      payload TEXT NOT NULL,
      narrative TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Ministry corrective-action requests shown on the readiness screen. Recorded by
    -- the Ministry console (Slice 6); the facility side only displays and answers.
    CREATE TABLE IF NOT EXISTS facility_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT NOT NULL REFERENCES facilities(id),
      body_en TEXT NOT NULL, body_ar TEXT NOT NULL,
      due TEXT,
      -- Slice 6: a request is a corrective action with a life of its own. The
      -- due date derives from the configured corrective timeline; while that
      -- value is unset no due date is computed, and the row says so.
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','corrected')),
      raised_by TEXT NOT NULL DEFAULT '',
      corrected_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_demo INTEGER NOT NULL DEFAULT 0
    );

    -- Applicability (Protocol 3): referrals logged from outside, and the Ministry's
    -- in-scope / out-of-scope determination with its reasons. An in-scope
    -- determination may DESIGNATE the event -- the instrument's mechanism for
    -- bringing an unregistered mass gathering into the process. The record is the
    -- Ministry's own: no organizer account exists yet, so nothing here scopes to one.
    CREATE TABLE IF NOT EXISTS applicability_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',       -- who referred it (municipality, authority)
      note TEXT NOT NULL DEFAULT '',
      determination TEXT NOT NULL DEFAULT 'undetermined' CHECK (determination IN ('undetermined','in_scope','out_of_scope')),
      reasons TEXT NOT NULL DEFAULT '',
      designated INTEGER NOT NULL DEFAULT 0,
      recorded_by TEXT NOT NULL DEFAULT '',
      determined_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_demo INTEGER NOT NULL DEFAULT 0
    );

    -- Record an interest: the end of the journey for a category awaiting a Ministry
    -- value. The operator is notified when the value activates.
    CREATE TABLE IF NOT EXISTS facility_interests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      category_key TEXT NOT NULL,
      facility_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ---- Slice 6: the Ministry console ----

    -- Internal workflow state on a filed submission: grey, quiet, never a
    -- determination. One row per event under review.
    CREATE TABLE IF NOT EXISTS review_state (
      event_id TEXT PRIMARY KEY REFERENCES events(id),
      state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','assigned','progress')),
      reviewer TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- The three outcomes -- the ONLY regulatory determinations. History kept:
    -- a revision then a satisfied are two rows, and the reference number never
    -- changes between them.
    CREATE TABLE IF NOT EXISTS determinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL REFERENCES events(id),
      outcome TEXT NOT NULL CHECK (outcome IN ('incomplete','revision','satisfied')),
      note TEXT NOT NULL DEFAULT '',
      recorded_by TEXT NOT NULL,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Attestations: the desk-verification gate on a submission (attestations.json).
    -- One row per (event, item); an ABSENT row is the pending state with no reason,
    -- so nothing needs seeding for an untouched submission. An attestation is not an
    -- outcome: it blocks only 'satisfied', through outcomeBlockersFor. A deficiency
    -- is not a third state -- it is the reason a pending row is pending.
    CREATE TABLE IF NOT EXISTS attestations (
      event_id TEXT NOT NULL REFERENCES events(id),
      item_key TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','complete')),
      attested_by TEXT,
      attested_at TEXT,
      reason_en TEXT,
      reason_ar TEXT,
      reason_by TEXT,
      reason_at TEXT,
      PRIMARY KEY (event_id, item_key)
    );

    -- Additional measures: a distinct action, not a fourth outcome. The measure
    -- is a catalogue item (attachments-catalog doc key or requirements-matrix
    -- row) -- nothing outside the catalogue attaches to a submission. The note
    -- is a note, never a requirement.
    CREATE TABLE IF NOT EXISTS added_measures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL REFERENCES events(id),
      catalog_key TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      blocking INTEGER NOT NULL DEFAULT 1,
      cleared_at TEXT,
      recorded_by TEXT NOT NULL,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Inspections on a submission. An inspector schedules and records findings;
    -- a blocking inspection without recorded findings gates ONLY the satisfied
    -- outcome. Findings are not an outcome.
    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL REFERENCES events(id),
      title_en TEXT NOT NULL, title_ar TEXT NOT NULL,
      inspector TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'none' CHECK (state IN ('none','scheduled','conducted','recorded')),
      date TEXT,
      blocking INTEGER NOT NULL DEFAULT 0,
      findings TEXT NOT NULL DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 0
    );

    -- Ministry configuration values (the cardiac powers). Unset = no row: the
    -- first-class answer. Publishing records the value, its effective date and
    -- who published it, and notifies the operators it reaches.
    CREATE TABLE IF NOT EXISTS ministry_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      effective TEXT,
      published_by TEXT NOT NULL DEFAULT '',
      published_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Designation of a place as a covered facility, exercised from Reported
    -- arrest locations (power eight). The place may not yet hold a facility
    -- record; the designation stands on its own and its operator is notified.
    CREATE TABLE IF NOT EXISTS facility_designations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL, name_ar TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      municipality TEXT NOT NULL DEFAULT '',
      facility_id TEXT,
      designated_by TEXT NOT NULL,
      designated_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_demo INTEGER NOT NULL DEFAULT 0
    );

    -- Enquiries against a determination: the organizer asks, the Ministry
    -- answers. The outcome does not change here.
    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL REFERENCES events(id),
      asked_by TEXT NOT NULL DEFAULT '',
      question TEXT NOT NULL,
      asked_at TEXT NOT NULL DEFAULT (datetime('now')),
      reply TEXT NOT NULL DEFAULT '',
      replied_by TEXT NOT NULL DEFAULT '',
      replied_at TEXT,
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

  // Additive column migrations: CREATE TABLE IF NOT EXISTS never alters an existing
  // table, so a database created before a column existed keeps its old shape and the
  // first query against the new column crashes. Guarded ALTERs bring it forward.
  const addColumn = (table: string, column: string, ddl: string): void => {
    const cols = d.prepare(`SELECT name FROM pragma_table_info(?)`).all(table) as { name: string }[];
    if (!cols.some((c) => c.name === column)) {
      d.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  };

  /**
   * Rebuild a table whose CHECK constraint widened. SQLite cannot alter a CHECK in
   * place, so the table is copied, dropped and renamed -- and the documented
   * procedure requires foreign_keys OFF *OUTSIDE* the transaction.
   *
   * THIS IS WHY THE FIRST VERSION BROKE EVERY EXISTING DATABASE: shared_documents
   * holds live invitation tokens, so DROP TABLE invitations was itself a foreign-key
   * violation; the exec threw mid-transaction, the transaction stayed open, and every
   * later request died on "database is locked" instead of on the real error. The e2e
   * suite never saw it because it seeds a fresh database, where the rebuild branch
   * does not run at all -- a migration path no test could reach.
   *
   * A failure now rolls back, clears the scratch table and rethrows the REAL error,
   * so the next request reports the cause rather than a lock.
   */
  const rebuildTable = (name: string, createNext: string, columns: string): void => {
    d.exec('PRAGMA foreign_keys = OFF');
    try {
      d.exec(`DROP TABLE IF EXISTS ${name}_next`);
      d.exec('BEGIN');
      d.exec(createNext);
      d.exec(`INSERT INTO ${name}_next SELECT ${columns} FROM ${name}`);
      d.exec(`DROP TABLE ${name}`);
      d.exec(`ALTER TABLE ${name}_next RENAME TO ${name}`);
      const violations = d.prepare('PRAGMA foreign_key_check').all() as unknown[];
      if (violations.length > 0) {
        throw new Error(`Rebuild of ${name} would leave ${violations.length} foreign-key violation(s)`);
      }
      d.exec('COMMIT');
    } catch (error) {
      try {
        d.exec('ROLLBACK');
      } catch {
        // Already rolled back by the failing statement; the rethrow below is the report.
      }
      try {
        d.exec(`DROP TABLE IF EXISTS ${name}_next`);
      } catch {
        // Best effort: the scratch table must not block the next attempt.
      }
      throw error;
    } finally {
      d.exec('PRAGMA foreign_keys = ON');
    }
  };

  addColumn('submissions', 'version', 'version INTEGER NOT NULL DEFAULT 1');
  addColumn('facilities', 'licensed_capacity', 'licensed_capacity INTEGER');
  // SQLite cannot add a NOT NULL column without a default; the CHECK stays on new
  // databases, and pre-migration rows (which predate typed notifications) read as
  // the generic 'major' kind rather than crashing every screen that lists them.
  addColumn('serious_incident_notifications', 'incident_type', "incident_type TEXT NOT NULL DEFAULT 'major'");
  addColumn('serious_incident_notifications', 'occurred_at', "occurred_at TEXT NOT NULL DEFAULT ''");
  addColumn('invitations', 'closed_at', 'closed_at TEXT');
  // Cancellation and postponement (Protocol 8.5 / 9(vii)): a lifecycle on the event,
  // not a deletion -- the record and its reference survive; obligations stop or wait.
  addColumn('events', 'lifecycle', "lifecycle TEXT NOT NULL DEFAULT 'active'");
  addColumn('events', 'lifecycle_at', 'lifecycle_at TEXT');
  addColumn('events', 'lifecycle_note', 'lifecycle_note TEXT');
  addColumn('events', 'postponed_to', 'postponed_to TEXT');
  addColumn('organizations', 'return_reason', 'return_reason TEXT');
  // Suspension: access off, record intact. currentAccount refuses a suspended
  // session, so suspension takes effect on the next request, not the next sign-in.
  addColumn('accounts', 'suspended', 'suspended INTEGER NOT NULL DEFAULT 0');
  addColumn('facility_requests', 'close_note', 'close_note TEXT');
  addColumn('facility_requests', 'closed_by', 'closed_by TEXT');
  // 'corrective' (the default) or 'confirmation' -- a readiness-confirmation request
  // closes when the operator records the annual confirmation.
  addColumn('facility_requests', 'kind', "kind TEXT NOT NULL DEFAULT 'corrective'");
  // The Director's return of the post-event report, RECORDED -- not just notified.
  addColumn('post_event_reports', 'director_returned_at', 'director_returned_at TEXT');
  addColumn('post_event_reports', 'director_return_note', 'director_return_note TEXT');
  // The Director's credential record: licence number, self-maintained. Verification
  // (the Order's, lane-gated) reads it; it never verifies itself.
  addColumn('accounts', 'credential_licence', 'credential_licence TEXT');
  addColumn('facility_device_updates', 'reason', 'reason TEXT');
  addColumn('organizations', 'returned_at', 'returned_at TEXT');

  // THE PLATFORM STORES THE FILE (reviewer ruling, 2026-08-28). Attachments were a
  // name and a date; a reviewer who cannot open the route map cannot review the
  // route. Bytes live in the row: one store, one backup, no orphaned files on a
  // disk the database knows nothing about. The size ceiling is configuration, in
  // lib/rules/data/uploads.json, and the accepted types are an allow-list -- see
  // lib/rules/uploads.ts for why the served type never comes from the upload.
  //
  // NULL bytes are legitimate and permanent: every demonstration attachment seeded
  // before this decision is a name and a date, and the screen says so rather than
  // offering a link to nothing.
  addColumn('event_attachments', 'content_type', 'content_type TEXT');
  addColumn('event_attachments', 'byte_size', 'byte_size INTEGER');
  addColumn('event_attachments', 'bytes', 'bytes BLOB');
  addColumn('plans', 'attached_content_type', 'attached_content_type TEXT');
  addColumn('plans', 'attached_byte_size', 'attached_byte_size INTEGER');
  addColumn('plans', 'attached_bytes', 'attached_bytes BLOB');
  // The counterparty lane stores its files on the same terms. Leaving one name-only
  // lane while the screens say the platform stores documents would be the same shape
  // of defect as a promise with no delivery behind it.
  addColumn('shared_documents', 'content_type', 'content_type TEXT');
  addColumn('shared_documents', 'byte_size', 'byte_size INTEGER');
  addColumn('shared_documents', 'bytes', 'bytes BLOB');

  // The organizations CHECK gained 'returned' -- same rebuild dance as invitations.
  const orgSql = (d
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'organizations'`)
    .get() as { sql: string } | undefined)?.sql ?? '';
  if (orgSql !== '' && !orgSql.includes("'returned'")) {
    rebuildTable(
      'organizations',
      `CREATE TABLE organizations_next (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL UNIQUE REFERENCES accounts(id),
        name_en TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('none','pending','recorded','returned')),
        recorded_at TEXT,
        return_reason TEXT,
        returned_at TEXT,
        is_demo INTEGER NOT NULL DEFAULT 0
      )`,
      'id, account_id, name_en, name_ar, status, recorded_at, return_reason, returned_at, is_demo',
    );
  }

  // The invitations CHECK gained two statuses (withdrawn, removed). SQLite cannot
  // widen a CHECK in place, so a pre-migration database is rebuilt once -- detected
  // from the stored schema text, copied column-for-column, constraint order intact.
  const invSql = (d
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'invitations'`)
    .get() as { sql: string } | undefined)?.sql ?? '';
  if (invSql !== '' && !invSql.includes("'withdrawn'")) {
    rebuildTable(
      'invitations',
      `CREATE TABLE invitations_next (
        token TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id),
        kind TEXT NOT NULL CHECK (kind IN ('ems','director')),
        name_en TEXT NOT NULL,
        name_ar TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'nominated' CHECK (status IN ('nominated','confirmed','declined','withdrawn','removed')),
        declaration TEXT NOT NULL DEFAULT 'none' CHECK (declaration IN ('none','draft','signed')),
        account_id INTEGER REFERENCES accounts(id),
        response_note TEXT NOT NULL DEFAULT '',
        ops_detail TEXT NOT NULL DEFAULT '{}',
        declaration_items TEXT NOT NULL DEFAULT '[]',
        certification TEXT NOT NULL DEFAULT '{}',
        signed_at TEXT,
        invited_at TEXT NOT NULL DEFAULT (datetime('now')),
        answered_at TEXT,
        closed_at TEXT
      )`,
      'token, event_id, kind, name_en, name_ar, email, status, declaration, account_id, response_note, ops_detail, declaration_items, certification, signed_at, invited_at, answered_at, closed_at',
    );
  }
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
