/**
 * Read-side queries for the organizer surfaces. Ownership is enforced here: every query
 * is scoped to the session's account, so a foreign record and a missing record are the
 * same absence -- indistinguishable by status.
 */

import { getDb } from './db';
import { deriveLevel } from './rules';
import {
  FACILITY_CONTENT,
  facilityCategory,
  facilityLedger,
  facilityStanding,
  type LedgerInputs,
  type LedgerRow as FacilityLedgerRow,
  type Standing,
} from './rules';
import { beirutToday as beirutTodayFn, clockNow as clockNowFn } from './clock';
import { planIsComplete, declarationsAreComplete, effectiveCycles, demonstrationFilter, filingDeadline, eventStage, POST_EVENT_STAGE } from './rules';
import type { DomainAnswers, Level, LevelDerivation, MinimumConditionInputs, OutcomeKey } from './rules';
import { organizerEventState } from './rules';

export interface EventRow {
  id: string;
  nameEn: string;
  nameAr: string;
  startDate: string | null;
  endDate: string | null;
  mophReference: string | null;
  filed: boolean;
  level: Level | null;
  /** Latest recorded determination, null until a reviewer records one. */
  outcome: OutcomeKey | null;
  stateEn: string;
  stateAr: string;
  due: string | null;
  dueLabelEn: string;
  dueLabelAr: string;
  stage: number | null;
  stageEn: string;
  stageAr: string;
  stages: string[];
  span: number;
  createdAt: string;
  venueFacilityId: string | null;
}

export interface AssessmentVersion {
  version: number;
  answers: DomainAnswers;
  inputs: MinimumConditionInputs;
  derivation: LevelDerivation;
  createdAt: string;
}

interface EventDbRow {
  id: string;
  name_en: string;
  name_ar: string;
  start_date: string | null;
  end_date: string | null;
  moph_reference: string | null;
  filed: number;
  demo_state_en: string | null;
  demo_state_ar: string | null;
  demo_due: string | null;
  demo_due_label_en: string | null;
  demo_due_label_ar: string | null;
  demo_stage: number | null;
  demo_stage_en: string | null;
  demo_stage_ar: string | null;
  demo_stages: string | null;
  demo_span: number | null;
  demo_level: number | null;
  created_at: string;
  venue_facility_id: string | null;
}

function latestDerivation(eventId: string): LevelDerivation | null {
  const row = getDb()
    .prepare(
      `SELECT answers, inputs FROM assessments WHERE event_id = ? ORDER BY version DESC LIMIT 1`,
    )
    .get(eventId) as { answers: string; inputs: string } | undefined;
  if (!row) return null;
  // Recomputed against the current rules data, never trusted from storage.
  return deriveLevel({
    answers: JSON.parse(row.answers) as DomainAnswers,
    inputs: JSON.parse(row.inputs) as MinimumConditionInputs,
  });
}

/** The full latest derivation, unscoped -- the review screen reports both results and which governed (non-negotiable 1). */
export function derivationForReview(eventId: string): LevelDerivation | null {
  return latestDerivation(eventId);
}

/** Latest recorded outcome -- same ordering as the Ministry queue, so the two sides never disagree. */
export function latestOutcomeFor(eventId: string): OutcomeKey | null {
  const row = getDb()
    .prepare(
      `SELECT outcome FROM determinations WHERE event_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`,
    )
    .get(eventId) as { outcome: OutcomeKey } | undefined;
  return row?.outcome ?? null;
}

function toEventRow(row: EventDbRow, orgRecorded = false): EventRow {
  const derivation = latestDerivation(row.id);
  const level =
    derivation?.finalLevel ?? (row.demo_level as Level | null) ?? null;
  // A recorded outcome overrides the seeded presentation state: the organizer must
  // read the same determination the reviewer recorded, not a stale seeded string.
  const outcome = latestOutcomeFor(row.id);
  // A seeded row's level IS its assessment's product: assessed when either the
  // stored answers derive, or a demonstration level stands in for them.
  const assessed = (derivation?.complete ?? false) || (derivation === null && level !== null);
  const filed = row.filed === 1;
  const derivedState = organizerEventState({ outcome, filed, assessed });
  // The dashboard tile derives what the record derives: seeded presentation values
  // apply only where they exist, and a real row is never a blank tile beside a
  // record that knows its own deadline and stage.
  const derivedDue =
    level !== null && row.start_date !== null
      ? filingDeadline(level, new Date(`${row.start_date}T12:00:00+03:00`)).date
      : null;
  const reportSubmitted =
    (getDb().prepare(`SELECT submitted_at FROM post_event_reports WHERE event_id = ?`).get(row.id) as { submitted_at: string | null } | undefined)?.submitted_at != null;
  const stageInfo = eventStage({
    assessed,
    filed,
    outcome,
    finalLevel: level,
    eventEndDate: row.end_date,
    reportSubmitted,
    now: clockNowFn(),
  });
  const derivedStages = [
    orgRecorded ? 'done' : 'current',
    assessed ? 'done' : 'current',
    !assessed ? 'todo' : filed ? 'done' : 'current',
    filed ? 'done' : 'todo',
    outcome
      ? outcome === 'satisfied'
        ? 'done'
        : 'returned'
      : filed && stageInfo.stage < POST_EVENT_STAGE
        ? 'current'
        : filed
          ? 'done'
          : 'todo',
    stageInfo.stage === POST_EVENT_STAGE ? 'current' : level === 3 ? 'todo' : 'na',
  ];
  return {
    id: row.id,
    nameEn: row.name_en,
    nameAr: row.name_ar,
    startDate: row.start_date,
    endDate: row.end_date,
    mophReference: row.moph_reference,
    filed: row.filed === 1,
    level,
    outcome,
    stateEn: outcome ? derivedState.en : (row.demo_state_en ?? derivedState.en),
    stateAr: outcome ? derivedState.ar : (row.demo_state_ar ?? derivedState.ar),
    due: row.demo_due ?? derivedDue,
    dueLabelEn: row.demo_due_label_en ?? 'File by',
    dueLabelAr: row.demo_due_label_ar ?? 'التقديم بحلول',
    stage: row.demo_stage ?? stageInfo.stage,
    stageEn: row.demo_stage_en ?? stageInfo.en,
    stageAr: row.demo_stage_ar ?? stageInfo.ar,
    stages: row.demo_stages ? (JSON.parse(row.demo_stages) as string[]) : derivedStages,
    span: row.demo_span ?? 60,
    createdAt: row.created_at,
    venueFacilityId: row.venue_facility_id,
  };
}

const EVENT_COLUMNS = `id, name_en, name_ar, start_date, end_date, moph_reference, filed,
   demo_state_en, demo_state_ar, demo_due, demo_due_label_en, demo_due_label_ar,
   demo_stage, demo_stage_en, demo_stage_ar, demo_stages, demo_span, demo_level, created_at, venue_facility_id`;

function orgRecordedFor(accountId: number): boolean {
  const r = getDb()
    .prepare(`SELECT status FROM organizations WHERE account_id = ?`)
    .get(accountId) as { status: string } | undefined;
  return r?.status === 'recorded';
}

export function eventsFor(accountId: number): EventRow[] {
  const orgRecorded = orgRecordedFor(accountId);
  const rows = getDb()
    .prepare(`SELECT ${EVENT_COLUMNS} FROM events WHERE account_id = ? ORDER BY created_at DESC`)
    .all(accountId) as unknown as EventDbRow[];
  return rows.map((r) => toEventRow(r, orgRecorded));
}

/** Scoped to the owner: a foreign id returns null exactly like a missing one. */
export function eventFor(accountId: number, eventId: string): EventRow | null {
  const row = getDb()
    .prepare(`SELECT ${EVENT_COLUMNS} FROM events WHERE id = ? AND account_id = ?`)
    .get(eventId, accountId) as unknown as EventDbRow | undefined;
  return row ? toEventRow(row, orgRecordedFor(accountId)) : null;
}

