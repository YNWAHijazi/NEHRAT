/**
 * Read-side queries for the organizer surfaces. Ownership is enforced here: every query
 * is scoped to the session's account, so a foreign record and a missing record are the
 * same absence -- indistinguishable by status.
 */

import { getDb } from './db';
import { deriveLevel } from './rules';
import type { DomainAnswers, Level, LevelDerivation, MinimumConditionInputs } from './rules';

export interface EventRow {
  id: string;
  nameEn: string;
  nameAr: string;
  startDate: string | null;
  endDate: string | null;
  mophReference: string | null;
  filed: boolean;
  level: Level | null;
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

function toEventRow(row: EventDbRow): EventRow {
  const derivation = latestDerivation(row.id);
  const level =
    derivation?.finalLevel ?? (row.demo_level as Level | null) ?? null;
  return {
    id: row.id,
    nameEn: row.name_en,
    nameAr: row.name_ar,
    startDate: row.start_date,
    endDate: row.end_date,
    mophReference: row.moph_reference,
    filed: row.filed === 1,
    level,
    stateEn: row.demo_state_en ?? (derivation?.complete ? 'Assessed — not submitted' : 'Assessment in progress'),
    stateAr: row.demo_state_ar ?? (derivation?.complete ? 'مُقيَّمة — غير مقدَّمة' : 'التقييم قيد الإجراء'),
    due: row.demo_due,
    dueLabelEn: row.demo_due_label_en ?? 'File by',
    dueLabelAr: row.demo_due_label_ar ?? 'التقديم بحلول',
    stage: row.demo_stage,
    stageEn: row.demo_stage_en ?? '',
    stageAr: row.demo_stage_ar ?? '',
    stages: row.demo_stages ? (JSON.parse(row.demo_stages) as string[]) : [],
    span: row.demo_span ?? 60,
    createdAt: row.created_at,
  };
}

const EVENT_COLUMNS = `id, name_en, name_ar, start_date, end_date, moph_reference, filed,
   demo_state_en, demo_state_ar, demo_due, demo_due_label_en, demo_due_label_ar,
   demo_stage, demo_stage_en, demo_stage_ar, demo_stages, demo_span, demo_level, created_at`;

export function eventsFor(accountId: number): EventRow[] {
  const rows = getDb()
    .prepare(`SELECT ${EVENT_COLUMNS} FROM events WHERE account_id = ? ORDER BY created_at DESC`)
    .all(accountId) as unknown as EventDbRow[];
  return rows.map(toEventRow);
}

/** Scoped to the owner: a foreign id returns null exactly like a missing one. */
export function eventFor(accountId: number, eventId: string): EventRow | null {
  const row = getDb()
    .prepare(`SELECT ${EVENT_COLUMNS} FROM events WHERE id = ? AND account_id = ?`)
    .get(eventId, accountId) as unknown as EventDbRow | undefined;
  return row ? toEventRow(row) : null;
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

export function facilitiesFor(accountId: number): FacilityRow[] {
  const rows = getDb()
    .prepare(`SELECT id, name_en, name_ar, category_en, category_ar, devices, next_lapse, state_en, state_ar, state_kind FROM facilities WHERE account_id = ?`)
    .all(accountId) as unknown as { id: string; name_en: string; name_ar: string; category_en: string | null; category_ar: string | null; devices: number; next_lapse: string | null; state_en: string | null; state_ar: string | null; state_kind: string | null }[];
  return rows.map((r) => ({
    id: r.id, nameEn: r.name_en, nameAr: r.name_ar,
    categoryEn: r.category_en ?? '', categoryAr: r.category_ar ?? '',
    devices: r.devices, nextLapse: r.next_lapse,
    stateEn: r.state_en ?? '', stateAr: r.state_ar ?? '', stateKind: r.state_kind ?? 'ok',
  }));
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
