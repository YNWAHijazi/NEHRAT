'use server';

/**
 * The Ministry's acts on a facility/site registration (latest revision, 9 October 2026,
 * sections 9-12): start the review, accept the registration, request additional information
 * or a correction, raise and close a corrective action, record an inspection, record a
 * designation for a designated category. Every act asks the permission matrix first and keeps
 * the demonstration boundary; none is an event outcome and none is an approval. The operator
 * is notified of each act that asks something of them or settles their status.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentAccount } from '../lib/auth';
import { getDb } from '../lib/db';
import { beirutToday } from '../lib/clock';
import { ministryConfig } from '../lib/queries';
import { siteStatusFacts } from '../lib/site-registration';
import { can, type MinistryAction } from '../lib/rules/ministry';
import { addDaysIso } from '../lib/rules/facility';
import { categoryNeedsDesignation, isIsoDate, siteReviewActions, type SiteReviewActKind } from '../lib/rules/site';

interface Actor { id: number; displayName: string; isDemo: boolean }
interface Site { id: string; accountId: number; isDemo: number; nameEn: string; nameAr: string; categoryKey: string; municipality: string }

async function requireMinistry(action: MinistryAction): Promise<Actor> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!can(account.role, action)) redirect('/signin?notice=ministry-permission');
  return { id: account.id, displayName: account.displayName, isDemo: account.isDemo };
}

/** The site, inside the actor's demonstration boundary; anything else reads as not found. */
function siteFor(actor: Actor, facilityId: string): Site {
  const r = getDb().prepare('SELECT id, account_id, is_demo, name_en, name_ar, category_key, municipality_en FROM facilities WHERE id = ?').get(facilityId) as
    | { id: string; account_id: number; is_demo: number; name_en: string; name_ar: string; category_key: string; municipality_en: string } | undefined;
  if (!r || (r.is_demo === 1) !== actor.isDemo) redirect('/ministry/facilities/queue?error=unknown');
  return { id: r.id, accountId: r.account_id, isDemo: r.is_demo, nameEn: r.name_en, nameAr: r.name_ar || r.name_en, categoryKey: r.category_key, municipality: r.municipality_en };
}

function latestSubmissionId(facilityId: string): number | null {
  return (getDb().prepare('SELECT id FROM facility_submissions WHERE facility_id = ? ORDER BY version DESC LIMIT 1').get(facilityId) as { id: number } | undefined)?.id ?? null;
}

function recordAct(site: Site, actor: Actor, kind: SiteReviewActKind, note: string, inspectionDate: string | null = null): void {
  getDb().prepare(`INSERT INTO facility_review_acts (facility_id, submission_id, kind, note, inspection_date, actor_id, actor_name, created_at, is_demo)
                   VALUES (?, ?, ?, ?, ?, ?, ?, now_stamp(), ?)`)
    .run(site.id, latestSubmissionId(site.id), kind, note, inspectionDate, actor.id, actor.displayName, site.isDemo);
}

function notify(site: Site, kind: 'needs_action' | 'for_information', subjectEn: string, subjectAr: string, bodyEn: string, bodyAr: string, route: string): void {
  getDb().prepare(`INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
                   VALUES (?, ?, ?, ?, ?, ?, ?, now_stamp(), ?)`)
    .run(site.accountId, kind, subjectEn, subjectAr, bodyEn, bodyAr, route, site.isDemo);
}

function done(facilityId: string, notice: string): never {
  revalidatePath(`/ministry/facilities/${facilityId}`);
  revalidatePath('/ministry/facilities/queue');
  revalidatePath(`/facilities/${facilityId}`);
  redirect(`/ministry/facilities/${facilityId}?notice=${notice}`);
}

/** Start the review: an internal state, grey, never a determination. */
export async function startSiteReviewAction(facilityId: string): Promise<void> {
  const actor = await requireMinistry('recordCorrective');
  const site = siteFor(actor, facilityId);
  if (!siteReviewActions(siteStatusFacts(site.id)).start) redirect(`/ministry/facilities/${site.id}?error=act`);
  recordAct(site, actor, 'reviewStarted', '');
  done(site.id, 'started');
}

