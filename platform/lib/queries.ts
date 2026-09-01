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
import { planIsComplete, declarationsAreComplete, effectiveCycles, demonstrationFilter, filingDeadline, eventStage, LIFECYCLE_CONTENT, POST_EVENT_STAGE, type AttestationRecord } from './rules';
import type { DomainAnswers, Level, LevelDerivation, MinimumConditionInputs, OutcomeKey } from './rules';
import { organizerEventState } from './rules';
import { NOMINEE_DOCUMENT_KEYS, nomineeMayReadSection } from './rules/nomination-access';
import { PLAN_SECTIONS } from './rules/content';
import type { AccountHoldings } from './rules/accounts';
import { can, permissionMatrix, rolesHolding } from './rules/ministry';
import { COMPLIANCE_DECLARATIONS } from './rules/content';
import { MINISTRY_CONTENT } from './rules/ministry';
import type { SubmissionRecord } from './rules/public-lookup';
import { certificationComplete } from './rules/certification';

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
  /** Cancellation and postponement -- a lifecycle, never a deletion. */
  lifecycle: 'active' | 'cancelled' | 'postponed';
  lifecycleAt: string | null;
  lifecycleNote: string | null;
  postponedTo: string | null;
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
  lifecycle?: string | null;
  lifecycle_at?: string | null;
  lifecycle_note?: string | null;
  postponed_to?: string | null;
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

/**
 * THE ANSWERS THEMSELVES, for the review screen -- not the derivation they produce.
 *
 * The reviewer could see the score, the triggered conditions and the final level,
 * and not one of the nine answers behind them. Reading a level without its inputs
 * is reading a conclusion without evidence, and the ruling that the Ministry sees
 * documents rather than names applies to answers for the same reason: a reviewer
 * who cannot check what the organizer declared about spectator numbers cannot
 * check whether the level is right.
 *
 * Returned raw. The screen joins them to DOMAINS for the option text, because the
 * option text belongs to the rules data and must not be duplicated into a query.
 */
export function assessmentAnswersForReview(
  eventId: string,
): { answers: DomainAnswers; inputs: MinimumConditionInputs; toolVersion: string; recordedAt: string } | null {
  const row = getDb()
    .prepare(
      `SELECT answers, inputs, nehrat_tool_version, created_at FROM assessments
       WHERE event_id = ? ORDER BY version DESC, id DESC LIMIT 1`,
    )
    .get(eventId) as
    | { answers: string; inputs: string; nehrat_tool_version: string; created_at: string }
    | undefined;
  if (!row) return null;
  return {
    answers: JSON.parse(row.answers) as DomainAnswers,
    inputs: JSON.parse(row.inputs) as MinimumConditionInputs,
    toolVersion: row.nehrat_tool_version,
    recordedAt: row.created_at.slice(0, 10),
  };
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
    stateEn:
      (row.lifecycle ?? 'active') !== 'active'
        ? LIFECYCLE_CONTENT.states[(row.lifecycle ?? 'active') as 'cancelled' | 'postponed'].en
        : outcome
          ? derivedState.en
          : (row.demo_state_en ?? derivedState.en),
    stateAr:
      (row.lifecycle ?? 'active') !== 'active'
        ? LIFECYCLE_CONTENT.states[(row.lifecycle ?? 'active') as 'cancelled' | 'postponed'].ar
        : outcome
          ? derivedState.ar
          : (row.demo_state_ar ?? derivedState.ar),
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
    lifecycle: (row.lifecycle ?? 'active') as EventRow['lifecycle'],
    lifecycleAt: row.lifecycle_at ? row.lifecycle_at.slice(0, 10) : null,
    lifecycleNote: row.lifecycle_note ?? null,
    postponedTo: row.postponed_to ?? null,
  };
}

const EVENT_COLUMNS = `id, name_en, name_ar, start_date, end_date, moph_reference, filed,
   demo_state_en, demo_state_ar, demo_due, demo_due_label_en, demo_due_label_ar,
   demo_stage, demo_stage_en, demo_stage_ar, demo_stages, demo_span, demo_level, created_at, venue_facility_id,
   lifecycle, lifecycle_at, lifecycle_note, postponed_to`;

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
  id: number;
  bodyEn: string;
  bodyAr: string;
  due: string | null;
  status: 'open' | 'corrected';
  kind: 'corrective' | 'confirmation';
  correctedAt: string | null;
  closeNote: string | null;
}

export function facilityRequests(facilityId: string): FacilityRequestRow[] {
  const rows = getDb()
    .prepare(`SELECT id, body_en, body_ar, due, status, kind, corrected_at, close_note FROM facility_requests WHERE facility_id = ? ORDER BY created_at DESC`)
    .all(facilityId) as unknown as { id: number; body_en: string; body_ar: string; due: string | null; status: 'open' | 'corrected'; kind: string; corrected_at: string | null; close_note: string | null }[];
  return rows.map((r) => ({
    id: r.id, bodyEn: r.body_en, bodyAr: r.body_ar, due: r.due,
    status: r.status, kind: r.kind === 'confirmation' ? 'confirmation' as const : 'corrective' as const,
    correctedAt: r.corrected_at ? r.corrected_at.slice(0, 10) : null,
    closeNote: r.close_note,
  }));
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
  /** Whether the platform holds the file itself. Bytes are never selected here. */
  hasFile: boolean;
  contentType: string | null;
}

export function attachmentsFor(accountId: number, eventId: string): AttachmentRow[] {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return [];
  const rows = getDb()
    .prepare(
      `SELECT doc_key, file_name, attached_at, content_type,
              (bytes IS NOT NULL AND length(bytes) > 0) AS has_file
       FROM event_attachments WHERE event_id = ?`,
    )
    .all(eventId) as unknown as { doc_key: string; file_name: string; attached_at: string; content_type: string | null; has_file: number }[];
  return rows.map((r) => ({
    docKey: r.doc_key, fileName: r.file_name, attachedAt: r.attached_at,
    hasFile: r.has_file === 1, contentType: r.content_type,
  }));
}

export interface InvitationRow {
  token: string;
  kind: 'ems' | 'director';
  nameEn: string;
  nameAr: string;
  email: string;
  status: 'nominated' | 'confirmed' | 'declined' | 'withdrawn' | 'removed';
  declaration: 'none' | 'draft' | 'signed';
  invitedAt: string;
  answeredAt: string | null;
  /** A modification request's reason, or a decline's -- verbatim. */
  responseNote: string;
}

export function invitationsFor(accountId: number, eventId: string): InvitationRow[] {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return [];
  const rows = getDb()
    .prepare(
      `SELECT token, kind, name_en, name_ar, email, status, declaration, invited_at, answered_at, response_note
       FROM invitations WHERE event_id = ? ORDER BY invited_at`,
    )
    .all(eventId) as unknown as {
      token: string; kind: 'ems' | 'director'; name_en: string; name_ar: string; email: string;
      status: InvitationRow['status']; declaration: InvitationRow['declaration'];
      invited_at: string; answered_at: string | null; response_note: string;
    }[];
  return rows.map((r) => ({
    token: r.token, kind: r.kind, nameEn: r.name_en, nameAr: r.name_ar, email: r.email,
    status: r.status, declaration: r.declaration, invitedAt: r.invited_at, answeredAt: r.answered_at,
    responseNote: r.response_note,
  }));
}

