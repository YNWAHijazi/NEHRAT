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
import { randomBytes } from 'node:crypto';
import { getDb } from '../lib/db';
import { ACTIVATION_EXPIRY_HOURS } from '../lib/password';
import { administrationBar, isAssignableRole } from '../lib/rules/accounts';
import { verbatimQuote } from '../lib/rules/verbatim';
import { currentAccount } from '../lib/auth';
import {
  MINISTRY_CONTENT,
  attestationBlockers,
  attestationRows,
  attestationsApplyAt,
  can,
  orderLaneActive,
  outcomeAvailability,
  type Level,
  type MinistryAction,
  type OutcomeBlocker,
} from '../lib/rules';
import { addedMeasuresFor, attestationRecordsFor, derivedLevelFor, inspectionsFor, inspectorCandidates } from '../lib/queries';

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
     VALUES (?, 'needs_action', ?, ?, ?, ?, ?, now_stamp(), ?)`,
  ).run(ev.account_id, subjectEn, subjectAr, bodyEn, bodyAr, route, ev.is_demo);
}

/**
 * The blocking items gating ONLY the satisfied outcome, each named: pending
 * attestations, blocking added measures, blocking inspections without recorded
 * findings. Three classes, one list -- which is what outcomeAvailability's
 * docstring promised for a whole slice while the attestation class had no data,
 * no table and no computation behind it. It does now.
 */
export async function outcomeBlockersFor(eventId: string): Promise<OutcomeBlocker[]> {
  const blockers: OutcomeBlocker[] = [];
  const level = derivedLevelFor(eventId);
  if (level !== null && attestationsApplyAt(level as Level)) {
    const rows = attestationRows(level as Level, attestationRecordsFor(eventId));
    blockers.push(...attestationBlockers(rows));
  }
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
       VALUES (?, ?, ?, now_stamp())
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
  // A FIRST determination only. Changing one is a separate act with its own reason;
  // this path used to accept a second silently and the screen kept its radios live,
  // so a recorded regulatory determination could be replaced by a stray click.
  const standing = getDb()
    .prepare(`SELECT id FROM determinations WHERE event_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`)
    .get(eventId) as { id: number } | undefined;
  if (standing) redirect(`/ministry/submissions/${eventId}?error=already-determined`);
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
  // The organizer's surfaces show the same determination -- refresh them too.
  revalidatePath('/dashboard');
  revalidatePath(`/events/${eventId}`);
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
  getDb().prepare(`UPDATE added_measures SET cleared_at = now_stamp() WHERE id = ? AND event_id = ?`).run(measureId, eventId);
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
  db.prepare(`UPDATE organizations SET status = 'recorded', recorded_at = now_stamp() WHERE id = ?`).run(orgId);
  db.prepare(
    `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
     VALUES (?, 'for_information', ?, ?, ?, ?, '/organization', now_stamp(), ?)`,
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
  const db = getDb();
  db.prepare(`UPDATE enquiries SET reply = ?, replied_by = ?, replied_at = now_stamp() WHERE id = ?`)
    .run(reply, actor.displayName, enquiryId);
  // The field is labelled "sent to the organizer as written" -- so send it. The reply
  // lands on the event owner's notifications, verbatim.
  const enq = db.prepare(`SELECT event_id FROM enquiries WHERE id = ?`).get(enquiryId) as { event_id: string } | undefined;
  if (enq) {
    const ev = db.prepare(`SELECT name_en, name_ar FROM events WHERE id = ?`).get(enq.event_id) as { name_en: string; name_ar: string } | undefined;
    if (ev) {
      notifyEventOwner(
        enq.event_id,
        `Ministry response to your enquiry — ${ev.name_en}`,
        `رد الوزارة على استفساركم — ${ev.name_ar}`,
        `The Ministry has answered your enquiry. The response, as written: “${reply}”.`,
        `أجابت الوزارة على استفساركم. والرد كما كُتب: «${reply}».`,
        `/events/${enq.event_id}`,
      );
    }
  }
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
     VALUES (?, 'needs_action', ?, ?, ?, ?, ?, now_stamp(), ?)`,
  ).run(
    fac.account_id,
    `Corrective action required — ${fac.name_en}`,
    `مطلوب إجراء تصحيحي — ${fac.name_ar}`,
    bodyEn, bodyAr, `/facilities/${facilityId}`, fac.is_demo,
  );
  revalidatePath('/ministry/facilities');
  redirect('/ministry/facilities?notice=raised');
}

