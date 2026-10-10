/**
 * Assembles RecordFacts from the database for one event or venue and runs the resolver.
 * The single call site the record page, the save action, the submit gate, the plan and
 * the reviewer use -- every server action recomputes from here rather than trusting a
 * screen (brief item 7).
 */

import { getDb } from './db';
import { eventPlanApproval } from './plan-approval';
import {
  assessmentsFor, attachmentsFor, invitationsFor, latestOutcomeFor, submissionFor, venueAssessmentsFor, venueAttachmentsFor, venueById,
  addedMeasuresFor, archiveWindowDays, beirutToday, derivedLevelFor,
} from './queries';
import { padFacilityForVenue } from './sites';
import { venuePackageEditable, type VenuePackageStatus } from './rules/venue-workflow';
import { siteConfirmationFor, siteForEvent, siteInformation, sitePatientAccessText, writeSiteSnapshot } from './event-site';
import { EVENT_FILE_KEYS, REQUESTED_KEYS } from './requirement-migration';
import {
  blocksFiling, CATALOGUE_REVISION, FACILITY_REFERENCE_KEY, siteAedAnswer, certificationComplete, declarationsAreComplete, isArchivedRecord,
  requirementBlockers, requirementSummary, resolvePlan, resolveRequirements,
  type AnswerValue, type AuthorRole, type Level, type PartyFact, type PlanSectionInstance, type RecordFacts, type RecordService,
  type RequirementInstance, type RequirementSummary, type StoredAnswer, type StoredFile,
} from './rules';

export interface RecordParty extends PartyFact {
  kind: 'ems' | 'director';
  email: string;
  invitedAt: string;
  answeredAt: string | null;
}

export interface RecordRequirements {
  service: RecordService;
  id: string;
  ownerId: number;
  level: Level | null;
  facts: RecordFacts | null;
  instances: RequirementInstance[];
  plan: PlanSectionInstance[];
  blockers: RequirementInstance[];
  summary: RequirementSummary;
  /** Whether answers may change now: not archived, the lifecycle active, and either unfiled or returned. */
  editable: boolean;
  filed: boolean;
  parties: RecordParty[];
  /** The plan version the Director's approval binds to, and the assessment version. */
  planVersion: number;
  assessmentVersion: number | null;
  approval: { by: string; at: string; planVersion: number } | null;
}

function answersFor(kind: RecordService, id: string): Record<string, StoredAnswer> {
  const rows = getDb()
    .prepare(`SELECT key, answers, author_role, author_name, version, saved_at FROM requirement_answers WHERE record_kind = ? AND record_id = ?`)
    .all(kind, id) as unknown as { key: string; answers: string; author_role: AuthorRole; author_name: string; version: number; saved_at: string }[];
  const out: Record<string, StoredAnswer> = {};
  for (const r of rows) {
    out[r.key] = { values: JSON.parse(r.answers) as Record<string, AnswerValue>, savedByRole: r.author_role, savedByName: r.author_name, savedAt: r.saved_at, version: r.version };
  }
  return out;
}

/** The catalogue key an event attachment's document key stands for. */
export function catalogueKeyForDocument(docKey: string): string | null {
  return Object.entries(EVENT_FILE_KEYS).find(([, d]) => d === docKey)?.[0] ?? null;
}

function organizerContactFor(ownerId: number): { name: string; phone: string } | null {
  const r = getDb().prepare(`SELECT display_name, phone FROM accounts WHERE id = ?`).get(ownerId) as { display_name: string; phone: string } | undefined;
  return r ? { name: r.display_name, phone: r.phone ?? '' } : null;
}

