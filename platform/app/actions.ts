'use server';

/**
 * Server actions for Slice 1: sign-in, sign-out, account creation, organization
 * registration, event creation with assessment, notification read-marking.
 *
 * Every regulatory decision is delegated to lib/rules -- nothing here derives a level
 * or invents a gate.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { getDb, nextRecordId } from '../lib/db';
import {
  checkPasswordPolicy,
  hashPassword,
  verifyPassword,
  RESET_EXPIRY_MINUTES,
} from '../lib/password';
import {
  currentAccount,
  endSession,
  findAccountByLogin,
  startSession,
} from '../lib/auth';
import { NEHRAT_TOOL_VERSION, deriveLevel } from '../lib/rules';
import type { DomainAnswers, MinimumConditionInputs } from '../lib/rules';

const DEMO_LOGINS = new Set([
  'test_organizer',
  'test_organizer_pending',
  'test_ems',
  'test_director',
  'test_response',
  'test_moph',
  'test_moph_admin',
]);

export async function demoSignInAction(formData: FormData): Promise<void> {
  const login = String(formData.get('login') ?? '');
  if (!DEMO_LOGINS.has(login)) redirect('/signin?error=unknown');
  const account = findAccountByLogin(login);
  if (!account) redirect('/signin?error=unknown');
  await startSession(account.id);
  // Only the organizer surface exists in Slice 1. Other demonstration roles land on
  // their dashboards in later slices; until then their sign-in routes to the organizer
  // journey is wrong, so they return to sign-in with a build notice.
  if (account.role !== 'organizer') redirect('/signin?notice=role-later-slice');
  redirect('/dashboard');
}

export async function signInWithPasswordAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) redirect('/signin?error=credentials');
  const row = getDb()
    .prepare(`SELECT id, password_hash FROM accounts WHERE email = ?`)
    .get(email) as { id: number; password_hash: string | null } | undefined;
  // One failure answer: whether the email exists is not disclosed.
  if (!row?.password_hash || !verifyPassword(password, row.password_hash)) {
    redirect('/signin?error=credentials');
  }
  await startSession(row.id);
  redirect('/dashboard');
}

export async function createAccountAction(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const organization = String(formData.get('organization') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!name) redirect('/signin?mode=signup&error=name-required');
  if (!email) redirect('/signin?mode=signup&error=email-required');
  if (!checkPasswordPolicy(password).ok) redirect('/signin?mode=signup&error=password-policy');
  const exists = getDb().prepare(`SELECT id FROM accounts WHERE email = ?`).get(email);
  if (exists) redirect('/signin?mode=signup&error=email-taken');
  const initials = name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const login = `user_${Date.now().toString(36)}`;
  const result = getDb()
    .prepare(
      `INSERT INTO accounts (login, email, password_hash, display_name, initials, role, is_demo)
       VALUES (?, ?, ?, ?, ?, 'organizer', 0)`,
    )
    .run(login, email, hashPassword(password), name, initials);
  await startSession(result.lastInsertRowid as number);
  // The reference: after creating the account you continue to the organization
  // registration form. The organization name captured here pre-fills it.
  redirect(organization ? `/organization?name=${encodeURIComponent(organization)}` : '/organization');
}

/**
 * Issues a reset token: expires per policy (one hour), single-use. The review build has
 * no mail transport, so the confirmation screen says the link was recorded; sending is
 * deployment configuration.
 */
export async function requestPasswordResetAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (email) {
    const row = getDb().prepare(`SELECT id FROM accounts WHERE email = ?`).get(email) as
      | { id: number }
      | undefined;
    if (row) {
      const token = randomBytes(32).toString('hex');
      getDb()
        .prepare(
          `INSERT INTO password_resets (token, account_id, expires_at)
           VALUES (?, ?, datetime('now', ?))`,
        )
        .run(token, row.id, `+${RESET_EXPIRY_MINUTES} minutes`);
    }
  }
  // The answer is uniform whether or not the email exists.
  redirect('/signin?mode=reset&notice=reset-sent');
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect('/signin');
}