export function assessmentsFor(accountId: number, eventId: string): AssessmentVersion[] {
  const owned = getDb()
    .prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`)
    .get(eventId, accountId);
  if (!owned) return [];
  const rows = getDb()
    .prepare(
      `SELECT version, answers, inputs, created_at FROM assessments WHERE event_id = ? ORDER BY version DESC`,
    )
    .all(eventId) as unknown as { version: number; answers: string; inputs: string; created_at: string }[];
  return rows.map((r) => {
    const answers = JSON.parse(r.answers) as DomainAnswers;
    const inputs = JSON.parse(r.inputs) as MinimumConditionInputs;
    return {
      version: r.version,
      answers,
      inputs,
      derivation: deriveLevel({ answers, inputs }),
      createdAt: r.created_at,
    };
  });
}

export interface VenueRow {
  id: string; nameEn: string; nameAr: string;
  level: number | null; issued: string | null; validUntil: string | null;
}

export function venuesFor(accountId: number): VenueRow[] {
  const rows = getDb()
    .prepare(`SELECT id, name_en, name_ar, level, issued, valid_until FROM venues WHERE account_id = ?`)
    .all(accountId) as unknown as { id: string; name_en: string; name_ar: string; level: number | null; issued: string | null; valid_until: string | null }[];
  return rows.map((r) => ({ id: r.id, nameEn: r.name_en, nameAr: r.name_ar, level: r.level, issued: r.issued, validUntil: r.valid_until }));
}

export interface FacilityRow {
  id: string; nameEn: string; nameAr: string;
  categoryEn: string; categoryAr: string;
  devices: number; nextLapse: string | null;
  stateEn: string; stateAr: string; stateKind: string;
}

/** Everything the ledger derives from, in one read. */
function ledgerInputsFor(facilityId: string, today: string): LedgerInputs {
  const db = getDb();
  const dev = db
    .prepare(
      `SELECT COUNT(*) AS n, MIN(pad_expiry) AS pads, MIN(battery_expiry) AS battery,
              MIN(latest_check) AS oldest_check, MAX(updated_at) AS affirmed
       FROM facility_devices WHERE facility_id = ?`,
    )
    .get(facilityId) as { n: number; pads: string | null; battery: string | null; oldest_check: string | null; affirmed: string | null };
  const plan = db
    .prepare(
      `SELECT drill_date, created_at FROM facility_plan_confirmations
       WHERE facility_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(facilityId) as { drill_date: string | null; created_at: string } | undefined;
  const coord = db
    .prepare(`SELECT updated_at FROM facility_persons WHERE facility_id = ? AND role = 'coordinator'`)
    .get(facilityId) as { updated_at: string } | undefined;
  const day = (v: string | null | undefined): string | null => (v ? v.slice(0, 10) : null);
  return {
    earliestPadExpiry: day(dev.pads),
    padAffirmed: day(dev.affirmed),
    earliestBatteryExpiry: day(dev.battery),
    batteryAffirmed: day(dev.affirmed),
    oldestCheck: day(dev.oldest_check),
    drillDate: day(plan?.drill_date),
    confirmedAt: day(plan?.created_at),
    coordinatorUpdatedAt: day(coord?.updated_at),
    hasDevices: dev.n > 0,
    today,
    cycles: publishedCycles(),
  };
}

/** The published values the facility categories are governed by (powers one and two). */
export function publishedFacilityValues(): {
  phasedSchedule: { value: string; effective: string | null } | null;
  capacityThreshold: { value: string; effective: string | null } | null;
} {
  const config = ministryConfig();
  const pick = (key: string) => {
    const row = config.get(key);
    return row ? { value: row.value, effective: row.effective } : null;
  };
  return { phasedSchedule: pick('phasedSchedule'), capacityThreshold: pick('capacityThreshold') };
}

/**
 * The cycles the ledger runs on: published values where the Ministry has set them
 * (power ten), the provisional figures where it has not. The one read every ledger
 * caller shares -- publishing a cycle changes every screen that shows one.
 */
export function publishedCycles(): ReturnType<typeof effectiveCycles> {
  const config = ministryConfig();
  const num = (key: string): number | null => {
    const v = config.get(key)?.value;
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return effectiveCycles({ checkCycleDays: num('checkCycleDays'), lapseWindowDays: num('lapseWindowDays') });
}

export function facilityLedgerFor(facilityId: string, today: string): FacilityLedgerRow[] {
  return facilityLedger(ledgerInputsFor(facilityId, today));
}

export function facilitiesFor(accountId: number): FacilityRow[] {
  const today = beirutTodayFn();
  const rows = getDb()
    .prepare(`SELECT id, name_en, name_ar, category_key FROM facilities WHERE account_id = ?`)
    .all(accountId) as unknown as { id: string; name_en: string; name_ar: string; category_key: string }[];
  return rows.map((r) => {
    const cat = facilityCategory(r.category_key);
    const short = (FACILITY_CONTENT.categories.find((c) => c.key === r.category_key) ?? null) as
      | { shortEn?: string; shortAr?: string }
      | null;
    const devices = getDb()
      .prepare(`SELECT COUNT(*) AS n FROM facility_devices WHERE facility_id = ?`)
      .get(r.id) as { n: number };
    const ledger = facilityLedgerFor(r.id, today);
    const standing = facilityStanding(ledger);
    // The dashboard row carries the reference's short state; the readiness screen
    // carries the full standing line.
    const line =
      standing.kind === 'lapsed' ? FACILITY_CONTENT.standingShort.notMet : FACILITY_CONTENT.standingShort.met;
    const untils = ledger.map((row) => row.until).filter((u): u is string => u !== null);
    return {
      id: r.id, nameEn: r.name_en, nameAr: r.name_ar,
      categoryEn: short?.shortEn ?? cat?.en ?? '',
      categoryAr: short?.shortAr ?? cat?.ar ?? '',
      devices: devices.n,
      nextLapse: untils.length ? untils.reduce((a, b) => (a < b ? a : b)) : null,
      stateEn: line.en, stateAr: line.ar,
      stateKind: standing.kind === 'met' ? 'ok' : standing.kind,
    };
  });
}

/* ---------------- Slice 4: the facility service ---------------- */

export interface FacilityDetail {
  id: string;
  nameEn: string; nameAr: string;
  categoryKey: string;
  address: string;
  municipalityEn: string; municipalityAr: string;
  operatingHours: string; phone: string; email: string;
  accessPoint: string; emsNumber: string;
  createdAt: string;
}

export function facilityDetail(accountId: number, facilityId: string): FacilityDetail | null {
  const r = getDb()
    .prepare(
      `SELECT id, name_en, name_ar, category_key, address, municipality_en, municipality_ar,
              operating_hours, phone, email, access_point, ems_number, created_at
       FROM facilities WHERE id = ? AND account_id = ?`,
    )
    .get(facilityId, accountId) as
    | {
        id: string; name_en: string; name_ar: string; category_key: string; address: string;
        municipality_en: string; municipality_ar: string; operating_hours: string;
        phone: string; email: string; access_point: string; ems_number: string; created_at: string;
      }
    | undefined;
  if (!r) return null;
  return {
    id: r.id, nameEn: r.name_en, nameAr: r.name_ar, categoryKey: r.category_key,
    address: r.address, municipalityEn: r.municipality_en, municipalityAr: r.municipality_ar,
    operatingHours: r.operating_hours, phone: r.phone, email: r.email,
    accessPoint: r.access_point, emsNumber: r.ems_number, createdAt: r.created_at,
  };
}

export interface FacilityPerson {
  role: 'coordinator' | 'alternate' | 'emsGuide';
  nameOrPosition: string; phone: string; email: string; updatedAt: string;
}

export function facilityPersons(facilityId: string): FacilityPerson[] {
  const rows = getDb()
    .prepare(`SELECT role, name_or_position, phone, email, updated_at FROM facility_persons WHERE facility_id = ?`)
    .all(facilityId) as unknown as { role: FacilityPerson['role']; name_or_position: string; phone: string; email: string; updated_at: string }[];
  return rows.map((r) => ({ role: r.role, nameOrPosition: r.name_or_position, phone: r.phone, email: r.email, updatedAt: r.updated_at }));
}

export interface FacilityDevice {
  label: string;
  identification: string;
  locationEn: string; locationAr: string;
  accessibleHours: boolean; publiclyAccessible: boolean;
  pediatric: 'yes' | 'no' | 'na';
  operational: boolean;
  padExpiry: string | null; batteryExpiry: string | null; latestCheck: string | null;
  updatedAt: string;
}

export function facilityDevices(facilityId: string): FacilityDevice[] {
  const rows = getDb()
    .prepare(
      `SELECT label, identification, location_en, location_ar, accessible_hours,
              publicly_accessible, pediatric, operational, pad_expiry, battery_expiry,
              latest_check, updated_at
       FROM facility_devices WHERE facility_id = ? ORDER BY label`,
    )
    .all(facilityId) as unknown as {
      label: string; identification: string; location_en: string; location_ar: string;
      accessible_hours: number; publicly_accessible: number; pediatric: 'yes' | 'no' | 'na';
      operational: number; pad_expiry: string | null; battery_expiry: string | null;
      latest_check: string | null; updated_at: string;
    }[];
  return rows.map((r) => ({
    label: r.label, identification: r.identification,
    locationEn: r.location_en, locationAr: r.location_ar,
    accessibleHours: r.accessible_hours === 1, publiclyAccessible: r.publicly_accessible === 1,
    pediatric: r.pediatric, operational: r.operational === 1,
    padExpiry: r.pad_expiry, batteryExpiry: r.battery_expiry, latestCheck: r.latest_check,
    updatedAt: r.updated_at,
  }));
}

export interface FacilityPlanConfirmation {
  checks: Record<string, boolean>;
  drillDate: string | null;
  coordinator: string; position: string;
  createdAt: string;
}

export function facilityPlanConfirmation(facilityId: string): FacilityPlanConfirmation | null {
  const r = getDb()
    .prepare(
      `SELECT checks, drill_date, coordinator, position, created_at
       FROM facility_plan_confirmations WHERE facility_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(facilityId) as { checks: string; drill_date: string | null; coordinator: string; position: string; created_at: string } | undefined;
  if (!r) return null;
  return {
    checks: JSON.parse(r.checks) as Record<string, boolean>,
    drillDate: r.drill_date, coordinator: r.coordinator, position: r.position, createdAt: r.created_at,
  };
}

export interface FacilityRequestRow {
  id: number; bodyEn: string; bodyAr: string; due: string | null;
}

export function facilityRequests(facilityId: string): FacilityRequestRow[] {
  const rows = getDb()
    .prepare(`SELECT id, body_en, body_ar, due FROM facility_requests WHERE facility_id = ? ORDER BY created_at DESC`)
    .all(facilityId) as unknown as { id: number; body_en: string; body_ar: string; due: string | null }[];
  return rows.map((r) => ({ id: r.id, bodyEn: r.body_en, bodyAr: r.body_ar, due: r.due }));
}

export function facilityIncidentCount(facilityId: string): number {
  const r = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM facility_incidents WHERE facility_id = ?`)
    .get(facilityId) as { n: number };
  return r.n;
}

export interface NotificationRow {
  id: number;
  kind: 'needs_action' | 'for_information';
  subjectEn: string; subjectAr: string;
  bodyEn: string; bodyAr: string;
  recordRoute: string; sentAt: string; read: boolean;
}

export function notificationsFor(accountId: number): NotificationRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, read
       FROM notifications WHERE account_id = ? ORDER BY sent_at DESC`,
    )
    .all(accountId) as unknown as { id: number; kind: 'needs_action' | 'for_information'; subject_en: string; subject_ar: string; body_en: string; body_ar: string; record_route: string; sent_at: string; read: number }[];
  return rows.map((r) => ({
    id: r.id, kind: r.kind,
    subjectEn: r.subject_en, subjectAr: r.subject_ar,
    bodyEn: r.body_en, bodyAr: r.body_ar,
    recordRoute: r.record_route, sentAt: r.sent_at, read: r.read === 1,
  }));
}

export function unreadCountFor(accountId: number): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM notifications WHERE account_id = ? AND read = 0`)
    .get(accountId) as { n: number };
  return row.n;
}