export function eventRecordRequirements(ownerId: number, eventId: string): RecordRequirements | null {
  const db = getDb();
  const event = db.prepare(`SELECT account_id, filed, lifecycle, archived_at, end_date FROM events WHERE id = ? AND account_id = ?`).get(eventId, ownerId) as
    { account_id: number; filed: number; lifecycle: string; archived_at: string | null; end_date: string | null } | undefined;
  if (!event) return null;
  const versions = assessmentsFor(ownerId, eventId);
  const latest = versions[0] ?? null;
  const level = latest?.derivation.finalLevel ?? derivedLevelFor(eventId);
  const archived = isArchivedRecord({ archivedAt: event.archived_at, endDate: event.end_date }, beirutToday(), archiveWindowDays());
  const outcome = latestOutcomeFor(eventId);
  const editable = !archived && event.lifecycle === 'active' && (event.filed === 0 || outcome === 'revision' || outcome === 'incomplete');
  const invitations = invitationsFor(ownerId, eventId);
  const parties: RecordParty[] = invitations
    .filter((i) => i.status !== 'withdrawn' && i.status !== 'removed')
    .map((i) => ({ kind: i.kind, token: i.token, name: i.nameEn, status: i.status, declarationSigned: i.declaration === 'signed', email: i.email, invitedAt: i.invitedAt, answeredAt: i.answeredAt }));
  const planRow = db.prepare(`SELECT version FROM plans WHERE event_id = ?`).get(eventId) as { version: number } | undefined;
  const approvalRow = eventPlanApproval(eventId);
  const base = {
    service: 'event' as const, id: eventId, ownerId, level, editable, filed: event.filed === 1, parties,
    planVersion: planRow?.version ?? 0, assessmentVersion: latest?.version ?? null,
    approval: approvalRow ? { by: approvalRow.display_name, at: approvalRow.approved_at, planVersion: approvalRow.plan_version } : null,
  };
  if (level === null) {
    return { ...base, facts: null, instances: [], plan: [], blockers: [], summary: { required: { total: 0, complete: 0, yours: 0, others: 0 }, recommended: { total: 0, complete: 0 }, later: 0 } };
  }
  const files: Record<string, StoredFile> = {};
  for (const a of attachmentsFor(ownerId, eventId)) {
    const key = catalogueKeyForDocument(a.docKey);
    if (key && a.hasFile) files[key] = { fileName: a.fileName, savedAt: a.attachedAt };
  }
  const submission = submissionFor(ownerId, eventId);
  const director = parties.find((p) => p.kind === 'director' && (p.status === 'confirmed' || p.status === 'nominated')) ?? null;
  const answers = answersFor('event', eventId);
  const facts: RecordFacts = {
    service: 'event',
    level,
    answers,
    site: eventSiteFacts(eventId, answers),
    files,
    organizerContact: organizerContactFor(ownerId),
    // A seeded row's level stands in for stored answers (the level is the assessment's product).
    assessmentComplete: latest ? latest.derivation.complete : level !== null,
    ems: parties.filter((p) => p.kind === 'ems'),
    director,
    planApprovalCurrent: approvalRow !== undefined,
    declaration: {
      statementsComplete: declarationsAreComplete(submission?.declarations ?? null, level),
      certificationComplete: certificationComplete('organizer', { representative: submission?.representative ?? '', telephone: submission?.telephone ?? '', position: submission?.position ?? '' }),
    },
    requested: addedMeasuresFor(eventId).filter((m) => !m.clearedAt).map((m) => REQUESTED_KEYS[m.catalogKey] ?? m.catalogKey),
    // A NEWLY REQUIRED DOCUMENT APPLIES FROM ITS EFFECTIVE DATE FORWARD (Ministry
    // ruling, 2026-08-29): a record filed before the requirement existed is never
    // blocked by it; a determined one stands, an undetermined one is asked through revision.
    waived: Object.entries(EVENT_FILE_KEYS)
      .filter(([, docKey]) => !blocksFiling(docKey, { today: beirutToday(), filedAt: submission?.filedAt?.slice(0, 10) ?? null, determined: outcome !== null }))
      .map(([key]) => key),
  };
  const instances = resolveRequirements(facts);
  return { ...base, facts, instances, plan: resolvePlan(facts, instances), blockers: requirementBlockers(instances), summary: requirementSummary(instances) };
}

/**
 * What the event's registered Facility/Site supplies to its rows, on the organizer's word only
 * (latest revision, sections 16 and 17). Null when the event names no site.
 */
function eventSiteFacts(eventId: string, answers: Readonly<Record<string, StoredAnswer>>): NonNullable<RecordFacts['site']> | null {
  const site = siteForEvent(eventId);
  if (!site) return null;
  const info = siteInformation(site.siteId);
  if (!info) return null;
  const aedReuse = info.aeds.length > 0 && siteAedAnswer(answers[FACILITY_REFERENCE_KEY]?.values) === 'yes';
  return {
    confirmed: siteConfirmationFor(eventId) !== null,
    patientAccess: sitePatientAccessText(info),
    aedReuse,
    aedLocations: info.aeds.map((a) => a.locationEn).filter((l) => l.trim() !== '').join('; '),
  };
}

