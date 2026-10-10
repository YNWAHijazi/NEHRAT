import { getDb } from './db';
import { beirutToday, nowStamp } from './clock';
import { facilityDesignation, facilitySnapshot, siteEventVenueThreshold } from './facility-gis';
import { derivedLevelFor, facilityLedgerFor, facilityPlanConfirmation } from './queries';
import { facilityInfrastructure, saveFacilityInfrastructure, type SiteInfrastructureAnswers } from './site-infrastructure';
import { demonstrationFilter } from './rules/scope';
import type { Level } from './rules/types';
import {
  siteApplicability,
  siteEventStage,
  siteRenewal,
  siteStatus,
  type Applicability,
  type SiteEventStageKey,
  type SiteRenewal,
  type SiteReviewActKind,
  type SiteStatusFacts,
  type SiteStatusKey,
} from './rules/site';

/**
 * THE FACILITY/SITE'S REGISTRATION RECORD (latest revision, 9 October 2026): what the site
 * submitted to the Ministry and what the Ministry did with it, read for the site's own record,
 * the Ministry's review screen and the queue. lib/rules/site.ts decides; this only reads and
 * writes. Every read that crosses accounts (the events held at the site, the queue) keeps the
 * demonstration boundary and projects only the fields its screen may show.
 */

/* ---------------- status ---------------- */

/** The facts the site status derives from, in one read. */
export function siteStatusFacts(facilityId: string): SiteStatusFacts {
  const d = getDb();
  const f = d.prepare('SELECT archived_at FROM facilities WHERE id = ?').get(facilityId) as { archived_at: string | null } | undefined;
  const latest = d.prepare('SELECT id FROM facility_submissions WHERE facility_id = ? ORDER BY version DESC LIMIT 1').get(facilityId) as { id: number } | undefined;
  const count = (d.prepare('SELECT COUNT(*) AS n FROM facility_submissions WHERE facility_id = ?').get(facilityId) as { n: number }).n;
  const acts = latest
    ? (d.prepare('SELECT kind FROM facility_review_acts WHERE facility_id = ? AND submission_id = ? ORDER BY id').all(facilityId, latest.id) as unknown as { kind: SiteReviewActKind }[]).map((a) => a.kind)
    : [];
  const open = (d.prepare(`SELECT COUNT(*) AS n FROM facility_requests WHERE facility_id = ? AND status = 'open' AND kind = 'corrective'`).get(facilityId) as { n: number }).n;
  const everAccepted = Boolean(d.prepare(`SELECT 1 FROM facility_review_acts WHERE facility_id = ? AND kind = 'accepted' LIMIT 1`).get(facilityId));
  return { archived: Boolean(f?.archived_at), submissionCount: count, actsOnLatest: acts, openCorrective: open, everAccepted, renewal: siteRenewalFor(facilityId).key };
}

/** Where the site's annual readiness confirmation and drill stand today, Asia/Beirut (lib/rules/site.ts siteRenewal). */
export function siteRenewalFor(facilityId: string, today: string = beirutToday()): SiteRenewal {
  return siteRenewal(facilityLedgerFor(facilityId, today));
}

export function siteStatusFor(facilityId: string): SiteStatusKey {
  return siteStatus(siteStatusFacts(facilityId));
}

/** Whether the site's category reaches it: automatic, by capacity, or by a Ministry designation. */
export function siteApplicabilityFor(facilityId: string): Applicability {
  const f = getDb().prepare('SELECT category_key, licensed_capacity FROM facilities WHERE id = ?').get(facilityId) as { category_key: string; licensed_capacity: number | null } | undefined;
  return siteApplicability({
    categoryKey: f?.category_key ?? '',
    capacity: f?.licensed_capacity ?? null,
    threshold: siteEventVenueThreshold(),
    designatedOn: facilityDesignation(facilityId)?.designatedAt ?? null,
  });
}

/* ---------------- documents ---------------- */

export interface SiteDocument {
  id: number;
  purpose: 'layoutMap' | 'evidence';
  docType: string;
  issuer: string;
  issueDate: string;
  reviewDate: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  uploadedAt: string;
}