export interface PlanRow {
  mode: 'write' | 'attach';
  refConfirmed: boolean;
  refAdmitsChildren: boolean;
  refTemporaryAreas: boolean;
  sections: Record<string, { text?: string; covered?: boolean }>;
  attachedFile: string | null;
  /** Whether the platform holds the attached plan document itself, not just its name. */
  attachedHasFile: boolean;
  majorIncident: Record<string, { covered?: boolean }>;
  version: number;
  updatedAt: string;
}

export function planFor(accountId: number, eventId: string): PlanRow | null {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return null;
  const r = getDb()
    .prepare(`SELECT mode, ref_confirmed, ref_admits_children, ref_temporary_areas, sections, attached_file,
              (attached_bytes IS NOT NULL AND length(attached_bytes) > 0) AS attached_has_file,
              major_incident, version, updated_at FROM plans WHERE event_id = ?`)
    .get(eventId) as
    | { mode: 'write' | 'attach'; ref_confirmed: number; ref_admits_children: number; ref_temporary_areas: number; sections: string; attached_file: string | null; attached_has_file: number; major_incident: string; version: number; updated_at: string }
    | undefined;
  if (!r) return null;
  return {
    mode: r.mode,
    refConfirmed: r.ref_confirmed === 1,
    refAdmitsChildren: r.ref_admits_children === 1,
    refTemporaryAreas: r.ref_temporary_areas === 1,
    sections: JSON.parse(r.sections) as PlanRow['sections'],
    attachedFile: r.attached_file,
    attachedHasFile: r.attached_has_file === 1,
    majorIncident: JSON.parse(r.major_incident) as PlanRow['majorIncident'],
    version: r.version,
    updatedAt: r.updated_at,
  };
}

/**
 * The plan AS SUBMITTED, for the Ministry's review screen -- event-scoped, because the
 * reviewer is not the owner. The organizer-side planFor stays account-scoped; this
 * exists so the reviewer can READ the document the submission is about, which for a
 * whole slice they could not: the review screen carried providers, inspections and an
 * outcome control, and not one word of the plan the outcome concerns.
 */