export { beirutToday } from './clock';

export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/* ---------------- Slice 2: requirements, invitations, plan, submission ---------------- */

export interface AttachmentRow {
  docKey: string;
  fileName: string;
  attachedAt: string;
}

export function attachmentsFor(accountId: number, eventId: string): AttachmentRow[] {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return [];
  const rows = getDb()
    .prepare(`SELECT doc_key, file_name, attached_at FROM event_attachments WHERE event_id = ?`)
    .all(eventId) as unknown as { doc_key: string; file_name: string; attached_at: string }[];
  return rows.map((r) => ({ docKey: r.doc_key, fileName: r.file_name, attachedAt: r.attached_at }));
}

export interface InvitationRow {
  token: string;
  kind: 'ems' | 'director';
  nameEn: string;
  nameAr: string;
  email: string;
  status: 'nominated' | 'confirmed' | 'declined';
  declaration: 'none' | 'draft' | 'signed';
  invitedAt: string;
  answeredAt: string | null;
}

export function invitationsFor(accountId: number, eventId: string): InvitationRow[] {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return [];
  const rows = getDb()
    .prepare(
      `SELECT token, kind, name_en, name_ar, email, status, declaration, invited_at, answered_at
       FROM invitations WHERE event_id = ? ORDER BY invited_at`,
    )
    .all(eventId) as unknown as {
      token: string; kind: 'ems' | 'director'; name_en: string; name_ar: string; email: string;
      status: InvitationRow['status']; declaration: InvitationRow['declaration'];
      invited_at: string; answered_at: string | null;
    }[];
  return rows.map((r) => ({
    token: r.token, kind: r.kind, nameEn: r.name_en, nameAr: r.name_ar, email: r.email,
    status: r.status, declaration: r.declaration, invitedAt: r.invited_at, answeredAt: r.answered_at,
  }));
}

export interface PlanRow {
  mode: 'write' | 'attach';
  refConfirmed: boolean;
  refAdmitsChildren: boolean;
  refTemporaryAreas: boolean;
  sections: Record<string, { text?: string; covered?: boolean }>;
  attachedFile: string | null;
  majorIncident: Record<string, { covered?: boolean }>;
  version: number;
  updatedAt: string;
}

export function planFor(accountId: number, eventId: string): PlanRow | null {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return null;
  const r = getDb()
    .prepare(`SELECT mode, ref_confirmed, ref_admits_children, ref_temporary_areas, sections, attached_file, major_incident, version, updated_at FROM plans WHERE event_id = ?`)
    .get(eventId) as
    | { mode: 'write' | 'attach'; ref_confirmed: number; ref_admits_children: number; ref_temporary_areas: number; sections: string; attached_file: string | null; major_incident: string; version: number; updated_at: string }
    | undefined;
  if (!r) return null;
  return {
    mode: r.mode,
    refConfirmed: r.ref_confirmed === 1,
    refAdmitsChildren: r.ref_admits_children === 1,
    refTemporaryAreas: r.ref_temporary_areas === 1,
    sections: JSON.parse(r.sections) as PlanRow['sections'],
    attachedFile: r.attached_file,
    majorIncident: JSON.parse(r.major_incident) as PlanRow['majorIncident'],
    version: r.version,
    updatedAt: r.updated_at,
  };
}

export interface PlanVersionRow {
  version: number;
  mode: 'write' | 'attach';
  sections: Record<string, { text?: string; covered?: boolean }>;
  attachedFile: string | null;
  majorIncident: Record<string, { covered?: boolean }>;
  savedAt: string;
}

/** Archived plan versions, newest first. The current version is on `plans` itself. */
export function venueRouteFor(accountId: number, eventId: string): string {
  const r = getDb()
    .prepare(`SELECT venue_route FROM events WHERE id = ? AND account_id = ?`)
    .get(eventId, accountId) as { venue_route: string } | undefined;
  return r?.venue_route ?? '';
}

export function planVersionsFor(accountId: number, eventId: string): PlanVersionRow[] {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return [];
  const rows = getDb()
    .prepare(
      `SELECT version, mode, sections, attached_file, major_incident, saved_at
       FROM plan_versions WHERE event_id = ? ORDER BY version DESC, id DESC`,
    )
    .all(eventId) as unknown as {
    version: number; mode: 'write' | 'attach'; sections: string; attached_file: string | null;
    major_incident: string; saved_at: string;
  }[];
  return rows.map((r) => ({
    version: r.version,
    mode: r.mode,
    sections: JSON.parse(r.sections) as PlanVersionRow['sections'],
    attachedFile: r.attached_file,
    majorIncident: JSON.parse(r.major_incident) as PlanVersionRow['majorIncident'],
    savedAt: r.saved_at,
  }));
}

export interface SubmissionRow {
  declarations: Record<string, boolean>;
  insurance: Record<string, string>;
  representative: string;
  telephone: string;
  position: string;
  expedited: boolean;
  filedAt: string | null;
  mophReference: string | null;
  version: number;
}

export function submissionFor(accountId: number, eventId: string): SubmissionRow | null {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return null;
  const r = getDb()
    .prepare(`SELECT declarations, insurance, representative, telephone, position, expedited, filed_at, moph_reference, version FROM submissions WHERE event_id = ?`)
    .get(eventId) as
    | { declarations: string; insurance: string; representative: string; telephone: string; position: string; expedited: number; filed_at: string | null; moph_reference: string | null; version: number }
    | undefined;
  if (!r) return null;
  return {
    declarations: JSON.parse(r.declarations) as Record<string, boolean>,
    insurance: JSON.parse(r.insurance) as Record<string, string>,
    representative: r.representative,
    telephone: r.telephone,
    position: r.position,
    expedited: r.expedited === 1,
    filedAt: r.filed_at,
    mophReference: r.moph_reference,
    version: r.version,
  };
}

