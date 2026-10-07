'use server';

/**
 * Server actions for the single record page: one answer per requirement, saved once
 * by whoever is authorized, with the version checked so a stale save shows a conflict
 * instead of silently overwriting (brief item 11); files on the rows that take one;
 * the Medical Director's approval of the current plan version (D4).
 *
 * Every rule is delegated to lib/rules: the catalogue says which keys exist at the
 * level and who may enter them; the resolver says what is complete. Nothing here
 * derives a gate.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentAccount, type Account } from '../lib/auth';
import { getDb } from '../lib/db';
import { recordRequirementsFor, type RecordRequirements } from '../lib/record-facts';
import { EVENT_FILE_KEYS } from '../lib/requirement-migration';
import { venueAccess } from '../lib/venue/collaboration';
import { authorsFor, fieldsFor, planTextKeys, type AnswerValue, type AuthorRole, type FieldDef, type RecordService } from '../lib/rules';
import { maxUploadBytes, refuseUpload } from '../lib/rules/uploads';

export type SaveAnswerResult = { ok: true; version: number } | { error: 'conflict' | 'forbidden' | 'invalid' | 'locked' | 'not-found'; fields?: string[] };

interface RecordAccess {
  ownerId: number;
  role: AuthorRole;
  invitationToken: string | null;
  invitationName: string | null;
}

/**
 * Who the signed-in account is on this record: the owner is the organizer; a medical
 * account is its role only through a CONFIRMED invitation on this record (rule 6).
 */
function recordAccess(account: Account, kind: RecordService, id: string): RecordAccess | null {
  const db = getDb();
  if (kind === 'event') {
    const event = db.prepare(`SELECT account_id, is_demo FROM events WHERE id = ?`).get(id) as { account_id: number; is_demo: number } | undefined;
    if (!event || event.is_demo !== Number(account.isDemo)) return null;
    if (event.account_id === account.id) return { ownerId: event.account_id, role: 'organizer', invitationToken: null, invitationName: null };
    if (account.role !== 'ems' && account.role !== 'director') return null;
    const inv = db.prepare(`SELECT token, name_en FROM invitations WHERE event_id = ? AND account_id = ? AND kind = ? AND status = 'confirmed'`).get(id, account.id, account.role) as { token: string; name_en: string } | undefined;
    return inv ? { ownerId: event.account_id, role: account.role, invitationToken: inv.token, invitationName: inv.name_en } : null;
  }
  const access = venueAccess(account, id);
  if (!access) return null;
  return { ownerId: access.ownerId, role: access.role, invitationToken: access.invitation?.token ?? null, invitationName: access.invitation?.name ?? null };
}

function routeFor(kind: RecordService, id: string): string {
  return kind === 'event' ? `/events/${id}` : `/venues/${id}`;
}

function refresh(kind: RecordService, id: string): void {
  revalidatePath(routeFor(kind, id), 'layout');
  revalidatePath('/dashboard');
  if (kind === 'event') revalidatePath(`/ministry/submissions/${id}`);
  else { revalidatePath(`/venue-team/${id}`); revalidatePath(`/ministry/venues/${id}`); }
}

/** Coerce and validate one posted value against its field; undefined means refused. */
function coerce(field: FieldDef, raw: unknown): AnswerValue | undefined {
  switch (field.type) {
    case 'checkbox':
      return raw === true || raw === 'true' || raw === 'on' ? true : false;
    case 'number': {
      if (raw === '' || raw === null || raw === undefined) return '';
      const n = Number(raw);
      return Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000 ? n : undefined;
    }
    case 'choice': {
      const v = String(raw ?? '');
      return v === '' || field.options?.some((o) => o.value === v) ? v : undefined;
    }
    case 'date': {
      const v = String(raw ?? '').trim();
      return v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
    }
    default: {
      const v = String(raw ?? '').replace(/\r\n/g, '\n');
      return v.length <= (field.type === 'textarea' ? 5000 : 500) ? v.trim() : undefined;
    }
  }
}

/** Keys whose change is a change to the plan (and so reopens the Director's approval). */
function touchesPlan(record: RecordRequirements, key: string): boolean {
  if (planTextKeys().includes(key)) return true;
  const inst = record.instances.find((i) => i.key === key);
  return Boolean(inst && inst.linkedPlan.length > 0);
}

function bumpPlanVersion(kind: RecordService, id: string, actorId: number): void {
  const db = getDb();
  if (kind === 'event') {
    db.prepare(
      `INSERT INTO plans (event_id, version, updated_at, updated_by) VALUES (?, 1, now_stamp(), ?)
       ON CONFLICT (event_id) DO UPDATE SET version = plans.version + 1, updated_at = now_stamp(), updated_by = excluded.updated_by`,
    ).run(id, actorId);
  } else {
    db.prepare(`UPDATE venue_packages SET work_revision = work_revision + 1 WHERE venue_id = ?`).run(id);
    db.prepare(`DELETE FROM venue_plan_approvals WHERE venue_id = ?`).run(id);
  }
}