export async function markCorrectiveDoneAction(requestId: number, formData: FormData): Promise<void> {
  const actor = await requireMinistry('recordCorrective');
  // Closing records WHAT was verified, not just that a status flipped: the note is
  // the record of the correction, and the operator's panel shows it.
  const note = String(formData.get('note') ?? '').trim();
  if (!note) redirect('/ministry/facilities?error=close-note');
  getDb()
    .prepare(`UPDATE facility_requests SET status = 'corrected', corrected_at = now_stamp(), close_note = ?, closed_by = ? WHERE id = ?`)
    .run(note, actor.displayName, requestId);
  revalidatePath('/ministry/facilities');
  redirect('/ministry/facilities?notice=closed');
}

/**
 * Request readiness confirmation from an operator (power ten, an act). The
 * request lands as an OPEN row on the facility's readiness screen pointing at
 * the confirmation control, and as a notification. It closes when the operator
 * records the annual confirmation, or when the Ministry closes it with a note.
 */
export async function requestReadinessConfirmationAction(formData: FormData): Promise<void> {
  const actor = await requireMinistry('recordCorrective');
  const facilityId = String(formData.get('facilityId') ?? '');
  if (!facilityId) redirect('/ministry/facilities');
  const db = getDb();
  const fac = db.prepare(`SELECT account_id, is_demo, name_en, name_ar FROM facilities WHERE id = ?`).get(facilityId) as
    | { account_id: number; is_demo: number; name_en: string; name_ar: string }
    | undefined;
  if (!fac) redirect('/ministry/facilities');
  db.prepare(
    `INSERT INTO facility_requests (facility_id, body_en, body_ar, status, raised_by, kind, is_demo)
     VALUES (?, ?, ?, 'open', ?, 'confirmation', ?)`,
  ).run(
    facilityId,
    'The Ministry requests readiness confirmation for this facility. Record the confirmation from the response-plan screen.',
    'تطلب الوزارة تأكيد الجاهزية لهذا المرفق. سجّلوا التأكيد من شاشة خطة الاستجابة.',
    actor.displayName, fac.is_demo,
  );
  db.prepare(
    `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
     VALUES (?, 'needs_action', ?, ?, ?, ?, ?, now_stamp(), ?)`,
  ).run(
    fac.account_id,
    `Readiness confirmation requested — ${fac.name_en}`,
    `طُلب تأكيد الجاهزية — ${fac.name_ar}`,
    'The Ministry requests readiness confirmation. Record it from the response-plan screen; the request closes when it is recorded.',
    'تطلب الوزارة تأكيد الجاهزية. سجّلوه من شاشة خطة الاستجابة؛ ويُقفل الطلب عند تسجيله.',
    `/facilities/${facilityId}/plan`, fac.is_demo,
  );
  revalidatePath('/ministry/facilities');
  redirect('/ministry/facilities?notice=confirmation-requested');
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
         VALUES (?, 'needs_action', ?, ?, ?, ?, ?, now_stamp(), ?)`,
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
     VALUES (?, ?, ?, ?, now_stamp())
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
         VALUES (?, 'needs_action', ?, ?, ?, ?, '/facilities/new', now_stamp(), ?)`,
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
         VALUES (?, 'for_information', ?, ?, ?, ?, ?, now_stamp(), ?)`,
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
       VALUES ('orderLane', ?, NULL, ?, now_stamp())
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, published_by = excluded.published_by, published_at = excluded.published_at`,
    )
    .run(active ? 'on' : 'off', actor.displayName);
  revalidatePath('/platform/admin');
  revalidatePath('/ministry/admin/users');
  redirect('/platform/admin?notice=lane');
}

