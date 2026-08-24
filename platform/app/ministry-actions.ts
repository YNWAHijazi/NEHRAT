'use server';

/**
 * The Ministry console's actions. Every one asks the permission matrix BEFORE
 * acting -- the screen asking too is presentation, this is the rule. An
 * administrator cannot record an outcome; an inspector records corrective
 * actions and none of the three; the platform owner performs no regulatory
 * action at all.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '../lib/db';
import { currentAccount } from '../lib/auth';
import {
  MINISTRY_CONTENT,
  can,
  outcomeAvailability,
  type MinistryAction,
  type OutcomeBlocker,
} from '../lib/rules';
import { addedMeasuresFor, inspectionsFor } from '../lib/queries';

async function requireMinistry(action: MinistryAction): Promise<{ id: number; role: string; displayName: string; isDemo: boolean }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!can(account.role, action)) redirect('/signin?notice=ministry-permission');
  return { id: account.id, role: account.role, displayName: account.displayName, isDemo: account.isDemo };
}

function notifyEventOwner(eventId: string, subjectEn: string, subjectAr: string, bodyEn: string, bodyAr: string, route: string): void {
  const db = getDb();
  const ev = db.prepare(`SELECT account_id, is_demo FROM events WHERE id = ?`).get(eventId) as { account_id: number; is_demo: number } | undefined;
  if (!ev) return;
  db.prepare(
    `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
     VALUES (?, 'needs_action', ?, ?, ?, ?, ?, datetime('now'), ?)`,
  ).run(ev.account_id, subjectEn, subjectAr, bodyEn, bodyAr, route, ev.is_demo);
}

/** The blocking items gating ONLY the satisfied outcome, each named. */
export async function outcomeBlockersFor(eventId: string): Promise<OutcomeBlocker[]> {
  const blockers: OutcomeBlocker[] = [];
  for (const m of addedMeasuresFor(eventId)) {
    if (m.blocking && !m.clearedAt) {
      blockers.push({
        en: `Added measure outstanding — ${m.catalogKey}`,
        ar: `تدبير مضاف قائم — ${m.catalogKey}`,
      });
    }
  }
  for (const i of inspectionsFor(eventId)) {
    if (i.blocking && i.state !== 'recorded') {
      blockers.push({
        en: `Blocking inspection without recorded findings — ${i.titleEn}`,
        ar: `تفتيش حاجب دون نتائج مسجَّلة — ${i.titleAr}`,
      });
    }
  }
  return blockers;
}

/** Take or assign a submission: an internal workflow act, not a determination. */
export async function assignReviewAction(eventId: string, formData: FormData): Promise<void> {
  const actor = await requireMinistry('assignReview');
  const state = String(formData.get('state') ?? 'progress');
  getDb()
    .prepare(
      `INSERT INTO review_state (event_id, state, reviewer, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(event_id) DO UPDATE SET state = excluded.state, reviewer = excluded.reviewer, updated_at = excluded.updated_at`,
    )
    .run(eventId, ['queued', 'assigned', 'progress'].includes(state) ? state : 'progress', actor.displayName);
  revalidatePath(`/ministry/submissions/${eventId}`);
  redirect(`/ministry/submissions/${eventId}`);
}

/**
 * Record one of the three outcomes -- the only regulatory determinations, and
 * only a reviewer's to record. 'satisfied' is refused while any blocking item
 * is outstanding; the other two are never gated.
 */
export async function recordOutcomeAction(eventId: string, formData: FormData): Promise<void> {
  const actor = await requireMinistry('recordOutcome');
  const outcome = String(formData.get('outcome') ?? '');
  if (!['incomplete', 'revision', 'satisfied'].includes(outcome)) redirect(`/ministry/submissions/${eventId}`);
  const blockers = await outcomeBlockersFor(eventId);
  const availability = outcomeAvailability(blockers).find((o) => o.key === outcome);
  if (!availability?.available) redirect(`/ministry/submissions/${eventId}?error=gated`);
  const note = String(formData.get('note') ?? '').trim();
  getDb()
    .prepare(`INSERT INTO determinations (event_id, outcome, note, recorded_by) VALUES (?, ?, ?, ?)`)
    .run(eventId, outcome, note, actor.displayName);
  const def = MINISTRY_CONTENT.outcomes.find((o) => o.key === outcome);
  const ev = getDb().prepare(`SELECT name_en, name_ar, moph_reference FROM events WHERE id = ?`).get(eventId) as { name_en: string; name_ar: string; moph_reference: string | null };
  notifyEventOwner(
    eventId,
    `${def?.en ?? outcome} — ${ev.moph_reference ?? ev.name_en}`,
    `${def?.ar ?? outcome} — ${ev.moph_reference ?? ev.name_ar}`,
    note
      ? `${def?.en ?? ''}. ${note} Your reference number does not change.`
      : `${def?.en ?? ''}. Your reference number does not change.`,
    note
      ? `${def?.ar ?? ''}. ${note} ولا يتغير رقمكم المرجعي.`
      : `${def?.ar ?? ''}. ولا يتغير رقمكم المرجعي.`,
    outcome === 'satisfied' ? `/events/${eventId}/acknowledgment` : `/events/${eventId}`,
  );
  revalidatePath(`/ministry/submissions/${eventId}`);
  redirect(`/ministry/submissions/${eventId}?notice=recorded`);
}