export function venueRecordRequirements(ownerId: number, venueId: string): RecordRequirements | null {
  const db = getDb();
  const venue = venueById(ownerId, venueId);
  if (!venue) return null;
  const pkg = db.prepare(`SELECT status, assessment_version, work_revision FROM venue_packages WHERE venue_id = ?`).get(venueId) as { status: string; assessment_version: number | null; work_revision: number } | undefined;
  const versions = venueAssessmentsFor(ownerId, venueId);
  const assessmentVersion = pkg ? pkg.assessment_version : (versions[0]?.version ?? null);
  const status = pkg?.status ?? (venue.issued ? 'accepted' : 'draft');
  const derived = assessmentVersion ? versions.find((v) => v.version === assessmentVersion)?.derivation.finalLevel ?? null : null;
  const level = (status === 'accepted' && venue.level ? venue.level : derived) as Level | null;
  const editable = venuePackageEditable(status as VenuePackageStatus, Boolean(venue.archivedAt));
  // A hosting venue names no EMS agency and no Medical Director (Hosting Venue Registration,
  // 8 October 2026): those belong to each event held there. Its AEDs come from the PAD facility
  // registration on the same site.
  const parties: RecordParty[] = [];
  const base = {
    service: 'venue' as const, id: venueId, ownerId, level, editable, filed: status !== 'draft', parties,
    planVersion: pkg?.work_revision ?? 0, assessmentVersion,
    approval: null,
  };
  if (level === null) {
    return { ...base, facts: null, instances: [], plan: [], blockers: [], summary: { required: { total: 0, complete: 0, yours: 0, others: 0 }, recommended: { total: 0, complete: 0 }, later: 0 } };
  }
  const files: Record<string, StoredFile> = {};
  for (const a of venueAttachmentsFor(ownerId, venueId)) if (a.hasFile) files[a.docKey] = { fileName: a.fileName, savedAt: a.attachedAt };
  const pad = padFacilityForVenue(venueId);
  const facts: RecordFacts = {
    service: 'venue',
    level,
    answers: answersFor('venue', venueId),
    files,
    organizerContact: venue.responsibleName && venue.responsiblePhone ? { name: venue.responsibleName, phone: venue.responsiblePhone } : null,
    assessmentComplete: assessmentVersion !== null,
    ems: [],
    director: null,
    planApprovalCurrent: false,
    declaration: { statementsComplete: true, certificationComplete: true },
    requested: [],
    padFacility: pad ? { id: pad.facilityId, nameEn: pad.nameEn, nameAr: pad.nameAr, devices: pad.devices.length } : null,
  };
  const instances = resolveRequirements(facts);
  return { ...base, facts, instances, plan: resolvePlan(facts, instances), blockers: requirementBlockers(instances), summary: requirementSummary(instances) };
}

export function recordRequirementsFor(kind: RecordService, ownerId: number, id: string): RecordRequirements | null {
  return kind === 'event' ? eventRecordRequirements(ownerId, id) : venueRecordRequirements(ownerId, id);
}

/**
 * The frozen package the Ministry reads: the instances, the plan, the parties, the
 * approval and the files as they stood at filing. Null for a record filed before the
 * record page existed -- the reviewer then reads the live tables, as before.
 */
export interface RequirementSnapshot {
  id: number;
  version: number;
  catalogueRevision: string;
  filedAt: string;
  level: Level;
  instances: RequirementInstance[];
  plan: PlanSectionInstance[];
  parties: RecordParty[];
  approval: RecordRequirements['approval'];
  files: { key: string; fileName: string; contentType: string; hasFile: boolean }[];
}