/** The site's current documents: the layout map and the supporting evidence. Removed ones stay in the table, not here. */
export function siteDocuments(facilityId: string): SiteDocument[] {
  const rows = getDb()
    .prepare(`SELECT id, purpose, doc_type, issuer, issue_date, review_date, file_name, content_type, length(bytes) AS byte_size, uploaded_at
              FROM facility_documents WHERE facility_id = ? AND removed_at IS NULL AND bytes IS NOT NULL ORDER BY purpose, id DESC`)
    .all(facilityId) as unknown as { id: number; purpose: 'layoutMap' | 'evidence'; doc_type: string; issuer: string; issue_date: string; review_date: string; file_name: string; content_type: string; byte_size: number; uploaded_at: string }[];
  return rows.map((r) => ({ id: r.id, purpose: r.purpose, docType: r.doc_type, issuer: r.issuer, issueDate: r.issue_date, reviewDate: r.review_date, fileName: r.file_name, contentType: r.content_type, byteSize: r.byte_size, uploadedAt: r.uploaded_at }));
}

/** The supporting-evidence documents counted on the review page (section 8). */
export function evidenceDocumentCount(facilityId: string): number {
  return (getDb().prepare(`SELECT COUNT(*) AS n FROM facility_documents WHERE facility_id = ? AND purpose = 'evidence' AND removed_at IS NULL AND bytes IS NOT NULL`).get(facilityId) as { n: number }).n;
}

/** AED photographs on the site's devices. */
export function aedPhotoCount(facilityId: string): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM facility_device_photos WHERE facility_id = ? AND bytes IS NOT NULL').get(facilityId) as { n: number }).n;
}

/** Stores one document with its metadata; returns its id. The caller has checked ownership and the file. */
export function storeSiteDocument(facilityId: string, doc: { purpose: 'layoutMap' | 'evidence'; docType: string; issuer: string; issueDate: string; reviewDate: string; fileName: string; contentType: string; bytes: Buffer }, accountId: number): number {
  const d = getDb();
  if (doc.purpose === 'layoutMap') {
    // One layout map at a time: the earlier one is kept, marked removed, for the record.
    d.prepare(`UPDATE facility_documents SET removed_at = now_stamp() WHERE facility_id = ? AND purpose = 'layoutMap' AND removed_at IS NULL`).run(facilityId);
  }
  const r = d.prepare(`INSERT INTO facility_documents (facility_id, purpose, doc_type, issuer, issue_date, review_date, file_name, content_type, bytes, uploaded_by, uploaded_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now_stamp())`)
    .run(facilityId, doc.purpose, doc.docType, doc.issuer, doc.issueDate, doc.reviewDate, doc.fileName, doc.contentType, doc.bytes, accountId);
  return Number(r.lastInsertRowid);
}

/* ---------------- from a venue ---------------- */

/** The venue's V1-V6 answers, by field, onto the site's infrastructure keys (lib/site-infrastructure.ts). */
const VENUE_FIELDS: readonly [string, string, keyof SiteInfrastructureAnswers][] = [
  ['V1', 'configuration', 'configuration'], ['V1', 'zones', 'zones'],
  ['V2', 'entry', 'emergencyAccess'], ['V2', 'staging', 'ambulanceWaiting'],
  ['V3', 'routes', 'patientAccess'], ['V3', 'lifts', 'stretcherRoutes'],
  ['V4', 'exists', 'firstAidRoom'], ['V4', 'location', 'firstAidLocation'], ['V4', 'equipment', 'firstAidEquipment'],
  ['V5', 'systems', 'communications'],
  ['V6', 'notes', 'other'],
];

/**
 * A facility/site started from a venue reuses what the venue already recorded: its basic
 * infrastructure answers (V1-V6) and its layout map (the V1 file) are copied into the new
 * site's infrastructure. The venue keeps its own rows; nothing is moved. Returns whether
 * anything was copied.
 */
export function copyVenueInfrastructure(venueId: string, facilityId: string, accountId: number): boolean {
  const d = getDb();
  const rows = d.prepare(`SELECT key, answers FROM requirement_answers WHERE record_kind = 'venue' AND record_id = ? AND key IN ('V1','V2','V3','V4','V5','V6')`)
    .all(venueId) as unknown as { key: string; answers: string }[];
  const byKey = new Map(rows.map((r) => {
    try { return [r.key, JSON.parse(r.answers) as Record<string, unknown>] as const; } catch { return [r.key, {}] as const; }
  }));
  const answers: SiteInfrastructureAnswers = {};
  for (const [req, field, key] of VENUE_FIELDS) {
    const v = byKey.get(req)?.[field];
    if (typeof v === 'string' && v.trim()) answers[key] = v.trim();
  }
  const copied = Object.keys(answers).length > 0;
  if (copied) saveFacilityInfrastructure(facilityId, answers, accountId, nowStamp());
  const map = d.prepare(`SELECT file_name, content_type, bytes FROM venue_attachments WHERE venue_id = ? AND doc_key = 'V1' AND bytes IS NOT NULL`)
    .get(venueId) as { file_name: string; content_type: string; bytes: Uint8Array } | undefined;
  if (map?.bytes?.length) {
    storeSiteDocument(facilityId, { purpose: 'layoutMap', docType: '', issuer: '', issueDate: '', reviewDate: '', fileName: map.file_name, contentType: map.content_type, bytes: Buffer.from(map.bytes) }, accountId);
    return true;
  }
  return copied;
}