export function planForReview(eventId: string): PlanRow | null {
  const r = getDb()
    .prepare(`SELECT mode, ref_confirmed, ref_admits_children, ref_temporary_areas, sections, attached_file,
              (attached_bytes IS NOT NULL AND length(attached_bytes) > 0) AS attached_has_file,
              major_incident, version, updated_at FROM plans WHERE event_id = ?`)
    .get(eventId) as
    | { mode: 'write' | 'attach'; ref_confirmed: number; ref_admits_children: number; ref_temporary_areas: number; sections: string; attached_file: string | null; attached_has_file: number; major_incident: string; version: number; updated_at: string }
    | undefined;
  if (!r) return null;
  return {
    mode: r.mode,
    refConfirmed: r.ref_confirmed === 1,
    refAdmitsChildren: r.ref_admits_children === 1,
    refTemporaryAreas: r.ref_temporary_areas === 1,
    sections: JSON.parse(r.sections) as PlanRow['sections'],
    attachedFile: r.attached_file,
    attachedHasFile: r.attached_has_file === 1,
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

export function municipalitiesFor(accountId: number, eventId: string): string {
  const r = getDb()
    .prepare(`SELECT municipalities FROM events WHERE id = ? AND account_id = ?`)
    .get(eventId, accountId) as { municipalities: string } | undefined;
  return r?.municipalities ?? '';
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
  directorReturnedAt: string | null;
  directorReturnNote: string | null;
}

export function postEventReportFor(accountId: number, eventId: string): PostEventReportRow | null {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return null;
  const r = getDb()
    .prepare(`SELECT activity, significant, lessons_none, lessons_text, organizer_signed_at, director_signed_at, submitted_at, director_returned_at, director_return_note FROM post_event_reports WHERE event_id = ?`)
    .get(eventId) as
    | { activity: string; significant: string; lessons_none: number; lessons_text: string; organizer_signed_at: string | null; director_signed_at: string | null; submitted_at: string | null; director_returned_at: string | null; director_return_note: string | null }
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
    directorReturnedAt: r.director_returned_at ? r.director_returned_at.slice(0, 10) : null,
    directorReturnNote: r.director_return_note,
  };
}

/**
 * The document-state map the submission gate consumes: system documents are complete by
 * construction; platform documents report their own completeness; attached documents
 * are complete when a row exists; the third-party document when every provider signed.
 */
/**
 * The keys documentStateFor answers for. Exported so a guard can compare them against
 * the catalogue rather than trusting that the two were kept together by hand.
 */
export const DOCUMENT_STATE_KEYS: readonly string[] = [
  'assessment', 'arrangements', 'complianceForm', 'plan', 'siteMap',
  'deploymentMap', 'insuranceEvidence', 'emsDeclarations', 'other',
];

/**
 * Whether each catalogue document is satisfied, for one event.
 *
 * THIS MAP IS HAND-WRITTEN BESIDE A DATA-DRIVEN CATALOGUE, which is a shape this
 * build keeps getting caught by: add a document to attachments-catalog.json and it
 * appears on every screen that reads the catalogue, while this map silently returns
 * undefined for it -- and undefined reads as "not satisfied", so the document blocks
 * filing forever with no way to satisfy it. tests/attachments.test.ts now asserts
 * every catalogue key has an entry here, so the omission fails the build instead of
 * the organizer.
 *
 * Most entries are an attachment; three are DERIVED, because the platform completes
 * them rather than receiving a file: the assessment, the compliance form and the
 * plan. Those keep their own completeness rules in lib/rules.
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
  // THE FORM IS NOT COMPLETE WITHOUT ITS CERTIFICATION. The requirements screen used
  // to call this row done as soon as the boxes were ticked, while the authorized
  // representative, telephone and position were still empty -- so an organizer saw a
  // green compliance form and a filing gate that refused, with the two disagreeing
  // about the same document.
  const certificationDone = certificationComplete('organizer', {
    representative: submission?.representative ?? '',
    telephone: submission?.telephone ?? '',
    position: submission?.position ?? '',
  });

  return {
    assessment: true,
    arrangements: attached.has('arrangements'),
    complianceForm: declarationsComplete && certificationDone,
    plan: planComplete,
    siteMap: attached.has('siteMap'),
    deploymentMap: attached.has('deploymentMap'),
    insuranceEvidence: attached.has('insuranceEvidence'),
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
  status: 'nominated' | 'confirmed' | 'declined' | 'withdrawn' | 'removed';
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

/**
 * THE BRIEFING a nominated party reads BEFORE responding (stage one of three).
 *
 * The nomination screen used to carry five facts -- who invited you, the event, its
 * level, its date, and the name you were nominated under -- and then asked for a
 * decision. That is not enough to decide with. A party being asked to take personal
 * or institutional responsibility for an event needs to know when it is, where, how
 * big, what the level demands of THEM, when the organizer must file, who else is
 * named beside them, and what documents concern their role.
 *
 * WHAT THIS DELIBERATELY DOES NOT RETURN: the submission. Not the assessment answers,
 * not the compliance form, not the other parties' declarations, not any document
 * outside the nominee's own role. A nomination is an invitation to take on a defined
 * part, not a licence to read the organizer's file (rule 6: none sees an event it was
 * not named in -- and being named in one is not being named in all of it).
 *
 * The identity of the Event Medical Director IS returned, to everyone named. It has
 * to be: declaration item 7 turns on who the Director is, so an EMS provider asked to
 * sign cannot evaluate the nomination without it.
 */
export interface NominationBriefing {
  eventNameEn: string; eventNameAr: string;
  organizationNameEn: string; organizationNameAr: string;
  startDate: string | null; endDate: string | null;
  openingTime: string | null; closingTime: string | null;
  venueRoute: string | null; municipalities: string | null;
  eventType: string | null;
  filed: boolean;
  /** Everyone else named on this event, with the state of their own nomination. */
  otherParties: {
    kind: 'ems' | 'director';
    nameEn: string; nameAr: string;
    status: InvitationDetail['status'];
    isThisOne: boolean;
  }[];
  /** Documents that concern the nominee's role -- never the whole attachment set. */
  documents: { docKey: string; fileName: string; attachedAt: string; hasFile: boolean; contentType: string | null }[];
}

export function nominationBriefing(token: string): NominationBriefing | null {
  const db = getDb();
  const inv = db
    .prepare(`SELECT event_id, kind FROM invitations WHERE token = ?`)
    .get(token) as { event_id: string; kind: 'ems' | 'director' } | undefined;
  if (!inv) return null;

  const ev = db
    .prepare(
      `SELECT name_en, name_ar, start_date, end_date, opening_time, closing_time,
              venue_route, municipalities, event_type, filed
       FROM events WHERE id = ?`,
    )
    .get(inv.event_id) as
    | {
        name_en: string; name_ar: string; start_date: string | null; end_date: string | null;
        opening_time: string | null; closing_time: string | null; venue_route: string | null;
        municipalities: string | null; event_type: string | null; filed: number;
      }
    | undefined;
  if (!ev) return null;

  const org = db
    .prepare(
      `SELECT o.name_en, o.name_ar FROM events e
       LEFT JOIN organizations o ON o.account_id = e.account_id WHERE e.id = ?`,
    )
    .get(inv.event_id) as { name_en: string | null; name_ar: string | null } | undefined;

  const parties = db
    .prepare(
      `SELECT token, kind, name_en, name_ar, status FROM invitations
       WHERE event_id = ? ORDER BY kind, invited_at`,
    )
    .all(inv.event_id) as unknown as {
    token: string; kind: 'ems' | 'director'; name_en: string; name_ar: string;
    status: InvitationDetail['status'];
  }[];

  // The SAME allow-list the serving route checks against (lib/rules/nomination-access).
  // A second copy here would let the panel and the route drift: a listed document the
  // route refuses is a dead control, and a served one the panel never lists is a hole.
  const allowed = NOMINEE_DOCUMENT_KEYS[inv.kind];
  const documents = (
    db
      .prepare(
        `SELECT doc_key, file_name, attached_at, content_type,
                (bytes IS NOT NULL AND length(bytes) > 0) AS has_file
         FROM event_attachments WHERE event_id = ? ORDER BY attached_at`,
      )
      .all(inv.event_id) as unknown as {
      doc_key: string; file_name: string; attached_at: string;
      content_type: string | null; has_file: number;
    }[]
  )
    .filter((d) => allowed.includes(d.doc_key))
    .map((d) => ({
      docKey: d.doc_key,
      fileName: d.file_name,
      attachedAt: d.attached_at.slice(0, 10),
      hasFile: d.has_file === 1,
      contentType: d.content_type,
    }));

  return {
    eventNameEn: ev.name_en,
    eventNameAr: ev.name_ar,
    organizationNameEn: org?.name_en ?? '',
    organizationNameAr: org?.name_ar ?? '',
    startDate: ev.start_date,
    endDate: ev.end_date,
    openingTime: ev.opening_time,
    closingTime: ev.closing_time,
    venueRoute: ev.venue_route,
    municipalities: ev.municipalities,
    eventType: ev.event_type,
    filed: ev.filed === 1,
    otherParties: parties
      // A withdrawn or removed party is not "who else is named" -- they are not.
      .filter((p) => p.status !== 'withdrawn' && p.status !== 'removed')
      .map((p) => ({
        kind: p.kind,
        nameEn: p.name_en,
        nameAr: p.name_ar,
        status: p.status,
        isThisOne: p.token === token,
      })),
    documents,
  };
}

/**
 * THE PLAN SLICE a named party may read, with the version it was read at.
 *
 * THE VERSION STAMP IS THE POINT. A standing view that silently changes is worse than
 * no standing view: a provider who read the major-incident arrangements in August and
 * acts on them in September must be able to see whether what they read is what
 * stands. The version and the date it was last saved are rendered with the text, and
 * the plan's version increments on every save (savePlanAction archives the row it
 * replaces), so a changed slice is visible as a changed number.
 *
 * Four sections, from lib/rules/nomination-access. Returns null when the organizer
 * has no plan yet -- which the screen states, rather than showing four empty rows
 * that read as an organizer who wrote nothing.
 */
export interface NomineePlanSlice {
  version: number;
  updatedAt: string;
  mode: 'write' | 'attach';
  sections: { n: number; en: string; ar: string; text: string; covered: boolean }[];
}

export function nomineePlanSlice(eventId: string): NomineePlanSlice | null {
  const r = getDb()
    .prepare(
      `SELECT mode, sections, version, updated_at FROM plans WHERE event_id = ?`,
    )
    .get(eventId) as
    | { mode: 'write' | 'attach'; sections: string; version: number; updated_at: string }
    | undefined;
  if (!r) return null;
  const stored = JSON.parse(r.sections) as Record<string, { text?: string; covered?: boolean }>;
  return {
    version: r.version,
    updatedAt: r.updated_at.slice(0, 10),
    mode: r.mode,
    sections: PLAN_SECTIONS.filter((sec) => nomineeMayReadSection(sec.n)).map((sec) => ({
      n: sec.n,
      en: sec.en,
      ar: sec.ar,
      text: (stored[String(sec.n)]?.text ?? '').trim(),
      covered: stored[String(sec.n)]?.covered === true,
    })),
  };
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
  /** Whether the platform holds the file, not just its name. Bytes are never selected here. */
  hasFile: boolean;
  contentType: string | null;
}

export function sharedDocumentsFor(token: string): SharedDocumentRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, name_en, name_ar, source, file_name, meta_en, meta_ar, content_type,
              (bytes IS NOT NULL AND length(bytes) > 0) AS has_file
       FROM shared_documents WHERE invitation_token = ? ORDER BY added_at`,
    )
    .all(token) as unknown as { id: number; name_en: string; name_ar: string; source: SharedDocumentRow['source']; file_name: string | null; meta_en: string; meta_ar: string; content_type: string | null; has_file: number }[];
  return rows.map((r) => ({ id: r.id, nameEn: r.name_en, nameAr: r.name_ar, source: r.source, fileName: r.file_name, metaEn: r.meta_en, metaAr: r.meta_ar, hasFile: r.has_file === 1, contentType: r.content_type }));
}

/**
 * Every document on every counterparty's shared list for one event, for the review
 * screen. The organizer's own attachments are attachmentsForReview; this is the
 * OTHER lane -- what a named provider or Director supplied, or was asked for and
 * has not supplied. A reviewer reading only the organizer's attachments cannot see
 * that the deployment map was requested from the EMS provider a fortnight ago and
 * never arrived, which is exactly the kind of gap a determination turns on.
 */
export function sharedDocumentsForReview(
  eventId: string,
): { id: number; nameEn: string; nameAr: string; source: SharedDocumentRow['source']; fileName: string | null; hasFile: boolean; contentType: string | null; partyEn: string; partyAr: string }[] {
  const rows = getDb()
    .prepare(
      `SELECT d.id, d.name_en, d.name_ar, d.source, d.file_name, d.content_type,
              (d.bytes IS NOT NULL AND length(d.bytes) > 0) AS has_file,
              i.name_en AS party_en, i.name_ar AS party_ar
       FROM shared_documents d
       JOIN invitations i ON i.token = d.invitation_token
       WHERE i.event_id = ? ORDER BY i.name_en, d.added_at`,
    )
    .all(eventId) as unknown as {
    id: number; name_en: string; name_ar: string; source: SharedDocumentRow['source'];
    file_name: string | null; content_type: string | null; has_file: number;
    party_en: string; party_ar: string;
  }[];
  return rows.map((r) => ({
    id: r.id, nameEn: r.name_en, nameAr: r.name_ar, source: r.source,
    fileName: r.file_name, hasFile: r.has_file === 1, contentType: r.content_type,
    partyEn: r.party_en, partyAr: r.party_ar,
  }));
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
  id: number;
  outcome: 'incomplete' | 'revision' | 'satisfied';
  note: string;
  recordedBy: string;
  recordedAt: string;
  /** The determination this one replaced, if it is a revision. */
  supersedes: number | null;
  /** Why it was revised. Verbatim; never improved. */
  revisionReason: string | null;
  /** True once a later determination has replaced this one. */
  superseded: boolean;
}

/**
 * Every determination on an event, newest first, with which replaced which.
 *
 * THE TABLE WAS ALWAYS APPEND-ONLY; THE SCREEN WAS NOT. After recording, the three
 * radios stayed live and a second record silently replaced the first with nothing
 * saying it had -- a regulatory act overwritten by a stray click. The rows were all
 * still here; nothing read them as a chain. They are read as one now, so the screen
 * can show what stands, what it replaced, and why.
 */
export function determinationsFor(eventId: string): DeterminationRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, outcome, note, recorded_by, recorded_at, supersedes, revision_reason
       FROM determinations WHERE event_id = ? ORDER BY recorded_at DESC, id DESC`,
    )
    .all(eventId) as unknown as {
    id: number; outcome: DeterminationRow['outcome']; note: string; recorded_by: string;
    recorded_at: string; supersedes: number | null; revision_reason: string | null;
  }[];
  const replaced = new Set(rows.map((r) => r.supersedes).filter((v): v is number => v !== null));
  return rows.map((r) => ({
    id: r.id,
    outcome: r.outcome,
    note: r.note,
    recordedBy: r.recorded_by,
    recordedAt: r.recorded_at.slice(0, 10),
    supersedes: r.supersedes,
    revisionReason: r.revision_reason,
    superseded: replaced.has(r.id),
  }));
}