export async function registerOrganizationAction(formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const nameEn = String(formData.get('nameEn') ?? '').trim();
  const nameAr = String(formData.get('nameAr') ?? '').trim();
  if (!nameEn || !nameAr) redirect('/organization?error=both-names');
  getDb()
    .prepare(
      `INSERT INTO organizations (account_id, name_en, name_ar, status, is_demo)
       VALUES (?, ?, ?, 'pending', ?)
       ON CONFLICT (account_id) DO UPDATE SET name_en = excluded.name_en, name_ar = excluded.name_ar`,
    )
    .run(account.id, nameEn, nameAr, account.isDemo ? 1 : 0);
  revalidatePath('/organization');
  revalidatePath('/dashboard');
  redirect('/organization');
}

export interface PartAFields {
  eventType: string;
  venueRoute: string;
  municipalities: string;
  openingTime: string;
  closingTime: string;
  expectedParticipants: number | null;
  expectedSpectators: number | null;
  expectedStaff: number | null;
  previousEdition: boolean;
  recurringFixedVenue: boolean;
}

export interface AssessmentSubmission {
  nameEn: string;
  nameAr: string;
  startDate: string;
  endDate: string;
  partA: PartAFields;
  answers: DomainAnswers;
  inputs: MinimumConditionInputs;
}

/**
 * Creates the event and its first assessment version. The level is derived here, by
 * lib/rules, at save -- and recomputed at read. It is never accepted from the client.
 */
export async function createEventAction(payload: AssessmentSubmission): Promise<{ eventId: string } | { error: string }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');

  const derivation = deriveLevel({ answers: payload.answers, inputs: payload.inputs });

  if (!payload.nameEn.trim() || !payload.nameAr.trim()) {
    return { error: 'name-required' };
  }
  if (!payload.startDate || !payload.endDate) {
    return { error: 'dates-required' };
  }

  const db = getDb();
  const eventId = nextRecordId('EV');
  const a = payload.partA;
  db.prepare(
    `INSERT INTO events (id, account_id, name_en, name_ar, start_date, end_date,
       event_type, venue_route, municipalities, opening_time, closing_time,
       expected_participants, expected_spectators, expected_staff,
       previous_edition, recurring_fixed_venue, filed, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(
    eventId,
    account.id,
    payload.nameEn.trim(),
    payload.nameAr.trim(),
    payload.startDate,
    payload.endDate,
    a.eventType.trim(),
    a.venueRoute.trim(),
    a.municipalities.trim(),
    a.openingTime,
    a.closingTime,
    a.expectedParticipants,
    a.expectedSpectators,
    a.expectedStaff,
    a.previousEdition ? 1 : 0,
    a.recurringFixedVenue ? 1 : 0,
    account.isDemo ? 1 : 0,
  );
  db.prepare(
    `INSERT INTO assessments (event_id, version, answers, inputs, derivation, nehrat_tool_version)
     VALUES (?, 1, ?, ?, ?, ?)`,
  ).run(
    eventId,
    JSON.stringify(payload.answers),
    JSON.stringify(payload.inputs),
    JSON.stringify(derivation),
    NEHRAT_TOOL_VERSION,
  );
  revalidatePath('/dashboard');
  return { eventId };
}

/**
 * A re-assessment creates a new version; the previous one remains readable (SPEC 1).
 */
export async function reassessAction(
  eventId: string,
  payload: Pick<AssessmentSubmission, 'answers' | 'inputs'>,
): Promise<{ version: number } | { error: string }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const db = getDb();
  const owned = db
    .prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`)
    .get(eventId, account.id);
  if (!owned) return { error: 'not-found' };

  const derivation = deriveLevel({ answers: payload.answers, inputs: payload.inputs });
  const latest = db
    .prepare(`SELECT MAX(version) AS v FROM assessments WHERE event_id = ?`)
    .get(eventId) as { v: number | null };
  const version = (latest.v ?? 0) + 1;
  db.prepare(
    `INSERT INTO assessments (event_id, version, answers, inputs, derivation, nehrat_tool_version)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(eventId, version, JSON.stringify(payload.answers), JSON.stringify(payload.inputs), JSON.stringify(derivation), NEHRAT_TOOL_VERSION);
  revalidatePath(`/events/${eventId}`);
  return { version };
}

export async function markNotificationReadAction(id: number): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  getDb()
    .prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND account_id = ?`)
    .run(id, account.id);
  revalidatePath('/notifications');
}

/* ---------------- Slice 2 actions ---------------- */