/** Accept the registration and readiness record: the status becomes Readiness current. */
export async function acceptSiteRegistrationAction(facilityId: string, formData: FormData): Promise<void> {
  const actor = await requireMinistry('recordCorrective');
  const site = siteFor(actor, facilityId);
  if (!siteReviewActions(siteStatusFacts(site.id)).accept) redirect(`/ministry/facilities/${site.id}?error=act`);
  recordAct(site, actor, 'accepted', String(formData.get('note') ?? '').trim());
  notify(site, 'for_information', `Registration accepted — ${site.nameEn}`, `قُبل التسجيل — ${site.nameAr}`,
    'The Ministry accepted the facility/site registration and readiness record. Keep the record current; the annual element is the practical drill.',
    'قبلت الوزارة تسجيل المنشأة/الموقع وسجل الجاهزية. حافظوا على تحديث السجل؛ والعنصر السنوي هو التمرين العملي.',
    `/facilities/${site.id}`);
  done(site.id, 'accepted');
}

/**
 * Request additional information, or a correction, on the latest submission. The request is
 * a row on the operator's record and a notification; the operator answers by submitting the
 * updated registration, which closes it.
 */
export async function requestSiteInformationAction(facilityId: string, formData: FormData): Promise<void> {
  const actor = await requireMinistry('recordCorrective');
  const site = siteFor(actor, facilityId);
  const kind = String(formData.get('kind') ?? '') === 'correction' ? 'correction' : 'information';
  const body = String(formData.get('body') ?? '').trim();
  if (!body || !siteReviewActions(siteStatusFacts(site.id)).request) redirect(`/ministry/facilities/${site.id}?error=request`);
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    recordAct(site, actor, kind === 'correction' ? 'correctionRequested' : 'infoRequested', body);
    db.prepare(`INSERT INTO facility_requests (facility_id, body_en, body_ar, status, raised_by, kind, submission_id, created_at, is_demo)
                VALUES (?, ?, ?, 'open', ?, ?, ?, now_stamp(), ?)`)
      .run(site.id, body, body, actor.displayName, kind, latestSubmissionId(site.id), site.isDemo);
    notify(site, 'needs_action',
      kind === 'correction' ? `Correction requested — ${site.nameEn}` : `Additional information requested — ${site.nameEn}`,
      kind === 'correction' ? `طُلب تصحيح — ${site.nameAr}` : `طُلبت معلومات إضافية — ${site.nameAr}`,
      `The Ministry asks: ${body} Update the record, then submit the updated registration.`,
      `تطلب الوزارة: ${body} حدّثوا السجل ثم قدّموا التسجيل المحدَّث.`,
      `/facilities/${site.id}?tab=overview#resubmit`);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  done(site.id, kind === 'correction' ? 'correction' : 'information');
}

/**
 * Raise a corrective action (revision section 12): the deficiency, the action requested, the
 * due date where the Ministry's corrective timeline is published -- none is computed while it
 * is unset -- and a supporting note. The status reads Corrective action required until closed.
 */
export async function raiseSiteCorrectiveAction(facilityId: string, formData: FormData): Promise<void> {
  const actor = await requireMinistry('recordCorrective');
  const site = siteFor(actor, facilityId);
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  if (!s('deficiency') || !s('action')) redirect(`/ministry/facilities/${site.id}?error=corrective`);
  const timeline = ministryConfig().get('correctiveTimelines');
  const days = timeline && (!timeline.effective || timeline.effective <= beirutToday()) ? Number(timeline.value) : NaN;
  const due = Number.isSafeInteger(days) && days > 0 ? addDaysIso(beirutToday(), days) : null;
  const db = getDb();
  db.prepare(`INSERT INTO facility_requests (facility_id, body_en, body_ar, deficiency, note, due, status, raised_by, kind, submission_id, created_at, is_demo)
              VALUES (?, ?, ?, ?, ?, ?, 'open', ?, 'corrective', ?, now_stamp(), ?)`)
    .run(site.id, s('action'), s('action'), s('deficiency'), s('note'), due, actor.displayName, latestSubmissionId(site.id), site.isDemo);
  notify(site, 'needs_action', `Corrective action required — ${site.nameEn}`, `مطلوب إجراء تصحيحي — ${site.nameAr}`,
    `Deficiency: ${s('deficiency')}. Action requested: ${s('action')}.${due ? ` Due ${due}.` : ''} Record what was done, with evidence, on the site record.`,
    `النقص: ${s('deficiency')}. الإجراء المطلوب: ${s('action')}.${due ? ` يُستحق في ⁦${due}⁩.` : ''} سجّلوا ما تم، مع الدليل، في سجل الموقع.`,
    `/facilities/${site.id}?tab=history#requests`);
  done(site.id, 'corrective');
}