/**
 * Attest one item, or record a deficiency against it. Who may record derives from
 * lib/rules/attestations.ts (attestationRows.recordableBy), never from this file:
 * Ministry-assigned items take the reviewer's recordAttestation permission; items
 * assigned to the Order of Physicians take the Order's own orderVerify while the
 * lane is active, and fall back to the reviewer while it is off -- the recorded
 * build ruling (open decision 19), applied here and on the screen from one place.
 *
 * A deficiency does not create a third state. The item stays pending; the text is
 * stored as the reason it is pending, with who raised it and when.
 */
export async function recordAttestationAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const itemKey = String(formData.get('itemKey') ?? '');
  const kind = String(formData.get('kind') ?? '');
  const level = derivedLevelFor(eventId);
  if (level === null || !attestationsApplyAt(level as Level)) redirect(`/ministry/submissions/${eventId}`);
  const row = attestationRows(level as Level, attestationRecordsFor(eventId)).find((r) => r.key === itemKey);
  if (!row) redirect(`/ministry/submissions/${eventId}`);
  // Attesting needs a pending item. A DEFICIENCY does not: discovered after
  // attestation, it returns the item to pending -- completion is correctable.
  if (kind === 'attest' && row.state === 'complete') redirect(`/ministry/submissions/${eventId}`);

  const permitted =
    (row.recorder === 'reviewer' && can(account.role, 'recordAttestation')) ||
    (row.recorder === 'order' && can(account.role, 'orderVerify') && orderLaneActive());
  if (!permitted) redirect('/signin?notice=ministry-permission');

  const db = getDb();
  if (kind === 'attest') {
    db.prepare(
      `INSERT INTO attestations (event_id, item_key, state, attested_by, attested_at)
       VALUES (?, ?, 'complete', ?, now_stamp())
       ON CONFLICT(event_id, item_key) DO UPDATE SET
         state = 'complete', attested_by = excluded.attested_by, attested_at = excluded.attested_at`,
    ).run(eventId, itemKey, account.displayName);
  } else if (kind === 'deficiency') {
    const reason = String(formData.get('reason') ?? '').trim();
    if (!reason) redirect(`/ministry/submissions/${eventId}?error=deficiency-reason`);
    // Stored in the language it was typed; the row renders it in both columns rather
    // than inventing a translation for user-entered text.
    db.prepare(
      `INSERT INTO attestations (event_id, item_key, state, reason_en, reason_ar, reason_by, reason_at)
       VALUES (?, ?, 'pending', ?, ?, ?, now_stamp())
       ON CONFLICT(event_id, item_key) DO UPDATE SET
         state = 'pending', attested_by = NULL, attested_at = NULL,
         reason_en = excluded.reason_en, reason_ar = excluded.reason_ar,
         reason_by = excluded.reason_by, reason_at = excluded.reason_at`,
    ).run(eventId, itemKey, reason, reason, account.displayName);
  }
  revalidatePath(`/ministry/submissions/${eventId}`);
  redirect(`/ministry/submissions/${eventId}`);
}

/**
 * Return an organization filing with a reason, and reverse a recording. A returned
 * filing goes back to the organizer EDITABLE, with the reason on their screen
 * verbatim; re-submitting sets it pending again. Reversing a recording is the
 * correction path for a recording made in error -- back to pending, never silently
 * deleted, and the organizer is told. Submission stays blocked while not recorded
 * (non-negotiable 9), which is exactly why both acts notify.
 */
export async function returnOrganizationAction(orgId: number, formData: FormData): Promise<void> {
  const actor = await requireMinistry('recordOrganization');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) redirect('/ministry/organizations?error=reason');
  const db = getDb();
  const org = db.prepare(`SELECT account_id, name_en, name_ar, is_demo, status FROM organizations WHERE id = ?`).get(orgId) as
    | { account_id: number; name_en: string; name_ar: string; is_demo: number; status: string }
    | undefined;
  if (!org || org.status !== 'pending') redirect('/ministry/organizations');
  db.prepare(`UPDATE organizations SET status = 'returned', return_reason = ?, returned_at = now_stamp() WHERE id = ?`).run(reason, orgId);
  db.prepare(
    `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
     VALUES (?, 'needs_action', ?, ?, ?, ?, '/organization', now_stamp(), ?)`,
  ).run(
    org.account_id,
    `Organization returned — ${org.name_en}`, `أُعيدت المؤسسة — ${org.name_ar}`,
    `The Ministry has returned your organization registration. The reason, as written: “${reason}”. Edit the details and re-submit; filing stays blocked until the organization is recorded.`,
    `أعادت الوزارة تسجيل مؤسستكم. والسبب كما كُتب: «${reason}». عدّلوا البيانات وأعيدوا التقديم؛ ويبقى تقديم الملفات محجوباً حتى تُسجَّل المؤسسة.`,
    org.is_demo,
  );
  revalidatePath('/ministry/organizations');
  redirect('/ministry/organizations?notice=returned');
}