/* ---------------- submissions ---------------- */

export interface SiteSubmission { id: number; version: number; submittedAt: string; submittedBy: string; representative: string; position: string }

export function siteSubmissions(facilityId: string): SiteSubmission[] {
  return (getDb()
    .prepare(`SELECT s.id, s.version, s.submitted_at, s.representative, s.position, COALESCE(a.display_name, '') AS who FROM facility_submissions s LEFT JOIN accounts a ON a.id = s.submitted_by
              WHERE s.facility_id = ? ORDER BY s.version DESC`)
    .all(facilityId) as unknown as { id: number; version: number; submitted_at: string; who: string; representative: string; position: string }[])
    .map((r) => ({ id: r.id, version: r.version, submittedAt: r.submitted_at, submittedBy: r.who, representative: r.representative, position: r.position }));
}

/**
 * "Submit Facility/Site registration to MOPH" (revision section 8): a new version, frozen as
 * a snapshot of everything the Ministry reads -- the profile, the contact, the AEDs, the
 * infrastructure, the documents' metadata (never their bytes), the readiness confirmation
 * and the applicability -- so a later edit never rewrites what was submitted. Any open
 * Ministry request for information or a correction is answered by it and closes, naming the
 * version. Returns the version.
 */
export function submitSiteRegistration(facilityId: string, accountId: number, isDemo: boolean, declaration: { representative: string; position: string } = { representative: '', position: '' }): number {
  const d = getDb();
  const version = ((d.prepare('SELECT MAX(version) AS v FROM facility_submissions WHERE facility_id = ?').get(facilityId) as { v: number | null }).v ?? 0) + 1;
  const snapshot = JSON.stringify({
    ...(JSON.parse(facilitySnapshot(facilityId)) as Record<string, unknown>),
    infrastructure: facilityInfrastructure(facilityId)?.answers ?? {},
    documents: siteDocuments(facilityId).map(({ id, purpose, docType, issuer, issueDate, reviewDate, fileName, uploadedAt }) => ({ id, purpose, docType, issuer, issueDate, reviewDate, fileName, uploadedAt })),
    confirmation: facilityPlanConfirmation(facilityId),
    applicability: siteApplicabilityFor(facilityId).key,
  });
  d.prepare(`INSERT INTO facility_submissions (facility_id, version, snapshot, submitted_by, submitted_at, is_demo, representative, position) VALUES (?, ?, ?, ?, now_stamp(), ?, ?, ?)`)
    .run(facilityId, version, snapshot, accountId, isDemo ? 1 : 0, declaration.representative, declaration.position);
  d.prepare(`UPDATE facility_requests SET status = 'corrected', corrected_at = now_stamp(), close_note = ?, closed_by = 'operator'
             WHERE facility_id = ? AND status = 'open' AND kind IN ('information','correction')`)
    .run(`Answered by the updated registration, version ${version}.`, facilityId);
  return version;
}

/** One submitted version's snapshot, as stored. */
export function siteSubmissionSnapshot(facilityId: string, version: number): Record<string, unknown> | null {
  const r = getDb().prepare('SELECT snapshot FROM facility_submissions WHERE facility_id = ? AND version = ?').get(facilityId, version) as { snapshot: string } | undefined;
  return r ? (JSON.parse(r.snapshot) as Record<string, unknown>) : null;
}

/* ---------------- Ministry acts and requests ---------------- */

export interface SiteReviewAct { id: number; kind: SiteReviewActKind; note: string; inspectionDate: string | null; actor: string; at: string; version: number | null }