function ownedEvent(accountId: number, eventId: string): boolean {
  return Boolean(
    getDb().prepare(`SELECT id FROM events WHERE id = ? AND account_id = ?`).get(eventId, accountId),
  );
}

/** Records an attachment (review build: the declared file name; storage is deployment). */
export async function attachDocumentAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  const docKey = String(formData.get('docKey') ?? '');
  const fileName = String(formData.get('fileName') ?? '').trim();
  if (docKey && fileName) {
    getDb()
      .prepare(
        `INSERT INTO event_attachments (event_id, doc_key, file_name) VALUES (?, ?, ?)
         ON CONFLICT (event_id, doc_key) DO UPDATE SET file_name = excluded.file_name, attached_at = datetime('now')`,
      )
      .run(eventId, docKey, fileName);
  }
  revalidatePath(`/events/${eventId}/requirements`);
  redirect(`/events/${eventId}/requirements`);
}

/**
 * Names a party from inside the requirement that needs them (SPEC 5c). The token is the
 * invitation: unguessable, never sequential. The review build records the link rather
 * than sending mail; the invited party self-registers against it (Slice 5).
 */
export async function inviteParticipantAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  const kind = String(formData.get('kind') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  if ((kind === 'ems' || kind === 'director') && name && email) {
    const token = randomBytes(24).toString('hex');
    getDb()
      .prepare(
        `INSERT INTO invitations (token, event_id, kind, name_en, name_ar, email) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(token, eventId, kind, name, name, email);
  }
  revalidatePath(`/events/${eventId}/requirements`);
  redirect(`/events/${eventId}/requirements`);
}

export interface PlanPayload {
  mode: 'write' | 'attach';
  refConfirmed: boolean;
  sections: Record<string, { text?: string; covered?: boolean }>;
  attachedFile: string | null;
  majorIncident: Record<string, { covered?: boolean }>;
}

/** Saves the plan. Saving bumps the version; prior versions remain in the audit trail. */
export async function savePlanAction(eventId: string, payload: PlanPayload): Promise<{ ok: true } | { error: string }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) return { error: 'not-found' };
  getDb()
    .prepare(
      `INSERT INTO plans (event_id, mode, ref_confirmed, sections, attached_file, major_incident, version)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT (event_id) DO UPDATE SET
         mode = excluded.mode, ref_confirmed = excluded.ref_confirmed, sections = excluded.sections,
         attached_file = excluded.attached_file, major_incident = excluded.major_incident,
         version = plans.version + 1, updated_at = datetime('now')`,
    )
    .run(eventId, payload.mode, payload.refConfirmed ? 1 : 0, JSON.stringify(payload.sections), payload.attachedFile, JSON.stringify(payload.majorIncident));
  revalidatePath(`/events/${eventId}/plan`);
  return { ok: true };
}

export interface CompliancePayload {
  declarations: Record<string, boolean>;
  insurance: Record<string, string>;
  representative: string;
  telephone: string;
  position: string;
}

export async function saveComplianceAction(eventId: string, payload: CompliancePayload): Promise<{ ok: true } | { error: string }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) return { error: 'not-found' };
  getDb()
    .prepare(
      `INSERT INTO submissions (event_id, declarations, insurance, representative, telephone, position)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (event_id) DO UPDATE SET
         declarations = excluded.declarations, insurance = excluded.insurance,
         representative = excluded.representative, telephone = excluded.telephone,
         position = excluded.position`,
    )
    .run(eventId, JSON.stringify(payload.declarations), JSON.stringify(payload.insurance), payload.representative, payload.telephone, payload.position);
  revalidatePath(`/events/${eventId}/submit`);
  return { ok: true };
}

/**
 * Files the submission. The gate is recomputed HERE, server-side -- the screen's gate is
 * presentation. Assigns the Ministry reference; a submission counts as received only
 * when the acknowledgment carries it (Protocol 9).
 */
export async function fileSubmissionAction(eventId: string): Promise<{ reference: string } | { error: string }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) return { error: 'not-found' };

  const { submissionGateFor } = await import('../lib/submission-facts');
  const gate = submissionGateFor(account.id, eventId);
  if (!gate.canFile) return { error: 'blocked' };

  const db = getDb();
  const year = new Date().getFullYear();
  const last = db
    .prepare(`SELECT moph_reference AS r FROM events WHERE moph_reference LIKE ? ORDER BY moph_reference DESC LIMIT 1`)
    .get(`MOPH-EV-${year}-%`) as { r: string } | undefined;
  const n = last ? Number.parseInt(last.r.slice(-4), 10) + 1 : 1;
  const reference = `MOPH-EV-${year}-${String(n).padStart(4, '0')}`;

  db.prepare(
    `UPDATE submissions SET filed_at = datetime('now'), moph_reference = ?, expedited = ? WHERE event_id = ?`,
  ).run(reference, gate.expedited ? 1 : 0, eventId);
  db.prepare(`UPDATE events SET filed = 1, moph_reference = ? WHERE id = ?`).run(reference, eventId);
  revalidatePath(`/events/${eventId}`);
  return { reference };
}

export async function reportMaterialChangeAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  const aspects = formData.getAll('aspect').map(String);
  const description = String(formData.get('description') ?? '').trim();
  const effectiveDate = String(formData.get('effectiveDate') ?? '').trim();
  if (aspects.length > 0 && description) {
    getDb()
      .prepare(`INSERT INTO material_changes (event_id, aspects, description, effective_date) VALUES (?, ?, ?, ?)`)
      .run(eventId, JSON.stringify(aspects), description, effectiveDate);
  }
  revalidatePath(`/events/${eventId}/change`);
  redirect(`/events/${eventId}/change?notice=reported`);
}

export interface PostEventPayload {
  activity: Record<string, string>;
  significant: Record<string, boolean>;
  lessonsNone: boolean;
  lessonsText: string;
}

export async function savePostEventReportAction(eventId: string, payload: PostEventPayload): Promise<{ ok: true } | { error: string }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) return { error: 'not-found' };
  // Event-side data minimisation (Protocol 14): the narrative field is name-screened,
  // the same rule the facility incident report carries.
  const { detectPersonalName } = await import('../lib/rules/pii');
  if (!payload.lessonsNone && detectPersonalName(payload.lessonsText)) {
    return { error: 'personal-name' };
  }
  getDb()
    .prepare(
      `INSERT INTO post_event_reports (event_id, activity, significant, lessons_none, lessons_text)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (event_id) DO UPDATE SET
         activity = excluded.activity, significant = excluded.significant,
         lessons_none = excluded.lessons_none, lessons_text = excluded.lessons_text`,
    )
    .run(eventId, JSON.stringify(payload.activity), JSON.stringify(payload.significant), payload.lessonsNone ? 1 : 0, payload.lessonsText);
  revalidatePath(`/events/${eventId}/post-event`);
  return { ok: true };
}

/** The organizer's signature; the Director's arrives with Slice 5. Submission requires all required signatures. */
export async function signAndSubmitPostEventAction(eventId: string): Promise<{ ok: true } | { error: string }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) return { error: 'not-found' };
  const db = getDb();
  const level = (db.prepare(`SELECT demo_level FROM events WHERE id = ?`).get(eventId) as { demo_level: number | null } | undefined)?.demo_level;
  db.prepare(`UPDATE post_event_reports SET organizer_signed_at = datetime('now') WHERE event_id = ?`).run(eventId);
  const row = db.prepare(`SELECT organizer_signed_at, director_signed_at FROM post_event_reports WHERE event_id = ?`).get(eventId) as
    | { organizer_signed_at: string | null; director_signed_at: string | null }
    | undefined;
  if (!row?.organizer_signed_at) return { error: 'not-saved' };
  // Level 3 carries two signatures; it is not complete with one (SPEC 5).
  if (level === 3 && !row.director_signed_at) {
    revalidatePath(`/events/${eventId}/post-event`);
    return { error: 'awaiting-director' };
  }
  db.prepare(`UPDATE post_event_reports SET submitted_at = datetime('now') WHERE event_id = ?`).run(eventId);
  revalidatePath(`/events/${eventId}/post-event`);
  return { ok: true };
}

/** Protocol 13: records the 24-hour serious-incident notification to the Ministry. */
export async function notifySeriousIncidentAction(eventId: string): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  getDb()
    .prepare(`INSERT INTO serious_incident_notifications (event_id) VALUES (?)`)
    .run(eventId);
  revalidatePath(`/events/${eventId}/post-event`);
  redirect(`/events/${eventId}/post-event`);
}