/** The determination that STANDS: the newest one nothing has replaced. */
export function standingDeterminationFor(eventId: string): DeterminationRow | null {
  return determinationsFor(eventId).find((d) => !d.superseded) ?? null;
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

/**
 * The stored attestation records for one event. The derivation -- which items apply,
 * who may record, what blocks -- lives in lib/rules/attestations.ts; this only reads
 * the rows. An absent row is the pending state, so a fresh submission returns [].
 */
export function attestationRecordsFor(eventId: string): AttestationRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT item_key, state, attested_by, attested_at, reason_en, reason_ar, reason_by, reason_at
       FROM attestations WHERE event_id = ?`,
    )
    .all(eventId) as unknown as {
      item_key: string; state: 'pending' | 'complete';
      attested_by: string | null; attested_at: string | null;
      reason_en: string | null; reason_ar: string | null;
      reason_by: string | null; reason_at: string | null;
    }[];
  return rows.map((r) => ({
    itemKey: r.item_key, state: r.state,
    attestedBy: r.attested_by, attestedAt: r.attested_at ? r.attested_at.slice(0, 10) : null,
    reasonEn: r.reason_en, reasonAr: r.reason_ar,
    reasonBy: r.reason_by, reasonAt: r.reason_at ? r.reason_at.slice(0, 10) : null,
  }));
}

/**
 * The attached documents on an event, for the review screen.
 *
 * The BYTES ARE NOT SELECTED HERE and must not be: this feeds a server component
 * that renders a list, and pulling a 20 MB blob into a page render to display a
 * file name would be a real cost for no purpose. The reviewer opens a document
 * through /api/documents, which reads the bytes for exactly the one asked for.
 *
 * `hasFile` is what the screen needs: whether an Open control appears at all, or
 * the row explains that this is a demonstration record with no file behind it.
 */
export function attachmentsForReview(
  eventId: string,
): { docKey: string; fileName: string; attachedAt: string; hasFile: boolean; contentType: string | null; byteSize: number | null }[] {
  const rows = getDb()
    .prepare(
      `SELECT doc_key, file_name, attached_at, content_type, byte_size,
              (bytes IS NOT NULL AND length(bytes) > 0) AS has_file
       FROM event_attachments WHERE event_id = ? ORDER BY attached_at`,
    )
    .all(eventId) as unknown as {
    doc_key: string; file_name: string; attached_at: string;
    content_type: string | null; byte_size: number | null; has_file: number;
  }[];
  return rows.map((r) => ({
    docKey: r.doc_key,
    fileName: r.file_name,
    attachedAt: r.attached_at.slice(0, 10),
    hasFile: r.has_file === 1,
    contentType: r.content_type,
    byteSize: r.byte_size,
  }));
}

/** Archived submission versions, oldest first -- what each earlier filing carried. */
export function submissionVersionsFor(eventId: string): { version: number; representative: string; archivedAt: string }[] {
  const rows = getDb()
    .prepare(`SELECT version, representative, archived_at FROM submission_versions WHERE event_id = ? ORDER BY version`)
    .all(eventId) as unknown as { version: number; representative: string; archived_at: string }[];
  return rows.map((r) => ({ version: r.version, representative: r.representative, archivedAt: r.archived_at.slice(0, 10) }));
}

/** Recorded covered-facility designations (power 3), newest first. */
export function designationsForReview(viewerIsDemo: boolean): { nameEn: string; nameAr: string; category: string; municipality: string; facilityId: string | null; designatedBy: string; designatedAt: string }[] {
  const rows = getDb()
    .prepare(
      `SELECT name_en, name_ar, category, municipality, facility_id, designated_by, designated_at
       FROM facility_designations WHERE is_demo = ? ORDER BY designated_at DESC`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as { name_en: string; name_ar: string; category: string; municipality: string; facility_id: string | null; designated_by: string; designated_at: string }[];
  return rows.map((r) => ({ nameEn: r.name_en, nameAr: r.name_ar, category: r.category, municipality: r.municipality, facilityId: r.facility_id, designatedBy: r.designated_by, designatedAt: r.designated_at.slice(0, 10) }));
}

export interface ApplicabilityRecordRow {
  id: number;
  eventName: string;
  source: string;
  note: string;
  determination: 'undetermined' | 'in_scope' | 'out_of_scope';
  reasons: string;
  designated: boolean;
  recordedBy: string;
  determinedAt: string | null;
  createdAt: string;
}

export function applicabilityRecords(viewerIsDemo: boolean): ApplicabilityRecordRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, event_name, source, note, determination, reasons, designated, recorded_by, determined_at, created_at
       FROM applicability_records WHERE is_demo = ? ORDER BY created_at DESC`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as { id: number; event_name: string; source: string; note: string; determination: ApplicabilityRecordRow['determination']; reasons: string; designated: number; recorded_by: string; determined_at: string | null; created_at: string }[];
  return rows.map((r) => ({
    id: r.id, eventName: r.event_name, source: r.source, note: r.note,
    determination: r.determination, reasons: r.reasons, designated: r.designated === 1,
    recordedBy: r.recorded_by, determinedAt: r.determined_at ? r.determined_at.slice(0, 10) : null,
    createdAt: r.created_at.slice(0, 10),
  }));
}