export function siteReviewActs(facilityId: string): SiteReviewAct[] {
  return (getDb()
    .prepare(`SELECT r.id, r.kind, r.note, r.inspection_date, r.actor_name, r.created_at, s.version FROM facility_review_acts r
              LEFT JOIN facility_submissions s ON s.id = r.submission_id WHERE r.facility_id = ? ORDER BY r.id DESC`)
    .all(facilityId) as unknown as { id: number; kind: SiteReviewActKind; note: string; inspection_date: string | null; actor_name: string; created_at: string; version: number | null }[])
    .map((r) => ({ id: r.id, kind: r.kind, note: r.note, inspectionDate: r.inspection_date, actor: r.actor_name, at: r.created_at, version: r.version }));
}

export interface SiteRequest {
  id: number;
  kind: 'corrective' | 'confirmation' | 'information' | 'correction';
  deficiency: string;
  bodyEn: string; bodyAr: string;
  note: string;
  due: string | null;
  status: 'open' | 'corrected';
  raisedBy: string;
  raisedAt: string;
  closedAt: string | null;
  closeNote: string | null;
  closedBy: string | null;
  responses: { id: number; note: string; documentId: number | null; fileName: string | null; at: string }[];
}

/** The Ministry's requests and corrective actions on the site, with the operator's answers. */
export function siteRequests(facilityId: string): SiteRequest[] {
  const d = getDb();
  const rows = d.prepare(`SELECT id, kind, deficiency, body_en, body_ar, note, due, status, raised_by, created_at, corrected_at, close_note, closed_by
                          FROM facility_requests WHERE facility_id = ? ORDER BY status = 'open' DESC, created_at DESC, id DESC`)
    .all(facilityId) as unknown as { id: number; kind: string; deficiency: string | null; body_en: string; body_ar: string; note: string | null; due: string | null; status: 'open' | 'corrected'; raised_by: string; created_at: string; corrected_at: string | null; close_note: string | null; closed_by: string | null }[];
  const responses = d.prepare(`SELECT r.id, r.note, r.document_id, r.responded_at, f.file_name FROM facility_request_responses r
                               LEFT JOIN facility_documents f ON f.id = r.document_id WHERE r.request_id = ? ORDER BY r.id`);
  return rows.map((r) => ({
    id: r.id,
    kind: (['confirmation', 'information', 'correction'].includes(r.kind) ? r.kind : 'corrective') as SiteRequest['kind'],
    deficiency: r.deficiency ?? '', bodyEn: r.body_en, bodyAr: r.body_ar, note: r.note ?? '', due: r.due,
    status: r.status, raisedBy: r.raised_by, raisedAt: r.created_at.slice(0, 10),
    closedAt: r.corrected_at ? r.corrected_at.slice(0, 10) : null, closeNote: r.close_note, closedBy: r.closed_by,
    responses: (responses.all(r.id) as unknown as { id: number; note: string; document_id: number | null; responded_at: string; file_name: string | null }[])
      .map((x) => ({ id: x.id, note: x.note, documentId: x.document_id, fileName: x.file_name, at: x.responded_at })),
  }));
}

/* ---------------- the events held at the site ---------------- */

export interface SiteEventRow {
  id: string;
  nameEn: string; nameAr: string;
  startDate: string | null; endDate: string | null;
  /** Planned, scheduled, cancelled or postponed -- never the organizer's steps (lib/rules/site.ts siteEventStage). */
  stage: SiteEventStageKey;
  statusEn: string; statusAr: string;
  /** The viewer's own event: it links to its record. */
  own: boolean;
}

const OUTCOME = `(SELECT dt.outcome FROM determinations dt WHERE dt.event_id = e.id ORDER BY dt.recorded_at DESC, dt.id DESC LIMIT 1)`;

/**
 * The events linked to this site (events.site_id), inside the site's demonstration boundary.
 * The viewer's own events link to their records. Another organizer's event is read through a
 * projection that selects only its name, dates, record id and the facts its level and status
 * derive from -- the field limit is the SQL, not a filter at render.
 */
