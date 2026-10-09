'use server';

/**
 * The facility/site operator's actions added by the latest revision (9 October 2026): the
 * basic site infrastructure, the supporting evidence, "Submit Facility/Site registration to
 * MOPH", and the answer to a Ministry corrective action. Each checks ownership and the
 * archived state on the server; every rule it applies comes from lib/rules.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentAccount } from '../lib/auth';
import { getDb } from '../lib/db';
import { nowStamp } from '../lib/clock';
import { INFRASTRUCTURE_KEYS, saveFacilityInfrastructure, type SiteInfrastructureAnswers } from '../lib/site-infrastructure';
import { siteStatusFacts, storeSiteDocument, submitSiteRegistration } from '../lib/site-registration';
import { facilityRegistrationFacts } from '../lib/facility-registration';
import { facilityReadyToSubmit, facilityRecordMode } from '../lib/rules/facility-workflow';
import { CORRECTIVE_RESPONSE_TYPE, evidenceTypes, isIsoDate, siteMaySubmit, siteRecordLocked } from '../lib/rules/site';
import { can } from '../lib/rules/ministry';
import { refuseUpload } from '../lib/rules/uploads';

type Owner = { accountId: number; isDemo: boolean };

/** The signed-in owner of a live facility/site, or a redirect: sign-in, the dashboard, or the read-only record. */
async function owner(facilityId: string): Promise<Owner> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const row = getDb().prepare('SELECT account_id, archived_at FROM facilities WHERE id = ?').get(facilityId) as { account_id: number; archived_at: string | null } | undefined;
  if (!row || row.account_id !== account.id) redirect('/dashboard');
  if (row.archived_at) redirect(`/facilities/${facilityId}?error=archived`);
  return { accountId: account.id, isDemo: account.isDemo };
}

/** The owner, for an edit: refused while the registration is with the Ministry and not yet accepted, as a filed event's is. */
async function editor(facilityId: string): Promise<Owner> {
  const o = await owner(facilityId);
  if (siteRecordLocked(siteStatusFacts(facilityId))) redirect(`/facilities/${facilityId}?error=locked`);
  return o;
}

/** Where a save lands: the step while in preparation, the matching tab once submitted. */
function back(facilityId: string, step: string, tab: string, query: Record<string, string>, anchor: string): string {
  const managing = facilityRecordMode(facilityRegistrationFacts(facilityId)) === 'manage';
  const params = new URLSearchParams(managing ? { tab, ...query } : { step, ...query });
  return `/facilities/${facilityId}?${params.toString()}#${anchor}`;
}

function answersFrom(formData: FormData): SiteInfrastructureAnswers {
  const out: SiteInfrastructureAnswers = {};
  for (const k of INFRASTRUCTURE_KEYS) {
    const v = String(formData.get(k) ?? '').trim();
    if (v) out[k] = v;
  }
  // The first-aid room's location and contents mean nothing without the room.
  if (out.firstAidRoom !== 'yes') { delete out.firstAidLocation; delete out.firstAidEquipment; }
  if (out.configuration && !['indoor', 'outdoor', 'both'].includes(out.configuration)) delete out.configuration;
  if (out.firstAidRoom && !['yes', 'no'].includes(out.firstAidRoom)) delete out.firstAidRoom;
  return out;
}

/** A file from the form, checked against the allow-list before anything is written. Null when none was chosen. */
async function fileFrom(formData: FormData, name: string): Promise<{ file: File; bytes: Buffer } | { refused: string } | null> {
  const file = formData.get(name);
  if (!(file instanceof File) || file.size === 0) return null;
  const refusal = refuseUpload({ type: file.type, size: file.size });
  if (refusal) return { refused: refusal.reason };
  return { file, bytes: Buffer.from(await file.arrayBuffer()) };
}