/** Require an additional measure: a distinct action, not a fourth outcome. */
export async function requireMeasureAction(eventId: string, formData: FormData): Promise<void> {
  const actor = await requireMinistry('requireMeasures');
  const catalogKey = String(formData.get('catalogKey') ?? '').trim();
  if (!catalogKey) redirect(`/ministry/submissions/${eventId}`);
  const note = String(formData.get('note') ?? '').trim();
  getDb()
    .prepare(`INSERT INTO added_measures (event_id, catalog_key, note, blocking, recorded_by) VALUES (?, ?, ?, 1, ?)`)
    .run(eventId, catalogKey, note, actor.displayName);
  const ev = getDb().prepare(`SELECT name_en, name_ar FROM events WHERE id = ?`).get(eventId) as { name_en: string; name_ar: string };
  notifyEventOwner(
    eventId,
    `Additional measures required — ${ev.name_en}`,
    `طُلبت تدابير إضافية — ${ev.name_ar}`,
    'The Ministry requires additional measures on this submission. This is separate from a revision request and is not a determination.',
    'تطلب الوزارة تدابير إضافية على هذا التقديم. وهذا مستقل عن طلب التعديل وليس نتيجة.',
    `/events/${eventId}/requirements`,
  );
  revalidatePath(`/ministry/submissions/${eventId}`);
  redirect(`/ministry/submissions/${eventId}?notice=measure`);
}

export async function clearMeasureAction(eventId: string, measureId: number): Promise<void> {
  await requireMinistry('requireMeasures');
  getDb().prepare(`UPDATE added_measures SET cleared_at = datetime('now') WHERE id = ? AND event_id = ?`).run(measureId, eventId);
  revalidatePath(`/ministry/submissions/${eventId}`);
  redirect(`/ministry/submissions/${eventId}`);
}

/** Record an organization. Filing opens for the organizer the moment this lands. */
export async function recordOrganizationAction(orgId: number): Promise<void> {
  await requireMinistry('recordOrganization');
  const db = getDb();
  const org = db.prepare(`SELECT account_id, name_en, name_ar, is_demo FROM organizations WHERE id = ?`).get(orgId) as
    | { account_id: number; name_en: string; name_ar: string; is_demo: number }
    | undefined;
  if (!org) redirect('/ministry/organizations');
  db.prepare(`UPDATE organizations SET status = 'recorded', recorded_at = datetime('now') WHERE id = ?`).run(orgId);
  db.prepare(
    `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
     VALUES (?, 'for_information', ?, ?, ?, ?, '/organization', datetime('now'), ?)`,
  ).run(
    org.account_id,
    `Organization recorded — ${org.name_en}`,
    `سُجّلت المؤسسة — ${org.name_ar}`,
    'The Ministry of Public Health has recorded your organization. You may now file submissions. Events and assessments you created while registration was pending are retained. This records health and medical preparedness only; authorization of an event remains with the legally competent authority.',
    'سجّلت وزارة الصحة العامة مؤسستكم. ويمكنكم الآن تقديم الملفات. وتبقى الفعاليات والتقييمات التي أنشأتموها أثناء انتظار التسجيل محفوظة. هذا تسجيل للتأهب الصحي والطبي فقط؛ ويبقى الترخيص بالفعالية لدى السلطة المختصة قانوناً.',
    org.is_demo,
  );
  revalidatePath('/ministry/organizations');
  redirect('/ministry/organizations?notice=recorded');
}

export async function respondEnquiryAction(enquiryId: number, formData: FormData): Promise<void> {
  const actor = await requireMinistry('respondEnquiry');
  const reply = String(formData.get('reply') ?? '').trim();
  if (!reply) redirect('/ministry/enquiries');
  getDb()
    .prepare(`UPDATE enquiries SET reply = ?, replied_by = ?, replied_at = datetime('now') WHERE id = ?`)
    .run(reply, actor.displayName, enquiryId);
  revalidatePath('/ministry/enquiries');
  redirect('/ministry/enquiries?notice=responded');
}