export function requirementSnapshotFor(kind: RecordService, id: string, version?: number): RequirementSnapshot | null {
  const db = getDb();
  const row = (version
    ? db.prepare(`SELECT id, version, catalogue_revision, snapshot, filed_at FROM requirement_snapshots WHERE record_kind = ? AND record_id = ? AND version = ?`).get(kind, id, version)
    : db.prepare(`SELECT id, version, catalogue_revision, snapshot, filed_at FROM requirement_snapshots WHERE record_kind = ? AND record_id = ? ORDER BY version DESC LIMIT 1`).get(kind, id)
  ) as { id: number; version: number; catalogue_revision: string; snapshot: string; filed_at: string } | undefined;
  if (!row) return null;
  const body = JSON.parse(row.snapshot) as { level: Level; instances: RequirementInstance[]; plan: PlanSectionInstance[]; parties: RecordParty[]; approval: RecordRequirements['approval'] };
  const files = db.prepare(`SELECT key, file_name, content_type, (bytes IS NOT NULL AND length(bytes) > 0) AS has_file FROM requirement_snapshot_files WHERE snapshot_id = ?`).all(row.id) as unknown as
    { key: string; file_name: string; content_type: string; has_file: number }[];
  return {
    id: row.id, version: row.version, catalogueRevision: row.catalogue_revision, filedAt: row.filed_at,
    level: body.level, instances: body.instances, parties: body.parties, approval: body.approval,
    // A snapshot frozen before plan sections carried a progress state reads as complete or pending.
    plan: body.plan.map((p) => ({ ...p, progress: p.progress ?? (p.complete ? 'complete' : 'pending'), lacking: p.lacking ?? [] })),
    files: files.map((f) => ({ key: f.key, fileName: f.file_name, contentType: f.content_type, hasFile: f.has_file === 1 })),
  };
}

/** Lists every frozen version, newest first, for the history block. */
export function requirementSnapshotVersions(kind: RecordService, id: string): { version: number; filedAt: string }[] {
  return (getDb().prepare(`SELECT version, filed_at FROM requirement_snapshots WHERE record_kind = ? AND record_id = ? ORDER BY version DESC`).all(kind, id) as unknown as { version: number; filed_at: string }[])
    .map((r) => ({ version: r.version, filedAt: r.filed_at }));
}

/**
 * Freezes the current package. Called inside the filing transaction; the version is
 * the submission's version so the two histories line up.
 */
export function writeRequirementSnapshot(kind: RecordService, record: RecordRequirements, version: number): void {
  const db = getDb();
  const { level, instances, plan, parties, approval } = record;
  const result = db.prepare(
    `INSERT INTO requirement_snapshots (record_kind, record_id, version, catalogue_revision, snapshot, filed_at)
     VALUES (?, ?, ?, ?, ?, now_stamp())
     ON CONFLICT (record_kind, record_id, version) DO UPDATE SET snapshot = excluded.snapshot, catalogue_revision = excluded.catalogue_revision, filed_at = now_stamp()`,
  ).run(kind, record.id, version, CATALOGUE_REVISION, JSON.stringify({ level, instances, plan, parties, approval }));
  const snapshotId = db.prepare(`SELECT id FROM requirement_snapshots WHERE record_kind = ? AND record_id = ? AND version = ?`).get(kind, record.id, version) as { id: number };
  void result;
  db.prepare(`DELETE FROM requirement_snapshot_files WHERE snapshot_id = ?`).run(snapshotId.id);
  if (kind === 'event') {
    for (const [key, docKey] of Object.entries(EVENT_FILE_KEYS)) {
      db.prepare(
        `INSERT INTO requirement_snapshot_files (snapshot_id, key, file_name, content_type, bytes)
         SELECT ?, ?, file_name, COALESCE(content_type, ''), bytes FROM event_attachments WHERE event_id = ? AND doc_key = ? AND bytes IS NOT NULL`,
      ).run(snapshotId.id, key, record.id, docKey);
    }
    // The Site information the event relied on, frozen with the same submission version
    // (latest revision, section 1): a later edit to the site record never rewrites it.
    writeSiteSnapshot(record.id, version, siteAedAnswer(record.facts?.answers[FACILITY_REFERENCE_KEY]?.values));
  } else {
    db.prepare(
      `INSERT INTO requirement_snapshot_files (snapshot_id, key, file_name, content_type, bytes)
       SELECT ?, doc_key, file_name, content_type, bytes FROM venue_attachments WHERE venue_id = ? AND bytes IS NOT NULL AND length(bytes) > 0`,
    ).run(snapshotId.id, record.id);
  }
}