export async function reverseOrganizationRecordingAction(orgId: number, formData: FormData): Promise<void> {
  await requireMinistry('recordOrganization');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) redirect('/ministry/organizations?error=reason');
  const db = getDb();
  const org = db.prepare(`SELECT account_id, name_en, name_ar, is_demo, status FROM organizations WHERE id = ?`).get(orgId) as
    | { account_id: number; name_en: string; name_ar: string; is_demo: number; status: string }
    | undefined;
  if (!org || org.status !== 'recorded') redirect('/ministry/organizations');
  db.prepare(`UPDATE organizations SET status = 'pending', recorded_at = NULL, return_reason = ?, returned_at = now_stamp() WHERE id = ?`).run(reason, orgId);
  db.prepare(
    `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
     VALUES (?, 'needs_action', ?, ?, ?, ?, '/organization', now_stamp(), ?)`,
  ).run(
    org.account_id,
    `Organization recording reversed — ${org.name_en}`, `عُكس تسجيل المؤسسة — ${org.name_ar}`,
    `The Ministry has reversed the recording of your organization, pending review. The reason, as written: “${reason}”. New filings are blocked until it is recorded again; anything already filed stands.`,
    `عكست الوزارة تسجيل مؤسستكم ريثما تُراجَع. والسبب كما كُتب: «${reason}». تُحجب التقديمات الجديدة حتى تُسجَّل من جديد؛ ويبقى ما قُدّم قائماً.`,
    org.is_demo,
  );
  revalidatePath('/ministry/organizations');
  redirect('/ministry/organizations?notice=reversed');
}

/**
 * ACCOUNT ADMINISTRATION, across every account (reviewer ruling, 2026-08-28).
 *
 * What changed and why each part of it changed:
 *
 * THE ADMINISTRATOR NEVER SETS OR SEES A PASSWORD. addMinistryUserAction used to
 * insert an account with NO password_hash and tell the administrator that credentials
 * were "issued out of band" -- which meant the account could not sign in at all and
 * nothing on the screen said so. Creating an account now issues an ACTIVATION LINK
 * and the recipient sets their own credential against it. An administrator who can
 * set a password can sign in as that person, and on a platform where a reviewer's
 * determination is the regulatory instrument, that is not a convenience worth having.
 *
 * EVERY ROLE, not five. The console listed Ministry-side accounts only, so an
 * organizer, a provider, a Director or a first-response unit could not be seen here,
 * let alone suspended.
 *
 * THE TWO UNTOUCHABLE ROWS are unchanged and now enforced through lib/rules: nobody
 * edits their own row, and the platform owner's seat is above this console. The bar
 * is returned as a REASON so the screen can name who holds the row rather than
 * rendering a control that does nothing (non-negotiable 10).
 */

/** Resolves the target and the reason an administrator may not act on it. */
function targetOf(
  actor: { id: number; isDemo: boolean },
  login: string,
): { id: number; role: string; displayName: string } | null {
  const row = getDb()
    .prepare(`SELECT id, role, display_name, is_demo FROM accounts WHERE login = ?`)
    .get(login) as { id: number; role: string; display_name: string; is_demo: number } | undefined;
  if (!row) return null;
  // Demonstration isolation is symmetric: an administrator acts within their own
  // world in both directions, or a real one could suspend a showcase account and a
  // demonstration one could suspend a real reviewer.
  if ((row.is_demo === 1) !== actor.isDemo) return null;
  const bar = administrationBar(
    { id: actor.id, isDemo: actor.isDemo },
    { id: row.id, role: row.role, isDemo: row.is_demo === 1 },
  );
  if (bar !== null) return null;
  return { id: row.id, role: row.role, displayName: row.display_name };
}