/** Inspections: scheduled and recorded by an inspector. Findings are not an outcome. */
export async function recordInspectionAction(inspectionId: number, formData: FormData): Promise<void> {
  const actor = await requireMinistry('scheduleInspection');
  const db = getDb();
  const row = db.prepare(`SELECT event_id, state FROM inspections WHERE id = ?`).get(inspectionId) as { event_id: string; state: string } | undefined;
  if (!row) redirect('/ministry/queue');
  const findings = String(formData.get('findings') ?? '').trim();
  const date = String(formData.get('date') ?? '').trim();
  if (findings) {
    db.prepare(`UPDATE inspections SET state = 'recorded', findings = ?, inspector = ?, date = COALESCE(NULLIF(?, ''), date) WHERE id = ?`)
      .run(findings, actor.displayName, date, inspectionId);
  } else {
    db.prepare(`UPDATE inspections SET state = 'scheduled', inspector = ?, date = NULLIF(?, '') WHERE id = ?`)
      .run(actor.displayName, date, inspectionId);
  }
  revalidatePath(`/ministry/submissions/${row.event_id}`);
  redirect(`/ministry/submissions/${row.event_id}`);
}

/** A facility corrective action: raised, tracked, and never an outcome. */
export async function recordFacilityCorrectiveAction(formData: FormData): Promise<void> {
  const actor = await requireMinistry('recordCorrective');
  const facilityId = String(formData.get('facilityId') ?? '');
  const bodyEn = String(formData.get('body') ?? '').trim();
  const bodyAr = String(formData.get('bodyAr') ?? '').trim() || bodyEn;
  if (!facilityId || !bodyEn) redirect('/ministry/facilities');
  const db = getDb();
  const fac = db.prepare(`SELECT account_id, is_demo, name_en, name_ar FROM facilities WHERE id = ?`).get(facilityId) as
    | { account_id: number; is_demo: number; name_en: string; name_ar: string }
    | undefined;
  if (!fac) redirect('/ministry/facilities');
  db.prepare(
    `INSERT INTO facility_requests (facility_id, body_en, body_ar, status, raised_by, is_demo)
     VALUES (?, ?, ?, 'open', ?, ?)`,
  ).run(facilityId, bodyEn, bodyAr, actor.displayName, fac.is_demo);
  db.prepare(
    `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
     VALUES (?, 'needs_action', ?, ?, ?, ?, ?, datetime('now'), ?)`,
  ).run(
    fac.account_id,
    `Corrective action required — ${fac.name_en}`,
    `مطلوب إجراء تصحيحي — ${fac.name_ar}`,
    bodyEn, bodyAr, `/facilities/${facilityId}`, fac.is_demo,
  );
  revalidatePath('/ministry/facilities');
  redirect('/ministry/facilities?notice=raised');
}

export async function markCorrectiveDoneAction(requestId: number): Promise<void> {
  await requireMinistry('recordCorrective');
  getDb().prepare(`UPDATE facility_requests SET status = 'corrected', corrected_at = datetime('now') WHERE id = ?`).run(requestId);
  revalidatePath('/ministry/facilities');
  redirect('/ministry/facilities');
}

/**
 * Designate a place as a covered facility, from the arrest pattern (power
 * eight). Where the place holds a facility record its operator is notified;
 * a place without one is designated by name and picked up at registration.
 */