export function siteEventsFor(viewerAccountId: number, siteId: string, isDemo: boolean): SiteEventRow[] {
  const d = getDb();
  const flag = isDemo ? 1 : 0;
  const own = d.prepare(`SELECT e.id, e.name_en, e.name_ar, e.start_date, e.end_date, e.filed, e.lifecycle, ${OUTCOME} AS outcome
                         FROM events e WHERE e.site_id = ? AND e.is_demo = ? AND e.account_id = ? AND e.archived_at IS NULL ORDER BY e.start_date, e.id`)
    .all(siteId, flag, viewerAccountId) as unknown as { id: string; name_en: string; name_ar: string; start_date: string | null; end_date: string | null; filed: number; lifecycle: string; outcome: string | null }[];
  const others = d.prepare(`SELECT e.id, e.name_en, e.name_ar, e.start_date, e.end_date, e.filed, e.lifecycle, ${OUTCOME} AS outcome
                            FROM events e WHERE e.site_id = ? AND e.is_demo = ? AND e.account_id <> ? AND e.archived_at IS NULL ORDER BY e.start_date, e.id`)
    .all(siteId, flag, viewerAccountId) as unknown as { id: string; name_en: string; name_ar: string; start_date: string | null; end_date: string | null; filed: number; lifecycle: string; outcome: string | null }[];
  const row = (r: (typeof own)[number], mine: boolean): SiteEventRow => {
    const st = siteEventStage(r);
    return { id: r.id, nameEn: r.name_en, nameAr: r.name_ar || r.name_en, startDate: r.start_date, endDate: r.end_date, stage: st.key, statusEn: st.en, statusAr: st.ar, own: mine };
  };
  return [...own.map((r) => row(r, true)), ...others.map((r) => row(r, false))]
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '') || a.id.localeCompare(b.id));
}

/** Events at the site that have not yet ended (Asia/Beirut), for the overview's count. Cancelled ones do not count. */
/**
 * THE SITE OWNER'S RECEIPT for an event scheduled at the site (owner, 10 October 2026): the event's
 * name, dates, record id and Ministry reference, and the date the Ministry completed its review.
 * Only for an event linked to this facility's site, on the same side of the demonstration line,
 * once the Ministry has recorded its requirements satisfied. Never the organizer's contacts,
 * documents or answers.
 */
export interface SiteEventReceipt {
  id: string; nameEn: string; nameAr: string;
  startDate: string | null; endDate: string | null;
  reference: string | null;
  reviewedOn: string;
}
export function siteEventReceipt(facilityId: string, eventId: string): SiteEventReceipt | null {
  const row = getDb().prepare(
    `SELECT e.id, e.name_en, e.name_ar, e.start_date, e.end_date, e.moph_reference, e.lifecycle,
            (SELECT dt.outcome FROM determinations dt WHERE dt.event_id = e.id ORDER BY dt.recorded_at DESC, dt.id DESC LIMIT 1) AS outcome,
            (SELECT dt.recorded_at FROM determinations dt WHERE dt.event_id = e.id ORDER BY dt.recorded_at DESC, dt.id DESC LIMIT 1) AS recorded_at
     FROM events e JOIN facilities f ON f.site_id = e.site_id AND f.is_demo = e.is_demo
     WHERE e.id = ? AND f.id = ? AND e.archived_at IS NULL`,
  ).get(eventId, facilityId) as
    | { id: string; name_en: string; name_ar: string; start_date: string | null; end_date: string | null; moph_reference: string | null; lifecycle: string; outcome: string | null; recorded_at: string | null }
    | undefined;
  if (!row || siteEventStage(row).key !== 'scheduled') return null;
  return { id: row.id, nameEn: row.name_en, nameAr: row.name_ar || row.name_en, startDate: row.start_date, endDate: row.end_date, reference: row.moph_reference, reviewedOn: (row.recorded_at ?? '').slice(0, 10) };
}

export function upcomingSiteEventCount(siteId: string, isDemo: boolean, today: string): number {
  return (getDb().prepare(`SELECT COUNT(*) AS n FROM events WHERE site_id = ? AND is_demo = ? AND archived_at IS NULL AND lifecycle <> 'cancelled'
                           AND COALESCE(end_date, start_date) >= ?`).get(siteId, isDemo ? 1 : 0, today) as { n: number }).n;
}

/** The events an incident at the site may be linked to: id, name and dates only. */
export function siteEventChoices(siteId: string, isDemo: boolean): { id: string; nameEn: string; nameAr: string; startDate: string | null; endDate: string | null }[] {
  return (getDb().prepare(`SELECT id, name_en, name_ar, start_date, end_date FROM events WHERE site_id = ? AND is_demo = ? AND archived_at IS NULL ORDER BY start_date DESC, id`)
    .all(siteId, isDemo ? 1 : 0) as unknown as { id: string; name_en: string; name_ar: string; start_date: string | null; end_date: string | null }[])
    .map((r) => ({ id: r.id, nameEn: r.name_en, nameAr: r.name_ar || r.name_en, startDate: r.start_date, endDate: r.end_date }));
}

/* ---------------- the Ministry's queue ---------------- */