/**
 * A filed submission reopens for revision exactly when the latest recorded outcome is
 * 'revision' or 'incomplete' -- the two determinations that ask the organizer for more.
 * 'satisfied' closes the loop; no outcome means the Ministry has not asked.
 */
export function revisionOpenFor(eventId: string): boolean {
  const outcome = latestOutcomeFor(eventId);
  return outcome === 'revision' || outcome === 'incomplete';
}

export interface MaterialChangeRow {
  id: number;
  aspects: string[];
  description: string;
  reportedAt: string;
}

export function materialChangesFor(accountId: number, eventId: string): MaterialChangeRow[] {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return [];
  const rows = getDb()
    .prepare(`SELECT id, aspects, description, reported_at FROM material_changes WHERE event_id = ? ORDER BY reported_at DESC`)
    .all(eventId) as unknown as { id: number; aspects: string; description: string; reported_at: string }[];
  return rows.map((r) => ({ id: r.id, aspects: JSON.parse(r.aspects) as string[], description: r.description, reportedAt: r.reported_at }));
}

export interface PostEventReportRow {
  activity: Record<string, string>;
  significant: Record<string, boolean>;
  lessonsNone: boolean;
  lessonsText: string;
  organizerSignedAt: string | null;
  directorSignedAt: string | null;
  submittedAt: string | null;
}

export function postEventReportFor(accountId: number, eventId: string): PostEventReportRow | null {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return null;
  const r = getDb()
    .prepare(`SELECT activity, significant, lessons_none, lessons_text, organizer_signed_at, director_signed_at, submitted_at FROM post_event_reports WHERE event_id = ?`)
    .get(eventId) as
    | { activity: string; significant: string; lessons_none: number; lessons_text: string; organizer_signed_at: string | null; director_signed_at: string | null; submitted_at: string | null }
    | undefined;
  if (!r) return null;
  return {
    activity: JSON.parse(r.activity) as Record<string, string>,
    significant: JSON.parse(r.significant) as Record<string, boolean>,
    lessonsNone: r.lessons_none === 1,
    lessonsText: r.lessons_text,
    organizerSignedAt: r.organizer_signed_at,
    directorSignedAt: r.director_signed_at,
    submittedAt: r.submitted_at,
  };
}

/**
 * The document-state map the submission gate consumes: system documents are complete by
 * construction; platform documents report their own completeness; attached documents
 * are complete when a row exists; the third-party document when every provider signed.
 */
export function documentStateFor(
  accountId: number,
  eventId: string,
  level: 1 | 2 | 3,
): Record<string, boolean> {
  const attached = new Set(attachmentsFor(accountId, eventId).map((a) => a.docKey));
  const invitations = invitationsFor(accountId, eventId);
  const providers = invitations.filter((i) => i.kind === 'ems');
  const plan = planFor(accountId, eventId);
  const submission = submissionFor(accountId, eventId);

  // Both completeness rules live in lib/rules -- this file never re-derives them.
  const planComplete = planIsComplete(plan, level);
  const declarationsComplete = declarationsAreComplete(submission?.declarations ?? null, level);

  return {
    assessment: true,
    arrangements: attached.has('arrangements'),
    complianceForm: declarationsComplete,
    plan: planComplete,
    siteMap: attached.has('siteMap'),
    deploymentMap: attached.has('deploymentMap'),
    // CONFIRMED providers only, per lib/rules/submission.ts: a declined party has
    // answered and can never sign -- counting them made one decline block filing
    // forever. At least one confirmed provider must exist and every one must sign.
    emsDeclarations:
      providers.filter((p) => p.status === 'confirmed').length > 0 &&
      providers.filter((p) => p.status === 'confirmed').every((p) => p.declaration === 'signed'),
    other: attached.has('other'),
  };
}

export function facilityById(accountId: number, facilityId: string): FacilityRow | null {
  return facilitiesFor(accountId).find((f) => f.id === facilityId) ?? null;
}

export interface SeriousIncidentRow {
  incidentType: 'arrest' | 'death' | 'major' | 'interruption';
  occurredAt: string;
  notifiedAt: string;
}

export function seriousIncidentNotificationsFor(accountId: number, eventId: string): SeriousIncidentRow[] {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return [];
  const rows = getDb()
    .prepare(`SELECT incident_type, occurred_at, notified_at FROM serious_incident_notifications WHERE event_id = ? ORDER BY notified_at DESC`)
    .all(eventId) as unknown as { incident_type: SeriousIncidentRow['incidentType']; occurred_at: string; notified_at: string }[];
  return rows.map((r) => ({ incidentType: r.incident_type, occurredAt: r.occurred_at, notifiedAt: r.notified_at }));
}

/** Kept for the post-event page's cross-reference: the earliest notification date, if any. */
export function seriousIncidentNotificationFor(accountId: number, eventId: string): string | null {
  const rows = seriousIncidentNotificationsFor(accountId, eventId);
  return rows.length ? rows[rows.length - 1]!.notifiedAt : null;
}

/** The Ministry's lane: every notification, joined to its event. Demo isolation applies. */
export interface MinistrySeriousIncidentRow extends SeriousIncidentRow {
  eventId: string;
  eventEn: string;
  eventAr: string;
  mophReference: string | null;
}