export async function saveRequirementAnswerAction(
  kind: RecordService,
  id: string,
  key: string,
  payload: { baseVersion: number; values: Record<string, unknown> },
): Promise<SaveAnswerResult> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const access = recordAccess(account, kind, id);
  if (!access) return { error: 'not-found' };
  const record = recordRequirementsFor(kind, access.ownerId, id);
  if (!record || record.level === null) return { error: 'not-found' };
  if (!record.editable) return { error: 'locked' };
  const fields = fieldsFor(key, record.level, kind);
  if (!fields) return { error: 'invalid' };
  if (!authorsFor(key, record.level, kind).includes(access.role)) return { error: 'forbidden' };

  const values: Record<string, AnswerValue> = {};
  const refused: string[] = [];
  for (const f of fields) {
    const v = coerce(f, payload.values[f.key]);
    if (v === undefined) refused.push(f.key);
    else if (v !== '' && v !== false) values[f.key] = v;
  }
  if (refused.length > 0) return { error: 'invalid', fields: refused };

  const db = getDb();
  let result: SaveAnswerResult = { error: 'conflict' };
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = db.prepare(`SELECT version, answers, author_id, author_role, author_name, saved_at FROM requirement_answers WHERE record_kind = ? AND record_id = ? AND key = ?`).get(kind, id, key) as
      { version: number; answers: string; author_id: number | null; author_role: string; author_name: string; saved_at: string } | undefined;
    const version = current?.version ?? 0;
    if (version !== Number(payload.baseVersion)) throw new Error('STALE');
    if (current) {
      db.prepare(`INSERT INTO requirement_answer_history (record_kind, record_id, key, answers, author_id, author_role, author_name, version, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(kind, id, key, current.answers, current.author_id, current.author_role, current.author_name, current.version, current.saved_at);
    }
    const authorName = access.role === 'organizer' ? account.displayName : `${account.displayName}${access.invitationName ? ` — ${access.invitationName}` : ''}`;
    db.prepare(
      `INSERT INTO requirement_answers (record_kind, record_id, key, answers, author_id, author_role, author_name, version, saved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, now_stamp())
       ON CONFLICT (record_kind, record_id, key) DO UPDATE SET answers = excluded.answers, author_id = excluded.author_id,
         author_role = excluded.author_role, author_name = excluded.author_name, version = excluded.version, saved_at = now_stamp()`,
    ).run(kind, id, key, JSON.stringify(values), account.id, access.role, authorName, version + 1);
    // A material edit to anything the plan reads reopens the Director's approval (D4).
    if (record.level >= 2 && touchesPlan(record, key)) bumpPlanVersion(kind, id, account.id);
    db.exec('COMMIT');
    result = { ok: true, version: version + 1 };
  } catch (error) {
    db.exec('ROLLBACK');
    if (!(error instanceof Error && error.message === 'STALE')) throw error;
  }
  refresh(kind, id);
  return result;
}

/**
 * A file on a row that takes one: the map, the deployment map, the insurance
 * evidence, a supporting plan document. Events keep their files in event_attachments
 * under the document keys the serving route and the reviewer already read.
 */
export async function saveRequirementFileAction(kind: RecordService, id: string, key: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const access = recordAccess(account, kind, id);
  if (!access) redirect('/dashboard');
  const record = recordRequirementsFor(kind, access.ownerId, id)!;
  const back = access.role === 'organizer' ? routeFor(kind, id) : kind === 'event' ? `/events/${id}` : `/venue-team/${id}`;
  const anchor = `#req-${key}`;
  const inst = record.instances.find((i) => i.key === key);
  if (!record.editable || record.level === null || !inst?.file || !authorsFor(key, record.level, kind).includes(access.role)) redirect(`${back}?error=forbidden${anchor}`);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) redirect(`${back}${anchor}`);
  const refusal = refuseUpload({ type: file.type, size: file.size });
  if (refusal) redirect(`${back}?upload=${refusal.reason}&doc=${encodeURIComponent(key)}${anchor}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > maxUploadBytes()) redirect(`${back}?upload=tooLarge&doc=${encodeURIComponent(key)}${anchor}`);
  const db = getDb();
  if (kind === 'event') {
    const docKey = EVENT_FILE_KEYS[key];
    if (!docKey) redirect(`${back}?error=forbidden${anchor}`);
    db.prepare(
      `INSERT INTO event_attachments (event_id, doc_key, file_name, content_type, byte_size, bytes) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (event_id, doc_key) DO UPDATE SET file_name = excluded.file_name, content_type = excluded.content_type,
         byte_size = excluded.byte_size, bytes = excluded.bytes, attached_at = now_stamp()`,
    ).run(id, docKey, file.name.trim(), file.type, bytes.length, bytes);
  } else {
    db.prepare(
      `INSERT INTO venue_attachments (venue_id, doc_key, file_name, content_type, byte_size, bytes) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (venue_id, doc_key) DO UPDATE SET file_name = excluded.file_name, content_type = excluded.content_type,
         byte_size = excluded.byte_size, bytes = excluded.bytes, attached_at = now_stamp()`,
    ).run(id, key, file.name.trim(), file.type, bytes.length, bytes);
  }
  if (record.level >= 2 && touchesPlan(record, key)) bumpPlanVersion(kind, id, account.id);
  refresh(kind, id);
  redirect(`${back}?saved=${encodeURIComponent(key)}${anchor}`);
}

export async function removeRequirementFileAction(kind: RecordService, id: string, key: string): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const access = recordAccess(account, kind, id);
  if (!access) redirect('/dashboard');
  const record = recordRequirementsFor(kind, access.ownerId, id)!;
  const back = access.role === 'organizer' ? routeFor(kind, id) : kind === 'event' ? `/events/${id}` : `/venue-team/${id}`;
  // A filed package's files are part of what the Ministry read: replaceable, never removed.
  if (!record.editable || record.filed || record.level === null || !authorsFor(key, record.level, kind).includes(access.role)) redirect(`${back}?error=forbidden#req-${key}`);
  if (kind === 'event') {
    const docKey = EVENT_FILE_KEYS[key];
    if (docKey) getDb().prepare(`DELETE FROM event_attachments WHERE event_id = ? AND doc_key = ?`).run(id, docKey);
  } else getDb().prepare(`DELETE FROM venue_attachments WHERE venue_id = ? AND doc_key = ?`).run(id, key);
  refresh(kind, id);
  redirect(`${back}#req-${key}`);
}

/**
 * The named Medical Director approves the CURRENT plan version against the CURRENT
 * assessment version (D4). The form carries both; a mismatch means something changed
 * while they read it, and the approval is refused rather than attached to the wrong
 * version. EMS completion is never approval: only a confirmed Director's invitation
 * can hold the row.
 */
export async function approveRecordPlanAction(kind: RecordService, id: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const access = recordAccess(account, kind, id);
  const back = kind === 'event' ? `/events/${id}` : `/venue-team/${id}`;
  if (!access || access.role !== 'director' || !access.invitationToken) redirect('/dashboard');
  const db = getDb();
  let refused = false;
  db.exec('BEGIN IMMEDIATE');
  try {
    const record = recordRequirementsFor(kind, access.ownerId, id);
    const plan = record?.instances.find((i) => i.key === 'B2');
    const prepared = record?.plan.length ? record.plan.every((s) => s.complete) : false;
    if (!record || !record.editable || record.level !== 3 || !plan || !prepared
      || Number(formData.get('planVersion')) !== record.planVersion
      || Number(formData.get('assessmentVersion')) !== (record.assessmentVersion ?? 0)
      || formData.get('confirm') !== 'yes') {
      refused = true;
    } else if (kind === 'event') {
      db.prepare(`INSERT INTO event_plan_approvals (event_id, plan_version, assessment_version, invitation_token, approved_at) VALUES (?, ?, ?, ?, now_stamp())`)
        .run(id, record.planVersion, record.assessmentVersion ?? 0, access.invitationToken);
    } else {
      db.prepare(`INSERT OR REPLACE INTO venue_plan_approvals (venue_id, invitation_token, assessment_version, approved_at) VALUES (?, ?, ?, now_stamp())`)
        .run(id, access.invitationToken, record.assessmentVersion ?? 0);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  if (!refused) {
    const ev = kind === 'event' ? getDb().prepare(`SELECT account_id, is_demo FROM events WHERE id = ?`).get(id) as { account_id: number; is_demo: number } | undefined
      : getDb().prepare(`SELECT account_id, is_demo FROM venues WHERE id = ?`).get(id) as { account_id: number; is_demo: number } | undefined;
    if (ev) {
      getDb().prepare(`INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo) VALUES (?, 'for_information', ?, ?, ?, ?, ?, now_stamp(), ?)`)
        .run(ev.account_id, 'The Medical Director approved the medical plan', 'اعتمد المدير الطبي الخطة الطبية', id, id, routeFor(kind, id), ev.is_demo);
    }
  }
  refresh(kind, id);
  redirect(`${back}?${refused ? 'error=approval' : 'approval=recorded'}#req-B2`);
}