export interface PendingOrganizationRow {
  id: number;
  nameEn: string; nameAr: string;
  status: 'none' | 'pending' | 'recorded' | 'returned';
  recordedAt: string | null;
}

export function organizationsForReview(viewerIsDemo: boolean): PendingOrganizationRow[] {
  const rows = getDb()
    .prepare(`SELECT id, name_en, name_ar, status, recorded_at FROM organizations WHERE is_demo = ? ORDER BY status = 'pending' DESC, name_en`)
    .all(demoFlag(viewerIsDemo)) as unknown as { id: number; name_en: string; name_ar: string; status: PendingOrganizationRow['status']; recorded_at: string | null }[];
  return rows.map((r) => ({ id: r.id, nameEn: r.name_en, nameAr: r.name_ar, status: r.status, recordedAt: r.recorded_at }));
}

export interface MinistryChangeRow {
  kind: 'material' | 'declined' | 'lifecycle';
  linksToReview?: boolean;
  eventId: string;
  eventEn: string; eventAr: string;
  detailEn: string; detailAr: string;
  when: string;
}

export function changesForReview(viewerIsDemo: boolean): MinistryChangeRow[] {
  const db = getDb();
  const material = db
    .prepare(
      `SELECT m.event_id, e.name_en, e.name_ar, m.aspects, m.description, m.effective_date, m.reported_at
       FROM material_changes m JOIN events e ON e.id = m.event_id
       WHERE e.is_demo = ? ORDER BY m.reported_at DESC`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as { event_id: string; name_en: string; name_ar: string; aspects: string; description: string; effective_date: string; reported_at: string }[];
  const parties = db
    .prepare(
      `SELECT i.event_id, e.name_en, e.name_ar, i.name_en AS party_en, i.name_ar AS party_ar, i.status, i.answered_at, i.closed_at
       FROM invitations i JOIN events e ON e.id = i.event_id
       WHERE i.status IN ('declined', 'removed') AND e.is_demo = ? ORDER BY COALESCE(i.closed_at, i.answered_at) DESC`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as { event_id: string; name_en: string; name_ar: string; party_en: string; party_ar: string; status: string; answered_at: string | null; closed_at: string | null }[];
  // Cancellations and postponements read straight off the event rows: the organizer's
  // act IS the notice, and the lane shows it without a second filing.
  const lifecycle = db
    .prepare(
      `SELECT id, name_en, name_ar, lifecycle, lifecycle_at, lifecycle_note, postponed_to, filed
       FROM events WHERE lifecycle != 'active' AND is_demo = ? ORDER BY lifecycle_at DESC`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as { id: string; name_en: string; name_ar: string; lifecycle: string; lifecycle_at: string | null; lifecycle_note: string | null; postponed_to: string | null; filed: number }[];
  return [
    ...material.map((m) => {
      const aspectKeys = (JSON.parse(m.aspects) as string[]).join(', ');
      return {
        kind: 'material' as const, eventId: m.event_id, eventEn: m.name_en, eventAr: m.name_ar,
        // The stored substance, not just the fact of a report: aspects, the
        // organizer's description verbatim, and the effective date where given.
        detailEn: `Material change — ${aspectKeys}${m.effective_date ? ` · effective ${m.effective_date}` : ''} · “${m.description}”`,
        detailAr: `تغيير جوهري — ${aspectKeys}${m.effective_date ? ` · يسري من ⁦${m.effective_date}⁩` : ''} · «${m.description}»`,
        when: m.reported_at.slice(0, 10),
        linksToReview: true,
      };
    }),
    ...parties.map((d) => ({
      kind: 'declined' as const, eventId: d.event_id, eventEn: d.name_en, eventAr: d.name_ar,
      detailEn: d.status === 'removed' ? `Confirmed party removed by the organizer — ${d.party_en}` : `Named party declined — ${d.party_en}`,
      detailAr: d.status === 'removed' ? `أزال المنظّم طرفاً مؤكَّداً — ${d.party_ar}` : `اعتذر طرف مُسمّى — ${d.party_ar}`,
      when: (d.closed_at ?? d.answered_at)?.slice(0, 10) ?? '',
      linksToReview: true,
    })),
    ...lifecycle.map((e) => ({
      kind: 'lifecycle' as const, eventId: e.id, eventEn: e.name_en, eventAr: e.name_ar,
      detailEn:
        e.lifecycle === 'cancelled'
          ? `Cancelled${e.lifecycle_note ? ` · “${e.lifecycle_note}”` : ''}`
          : `Postponed ${e.postponed_to ? `to ${e.postponed_to}` : '— no new date yet'}${e.lifecycle_note ? ` · “${e.lifecycle_note}”` : ''}`,
      detailAr:
        e.lifecycle === 'cancelled'
          ? `أُلغيت${e.lifecycle_note ? ` · «${e.lifecycle_note}»` : ''}`
          : `أُجّلت ${e.postponed_to ? `إلى ⁦${e.postponed_to}⁩` : '— لا تاريخ جديداً بعد'}${e.lifecycle_note ? ` · «${e.lifecycle_note}»` : ''}`,
      when: e.lifecycle_at?.slice(0, 10) ?? '',
      // An unfiled cancelled draft has no submission to open.
      linksToReview: e.filed === 1,
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
  suspended: boolean;
  isDemo: boolean;
}

export function ministryUsers(viewerIsDemo: boolean): MinistryUserRow[] {
  const rows = getDb()
    .prepare(
      `SELECT login, display_name, role, is_demo, suspended FROM accounts
       WHERE role IN ('reviewer','inspector','ministry_admin','order','platform_owner') AND is_demo = ?
       ORDER BY role, display_name`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as { login: string; display_name: string; role: string; is_demo: number; suspended: number }[];
  return rows.map((r) => ({ login: r.login, displayName: r.display_name, role: r.role, isDemo: r.is_demo === 1, suspended: r.suspended === 1 }));
}

/**
 * THE COMPLIANCE FORM AS FILED -- every declaration with whether it was made, and the
 * certification it was made under.
 *
 * submissionForReview carries the review header; this carries the CONTENT. They are
 * separate because the reviewer's screen needs the first and the complete file needs
 * both, and merging them would make every queue row read a JSON blob it never uses.
 */
export function complianceForReview(
  eventId: string,
  level: 1 | 2 | 3,
): { declarations: { en: string; ar: string; declared: boolean }[]; representative: string; telephone: string; position: string; insurance: Record<string, string> } | null {
  const r = getDb()
    .prepare(
      `SELECT declarations, insurance, representative, telephone, position
       FROM submissions WHERE event_id = ?`,
    )
    .get(eventId) as
    | { declarations: string; insurance: string; representative: string; telephone: string; position: string }
    | undefined;
  if (!r) return null;
  const ticked = JSON.parse(r.declarations) as Record<string, boolean>;
  return {
    declarations: COMPLIANCE_DECLARATIONS.filter((d) => d.minLevel <= level).map((d, i) => ({
      en: d.en,
      ar: d.ar,
      declared: ticked[String(i)] === true,
    })),
    representative: r.representative,
    telephone: r.telephone,
    position: r.position,
    insurance: JSON.parse(r.insurance) as Record<string, string>,
  };
}

/**
 * EVERY NOTIFICATION THE PLATFORM SENT ABOUT ONE RECORD.
 *
 * What a party was actually told, and when. Matched on the record route the
 * notification carries, which is how the notification already identifies its subject
 * -- no second field to keep in step with the first.
 */
export function notificationsForEvent(eventId: string): { id: number; titleEn: string; titleAr: string; bodyEn: string; bodyAr: string; createdAt: string }[] {
  const rows = getDb()
    .prepare(
      `SELECT id, subject_en, subject_ar, body_en, body_ar, sent_at
       FROM notifications WHERE record_route LIKE ? ORDER BY sent_at DESC, id DESC`,
    )
    .all(`%/events/${eventId}%`) as unknown as {
    id: number; subject_en: string; subject_ar: string; body_en: string; body_ar: string; sent_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    titleEn: r.subject_en,
    titleAr: r.subject_ar,
    bodyEn: r.body_en,
    bodyAr: r.body_ar,
    createdAt: r.sent_at.slice(0, 16),
  }));
}

/**
 * ONE FINDER FOR THE PUBLIC REGISTER, used by the lookup endpoint AND by the lookup
 * screen in front of it.
 *
 * It lived inside the route handler, so building a page for the public would have
 * meant either calling our own HTTP endpoint from the server or writing the query a
 * second time. Two queries of the same register is how the page and the API end up
 * disagreeing about one event.
 */
export function findSubmissionByReference(reference: string): SubmissionRecord | null {
  const row = getDb()
    .prepare(
      `SELECT e.id, e.moph_reference, e.name_en, e.start_date, e.is_demo, e.demo_level, e.demo_state_en
       FROM events e WHERE e.moph_reference = ?`,
    )
    .get(reference) as
    | {
        id: string;
        moph_reference: string;
        name_en: string;
        start_date: string | null;
        is_demo: number;
        demo_level: number | null;
        demo_state_en: string | null;
      }
    | undefined;
  if (!row) return null;
  // The same precedence as the organizer's own screens: a recorded outcome wins,
  // so the public register never disagrees with the dashboard on the same event.
  const outcome = latestOutcomeFor(row.id);
  const outcomeLabel = outcome
    ? MINISTRY_CONTENT.outcomes.find((o) => o.key === outcome)?.en
    : undefined;
  return {
    referenceNumber: row.moph_reference,
    eventName: row.name_en,
    // No derivable level is NOT Level 1 (non-negotiable 0): the register reports the
    // absence rather than inventing the lowest band.
    level: derivedLevelFor(row.id),
    status: outcomeLabel ?? row.demo_state_en ?? 'Submission received but incomplete',
    isDemo: row.is_demo === 1,
    eventStartDate: row.start_date ?? '',
  };
}


/**
 * EVERY SUBMISSION ON THE PLATFORM, for the administrator's Records tab.
 *
 * The reviewer's queue answers "what is waiting for me". This answers "what exists",
 * which is a different question and the one an overseeing profile asks. Filed and
 * unfiled alike, because a record that never filed is a fact about the platform too.
 *
 * Filtering is done in SQL, with ONE deliberate exception. Status, search and the
 * demonstration boundary are WHERE clauses, because "server-side field limits are
 * enforced on the server" and a wide query filtered in the page would still have read
 * every row.
 *
 * THE LEVEL IS NOT, and cannot be. It is derived by lib/rules from the assessment
 * answers -- nine domains, ten minimum conditions, the higher of the two -- and
 * writing that as a SQL clause would be a SECOND derivation of the one number this
 * whole platform turns on. Two derivations of one rule drift; that is the defect this
 * build keeps finding. So the level is computed once, by the rules, and the filter is
 * applied to the result. The cost is reading the event rows before narrowing, which
 * is a page of records, not a national register scan.
 */
export interface AdminRecordRow {
  id: string;
  nameEn: string;
  nameAr: string;
  organizationEn: string;
  organizationAr: string;
  municipalities: string;
  level: number | null;
  startDate: string | null;
  filed: boolean;
  filedAt: string | null;
  mophReference: string | null;
  outcome: string | null;
  outcomeAt: string | null;
  lifecycle: string;
}

export interface AdminRecordFilter {
  level?: number | undefined;
  /** 'filed' | 'unfiled' | one of the three outcome keys | 'undetermined' */
  status?: string | undefined;
  /** Matched against the event name, the organization and the municipality. */
  search?: string | undefined;
}

export function adminRecords(viewerIsDemo: boolean, filter: AdminRecordFilter = {}): AdminRecordRow[] {
  const clauses: string[] = ['e.is_demo = ?'];
  const params: (string | number)[] = [demoFlag(viewerIsDemo)];

  if (filter.status === 'filed') clauses.push('e.filed = 1');
  if (filter.status === 'unfiled') clauses.push('e.filed = 0');
  if (filter.status === 'undetermined') {
    clauses.push('e.filed = 1 AND NOT EXISTS (SELECT 1 FROM determinations d WHERE d.event_id = e.id)');
  }
  if (filter.status && ['incomplete', 'revision', 'satisfied'].includes(filter.status)) {
    clauses.push(
      `(SELECT d.outcome FROM determinations d WHERE d.event_id = e.id
         ORDER BY d.recorded_at DESC, d.id DESC LIMIT 1) = ?`,
    );
    params.push(filter.status);
  }
  if (filter.search && filter.search.trim() !== '') {
    clauses.push('(e.name_en LIKE ? OR e.name_ar LIKE ? OR e.municipalities LIKE ? OR o.name_en LIKE ? OR o.name_ar LIKE ?)');
    const like = `%${filter.search.trim()}%`;
    params.push(like, like, like, like, like);
  }

  const rows = getDb()
    .prepare(
      `SELECT e.id, e.name_en, e.name_ar, e.municipalities, e.demo_level, e.start_date,
              e.filed, e.moph_reference, e.lifecycle,
              COALESCE(o.name_en, '—') AS org_en, COALESCE(o.name_ar, '—') AS org_ar,
              (SELECT s.filed_at FROM submissions s WHERE s.event_id = e.id) AS filed_at,
              (SELECT d.outcome FROM determinations d WHERE d.event_id = e.id
                ORDER BY d.recorded_at DESC, d.id DESC LIMIT 1) AS outcome,
              (SELECT d.recorded_at FROM determinations d WHERE d.event_id = e.id
                ORDER BY d.recorded_at DESC, d.id DESC LIMIT 1) AS outcome_at
       FROM events e
       LEFT JOIN organizations o ON o.account_id = e.account_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY e.filed DESC, e.start_date DESC, e.id DESC`,
    )
    .all(...params) as unknown as {
    id: string; name_en: string; name_ar: string; municipalities: string | null;
    demo_level: number | null; start_date: string | null; filed: number;
    moph_reference: string | null; lifecycle: string; org_en: string; org_ar: string;
    filed_at: string | null; outcome: string | null; outcome_at: string | null;
  }[];

  const mapped = rows.map((r) => ({
    id: r.id,
    nameEn: r.name_en,
    nameAr: r.name_ar,
    organizationEn: r.org_en,
    organizationAr: r.org_ar,
    municipalities: r.municipalities ?? '—',
    // Recomputed from the assessment where one exists, never trusted from storage.
    level: derivedLevelFor(r.id) ?? r.demo_level,
    startDate: r.start_date,
    filed: r.filed === 1,
    filedAt: r.filed_at ? r.filed_at.slice(0, 10) : null,
    mophReference: r.moph_reference,
    outcome: r.outcome,
    outcomeAt: r.outcome_at ? r.outcome_at.slice(0, 10) : null,
    lifecycle: r.lifecycle,
  }));

  return filter.level === undefined ? mapped : mapped.filter((r) => r.level === filter.level);
}

/**
 * WHO DID WHAT, WHEN -- the audit trail as one readable surface.
 *
 * Every one of these facts already existed, each on the record it belongs to, and
 * there was nowhere to read them together. An overseeing profile asking "what
 * happened on this platform last week" had to open records one at a time and hope.
 *
 * Assembled by union rather than by a written-to audit table, deliberately: an audit
 * table is a second copy of the truth that can disagree with the first, and it only
 * records what somebody remembered to write to it. These rows ARE the records.
 */
export interface ActivityRow {
  at: string;
  kind: string;
  actor: string;
  subject: string;
  detail: string;
  href: string | null;
}

export function ministryActivity(viewerIsDemo: boolean, limit = 200): ActivityRow[] {
  const d = demoFlag(viewerIsDemo);
  const rows = getDb()
    .prepare(
      `SELECT * FROM (
         SELECT dt.recorded_at AS at, 'determination' AS kind, dt.recorded_by AS actor,
                COALESCE(e.moph_reference, e.id) AS subject, dt.outcome AS detail,
                '/ministry/submissions/' || e.id AS href
           FROM determinations dt JOIN events e ON e.id = dt.event_id WHERE e.is_demo = ?
         UNION ALL
         SELECT s.filed_at, 'filed', s.representative,
                COALESCE(e.moph_reference, e.id), 'submission filed',
                '/ministry/submissions/' || e.id
           FROM submissions s JOIN events e ON e.id = s.event_id
           WHERE e.is_demo = ? AND s.filed_at IS NOT NULL
         UNION ALL
         SELECT i.date, 'inspection', i.inspector,
                COALESCE(e.moph_reference, e.id), i.title_en,
                '/ministry/submissions/' || e.id
           FROM inspections i JOIN events e ON e.id = i.event_id
           WHERE e.is_demo = ? AND i.date IS NOT NULL
         UNION ALL
         SELECT a.created_at, 'account', COALESCE(a.email, a.login), a.display_name, a.role,
                '/ministry/admin/users'
           FROM accounts a WHERE a.is_demo = ?
         UNION ALL
         SELECT o.recorded_at, 'organization', 'Ministry', o.name_en, o.status,
                '/ministry/organizations'
           FROM organizations o WHERE o.is_demo = ? AND o.recorded_at IS NOT NULL
       )
       WHERE at IS NOT NULL
       ORDER BY at DESC
       LIMIT ?`,
    )
    .all(d, d, d, d, d, limit) as unknown as {
    at: string; kind: string; actor: string | null; subject: string; detail: string | null; href: string | null;
  }[];
  return rows.map((r) => ({
    at: r.at.slice(0, 16),
    kind: r.kind,
    actor: r.actor ?? '—',
    subject: r.subject,
    detail: r.detail ?? '',
    href: r.href,
  }));
}

/**
 * MINISTRY POWERS THAT NOBODY REACHABLE HOLDS, within one demonstration scope.
 *
 * The matrix can be perfectly well formed and the platform still unusable: an action
 * assigned only to a role that has no active account is advertised on every screen
 * and performable by nobody. That is exactly what the reviewer walked into --
 * scheduleInspection was the inspector's alone, there was no inspector account in the
 * real scope, and the inspections panel told them a reviewer or inspector would do it
 * while refusing them and offering no one else.
 *
 * Worse than an unassigned power, because an unassigned power is silent and this one
 * names an owner who does not exist.
 *
 * Scoped, because the two worlds are separate: a demonstration inspector does not
 * make the power reachable for a real reviewer, and vice versa.
 */
export function unreachablePowers(viewerIsDemo: boolean): { action: string; en: string; ar: string; roles: string[] }[] {
  const active = new Set(
    (
      getDb()
        .prepare(
          `SELECT DISTINCT role FROM accounts WHERE is_demo = ? AND suspended = 0`,
        )
        .all(demoFlag(viewerIsDemo)) as unknown as { role: string }[]
    ).map((r) => r.role),
  );
  return permissionMatrix()
    .map((row) => ({
      action: row.action.key,
      en: row.action.en,
      ar: row.action.ar,
      roles: rolesHolding(row.action.key as Parameters<typeof rolesHolding>[0]),
    }))
    .filter((row) => !row.roles.some((r) => active.has(r)));
}

/**
 * WHO CAN CONDUCT AN INSPECTION -- the accounts the scheduling control names.
 *
 * "Who conducts it" was not a field: the inspector was silently whoever clicked
 * Schedule, so an inspection could only ever be assigned to the person arranging it.
 * The findings are then recorded against that name, which makes the assignment a
 * matter of record rather than a convenience.
 *
 * Derived from the permission matrix, not from a role string written here: whoever
 * holds scheduleInspection is who can conduct one, and if the Ministry re-rules that
 * the list follows. Suspended accounts are excluded -- an inspection assigned to an
 * account that cannot sign in is an inspection nobody will conduct.
 */
export function inspectorCandidates(viewerIsDemo: boolean): { displayName: string; role: string }[] {
  const eligible = ['reviewer', 'inspector', 'ministry_admin', 'order', 'platform_owner'].filter((r) =>
    can(r, 'scheduleInspection'),
  );
  if (eligible.length === 0) return [];
  const marks = eligible.map(() => '?').join(',');
  const rows = getDb()
    .prepare(
      `SELECT display_name, role FROM accounts
       WHERE role IN (${marks}) AND is_demo = ? AND suspended = 0
       ORDER BY display_name`,
    )
    .all(...eligible, demoFlag(viewerIsDemo)) as unknown as { display_name: string; role: string }[];
  return rows.map((r) => ({ displayName: r.display_name, role: r.role }));
}

/**
 * EVERY ACCOUNT, for the administration console.
 *
 * ministryUsers above lists five roles out of nine, which is right for the permission
 * matrix it feeds and wrong for administering accounts: an administrator asked to
 * manage "the accounts" could not see an organizer, a provider, a Director or a
 * first-response unit at all. They exist, they sign in, and they were invisible here.
 *
 * Each row carries the facts its ORIGIN is derived from rather than a stored origin
 * field -- a stored one goes stale the first time somebody forgets to write it -- and
 * the counts of what it holds, so the console can state the weight of an act before
 * the click rather than making an administrator go and find out.
 *
 * The holdings are counted per account in one pass. They are counts, not contents:
 * this screen administers accounts and has no business rendering anybody's records.
 */
export interface AdministeredAccountRow {
  id: number;
  login: string;
  email: string | null;
  displayName: string;
  role: string;
  isDemo: boolean;
  suspended: boolean;
  createdAt: string;
  /** Origin facts, resolved by lib/rules/accounts.ts. */
  hasPassword: boolean;
  wasInvited: boolean;
  fromNomination: boolean;
  /** A live activation link, if one is outstanding. */
  activationToken: string | null;
  holdings: AccountHoldings;
  /**
   * The most recent session this account opened, or null if it never has.
   *
   * "Never signed in" is a different fact from "invited and not activated": an account
   * can have a password and still have never used it, and an administrator deciding
   * whether a seat is real needs to tell those apart.
   */
  lastSeen: string | null;
}

export function administeredAccounts(viewerIsDemo: boolean): AdministeredAccountRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.id, a.login, a.email, a.display_name, a.role, a.is_demo, a.suspended,
              a.created_at,
              (a.password_hash IS NOT NULL) AS has_password,
              EXISTS (SELECT 1 FROM password_resets p
                      WHERE p.account_id = a.id AND p.kind = 'activation') AS was_invited,
              EXISTS (SELECT 1 FROM invitations i WHERE i.account_id = a.id) AS from_nomination,
              (SELECT p.token FROM password_resets p
                WHERE p.account_id = a.id AND p.kind = 'activation'
                  AND p.used_at IS NULL AND p.expires_at > now_stamp()
                ORDER BY p.created_at DESC LIMIT 1) AS activation_token,
              (SELECT COUNT(*) FROM events e WHERE e.account_id = a.id) AS c_events,
              (SELECT COUNT(*) FROM organizations o WHERE o.account_id = a.id) AS c_orgs,
              (SELECT COUNT(*) FROM invitations i
                WHERE i.account_id = a.id AND i.status IN ('confirmed','declined')) AS c_nominations,
              (SELECT COUNT(*) FROM determinations d WHERE d.recorded_by = a.display_name) AS c_determinations,
              -- Inspections record the INSPECTOR by name, not by account id: the
              -- column is a person, and matching on it is the only join available.
              (SELECT COUNT(*) FROM inspections n WHERE n.inspector = a.display_name) AS c_inspections,
              (SELECT COUNT(*) FROM venues v WHERE v.account_id = a.id) AS c_venues,
              (SELECT COUNT(*) FROM facilities f WHERE f.account_id = a.id) AS c_facilities,
              (SELECT MAX(s.created_at) FROM sessions s WHERE s.account_id = a.id) AS last_seen
       FROM accounts a
       WHERE a.is_demo = ?
       ORDER BY a.role, a.display_name`,
    )
    .all(demoFlag(viewerIsDemo)) as unknown as {
    id: number; login: string; email: string | null; display_name: string; role: string;
    is_demo: number; suspended: number; created_at: string; has_password: number;
    was_invited: number; from_nomination: number; activation_token: string | null;
    c_events: number; c_orgs: number; c_nominations: number; c_determinations: number;
    c_inspections: number; c_venues: number; c_facilities: number; last_seen: string | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    login: r.login,
    email: r.email,
    displayName: r.display_name,
    role: r.role,
    isDemo: r.is_demo === 1,
    suspended: r.suspended === 1,
    createdAt: r.created_at.slice(0, 10),
    hasPassword: r.has_password === 1,
    wasInvited: r.was_invited === 1,
    fromNomination: r.from_nomination === 1,
    activationToken: r.activation_token,
    lastSeen: r.last_seen ? r.last_seen.slice(0, 16) : null,
    holdings: {
      events: r.c_events,
      organizations: r.c_orgs,
      nominations: r.c_nominations,
      determinations: r.c_determinations,
      inspections: r.c_inspections,
      venues: r.c_venues,
      facilities: r.c_facilities,
    },
  }));
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

/**
 * Whether this instance holds demonstration accounts.
 *
 * The sign-in panel used to be gated on NODE_ENV, borrowing the guard that forces the
 * SEEDER off in a deployed environment. The two are different questions. Non-negotiable 8
 * is explicit: demonstration accounts DO exist in production so the Ministry can walk the
 * platform; what is forced off is the seeder. Keying the panel to the environment meant a
 * deployed instance provisioned with those accounts offered no way to reach them, and an
 * instance with none still promised them locally.
 *
 * So the panel asks the record instead. Accounts present, panel shown. None, no panel,
 * and nothing to explain.
 */
export function demonstrationAccountsExist(): boolean {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM accounts WHERE is_demo = 1`)
    .get() as { n: number } | undefined;
  return (row?.n ?? 0) > 0;
}
