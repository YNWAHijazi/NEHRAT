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
    venueFacilityId: row.venue_facility_id,
  };
}

const EVENT_COLUMNS = `id, name_en, name_ar, start_date, end_date, moph_reference, filed,
   demo_state_en, demo_state_ar, demo_due, demo_due_label_en, demo_due_label_ar,
   demo_stage, demo_stage_en, demo_stage_ar, demo_stages, demo_span, demo_level, created_at, venue_facility_id`;

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
    .prepare(`SELECT mode, ref_confirmed, sections, attached_file, major_incident, version, updated_at FROM plans WHERE event_id = ?`)
    .get(eventId) as
    | { mode: 'write' | 'attach'; ref_confirmed: number; sections: string; attached_file: string | null; major_incident: string; version: number; updated_at: string }
    | undefined;
  if (!r) return null;
  return {
    mode: r.mode,
    refConfirmed: r.ref_confirmed === 1,
    sections: JSON.parse(r.sections) as PlanRow['sections'],
    attachedFile: r.attached_file,
    majorIncident: JSON.parse(r.major_incident) as PlanRow['majorIncident'],
    version: r.version,
    updatedAt: r.updated_at,
  };
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
}

export function submissionFor(accountId: number, eventId: string): SubmissionRow | null {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return null;
  const r = getDb()
    .prepare(`SELECT declarations, insurance, representative, telephone, position, expedited, filed_at, moph_reference FROM submissions WHERE event_id = ?`)
    .get(eventId) as
    | { declarations: string; insurance: string; representative: string; telephone: string; position: string; expedited: number; filed_at: string | null; moph_reference: string | null }
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
  };
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

  const planComplete =
    plan !== null &&
    (plan.mode === 'attach'
      ? plan.attachedFile !== null &&
        Array.from({ length: 16 }, (_, i) => plan.sections[String(i + 1)]?.covered === true).every(Boolean)
      : Array.from({ length: 16 }, (_, i) => {
          const s = plan.sections[String(i + 1)];
          return Boolean(s?.text && s.text.trim() !== '') || s?.covered === true;
        }).every(Boolean));

  const declCount = level === 3 ? 8 : 7; // insurance applies at Level 3 only
  const declarationsComplete =
    submission !== null &&
    Array.from({ length: declCount }, (_, i) => submission.declarations[String(i)] === true).every(Boolean);

  return {
    assessment: true,
    arrangements: attached.has('arrangements'),
    complianceForm: declarationsComplete,
    plan: planComplete,
    siteMap: attached.has('siteMap'),
    deploymentMap: attached.has('deploymentMap'),
    emsDeclarations: providers.length > 0 && providers.every((p) => p.declaration === 'signed'),
    other: attached.has('other'),
  };
}

export function facilityById(accountId: number, facilityId: string): FacilityRow | null {
  return facilitiesFor(accountId).find((f) => f.id === facilityId) ?? null;
}

export function seriousIncidentNotificationFor(accountId: number, eventId: string): string | null {
  const owned = getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId);
  if (!owned) return null;
  const r = getDb()
    .prepare(`SELECT notified_at FROM serious_incident_notifications WHERE event_id = ? ORDER BY notified_at LIMIT 1`)
    .get(eventId) as { notified_at: string } | undefined;
  return r?.notified_at ?? null;
}

/* ---------------- Slice 3: the venue service ---------------- */

export interface VenueDetail extends VenueRow {
  category: string;
  addressMunicipality: string;
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
      `SELECT id, name_en, name_ar, category, address_municipality, responsible_contact,
              licensed_capacity, regularly_hosts, is_nightclub, level, issued, valid_until,
              moph_reference, created_at
       FROM venues WHERE id = ? AND account_id = ?`,
    )
    .get(venueId, accountId) as
    | {
        id: string; name_en: string; name_ar: string; category: string;
        address_municipality: string; responsible_contact: string;
        licensed_capacity: number | null; regularly_hosts: number; is_nightclub: number;
        level: number | null; issued: string | null; valid_until: string | null;
        moph_reference: string | null; created_at: string;
      }
    | undefined;
  if (!r) return null;
  return {
    id: r.id, nameEn: r.name_en, nameAr: r.name_ar,
    category: r.category, addressMunicipality: r.address_municipality,
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