/**
 * Basic site infrastructure (revision section 3), with its optional layout map. Optional and
 * never a blocker: an empty save is a valid save. Written whole through the shared contract
 * events read (lib/site-infrastructure.ts).
 */
export async function saveSiteInfrastructureAction(facilityId: string, formData: FormData): Promise<void> {
  const o = await editor(facilityId);
  const map = await fileFrom(formData, 'layoutMap');
  if (map && 'refused' in map) redirect(back(facilityId, 'infrastructure', 'overview', { error: `layout-${map.refused}` }, 'infrastructure'));
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    saveFacilityInfrastructure(facilityId, answersFrom(formData), o.accountId, nowStamp());
    if (map && !('refused' in map)) {
      storeSiteDocument(facilityId, { purpose: 'layoutMap', docType: '', issuer: '', issueDate: '', reviewDate: '', fileName: map.file.name.trim() || 'layout-map', contentType: map.file.type, bytes: map.bytes }, o.accountId);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  revalidatePath(`/facilities/${facilityId}`);
  redirect(back(facilityId, 'infrastructure', 'overview', { notice: 'infrastructure' }, 'infrastructure'));
}

/** The same save on the step path's Next (components/record/autosave.ts): answers only, no file. */
export async function autosaveSiteInfrastructureAction(facilityId: string, formData: FormData): Promise<{ ok: true }> {
  const o = await editor(facilityId);
  saveFacilityInfrastructure(facilityId, answersFrom(formData), o.accountId, nowStamp());
  revalidatePath(`/facilities/${facilityId}`);
  return { ok: true };
}

/**
 * Supporting evidence -- optional (revision section 7): a document with its type, issuer,
 * issue date and expiry or review date where the document states one. Evidence only: it
 * never moves the status and never stands in for a requirement.
 */
export async function addSiteEvidenceAction(facilityId: string, formData: FormData): Promise<void> {
  const o = await editor(facilityId);
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const type = s('docType');
  const upload = await fileFrom(formData, 'document');
  if (!upload) redirect(back(facilityId, 'evidence', 'documents', { error: 'evidence-file' }, 'evidence'));
  if ('refused' in upload) redirect(back(facilityId, 'evidence', 'documents', { error: `evidence-${upload.refused}` }, 'evidence'));
  if (!evidenceTypes().some((t) => t.key === type) || (s('issueDate') && !isIsoDate(s('issueDate'))) || (s('reviewDate') && !isIsoDate(s('reviewDate')))) {
    redirect(back(facilityId, 'evidence', 'documents', { error: 'evidence-details' }, 'evidence'));
  }
  storeSiteDocument(facilityId, { purpose: 'evidence', docType: type, issuer: s('issuer'), issueDate: s('issueDate'), reviewDate: s('reviewDate'), fileName: upload.file.name.trim() || 'document', contentType: upload.file.type, bytes: upload.bytes }, o.accountId);
  revalidatePath(`/facilities/${facilityId}`);
  redirect(back(facilityId, 'evidence', 'documents', { notice: 'evidence' }, 'evidence'));
}

/** Removes a document from the site's current set. The row stays, marked removed: a submitted snapshot may name it. */
export async function removeSiteDocumentAction(facilityId: string, documentId: number): Promise<void> {
  await editor(facilityId);
  getDb().prepare('UPDATE facility_documents SET removed_at = now_stamp() WHERE id = ? AND facility_id = ? AND removed_at IS NULL').run(documentId, facilityId);
  revalidatePath(`/facilities/${facilityId}`);
  redirect(back(facilityId, 'evidence', 'documents', { notice: 'removed' }, 'evidence'));
}

/**
 * "Submit Facility/Site registration to MOPH" (revision section 8), as an event files: the
 * declaration signed by the representative, refused while a required item is open or while
 * the status does not take a submission. A resubmission archives the version it replaces
 * (each is kept, frozen -- lib/site-registration.ts) and the record ID does not change. The
 * reviewers are notified, as on a venue submission; the operator lands on the
 * acknowledgment of receipt, as an organizer does.
 */
export async function submitSiteRegistrationAction(facilityId: string, formData: FormData = new FormData()): Promise<void> {
  const o = await owner(facilityId);
  const facts = facilityRegistrationFacts(facilityId);
  const representative = String(formData.get('representative') ?? '').trim();
  const position = String(formData.get('position') ?? '').trim();
  if (!siteMaySubmit(facts.status)) redirect(`/facilities/${facilityId}?error=not-open`);
  if (!facilityReadyToSubmit(facts) || formData.get('confirm') !== 'yes' || !representative || !position) {
    redirect(back(facilityId, 'review', 'overview', { error: 'submit' }, facts.everAccepted ? 'resubmit' : 'final-review'));
  }
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const version = submitSiteRegistration(facilityId, o.accountId, o.isDemo, { representative, position });
    const site = db.prepare('SELECT site_id, name_en, name_ar FROM facilities WHERE id = ?').get(facilityId) as { site_id: string | null; name_en: string; name_ar: string };
    const ref = site.site_id ?? facilityId;
    const reviewers = db.prepare('SELECT id, role FROM accounts WHERE is_demo = ?').all(o.isDemo ? 1 : 0) as unknown as { id: number; role: string }[];
    for (const r of reviewers) {
      if (!can(r.role, 'recordCorrective')) continue;
      db.prepare(`INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
                  VALUES (?, 'needs_action', ?, ?, ?, ?, ?, now_stamp(), ?)`)
        .run(r.id, `Facility/site submission: ${ref}`, `طلب منشأة/موقع: ${ref}`,
          `${site.name_en} submitted its facility/site registration, version ${version}.`,
          `قدّمت ${site.name_ar || site.name_en} تسجيل المنشأة/الموقع، النسخة ${version}.`,
          `/ministry/facilities/${facilityId}`, o.isDemo ? 1 : 0);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  revalidatePath(`/facilities/${facilityId}`);
  revalidatePath('/dashboard');
  revalidatePath('/ministry/facilities/queue');
  redirect(`/facilities/${facilityId}/acknowledgment`);
}

/**
 * The operator's answer to a Ministry request or corrective action (revision section 12):
 * what was done, with evidence where there is some. It does not close the action -- the
 * Ministry closes it once it has verified the correction.
 */
export async function respondToSiteRequestAction(facilityId: string, requestId: number, formData: FormData): Promise<void> {
  const o = await owner(facilityId);
  const note = String(formData.get('note') ?? '').trim();
  const db = getDb();
  const request = db.prepare(`SELECT id FROM facility_requests WHERE id = ? AND facility_id = ? AND status = 'open'`).get(requestId, facilityId);
  if (!request || !note) redirect(`/facilities/${facilityId}?tab=history&error=response#request-${requestId}`);
  const upload = await fileFrom(formData, 'evidence');
  if (upload && 'refused' in upload) redirect(`/facilities/${facilityId}?tab=history&error=response-${upload.refused}#request-${requestId}`);
  db.exec('BEGIN IMMEDIATE');
  try {
    const documentId = upload && !('refused' in upload)
      ? storeSiteDocument(facilityId, { purpose: 'evidence', docType: CORRECTIVE_RESPONSE_TYPE, issuer: '', issueDate: '', reviewDate: '', fileName: upload.file.name.trim() || 'evidence', contentType: upload.file.type, bytes: upload.bytes }, o.accountId)
      : null;
    db.prepare('INSERT INTO facility_request_responses (request_id, facility_id, note, document_id, responded_by, responded_at) VALUES (?, ?, ?, ?, ?, now_stamp())')
      .run(requestId, facilityId, note, documentId, o.accountId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  revalidatePath(`/facilities/${facilityId}`);
  redirect(`/facilities/${facilityId}?tab=history&notice=response#request-${requestId}`);
}