export async function designateCoveredAction(formData: FormData): Promise<void> {
  const actor = await requireMinistry('designateCovered');
  const nameEn = String(formData.get('nameEn') ?? '').trim();
  const nameAr = String(formData.get('nameAr') ?? '').trim() || nameEn;
  const category = String(formData.get('category') ?? '').trim();
  const municipality = String(formData.get('municipality') ?? '').trim();
  const facilityId = String(formData.get('facilityId') ?? '').trim() || null;
  if (!nameEn) redirect('/ministry/facilities/arrests');
  const db = getDb();
  db.prepare(
    `INSERT INTO facility_designations (name_en, name_ar, category, municipality, facility_id, designated_by, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(nameEn, nameAr, category, municipality, facilityId, actor.displayName, actor.isDemo ? 1 : 0);
  if (facilityId) {
    const fac = db.prepare(`SELECT account_id, is_demo FROM facilities WHERE id = ?`).get(facilityId) as { account_id: number; is_demo: number } | undefined;
    if (fac) {
      db.prepare(
        `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
         VALUES (?, 'needs_action', ?, ?, ?, ?, ?, datetime('now'), ?)`,
      ).run(
        fac.account_id,
        `Designated as a covered facility — ${nameEn}`,
        `حُدِّد كمرفق مشمول — ${nameAr}`,
        'Following review of reported cardiac-arrest locations, the Ministry has designated this facility as covered. Its readiness obligations run from the designation date.',
        'بعد مراجعة مواقع حوادث توقف القلب المبلَّغة، حدّدت الوزارة هذا المرفق كمشمول. وتسري موجبات جاهزيته من تاريخ التحديد.',
        `/facilities/${facilityId}`,
        fac.is_demo,
      );
    }
  }
  revalidatePath('/ministry/facilities/arrests');
  redirect('/ministry/facilities/arrests?notice=designated');
}

/**
 * Set and publish a cardiac configuration value. Unset is the first-class
 * answer until this lands; publishing records the effective date and notifies
 * the operators the value reaches -- the public page promised them that.
 */
export async function publishConfigAction(formData: FormData): Promise<void> {
  const actor = await requireMinistry('configureCardiac');
  const key = String(formData.get('key') ?? '').trim();
  const value = String(formData.get('value') ?? '').trim();
  const effective = String(formData.get('effective') ?? '').trim();
  if (!key || !value || !effective) redirect('/ministry/admin/cardiac?error=incomplete');
  const db = getDb();
  db.prepare(
    `INSERT INTO ministry_config (key, value, effective, published_by, published_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, effective = excluded.effective,
       published_by = excluded.published_by, published_at = excluded.published_at`,
  ).run(key, value, effective, actor.displayName);

  // Operators are notified when the obligation begins. The phased schedule
  // reaches recorded interests; the readiness cycles reach facility operators.
  const flag = actor.isDemo ? 1 : 0;
  if (key === 'phasedSchedule') {
    const interests = db
      .prepare(
        `SELECT DISTINCT i.account_id FROM facility_interests i JOIN accounts a ON a.id = i.account_id
         WHERE i.category_key = 'education' AND a.is_demo = ?`,
      )
      .all(flag) as unknown as { account_id: number }[];
    for (const i of interests) {
      db.prepare(
        `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
         VALUES (?, 'needs_action', ?, ?, ?, ?, '/facilities/new', datetime('now'), ?)`,
      ).run(
        i.account_id,
        'The phased implementation schedule has been published',
        'نُشرت خطة التنفيذ المرحلية',
        `You recorded an interest while this value was unset. The schedule is now published, effective ${effective}. Registration under the educational category opens from that date.`,
        `سجّلتم اهتماماً عندما كانت هذه القيمة غير محددة. نُشرت الخطة الآن، وتسري اعتباراً من ⁦${effective}⁩. ويُفتح التسجيل ضمن الفئة التعليمية من ذلك التاريخ.`,
        flag,
      );
    }
  }
  if (key === 'checkCycleDays' || key === 'lapseWindowDays') {
    const operators = db
      .prepare(
        `SELECT DISTINCT f.account_id, f.id FROM facilities f JOIN accounts a ON a.id = f.account_id WHERE a.is_demo = ?`,
      )
      .all(flag) as unknown as { account_id: number; id: string }[];
    for (const o of operators) {
      db.prepare(
        `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
         VALUES (?, 'for_information', ?, ?, ?, ?, ?, datetime('now'), ?)`,
      ).run(
        o.account_id,
        'A readiness cycle has been published',
        'نُشرت دورة جاهزية',
        `The Ministry has published a readiness cycle value, effective ${effective}. The validity ledger uses it from that date; the provisional figure no longer applies.`,
        `نشرت الوزارة قيمة دورة جاهزية تسري اعتباراً من ⁦${effective}⁩. ويستخدمها سجل الصلاحية من ذلك التاريخ؛ ولا يعود الرقم المؤقت منطبقاً.`,
        `/facilities/${o.id}`,
        flag,
      );
    }
  }
  revalidatePath('/ministry/admin/cardiac');
  redirect('/ministry/admin/cardiac?notice=published');
}

/** The Order lane switch, on Master admin. Off suspends the Order reviewer's access. */
export async function setOrderLaneAction(formData: FormData): Promise<void> {
  const actor = await requireMinistry('manageFlags');
  const active = formData.get('active') === 'on';
  getDb()
    .prepare(
      `INSERT INTO ministry_config (key, value, effective, published_by, published_at)
       VALUES ('orderLane', ?, NULL, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, published_by = excluded.published_by, published_at = excluded.published_at`,
    )
    .run(active ? 'on' : 'off', actor.displayName);
  revalidatePath('/platform/admin');
  revalidatePath('/ministry/admin/users');
  redirect('/platform/admin?notice=lane');
}