export interface SiteQueueRow {
  facilityId: string;
  siteId: string | null;
  nameEn: string; nameAr: string;
  categoryKey: string;
  municipality: string;
  /** The operating organization on the site profile. */
  operator: string;
  version: number;
  submittedAt: string;
  status: SiteStatusKey;
  /** Who took the latest submission (the review-started act), '' while nobody has. */
  reviewer: string;
}

/**
 * The Facility/Site review queue (revision section 9): every site submitted at least once,
 * inside the viewer's demonstration boundary -- demonstration sites never reach a real queue.
 * Those awaiting the Ministry come first.
 */
export function siteReviewQueue(viewerIsDemo: boolean): SiteQueueRow[] {
  const flag = demonstrationFilter('reviewerQueue', { isDemonstration: viewerIsDemo }).isDemo ? 1 : 0;
  const rows = getDb().prepare(`SELECT f.id, f.site_id, f.name_en, f.name_ar, f.category_key, f.municipality_en, f.operating_organization, s.version, s.submitted_at,
                                  (SELECT r.actor_name FROM facility_review_acts r WHERE r.submission_id = s.id AND r.kind = 'reviewStarted' ORDER BY r.id DESC LIMIT 1) AS reviewer
                                FROM facilities f JOIN facility_submissions s ON s.facility_id = f.id
                                  AND s.version = (SELECT MAX(version) FROM facility_submissions WHERE facility_id = f.id)
                                WHERE f.is_demo = ? ORDER BY s.submitted_at`)
    .all(flag) as unknown as { id: string; site_id: string | null; name_en: string; name_ar: string; category_key: string; municipality_en: string; operating_organization: string; version: number; submitted_at: string; reviewer: string | null }[];
  const order: SiteStatusKey[] = ['submitted', 'underReview', 'informationRequired', 'correctiveActionRequired', 'expired', 'expiringSoon', 'readinessCurrent', 'noLongerCovered', 'inPreparation'];
  return rows
    .map((r) => ({ facilityId: r.id, siteId: r.site_id, nameEn: r.name_en, nameAr: r.name_ar || r.name_en, categoryKey: r.category_key, municipality: r.municipality_en, operator: r.operating_organization, version: r.version, submittedAt: r.submitted_at, status: siteStatusFor(r.id), reviewer: r.reviewer ?? '' }))
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.submittedAt.localeCompare(b.submittedAt));
}

/* ---------------- history ---------------- */

export interface SiteHistoryEntry { at: string; en: string; ar: string; detail: string }

/**
 * The site's changes after registration (revision section 14), newest first: profile and
 * contact saves, AED registrations and updates. The Ministry reads them in the history.
 */
export function siteChanges(facilityId: string): SiteHistoryEntry[] {
  const d = getDb();
  const profile = d.prepare(`SELECT p.created_at, COALESCE(a.display_name, '') AS who FROM facility_profile_updates p LEFT JOIN accounts a ON a.id = p.actor_id WHERE p.facility_id = ?`)
    .all(facilityId) as unknown as { created_at: string; who: string }[];
  const devices = d.prepare(`SELECT created_at, device_label, purpose, representative FROM facility_device_updates WHERE facility_id = ?`)
    .all(facilityId) as unknown as { created_at: string; device_label: string; purpose: string; representative: string }[];
  const purposes = new Map<string, { en: string; ar: string }>([
    ['initial', { en: 'AED registered', ar: 'سُجّل جهاز' }], ['relocation', { en: 'AED relocated', ar: 'نُقل جهاز' }],
    ['replacement', { en: 'AED replaced', ar: 'استُبدل جهاز' }], ['statusChange', { en: 'AED operational status changed', ar: 'تغيّرت الحالة التشغيلية لجهاز' }],
    ['accessibility', { en: 'AED accessibility changed', ar: 'تغيّرت إمكانية الوصول إلى جهاز' }], ['ministryUpdate', { en: 'AED updated at the Ministry’s request', ar: 'حُدّث جهاز بطلب من الوزارة' }],
  ]);
  return [
    ...profile.map((p) => ({ at: p.created_at, en: 'Site details or contact saved', ar: 'حُفظت تفاصيل الموقع أو جهة الاتصال', detail: p.who })),
    ...devices.map((u) => ({ at: u.created_at, ...(purposes.get(u.purpose) ?? { en: 'AED record updated', ar: 'حُدّث سجل جهاز' }), detail: `${u.device_label} · ${u.representative}` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}