export function seriousIncidentsForMinistry(viewerIsDemo: boolean): MinistrySeriousIncidentRow[] {
  const rows = getDb()
    .prepare(
      `SELECT n.incident_type, n.occurred_at, n.notified_at, e.id AS event_id, e.name_en, e.name_ar, e.moph_reference
       FROM serious_incident_notifications n JOIN events e ON e.id = n.event_id
       WHERE e.is_demo = ? ORDER BY n.notified_at DESC`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as {
    incident_type: SeriousIncidentRow['incidentType']; occurred_at: string; notified_at: string;
    event_id: string; name_en: string; name_ar: string; moph_reference: string | null;
  }[];
  return rows.map((r) => ({
    incidentType: r.incident_type, occurredAt: r.occurred_at, notifiedAt: r.notified_at,
    eventId: r.event_id, eventEn: r.name_en, eventAr: r.name_ar, mophReference: r.moph_reference,
  }));
}

/* ---------------- Slice 3: the venue service ---------------- */

export interface VenueDetail extends VenueRow {
  category: string;
  addressMunicipalityEn: string;
  addressMunicipalityAr: string;
  responsibleContact: string;
  licensedCapacity: number | null;
  regularlyHosts: boolean;
  isNightclub: boolean;
  mophReference: string | null;
  createdAt: string;
}

export function venueById(accountId: number, venueId: string): VenueDetail | null {
  const r = getDb()
    .prepare(
      `SELECT id, name_en, name_ar, category, address_municipality_en, address_municipality_ar, responsible_contact,
              licensed_capacity, regularly_hosts, is_nightclub, level, issued, valid_until,
              moph_reference, created_at
       FROM venues WHERE id = ? AND account_id = ?`,
    )
    .get(venueId, accountId) as
    | {
        id: string; name_en: string; name_ar: string; category: string;
        address_municipality_en: string; address_municipality_ar: string; responsible_contact: string;
        licensed_capacity: number | null; regularly_hosts: number; is_nightclub: number;
        level: number | null; issued: string | null; valid_until: string | null;
        moph_reference: string | null; created_at: string;
      }
    | undefined;
  if (!r) return null;
  return {
    id: r.id, nameEn: r.name_en, nameAr: r.name_ar,
    category: r.category,
    addressMunicipalityEn: r.address_municipality_en,
    addressMunicipalityAr: r.address_municipality_ar,
    responsibleContact: r.responsible_contact,
    licensedCapacity: r.licensed_capacity,
    regularlyHosts: r.regularly_hosts === 1,
    isNightclub: r.is_nightclub === 1,
    level: r.level, issued: r.issued, validUntil: r.valid_until,
    mophReference: r.moph_reference, createdAt: r.created_at,
  };
}

export interface VenueAssessmentVersion extends AssessmentVersion {
  effective: string;
  validUntil: string;
}

export function venueAssessmentsFor(accountId: number, venueId: string): VenueAssessmentVersion[] {
  const owned = getDb().prepare(`SELECT id FROM venues WHERE id = ? AND account_id = ?`).get(venueId, accountId);
  if (!owned) return [];
  const rows = getDb()
    .prepare(
      `SELECT version, answers, inputs, effective, valid_until, created_at
       FROM venue_assessments WHERE venue_id = ? ORDER BY version DESC`,
    )
    .all(venueId) as unknown as {
      version: number; answers: string; inputs: string; effective: string; valid_until: string; created_at: string;
    }[];
  return rows.map((r) => {
    const answers = JSON.parse(r.answers) as DomainAnswers;
    const inputs = JSON.parse(r.inputs) as MinimumConditionInputs;
    return {
      version: r.version, answers, inputs,
      derivation: deriveLevel({ answers, inputs }),
      effective: r.effective, validUntil: r.valid_until, createdAt: r.created_at,
    };
  });
}

export function venueChangesFor(accountId: number, venueId: string): MaterialChangeRow[] {
  const owned = getDb().prepare(`SELECT id FROM venues WHERE id = ? AND account_id = ?`).get(venueId, accountId);
  if (!owned) return [];
  const rows = getDb()
    .prepare(`SELECT id, aspects, description, reported_at FROM venue_changes WHERE venue_id = ? ORDER BY reported_at DESC`)
    .all(venueId) as unknown as { id: number; aspects: string; description: string; reported_at: string }[];
  return rows.map((r) => ({ id: r.id, aspects: JSON.parse(r.aspects) as string[], description: r.description, reportedAt: r.reported_at }));
}

/** A change reported since the last recorded assessment forces reassessment open. */
export function venueChangeSinceAssessment(accountId: number, venueId: string): boolean {
  const owned = getDb().prepare(`SELECT id FROM venues WHERE id = ? AND account_id = ?`).get(venueId, accountId);
  if (!owned) return false;
  const r = getDb()
    .prepare(
      `SELECT EXISTS (
         SELECT 1 FROM venue_changes c WHERE c.venue_id = ?
           AND c.reported_at > COALESCE(
             (SELECT MAX(a.created_at) FROM venue_assessments a WHERE a.venue_id = ?), '')
       ) AS x`,
    )
    .get(venueId, venueId) as { x: number };
  return r.x === 1;
}


/* ---------------- Slice 5: the counterparty roles ---------------- */

export interface InvitationDetail {
  token: string;
  eventId: string;
  kind: 'ems' | 'director';
  nameEn: string;
  nameAr: string;
  email: string;
  status: 'nominated' | 'confirmed' | 'declined';
  declaration: 'none' | 'draft' | 'signed';
  accountId: number | null;
  responseNote: string;
  opsDetail: Record<string, string>;
  declarationItems: boolean[];
  certification: Record<string, string>;
  signedAt: string | null;
  invitedAt: string;
  answeredAt: string | null;
  /** The event the nomination names, and who filed it. */
  eventNameEn: string;
  eventNameAr: string;
  eventStart: string | null;
  eventEnd: string | null;
  eventLevel: Level | null;
  organizerAccountId: number;
  organizationNameEn: string;
  organizationNameAr: string;
}

/**
 * The DERIVED final level, unscoped: stored answers first, demo_level as the seeded
 * fallback. The public lookup uses this -- demo_level alone reported real events as Level 1.
 */
export function derivedLevelFor(eventId: string): Level | null {
  const r = getDb()
    .prepare(`SELECT answers, inputs FROM assessments WHERE event_id = ? ORDER BY version DESC LIMIT 1`)
    .get(eventId) as { answers: string; inputs: string } | undefined;
  if (!r) {
    const d = getDb().prepare(`SELECT demo_level FROM events WHERE id = ?`).get(eventId) as { demo_level: number | null } | undefined;
    return (d?.demo_level as Level | null) ?? null;
  }
  const derivation = deriveLevel({
    answers: JSON.parse(r.answers) as DomainAnswers,
    inputs: JSON.parse(r.inputs) as MinimumConditionInputs,
  });
  return derivation.finalLevel;
}

function mapInvitation(r: {
  token: string; event_id: string; kind: 'ems' | 'director'; name_en: string; name_ar: string;
  email: string; status: InvitationDetail['status']; declaration: InvitationDetail['declaration'];
  account_id: number | null; response_note: string; ops_detail: string; declaration_items: string;
  certification: string; signed_at: string | null; invited_at: string; answered_at: string | null;
  ev_name_en: string; ev_name_ar: string; ev_start: string | null; ev_end: string | null;
  ev_level: number | null; ev_account: number; org_name_en: string | null; org_name_ar: string | null;
}): InvitationDetail {
  return {
    token: r.token, eventId: r.event_id, kind: r.kind,
    nameEn: r.name_en, nameAr: r.name_ar, email: r.email,
    status: r.status, declaration: r.declaration,
    accountId: r.account_id, responseNote: r.response_note,
    opsDetail: JSON.parse(r.ops_detail) as Record<string, string>,
    declarationItems: JSON.parse(r.declaration_items) as boolean[],
    certification: JSON.parse(r.certification) as Record<string, string>,
    signedAt: r.signed_at, invitedAt: r.invited_at, answeredAt: r.answered_at,
    eventNameEn: r.ev_name_en, eventNameAr: r.ev_name_ar,
    eventStart: r.ev_start, eventEnd: r.ev_end,
    // The level is derived, never chosen: the latest assessment's derivation wins,
    // the demonstration presentation level fills in for showcase rows without one.
    eventLevel: derivedLevelFor(r.event_id) ?? ((r.ev_level as Level | null) ?? null),
    organizerAccountId: r.ev_account,
    organizationNameEn: r.org_name_en ?? '', organizationNameAr: r.org_name_ar ?? '',
  };
}

const INVITATION_SELECT = `
  SELECT i.token, i.event_id, i.kind, i.name_en, i.name_ar, i.email, i.status,
         i.declaration, i.account_id, i.response_note, i.ops_detail, i.declaration_items,
         i.certification, i.signed_at, i.invited_at, i.answered_at,
         e.name_en AS ev_name_en, e.name_ar AS ev_name_ar, e.start_date AS ev_start,
         e.end_date AS ev_end, e.demo_level AS ev_level, e.id AS ev_id, e.account_id AS ev_account,
         o.name_en AS org_name_en, o.name_ar AS org_name_ar
  FROM invitations i
  JOIN events e ON e.id = i.event_id
  LEFT JOIN organizations o ON o.account_id = e.account_id`;

/** The token is the credential (rule 6): whoever holds it sees this one nomination. */
export function invitationByToken(token: string): InvitationDetail | null {
  const r = getDb().prepare(`${INVITATION_SELECT} WHERE i.token = ?`).get(token) as
    | Parameters<typeof mapInvitation>[0]
    | undefined;
  return r ? mapInvitation(r) : null;
}

/** Every nomination linked to this account -- the role dashboards. */
export function invitationsForAccount(accountId: number): InvitationDetail[] {
  const rows = getDb()
    .prepare(`${INVITATION_SELECT} WHERE i.account_id = ? ORDER BY e.start_date`)
    .all(accountId) as unknown as Parameters<typeof mapInvitation>[0][];
  return rows.map(mapInvitation);
}

/** One nomination on one event for this account -- the role event screens. */
/**
 * The nomination this account is ACTING under for the event. One account can hold more
 * than one nomination on the same event (a second agency invited to the same address),
 * so a declined row must never be the one a signature lands on: signing resurrected it,
 * flipping declined back to confirmed. Live nominations first, declined never chosen
 * while a live one exists.
 */
export function invitationForEvent(accountId: number, eventId: string, kind: 'ems' | 'director'): InvitationDetail | null {
  const rows = getDb()
    .prepare(
      `${INVITATION_SELECT} WHERE i.account_id = ? AND i.event_id = ? AND i.kind = ?
       ORDER BY CASE i.status WHEN 'confirmed' THEN 0 WHEN 'nominated' THEN 1 ELSE 2 END,
                i.invited_at DESC`,
    )
    .all(accountId, eventId, kind) as unknown as Parameters<typeof mapInvitation>[0][];
  const r = rows[0];
  return r ? mapInvitation(r) : null;
}

export interface SharedDocumentRow {
  id: number;
  nameEn: string; nameAr: string;
  source: 'organizer' | 'provider' | 'requested' | 'missing';
  fileName: string | null;
  metaEn: string; metaAr: string;
}

export function sharedDocumentsFor(token: string): SharedDocumentRow[] {
  const rows = getDb()
    .prepare(`SELECT id, name_en, name_ar, source, file_name, meta_en, meta_ar FROM shared_documents WHERE invitation_token = ? ORDER BY added_at`)
    .all(token) as unknown as { id: number; name_en: string; name_ar: string; source: SharedDocumentRow['source']; file_name: string | null; meta_en: string; meta_ar: string }[];
  return rows.map((r) => ({ id: r.id, nameEn: r.name_en, nameAr: r.name_ar, source: r.source, fileName: r.file_name, metaEn: r.meta_en, metaAr: r.meta_ar }));
}

export interface FrReadinessRow {
  confirmations: { equipment?: boolean[]; competence?: boolean[]; operational?: boolean[] };
  signedAt: string | null;
  updatedAt: string;
}

export function frReadinessFor(accountId: number): FrReadinessRow | null {
  const r = getDb()
    .prepare(`SELECT confirmations, signed_at, updated_at FROM fr_readiness WHERE account_id = ?`)
    .get(accountId) as { confirmations: string; signed_at: string | null; updated_at: string } | undefined;
  if (!r) return null;
  return { confirmations: JSON.parse(r.confirmations) as FrReadinessRow['confirmations'], signedAt: r.signed_at, updatedAt: r.updated_at };
}

export interface FrReportRow {
  id: number;
  mode: 'platform' | 'attach';
  attachedFile: string | null;
  covered: Record<string, boolean>;
  payload: Record<string, string>;
  createdAt: string;
}

export function frReportsFor(accountId: number): FrReportRow[] {
  const rows = getDb()
    .prepare(`SELECT id, mode, attached_file, covered, payload, created_at FROM fr_reports WHERE account_id = ? ORDER BY created_at DESC`)
    .all(accountId) as unknown as { id: number; mode: 'platform' | 'attach'; attached_file: string | null; covered: string; payload: string; created_at: string }[];
  return rows.map((r) => ({
    id: r.id, mode: r.mode, attachedFile: r.attached_file,
    covered: JSON.parse(r.covered) as Record<string, boolean>,
    payload: JSON.parse(r.payload) as Record<string, string>,
    createdAt: r.created_at,
  }));
}

export function roleProfileFor(accountId: number): Record<string, string> {
  const r = getDb()
    .prepare(`SELECT fields FROM role_profiles WHERE account_id = ?`)
    .get(accountId) as { fields: string } | undefined;
  return r ? (JSON.parse(r.fields) as Record<string, string>) : {};
}

export function governanceFor(eventId: string): Record<string, string> {
  const r = getDb()
    .prepare(`SELECT sections FROM event_governance WHERE event_id = ?`)
    .get(eventId) as { sections: string } | undefined;
  return r ? (JSON.parse(r.sections) as Record<string, string>) : {};
}


/* ---------------- Slice 6: the Ministry console ---------------- */
/* Demonstration isolation is symmetric (SPEC): a viewer sees rows whose is_demo
   matches their own account's. A real reviewer never sees a demonstration
   submission; a demonstration reviewer never sees a real one. */

/**
 * The `is_demo` bind value for a Ministry work surface -- from the demonstration-scope
 * rule, not decided here. Symmetric isolation: the session's own flag.
 */
function demoFlag(viewerIsDemo: boolean): number {
  return demonstrationFilter('reviewerQueue', { isDemonstration: viewerIsDemo }).isDemo ? 1 : 0;
}

export interface QueueRow {
  eventId: string;
  nameEn: string; nameAr: string;
  orgEn: string; orgAr: string;
  level: Level | null;
  eventDate: string | null;
  filedAt: string | null;
  mophReference: string | null;
  /** Internal workflow state -- grey, never a determination. */
  state: 'queued' | 'assigned' | 'progress';
  reviewer: string;
  /** The latest determination, if one has been recorded. */
  outcome: 'incomplete' | 'revision' | 'satisfied' | null;
  outcomeAt: string | null;
  /**
   * Days the submission has been waiting, filing date to today on the Beirut clock.
   * The reference's rightmost column; a plain count, no unit, beside the reviewer.
   */
  daysWaiting: number | null;
  /**
   * Whether the filing met its deadline. Derived from the level's lead time against the
   * event start (filingDeadline), never stored -- the reference shows Met / Filed late
   * beneath the filing date, and a stored flag would drift from the rule.
   */
  filingMet: boolean | null;
}

export function reviewQueue(viewerIsDemo: boolean): QueueRow[] {
  const rows = getDb()
    .prepare(
      `SELECT e.id, e.name_en, e.name_ar, e.start_date, e.demo_level, e.account_id,
              s.filed_at, s.moph_reference,
              r.state AS r_state, r.reviewer AS r_reviewer,
              o.name_en AS org_en, o.name_ar AS org_ar,
              d.outcome AS d_outcome, d.recorded_at AS d_at
       FROM submissions s
       JOIN events e ON e.id = s.event_id
       LEFT JOIN review_state r ON r.event_id = e.id
       LEFT JOIN organizations o ON o.account_id = e.account_id
       LEFT JOIN determinations d ON d.id = (
         SELECT id FROM determinations WHERE event_id = e.id ORDER BY recorded_at DESC, id DESC LIMIT 1
       )
       WHERE e.is_demo = ? AND s.filed_at IS NOT NULL
       ORDER BY e.start_date`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as {
      id: string; name_en: string; name_ar: string; start_date: string | null;
      demo_level: number | null; account_id: number; filed_at: string | null;
      moph_reference: string | null; r_state: QueueRow['state'] | null; r_reviewer: string | null;
      org_en: string | null; org_ar: string | null;
      d_outcome: QueueRow['outcome']; d_at: string | null;
    }[];
  return rows.map((r) => ({
    eventId: r.id,
    nameEn: r.name_en, nameAr: r.name_ar,
    orgEn: r.org_en ?? '', orgAr: r.org_ar ?? '',
    level: derivedLevelFor(r.id) ?? ((r.demo_level as Level | null) ?? null),
    eventDate: r.start_date,
    filedAt: r.filed_at ? r.filed_at.slice(0, 10) : null,
    mophReference: r.moph_reference,
    state: r.r_state ?? 'queued',
    reviewer: r.r_reviewer ?? '',
    outcome: r.d_outcome ?? null,
    outcomeAt: r.d_at ? r.d_at.slice(0, 10) : null,
    daysWaiting: r.filed_at ? daysBetween(r.filed_at.slice(0, 10), beirutTodayFn()) : null,
    filingMet: filingMetFor(r.start_date, derivedLevelFor(r.id) ?? ((r.demo_level as Level | null) ?? null), r.filed_at),
  }));
}

/**
 * Did the filing meet the lead time its level requires? The deadline comes from the
 * rules layer (filingDeadline); this only compares dates. Null when anything the
 * comparison needs is missing -- an unknown answer is never rendered as "Met".
 */
function filingMetFor(
  eventStart: string | null,
  level: Level | null,
  filedAt: string | null,
): boolean | null {
  if (!eventStart || level === null || !filedAt) return null;
  const deadline = filingDeadline(level, new Date(`${eventStart}T12:00:00+03:00`));
  return filedAt.slice(0, 10) <= deadline.date;
}

export interface DeterminationRow {
  outcome: 'incomplete' | 'revision' | 'satisfied';
  note: string;
  recordedBy: string;
  recordedAt: string;
}

export function determinationsFor(eventId: string): DeterminationRow[] {
  const rows = getDb()
    .prepare(`SELECT outcome, note, recorded_by, recorded_at FROM determinations WHERE event_id = ? ORDER BY recorded_at DESC, id DESC`)
    .all(eventId) as unknown as { outcome: DeterminationRow['outcome']; note: string; recorded_by: string; recorded_at: string }[];
  return rows.map((r) => ({ outcome: r.outcome, note: r.note, recordedBy: r.recorded_by, recordedAt: r.recorded_at.slice(0, 10) }));
}

export interface AddedMeasureRow {
  id: number;
  catalogKey: string;
  note: string;
  blocking: boolean;
  clearedAt: string | null;
  recordedBy: string;
  recordedAt: string;
}

export function addedMeasuresFor(eventId: string): AddedMeasureRow[] {
  const rows = getDb()
    .prepare(`SELECT id, catalog_key, note, blocking, cleared_at, recorded_by, recorded_at FROM added_measures WHERE event_id = ? ORDER BY recorded_at`)
    .all(eventId) as unknown as { id: number; catalog_key: string; note: string; blocking: number; cleared_at: string | null; recorded_by: string; recorded_at: string }[];
  return rows.map((r) => ({
    id: r.id, catalogKey: r.catalog_key, note: r.note, blocking: r.blocking === 1,
    clearedAt: r.cleared_at, recordedBy: r.recorded_by, recordedAt: r.recorded_at.slice(0, 10),
  }));
}

export interface InspectionRow {
  id: number;
  titleEn: string; titleAr: string;
  inspector: string;
  state: 'none' | 'scheduled' | 'conducted' | 'recorded';
  date: string | null;
  blocking: boolean;
  findings: string;
}

export function inspectionsFor(eventId: string): InspectionRow[] {
  const rows = getDb()
    .prepare(`SELECT id, title_en, title_ar, inspector, state, date, blocking, findings FROM inspections WHERE event_id = ? ORDER BY id`)
    .all(eventId) as unknown as { id: number; title_en: string; title_ar: string; inspector: string; state: InspectionRow['state']; date: string | null; blocking: number; findings: string }[];
  return rows.map((r) => ({
    id: r.id, titleEn: r.title_en, titleAr: r.title_ar, inspector: r.inspector,
    state: r.state, date: r.date, blocking: r.blocking === 1, findings: r.findings,
  }));
}

export interface PendingOrganizationRow {
  id: number;
  nameEn: string; nameAr: string;
  status: 'none' | 'pending' | 'recorded';
  recordedAt: string | null;
}

export function organizationsForReview(viewerIsDemo: boolean): PendingOrganizationRow[] {
  const rows = getDb()
    .prepare(`SELECT id, name_en, name_ar, status, recorded_at FROM organizations WHERE is_demo = ? ORDER BY status = 'pending' DESC, name_en`)
    .all(demoFlag(viewerIsDemo)) as unknown as { id: number; name_en: string; name_ar: string; status: PendingOrganizationRow['status']; recorded_at: string | null }[];
  return rows.map((r) => ({ id: r.id, nameEn: r.name_en, nameAr: r.name_ar, status: r.status, recordedAt: r.recorded_at }));
}

export interface MinistryChangeRow {
  kind: 'material' | 'declined';
  eventId: string;
  eventEn: string; eventAr: string;
  detailEn: string; detailAr: string;
  when: string;
}

export function changesForReview(viewerIsDemo: boolean): MinistryChangeRow[] {
  const db = getDb();
  const material = db
    .prepare(
      `SELECT m.event_id, e.name_en, e.name_ar, m.aspects, m.reported_at
       FROM material_changes m JOIN events e ON e.id = m.event_id
       WHERE e.is_demo = ? ORDER BY m.reported_at DESC`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as { event_id: string; name_en: string; name_ar: string; aspects: string; reported_at: string }[];
  const declined = db
    .prepare(
      `SELECT i.event_id, e.name_en, e.name_ar, i.name_en AS party_en, i.name_ar AS party_ar, i.answered_at
       FROM invitations i JOIN events e ON e.id = i.event_id
       WHERE i.status = 'declined' AND e.is_demo = ? ORDER BY i.answered_at DESC`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as { event_id: string; name_en: string; name_ar: string; party_en: string; party_ar: string; answered_at: string | null }[];
  return [
    ...material.map((m) => ({
      kind: 'material' as const, eventId: m.event_id, eventEn: m.name_en, eventAr: m.name_ar,
      detailEn: 'Material change reported', detailAr: 'أُبلغ عن تغيير جوهري',
      when: m.reported_at.slice(0, 10),
    })),
    ...declined.map((d) => ({
      kind: 'declined' as const, eventId: d.event_id, eventEn: d.name_en, eventAr: d.name_ar,
      detailEn: `Named party declined — ${d.party_en}`, detailAr: `اعتذر طرف مُسمّى — ${d.party_ar}`,
      when: d.answered_at?.slice(0, 10) ?? '',
    })),
  ].sort((a, b) => (a.when < b.when ? 1 : -1));
}

export interface EnquiryRow {
  id: number;
  eventId: string;
  eventEn: string; eventAr: string;
  mophReference: string | null;
  askedBy: string;
  question: string;
  askedAt: string;
  reply: string;
  repliedBy: string;
  repliedAt: string | null;
}

export function enquiriesForReview(viewerIsDemo: boolean): EnquiryRow[] {
  const rows = getDb()
    .prepare(
      `SELECT q.id, q.event_id, e.name_en, e.name_ar, s.moph_reference,
              q.asked_by, q.question, q.asked_at, q.reply, q.replied_by, q.replied_at
       FROM enquiries q JOIN events e ON e.id = q.event_id
       LEFT JOIN submissions s ON s.event_id = e.id
       WHERE q.is_demo = ? ORDER BY q.replied_at IS NOT NULL, q.asked_at DESC`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as {
      id: number; event_id: string; name_en: string; name_ar: string; moph_reference: string | null;
      asked_by: string; question: string; asked_at: string; reply: string; replied_by: string; replied_at: string | null;
    }[];
  return rows.map((r) => ({
    id: r.id, eventId: r.event_id, eventEn: r.name_en, eventAr: r.name_ar,
    mophReference: r.moph_reference, askedBy: r.asked_by, question: r.question,
    askedAt: r.asked_at.slice(0, 10), reply: r.reply, repliedBy: r.replied_by,
    repliedAt: r.replied_at ? r.replied_at.slice(0, 10) : null,
  }));
}

export interface ArrestGroup {
  placeEn: string; placeAr: string;
  category: string;
  municipality: string;
  count: number;
  firstMonth: string;
  lastMonth: string;
  /** Set when the place matches a registered facility. */
  facilityId: string | null;
  designated: boolean;
}

/**
 * Reported arrest locations: facility incident reports and first-response
 * dataset reports, grouped by place and category -- the pattern no single
 * report shows, and the mechanism by which a place with a confirmed arrest
 * becomes covered (power eight).
 */
export function arrestLocations(viewerIsDemo: boolean): ArrestGroup[] {
  const db = getDb();
  const flag = demoFlag(viewerIsDemo);
  const groups = new Map<string, ArrestGroup>();
  const add = (placeEn: string, placeAr: string, category: string, municipality: string, month: string, facilityId: string | null) => {
    const key = placeEn.trim().toLowerCase();
    const g = groups.get(key);
    if (g) {
      g.count += 1;
      if (month && (g.firstMonth === '' || month < g.firstMonth)) g.firstMonth = month;
      if (month && month > g.lastMonth) g.lastMonth = month;
      if (facilityId) g.facilityId = facilityId;
    } else {
      groups.set(key, {
        placeEn: placeEn.trim(), placeAr: placeAr.trim() || placeEn.trim(),
        category, municipality, count: 1,
        firstMonth: month, lastMonth: month, facilityId, designated: false,
      });
    }
  };
  const facilityIncidents = db
    .prepare(
      `SELECT i.payload, i.created_at, f.id AS fid, f.name_en, f.name_ar, f.municipality_en, f.category_key
       FROM facility_incidents i JOIN facilities f ON f.id = i.facility_id
       WHERE f.is_demo = ?`,
    )
    .all(flag) as unknown as { payload: string; created_at: string; fid: string; name_en: string; name_ar: string; municipality_en: string; category_key: string }[];
  for (const r of facilityIncidents) {
    const payload = JSON.parse(r.payload) as Record<string, string>;
    const month = (payload['date'] ?? r.created_at).slice(0, 7);
    add(r.name_en, r.name_ar, r.category_key, r.municipality_en, month, r.fid);
  }
  const frReports = db
    .prepare(
      `SELECT r.payload, r.created_at FROM fr_reports r JOIN accounts a ON a.id = r.account_id WHERE a.is_demo = ?`,
    )
    .all(flag) as unknown as { payload: string; created_at: string }[];
  for (const r of frReports) {
    const payload = JSON.parse(r.payload) as Record<string, string>;
    const place = payload['incident.location'] ?? '';
    if (!place) continue;
    const month = (payload['incident.date'] ?? r.created_at).slice(0, 7);
    add(place, place, payload['incident.facilityCategory'] ?? '', payload['incident.address'] ?? '', month, null);
  }
  const designations = db
    .prepare(`SELECT name_en FROM facility_designations WHERE is_demo = ?`)
    .all(flag) as unknown as { name_en: string }[];
  const designatedNames = new Set(designations.map((d) => d.name_en.trim().toLowerCase()));
  const out = [...groups.values()];
  for (const g of out) {
    g.designated = designatedNames.has(g.placeEn.trim().toLowerCase()) || g.facilityId !== null;
  }
  return out.sort((a, b) => b.count - a.count);
}

export interface ConfigValueRow {
  key: string;
  value: string;
  effective: string | null;
  publishedBy: string;
  publishedAt: string;
}

export function ministryConfig(): Map<string, ConfigValueRow> {
  const rows = getDb()
    .prepare(`SELECT key, value, effective, published_by, published_at FROM ministry_config`)
    .all() as unknown as { key: string; value: string; effective: string | null; published_by: string; published_at: string }[];
  return new Map(
    rows.map((r) => [r.key, { key: r.key, value: r.value, effective: r.effective, publishedBy: r.published_by, publishedAt: r.published_at.slice(0, 10) }]),
  );
}

export interface MinistryUserRow {
  login: string;
  displayName: string;
  role: string;
  isDemo: boolean;
}

export function ministryUsers(viewerIsDemo: boolean): MinistryUserRow[] {
  const rows = getDb()
    .prepare(
      `SELECT login, display_name, role, is_demo FROM accounts
       WHERE role IN ('reviewer','inspector','ministry_admin','order','platform_owner') AND is_demo = ?
       ORDER BY role, display_name`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as { login: string; display_name: string; role: string; is_demo: number }[];
  return rows.map((r) => ({ login: r.login, displayName: r.display_name, role: r.role, isDemo: r.is_demo === 1 }));
}

/** Counts only. Nothing here names an organizer, an account, an event or a patient. */
export interface PlatformCounts {
  organizations: number;
  events: number;
  submissions: number;
  determinations: number;
  venues: number;
  facilities: number;
  devices: number;
  incidents: number;
  frReports: number;
  invitations: number;
}

export function platformCounts(viewerIsDemo: boolean): PlatformCounts {
  const db = getDb();
  // Reviewer ruling: the owner's volumes are REAL volumes, whoever is looking --
  // demonstration rows are excluded even in a demonstration session, and the
  // surface says so.
  void viewerIsDemo;
  const flag = demonstrationFilter('platformActivityCounts', { isDemonstration: viewerIsDemo }).isDemo ? 1 : 0;
  const n = (sql: string): number => (db.prepare(sql).get(flag) as { n: number }).n;
  return {
    organizations: n(`SELECT COUNT(*) AS n FROM organizations WHERE is_demo = ?`),
    events: n(`SELECT COUNT(*) AS n FROM events WHERE is_demo = ?`),
    submissions: n(`SELECT COUNT(*) AS n FROM submissions s JOIN events e ON e.id = s.event_id WHERE e.is_demo = ?`),
    determinations: n(`SELECT COUNT(*) AS n FROM determinations d JOIN events e ON e.id = d.event_id WHERE e.is_demo = ?`),
    venues: n(`SELECT COUNT(*) AS n FROM venues WHERE is_demo = ?`),
    facilities: n(`SELECT COUNT(*) AS n FROM facilities WHERE is_demo = ?`),
    devices: n(`SELECT COUNT(*) AS n FROM facility_devices d JOIN facilities f ON f.id = d.facility_id WHERE f.is_demo = ?`),
    incidents: n(`SELECT COUNT(*) AS n FROM facility_incidents i JOIN facilities f ON f.id = i.facility_id WHERE f.is_demo = ?`),
    frReports: n(`SELECT COUNT(*) AS n FROM fr_reports r JOIN accounts a ON a.id = r.account_id WHERE a.is_demo = ?`),
    invitations: n(`SELECT COUNT(*) AS n FROM invitations i JOIN events e ON e.id = i.event_id WHERE e.is_demo = ?`),
  };
}

export interface FacilityOversightRow {
  id: string;
  nameEn: string; nameAr: string;
  categoryKey: string;
  municipality: string;
  devices: number;
  standingKind: string;
}

export function facilitiesForOversight(viewerIsDemo: boolean): FacilityOversightRow[] {
  const db = getDb();
  const today = beirutTodayFn();
  const rows = db
    .prepare(`SELECT id, name_en, name_ar, category_key, municipality_en FROM facilities WHERE is_demo = ? ORDER BY name_en`)
    .all(demoFlag(viewerIsDemo)) as unknown as { id: string; name_en: string; name_ar: string; category_key: string; municipality_en: string }[];
  return rows.map((r) => {
    const devices = (db.prepare(`SELECT COUNT(*) AS n FROM facility_devices WHERE facility_id = ?`).get(r.id) as { n: number }).n;
    const standing = facilityStanding(facilityLedgerFor(r.id, today));
    return {
      id: r.id, nameEn: r.name_en, nameAr: r.name_ar,
      categoryKey: r.category_key, municipality: r.municipality_en,
      devices, standingKind: standing.kind,
    };
  });
}

export interface CorrectiveActionRow {
  id: number;
  facilityId: string;
  facilityEn: string; facilityAr: string;
  bodyEn: string; bodyAr: string;
  status: 'open' | 'corrected';
  raisedBy: string;
  raisedAt: string;
  correctedAt: string | null;
}

export function correctiveActions(viewerIsDemo: boolean): CorrectiveActionRow[] {
  const rows = getDb()
    .prepare(
      `SELECT q.id, q.facility_id, f.name_en, f.name_ar, q.body_en, q.body_ar, q.status, q.raised_by, q.created_at, q.corrected_at
       FROM facility_requests q JOIN facilities f ON f.id = q.facility_id
       WHERE q.is_demo = ? ORDER BY q.status = 'open' DESC, q.created_at DESC`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as {
      id: number; facility_id: string; name_en: string; name_ar: string; body_en: string; body_ar: string;
      status: 'open' | 'corrected'; raised_by: string; created_at: string; corrected_at: string | null;
    }[];
  return rows.map((r) => ({
    id: r.id, facilityId: r.facility_id, facilityEn: r.name_en, facilityAr: r.name_ar,
    bodyEn: r.body_en, bodyAr: r.body_ar, status: r.status, raisedBy: r.raised_by,
    raisedAt: r.created_at.slice(0, 10), correctedAt: r.corrected_at ? r.corrected_at.slice(0, 10) : null,
  }));
}


export interface SubmissionReview {
  eventId: string;
  nameEn: string; nameAr: string;
  orgEn: string; orgAr: string;
  level: Level | null;
  eventDate: string | null;
  filedAt: string | null;
  mophReference: string | null;
  /** 1 on first filing; a re-file after a revision outcome increments it. */
  version: number;
  state: 'queued' | 'assigned' | 'progress';
  reviewer: string;
  providers: { nameEn: string; nameAr: string; status: string; declaration: string; signedAt: string | null }[];
}

/** The Ministry's read of one filed submission. Demo isolation applies. */
export function submissionForReview(viewerIsDemo: boolean, eventId: string): SubmissionReview | null {
  const db = getDb();
  const r = db
    .prepare(
      `SELECT e.id, e.name_en, e.name_ar, e.start_date, e.demo_level,
              s.filed_at, s.moph_reference, s.version AS s_version,
              rs.state AS r_state, rs.reviewer AS r_reviewer,
              o.name_en AS org_en, o.name_ar AS org_ar
       FROM submissions s
       JOIN events e ON e.id = s.event_id
       LEFT JOIN review_state rs ON rs.event_id = e.id
       LEFT JOIN organizations o ON o.account_id = e.account_id
       WHERE e.id = ? AND e.is_demo = ? AND s.filed_at IS NOT NULL`,
    )
    .get(eventId, demoFlag(viewerIsDemo)) as
    | {
        id: string; name_en: string; name_ar: string; start_date: string | null; demo_level: number | null;
        filed_at: string | null; moph_reference: string | null; s_version: number;
        r_state: SubmissionReview['state'] | null; r_reviewer: string | null;
        org_en: string | null; org_ar: string | null;
      }
    | undefined;
  if (!r) return null;
  const providers = db
    .prepare(`SELECT name_en, name_ar, status, declaration, signed_at FROM invitations WHERE event_id = ? AND kind = 'ems'`)
    .all(eventId) as unknown as { name_en: string; name_ar: string; status: string; declaration: string; signed_at: string | null }[];
  return {
    eventId: r.id,
    nameEn: r.name_en, nameAr: r.name_ar,
    orgEn: r.org_en ?? '', orgAr: r.org_ar ?? '',
    level: derivedLevelFor(r.id) ?? ((r.demo_level as Level | null) ?? null),
    eventDate: r.start_date,
    filedAt: r.filed_at ? r.filed_at.slice(0, 10) : null,
    mophReference: r.moph_reference,
    version: r.s_version,
    state: r.r_state ?? 'queued',
    reviewer: r.r_reviewer ?? '',
    providers: providers.map((p) => ({
      nameEn: p.name_en, nameAr: p.name_ar, status: p.status, declaration: p.declaration,
      signedAt: p.signed_at ? p.signed_at.slice(0, 10) : null,
    })),
  };
}