/** Issues a single-use activation link. Replacing one stops the previous working. */
function issueActivation(accountId: number, issuedBy: number): string {
  const db = getDb();
  // A new link supersedes the old: two live links to one account would mean a
  // withdrawn invitation could still be used.
  db.prepare(
    `UPDATE password_resets SET used_at = now_stamp()
     WHERE account_id = ? AND kind = 'activation' AND used_at IS NULL`,
  ).run(accountId);
  const token = randomBytes(32).toString('hex');
  db.prepare(
    `INSERT INTO password_resets (token, account_id, kind, issued_by, expires_at)
     VALUES (?, ?, 'activation', ?, datetime('now', ?))`,
  ).run(token, accountId, issuedBy, `+${ACTIVATION_EXPIRY_HOURS} hours`);
  return token;
}

export async function addMinistryUserAction(formData: FormData): Promise<void> {
  const actor = await requireMinistry('manageUsers');
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? '');
  if (!name || !email || !isAssignableRole(role)) {
    redirect('/ministry/admin/users?error=fields');
  }
  const db = getDb();
  if (db.prepare(`SELECT id FROM accounts WHERE email = ?`).get(email)) {
    redirect('/ministry/admin/users?error=email-taken');
  }
  const initials = name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  // NO password_hash is written here, and none is accepted from the form. The column
  // stays NULL until the holder sets one through their activation link.
  const created = db
    .prepare(
      `INSERT INTO accounts (login, email, display_name, initials, role, is_demo)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(`acct_${randomBytes(6).toString('hex')}`, email, name, initials, role, actor.isDemo ? 1 : 0);
  const token = issueActivation(created.lastInsertRowid as number, actor.id);
  revalidatePath('/ministry/admin/users');
  redirect(`/ministry/admin/users?notice=invited&token=${token}`);
}

/** Re-issues the link for an account that never activated. */
export async function reissueActivationAction(login: string): Promise<void> {
  const actor = await requireMinistry('manageUsers');
  const target = targetOf(actor, login);
  if (!target) redirect('/ministry/admin/users');
  const row = getDb()
    .prepare(`SELECT password_hash FROM accounts WHERE id = ?`)
    .get(target.id) as { password_hash: string | null } | undefined;
  // An activated account does not get an activation link. Its holder resets their own
  // password; an administrator issuing one here would be a way to take the account.
  if (!row || row.password_hash !== null) redirect('/ministry/admin/users?error=already-active');
  const token = issueActivation(target.id, actor.id);
  revalidatePath('/ministry/admin/users');
  redirect(`/ministry/admin/users?notice=reissued&token=${token}`);
}

export async function changeUserRoleAction(login: string, formData: FormData): Promise<void> {
  const actor = await requireMinistry('manageUsers');
  const role = String(formData.get('role') ?? '');
  if (!isAssignableRole(role)) redirect('/ministry/admin/users');
  const target = targetOf(actor, login);
  if (!target) redirect('/ministry/admin/users');
  getDb().prepare(`UPDATE accounts SET role = ? WHERE id = ?`).run(role, target.id);
  revalidatePath('/ministry/admin/users');
  redirect('/ministry/admin/users?notice=role-changed');
}

export async function setUserSuspensionAction(login: string, formData: FormData): Promise<void> {
  const actor = await requireMinistry('manageUsers');
  const suspend = String(formData.get('suspend') ?? '') === '1';
  const target = targetOf(actor, login);
  if (!target) redirect('/ministry/admin/users');
  getDb().prepare(`UPDATE accounts SET suspended = ? WHERE id = ?`).run(suspend ? 1 : 0, target.id);
  revalidatePath('/ministry/admin/users');
  redirect(`/ministry/admin/users?notice=${suspend ? 'suspended' : 'reinstated'}`);
}

/**
 * CREATE an inspection on a submission. Until this existed the only INSERT was the
 * seeder: on any non-demonstration submission the "schedule" control mutated rows
 * that could never exist. Blocking is set at creation and toggleable after --
 * whether an inspection gates the satisfied outcome is the scheduler's call.
 */
export async function createInspectionAction(eventId: string, formData: FormData): Promise<void> {
  // The gate, not an identity: who CONDUCTS the inspection is a field below, and it
  // used to be silently whoever clicked this.
  await requireMinistry('scheduleInspection');
  const titleEn = String(formData.get('titleEn') ?? '').trim();
  const titleAr = String(formData.get('titleAr') ?? '').trim();
  const date = String(formData.get('date') ?? '').trim();
  const blocking = String(formData.get('blocking') ?? '') === '1';
  if (!titleEn || !titleAr) redirect(`/ministry/submissions/${eventId}?error=inspection-titles`);
  const db = getDb();
  const ev = db
    .prepare(`SELECT is_demo, name_en, name_ar FROM events WHERE id = ?`)
    .get(eventId) as { is_demo: number; name_en: string; name_ar: string } | undefined;
  if (!ev) redirect('/ministry/queue');

  // WHO CONDUCTS IT is an input now, not the identity of whoever clicked. Validated
  // against the accounts that actually hold the power -- a free-text name would let
  // an inspection be assigned to somebody who cannot record its findings, which is a
  // scheduled inspection nobody will ever complete.
  const named = String(formData.get('inspector') ?? '').trim();
  const candidates = inspectorCandidates(ev.is_demo === 1);
  const inspector = candidates.find((c) => c.displayName === named)?.displayName;
  if (!inspector) redirect(`/ministry/submissions/${eventId}?error=inspector`);

  db.prepare(
    `INSERT INTO inspections (event_id, title_en, title_ar, inspector, state, date, blocking, is_demo)
     VALUES (?, ?, ?, ?, ?, NULLIF(?, ''), ?, ?)`,
  ).run(eventId, titleEn, titleAr, inspector, date ? 'scheduled' : 'none', date, blocking ? 1 : 0, ev.is_demo);

  // THE ORGANIZER IS TOLD. An inspection scheduled on a submission and never
  // mentioned to the party being inspected is the definition of an outstanding thing
  // with no owner on the side that has to accommodate it.
  const S = MINISTRY_CONTENT.scheduleInspection;
  notifyEventOwner(
    eventId,
    `${S.notifyTitleEn} — ${ev.name_en}`,
    `${S.notifyTitleAr} — ${ev.name_ar}`,
    `${S.notifyBodyEn} ${titleEn}. ${date ? `Scheduled for ${date}.` : S.notifyNoDateEn}`,
    `${S.notifyBodyAr} ${titleAr}. ${date ? `مقرَّر في ⁦${date}⁩.` : S.notifyNoDateAr}`,
    `/events/${eventId}/requirements`,
  );
  revalidatePath(`/ministry/submissions/${eventId}`);
  redirect(`/ministry/submissions/${eventId}?notice=inspection-scheduled`);
}

/**
 * REVISING a determination: a second regulatory act, never an overwrite.
 *
 * The original stays in the table and in the history panel, marked as superseded by
 * this one. A reason is required and is not optional politeness -- a determination
 * that changed with no recorded reason is a determination nobody can account for, and
 * the organizer has already acted on the first one.
 */
export async function reviseOutcomeAction(eventId: string, formData: FormData): Promise<void> {
  const actor = await requireMinistry('recordOutcome');
  const outcome = String(formData.get('outcome') ?? '');
  if (!['incomplete', 'revision', 'satisfied'].includes(outcome)) redirect(`/ministry/submissions/${eventId}`);
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) redirect(`/ministry/submissions/${eventId}?error=revision-reason`);

  const db = getDb();
  const standing = db
    .prepare(`SELECT id, outcome FROM determinations WHERE event_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`)
    .get(eventId) as { id: number; outcome: string } | undefined;
  // Nothing to revise: this is the first determination, and that is the other action.
  if (!standing) redirect(`/ministry/submissions/${eventId}?error=nothing-to-revise`);

  const blockers = await outcomeBlockersFor(eventId);
  const availability = outcomeAvailability(blockers).find((o) => o.key === outcome);
  if (!availability?.available) redirect(`/ministry/submissions/${eventId}?error=gated`);

  const note = String(formData.get('note') ?? '').trim();
  db.prepare(
    `INSERT INTO determinations (event_id, outcome, note, recorded_by, supersedes, revision_reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(eventId, outcome, note, actor.displayName, standing.id, reason);

  const def = MINISTRY_CONTENT.outcomes.find((o) => o.key === outcome);
  const ev = db.prepare(`SELECT name_en, name_ar, moph_reference FROM events WHERE id = ?`).get(eventId) as { name_en: string; name_ar: string; moph_reference: string | null };
  notifyEventOwner(
    eventId,
    `A revised determination — ${ev.moph_reference ?? ev.name_en}`,
    `نتيجة معدَّلة — ${ev.moph_reference ?? ev.name_ar}`,
    `The Ministry has recorded a revised determination on your submission: ${def?.en ?? outcome}. The reason, as written: “${verbatimQuote(reason)}”. The determination it replaces remains on the record. Your reference number does not change.`,
    `سجّلت الوزارة نتيجة معدَّلة على تقديمكم: ${def?.ar ?? outcome}. والسبب كما كُتب: «${verbatimQuote(reason)}». وتبقى النتيجة التي استُبدلت مسجَّلة. ولا يتغير رقمكم المرجعي.`,
    `/events/${eventId}`,
  );
  revalidatePath(`/ministry/submissions/${eventId}`);
  revalidatePath('/dashboard');
  revalidatePath(`/events/${eventId}`);
  redirect(`/ministry/submissions/${eventId}?notice=revised`);
}

/** Toggle whether an inspection blocks the satisfied outcome. */
export async function setInspectionBlockingAction(inspectionId: number, formData: FormData): Promise<void> {
  await requireMinistry('scheduleInspection');
  const blocking = String(formData.get('blocking') ?? '') === '1';
  const db = getDb();
  const row = db.prepare(`SELECT event_id FROM inspections WHERE id = ?`).get(inspectionId) as { event_id: string } | undefined;
  if (!row) redirect('/ministry/queue');
  db.prepare(`UPDATE inspections SET blocking = ? WHERE id = ?`).run(blocking ? 1 : 0, inspectionId);
  revalidatePath(`/ministry/submissions/${row.event_id}`);
  redirect(`/ministry/submissions/${row.event_id}`);
}

/**
 * Applicability (Protocol 3): log a referral, determine it in or out of scope
 * with reasons, designate an in-scope event. Determination of applicability is
 * a Ministry act on its own record -- no organizer account exists yet, and the
 * record says what happens next in either direction.
 */
export async function logReferralAction(formData: FormData): Promise<void> {
  const actor = await requireMinistry('respondEnquiry');
  const eventName = String(formData.get('eventName') ?? '').trim();
  const source = String(formData.get('source') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  if (!eventName) redirect('/ministry/applicability?error=name');
  getDb()
    .prepare(
      `INSERT INTO applicability_records (event_name, source, note, recorded_by, is_demo)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(eventName, source, note, actor.displayName, actor.isDemo ? 1 : 0);
  revalidatePath('/ministry/applicability');
  redirect('/ministry/applicability?notice=logged');
}

export async function determineApplicabilityAction(recordId: number, formData: FormData): Promise<void> {
  const actor = await requireMinistry('recordOutcome');
  const determination = String(formData.get('determination') ?? '');
  const reasons = String(formData.get('reasons') ?? '').trim();
  const designated = String(formData.get('designated') ?? '') === '1';
  if (!['in_scope', 'out_of_scope'].includes(determination) || !reasons) {
    redirect('/ministry/applicability?error=reasons');
  }
  getDb()
    .prepare(
      `UPDATE applicability_records SET determination = ?, reasons = ?, designated = ?, recorded_by = ?, determined_at = now_stamp() WHERE id = ?`,
    )
    .run(determination, reasons, determination === 'in_scope' && designated ? 1 : 0, actor.displayName, recordId);
  revalidatePath('/ministry/applicability');
  redirect('/ministry/applicability?notice=determined');
}