/** Close a corrective action with a record of what was verified. The note is required: closing is a finding, not a flag. */
export async function closeSiteCorrectiveAction(facilityId: string, requestId: number, formData: FormData): Promise<void> {
  const actor = await requireMinistry('recordCorrective');
  const site = siteFor(actor, facilityId);
  const verified = String(formData.get('verified') ?? '').trim();
  if (!verified) redirect(`/ministry/facilities/${site.id}?error=verified#request-${requestId}`);
  const changed = getDb().prepare(`UPDATE facility_requests SET status = 'corrected', corrected_at = now_stamp(), close_note = ?, closed_by = ?
                                   WHERE id = ? AND facility_id = ? AND status = 'open'`)
    .run(verified, actor.displayName, requestId, site.id).changes;
  if (!changed) redirect(`/ministry/facilities/${site.id}?error=verified`);
  notify(site, 'for_information', `Corrective action closed — ${site.nameEn}`, `أُقفل الإجراء التصحيحي — ${site.nameAr}`,
    `The Ministry closed the corrective action. Verified: ${verified}`, `أقفلت الوزارة الإجراء التصحيحي. ما جرى التحقق منه: ${verified}`,
    `/facilities/${site.id}?tab=history#requests`);
  done(site.id, 'closed');
}

/** Record an inspection: its date and findings. Findings are a record, not an outcome. */
export async function recordSiteInspectionAction(facilityId: string, formData: FormData): Promise<void> {
  const actor = await requireMinistry('recordCorrective');
  const site = siteFor(actor, facilityId);
  const date = String(formData.get('date') ?? '').trim();
  const findings = String(formData.get('findings') ?? '').trim();
  if (!isIsoDate(date) || date > beirutToday() || !findings) redirect(`/ministry/facilities/${site.id}?error=inspection`);
  recordAct(site, actor, 'inspection', findings, date);
  done(site.id, 'inspection');
}

/**
 * Record the designation for a designated category (revision section 10): the existing
 * designations model, a facility_designations row naming the site. Only for the three
 * categories that need one; the applicant never designates itself.
 */
export async function recordSiteDesignationAction(facilityId: string, formData: FormData): Promise<void> {
  const actor = await requireMinistry('designateCovered');
  const site = siteFor(actor, facilityId);
  if (!categoryNeedsDesignation(site.categoryKey)) redirect(`/ministry/facilities/${site.id}?error=designation`);
  const note = String(formData.get('note') ?? '').trim();
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO facility_designations (name_en, name_ar, category, municipality, facility_id, designated_by, designated_at, is_demo)
                VALUES (?, ?, ?, ?, ?, ?, now_stamp(), ?)`)
      .run(site.nameEn, site.nameAr, site.categoryKey, site.municipality, site.id, actor.displayName, site.isDemo);
    recordAct(site, actor, 'designation', note);
    db.prepare('UPDATE facilities SET details_revision = details_revision + 1 WHERE id = ?').run(site.id);
    notify(site, 'needs_action', `Designated by the Ministry — ${site.nameEn}`, `حدّدته الوزارة — ${site.nameAr}`,
      'The Ministry recorded the designation for this site. Its category applies from today and an AED is required.',
      'سجّلت الوزارة التحديد لهذا الموقع. وتنطبق فئته اعتباراً من اليوم ويلزم توفير جهاز إزالة رجفان.',
      `/facilities/${site.id}`);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  done(site.id, 'designated');
}
