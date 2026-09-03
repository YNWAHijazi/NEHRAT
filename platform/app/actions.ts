'use server';

/**
 * Server actions for Slice 1: sign-in, sign-out, account creation, organization
 * registration, event creation with assessment, notification read-marking.
 *
 * Every regulatory decision is delegated to lib/rules -- nothing here derives a level
 * or invents a gate.
 */

import { redirect } from 'next/navigation';
import { beirutToday, nowStamp } from '../lib/clock';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { getDb, nextRecordId } from '../lib/db';
import { archiveWindowDays } from '../lib/queries';
import { UPLOADS_CONTENT, maxUploadBytes, refuseUpload } from '../lib/rules/uploads';
import { missingCertificationFields } from '../lib/rules/certification';
import { verbatimQuote } from '../lib/rules/verbatim';
import {
  checkPasswordPolicy,
  hashPassword,
  verifyPassword,
  RESET_EXPIRY_MINUTES,
} from '../lib/password';
import { forgetSignInFields, rememberSignInFields,
  currentAccount,
  endSession,
  findAccountByLogin,
  startSession,
} from '../lib/auth';
import {
  RECURRING_VENUE_MIN_CAPACITY, NEHRAT_TOOL_VERSION, deriveLevel,
  facilityCategory, categoryWithPublished, categoryEndsJourney, detectPersonalName,
  declarationGate, isArchivedRecord, landingRouteFor } from '../lib/rules';
import type { DomainAnswers, MinimumConditionInputs } from '../lib/rules';

const DEMO_LOGINS = new Set([
  'test_organizer',
  'test_organizer_pending',
  'test_ems',
  'test_director',
  'test_moph',
  'test_moph_admin',
  'test_owner',
]);

export async function demoSignInAction(formData: FormData): Promise<void> {
  const login = String(formData.get('login') ?? '');
  if (!DEMO_LOGINS.has(login)) redirect('/signin?error=unknown');
  const account = findAccountByLogin(login);
  if (!account) redirect('/signin?error=unknown');
  // THE RECORD DECIDES, not the list above. This action signs somebody in with no
  // password, so the only thing standing between it and an authentication bypass is
  // that the account really is a demonstration account. It used to trust DEMO_LOGINS
  // alone -- safe only while the panel was hidden outside a review build, which is an
  // assumption held somewhere else entirely. A real account created with one of those
  // logins would have been signed into without a credential. Now the row is asked.
  if (!account.isDemo) redirect('/signin?error=unknown');
  await startSession(account.id);
  // Each role lands on its own surface -- landingRouteFor, the same derivation the
  // credentialed sign-in uses. This used to be an if-chain here and a bare
  // /dashboard there, and the two disagreed.
  redirect(landingRouteFor(account.role));
}

export async function signInWithPasswordAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  // The email survives a failed attempt so nobody retypes it; the password never does.
  if (!email || !password) {
    await rememberSignInFields({ email });
    redirect('/signin?error=credentials');
  }
  const row = getDb()
    .prepare(`SELECT id, password_hash, role FROM accounts WHERE email = ?`)
    .get(email) as { id: number; password_hash: string | null; role: string } | undefined;
  // One failure answer: whether the email exists is not disclosed.
  if (!row?.password_hash || !verifyPassword(password, row.password_hash)) {
    await rememberSignInFields({ email });
    redirect('/signin?error=credentials');
  }
  await forgetSignInFields();
  await startSession(row.id);
  // The ROLE's landing route, not a hard-coded /dashboard. This line sent every
  // credentialed account to the organizer surface, so a Ministry administrator
  // signing in with an email and password arrived at Events, Venues, Facilities
  // and Start a service -- controls for a job that role does not do.
  redirect(landingRouteFor(row.role));
}

export async function createAccountAction(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const organization = String(formData.get('organization') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const typed = { email, name, organization };
  if (!name) {
    await rememberSignInFields(typed);
    redirect('/signin?mode=signup&error=name-required');
  }
  if (!email) {
    await rememberSignInFields(typed);
    redirect('/signin?mode=signup&error=email-required');
  }
  if (!checkPasswordPolicy(password).ok) {
    await rememberSignInFields(typed);
    redirect('/signin?mode=signup&error=password-policy');
  }
  const exists = getDb().prepare(`SELECT id FROM accounts WHERE email = ?`).get(email);
  if (exists) {
    await rememberSignInFields(typed);
    redirect('/signin?mode=signup&error=email-taken');
  }
  await forgetSignInFields();
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

/**
 * Consumes a single-use link and sets the holder's OWN password.
 *
 * One action for both kinds. An activation (an administrator created the account and
 * the holder has never had a credential) and a reset (they have one and cannot use
 * it) are the same act: prove you hold the link, choose a secret nobody else has
 * seen. Splitting them would give two places for the password policy to drift apart.
 *
 * The link is spent whether or not the sign-in that follows succeeds, and it is spent
 * in the SAME statement that checks it is unspent -- an UPDATE ... WHERE used_at IS
 * NULL, so two submissions of the same link cannot both find it live.
 */
export async function setPasswordFromLinkAction(token: string, formData: FormData): Promise<void> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password !== confirm) redirect(`/activate/${token}?error=mismatch`);
  if (!checkPasswordPolicy(password).ok) redirect(`/activate/${token}?error=policy`);

  const db = getDb();
  const row = db
    .prepare(
      `SELECT p.account_id FROM password_resets p JOIN accounts a ON a.id = p.account_id
       WHERE p.token = ? AND p.used_at IS NULL AND p.expires_at > now_stamp()
         AND a.suspended = 0`,
    )
    .get(token) as { account_id: number } | undefined;
  if (!row) redirect(`/activate/${token}`);

  const spent = db
    .prepare(`UPDATE password_resets SET used_at = now_stamp() WHERE token = ? AND used_at IS NULL`)
    .run(token);
  // Lost the race: another submission of the same link got there first.
  if (spent.changes === 0) redirect(`/activate/${token}`);

  db.prepare(`UPDATE accounts SET password_hash = ? WHERE id = ?`).run(
    hashPassword(password),
    row.account_id,
  );
  await startSession(row.account_id);
  const account = await currentAccount();
  redirect(account ? landingRouteFor(account.role) : '/signin');
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
       ON CONFLICT (account_id) DO UPDATE SET name_en = excluded.name_en, name_ar = excluded.name_ar,
         -- Re-submitting a RETURNED filing sets it pending again; a recorded one is
         -- untouched (the guard below never routes a recorded org here).
         status = CASE WHEN organizations.status = 'returned' THEN 'pending' ELSE organizations.status END,
         return_reason = CASE WHEN organizations.status = 'returned' THEN NULL ELSE organizations.return_reason END`,
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
 * Archived records are read-only (partner review, 2026-09-01). The screens hide every
 * control; this is the half a crafted request meets. One helper so the refusal cannot
 * drift between actions -- the same lesson as the database-path fallback.
 */
function refuseIfArchived(eventId: string): void {
  const row = getDb().prepare(`SELECT archived_at, end_date FROM events WHERE id = ?`).get(eventId) as
    | { archived_at: string | null; end_date: string | null }
    | undefined;
  if (
    row &&
    isArchivedRecord({ archivedAt: row.archived_at, endDate: row.end_date }, beirutToday(), archiveWindowDays())
  ) {
    redirect(`/events/${eventId}?error=archived`);
  }
}

/**
 * REAPPLY (partner ruling, 2026-09-02): a new event prefilled from a concluded one —
 * the event information, the assessment answers, the disciplines, the named
 * providers. Everything except the dates, which the organizer must enter.
 *
 * NOTHING CARRIES OVER AS APPROVED. This is a new record with its own identifier:
 * the level re-derives from whatever the answers now say, every requirement is met
 * again, nominations start unanswered on fresh tokens, and the submission is new —
 * the filing gates apply as if nothing preceded it. The old record stays untouched
 * in Previous services; the new one names what it was copied from. Reading a
 * concluded record to copy it is the one act an archived record permits — it edits
 * nothing and refiles nothing.
 */
export async function reapplyEventAction(sourceEventId: string): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, sourceEventId)) redirect('/dashboard');
  const db = getDb();
  const src = db
    .prepare(
      `SELECT name_en, name_ar, event_type, venue_route, municipalities, opening_time, closing_time,
              expected_participants, expected_spectators, expected_staff, recurring_fixed_venue,
              venue_facility_id, end_date, is_demo
       FROM events WHERE id = ?`,
    )
    .get(sourceEventId) as
    | {
        name_en: string; name_ar: string; event_type: string | null; venue_route: string | null;
        municipalities: string | null; opening_time: string | null; closing_time: string | null;
        expected_participants: number | null; expected_spectators: number | null; expected_staff: number | null;
        recurring_fixed_venue: number; venue_facility_id: string | null; end_date: string | null; is_demo: number;
      }
    | undefined;
  if (!src) redirect('/dashboard');
  // Only a CONCLUDED event reapplies -- a live one is simply continued.
  if (!src.end_date || src.end_date >= beirutToday()) redirect(`/events/${sourceEventId}`);

  const assessment = db
    .prepare(`SELECT answers, inputs FROM assessments WHERE event_id = ? ORDER BY version DESC LIMIT 1`)
    .get(sourceEventId) as { answers: string; inputs: string } | undefined;

  const newId = nextRecordId('EV');
  db.prepare(
    `INSERT INTO events (id, account_id, name_en, name_ar, start_date, end_date,
       event_type, venue_route, municipalities, opening_time, closing_time,
       expected_participants, expected_spectators, expected_staff,
       previous_edition, recurring_fixed_venue, venue_facility_id, filed, is_demo, copied_from)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, ?, ?)`,
  ).run(
    newId, account.id, src.name_en, src.name_ar,
    src.event_type, src.venue_route, src.municipalities, src.opening_time, src.closing_time,
    src.expected_participants, src.expected_spectators, src.expected_staff,
    src.recurring_fixed_venue, src.venue_facility_id, src.is_demo, sourceEventId,
  );

  if (assessment) {
    const answers = JSON.parse(assessment.answers) as DomainAnswers;
    const inputs = JSON.parse(assessment.inputs) as MinimumConditionInputs;
    // Derived FRESH from the copied answers -- never inherited from the old record.
    const derivation = deriveLevel({ answers, inputs });
    db.prepare(
      `INSERT INTO assessments (event_id, version, answers, inputs, derivation, nehrat_tool_version)
       VALUES (?, 1, ?, ?, ?, ?)`,
    ).run(newId, assessment.answers, assessment.inputs, JSON.stringify(derivation), NEHRAT_TOOL_VERSION);
  }

  // The named parties return as FRESH nominations: unanswered, on new unguessable
  // tokens, unlinked -- a nomination is not a confirmation, and last year's answer
  // is not this year's.
  const parties = db
    .prepare(
      `SELECT kind, name_en, name_ar, email FROM invitations
       WHERE event_id = ? AND status IN ('nominated','confirmed') ORDER BY invited_at`,
    )
    .all(sourceEventId) as unknown as { kind: string; name_en: string; name_ar: string; email: string }[];
  const insertInvitation = db.prepare(
    `INSERT INTO invitations (token, event_id, kind, name_en, name_ar, email, status, declaration)
     VALUES (?, ?, ?, ?, ?, ?, 'nominated', 'none')`,
  );
  for (const inv of parties) {
    insertInvitation.run(randomBytes(24).toString('hex'), newId, inv.kind, inv.name_en, inv.name_ar, inv.email);
  }

  revalidatePath('/dashboard');
  redirect(`/events/${newId}?notice=reapplied`);
}

/** The venue lane's half of the same rule: an archived venue record is read-only. */
function refuseIfVenueArchived(venueId: string): void {
  const row = getDb().prepare(`SELECT archived_at FROM venues WHERE id = ?`).get(venueId) as
    | { archived_at: string | null }
    | undefined;
  if (row?.archived_at) redirect(`/venues/${venueId}?error=archived`);
}

/** And the facility lane's: an archived facility record is read-only. */
function refuseIfFacilityArchived(facilityId: string): void {
  const row = getDb().prepare(`SELECT archived_at FROM facilities WHERE id = ?`).get(facilityId) as
    | { archived_at: string | null }
    | undefined;
  if (row?.archived_at) redirect(`/facilities/${facilityId}?error=archived`);
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

/**
 * Stores an attached document -- THE FILE, not its name.
 *
 * The deferred storage decision is taken (reviewer ruling, 2026-08-28): the platform
 * stores the file so the Ministry reviewer can open the route map rather than read
 * that a route map exists. Acceptance is lib/rules/uploads.ts's judgement, not this
 * action's, and a refusal comes back named in both languages -- the organizer is
 * told which mistake they made, never just "invalid".
 *
 * The 20 MB ceiling is enforced HERE, on the server, against the buffer's real
 * length. A client-side accept attribute is a convenience and is not a limit.
 */
export async function attachDocumentAction(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  refuseIfArchived(eventId);
  const docKey = String(formData.get('docKey') ?? '');
  const file = formData.get('file');
  // WHERE TO COME BACK TO. The same attachment can be made from the requirements
  // screen or from the compliance form it belongs to, and sending an organizer back
  // to a different screen than the one they were on is its own small dead end.
  // Constrained to this event's own paths -- a returnTo taken from a form is
  // attacker-controlled text, and an open redirect is not worth the convenience.
  const asked = String(formData.get('returnTo') ?? '');
  const returnTo = /^\/events\/[A-Za-z0-9-]+\/[a-z-]+$/.test(asked) && asked.startsWith(`/events/${eventId}/`)
    ? asked
    : `/events/${eventId}/requirements`;
  if (!docKey || !(file instanceof File)) redirect(returnTo);

  const refusal = refuseUpload({ type: file.type, size: file.size });
  if (refusal) {
    redirect(`${returnTo}?upload=${refusal.reason}&doc=${encodeURIComponent(docKey)}`);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  // The buffer is the truth. A declared size can lie; a length cannot.
  if (bytes.length > maxUploadBytes()) {
    redirect(`${returnTo}?upload=tooLarge&doc=${encodeURIComponent(docKey)}`);
  }
  getDb()
    .prepare(
      `INSERT INTO event_attachments (event_id, doc_key, file_name, content_type, byte_size, bytes)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (event_id, doc_key) DO UPDATE SET
         file_name = excluded.file_name, content_type = excluded.content_type,
         byte_size = excluded.byte_size, bytes = excluded.bytes, attached_at = now_stamp()`,
    )
    .run(eventId, docKey, file.name.trim(), file.type, bytes.length, bytes);
  revalidatePath(`/events/${eventId}/requirements`);
  revalidatePath(returnTo);
  redirect(returnTo);
}

/**
 * Stores the plan document when the organizer attaches an existing plan rather than
 * writing one. Separate from savePlanAction because that one carries a JSON payload
 * from a client component and a file does not travel in JSON.
 */
export async function uploadPlanFileAction(
  eventId: string,
  formData: FormData,
): Promise<{ ok: true; fileName: string } | { error: string; en: string; ar: string }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) return { error: 'not-found', en: '', ar: '' };
  const file = formData.get('file');
  if (!(file instanceof File)) return { error: 'no-file', en: '', ar: '' };
  const refusal = refuseUpload({ type: file.type, size: file.size });
  if (refusal) return { error: refusal.reason, en: refusal.en, ar: refusal.ar };
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > maxUploadBytes()) {
    return { error: 'tooLarge', en: UPLOADS_CONTENT.copy.tooLargeEn.replace('{max}', UPLOADS_CONTENT.maxBytesLabel), ar: UPLOADS_CONTENT.copy.tooLargeAr.replace('{max}', UPLOADS_CONTENT.maxBytesLabel) };
  }
  getDb()
    .prepare(
      `INSERT INTO plans (event_id, mode, sections, major_incident, attached_file,
         attached_content_type, attached_byte_size, attached_bytes)
       VALUES (?, 'attach', '{}', '{}', ?, ?, ?, ?)
       ON CONFLICT (event_id) DO UPDATE SET
         attached_file = excluded.attached_file,
         attached_content_type = excluded.attached_content_type,
         attached_byte_size = excluded.attached_byte_size,
         attached_bytes = excluded.attached_bytes`,
    )
    .run(eventId, file.name.trim(), file.type, bytes.length, bytes);
  revalidatePath(`/events/${eventId}/plan`);
  return { ok: true, fileName: file.name.trim() };
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
  refuseIfArchived(eventId);
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
  refAdmitsChildren: boolean;
  refTemporaryAreas: boolean;
  sections: Record<string, { text?: string; covered?: boolean }>;
  attachedFile: string | null;
  majorIncident: Record<string, { covered?: boolean }>;
}

/** Saves the plan. The row being replaced is archived first -- prior versions stay readable. */
export async function savePlanAction(eventId: string, payload: PlanPayload): Promise<{ ok: true } | { error: string }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) return { error: 'not-found' };
  const db = getDb();
  db.prepare(
    `INSERT INTO plan_versions (event_id, version, mode, ref_confirmed, ref_admits_children,
       ref_temporary_areas, sections, attached_file, major_incident, saved_at)
     SELECT event_id, version, mode, ref_confirmed, ref_admits_children,
       ref_temporary_areas, sections, attached_file, major_incident, updated_at
     FROM plans WHERE event_id = ?`,
  ).run(eventId);
  db
    .prepare(
      `INSERT INTO plans (event_id, mode, ref_confirmed, ref_admits_children, ref_temporary_areas,
         sections, attached_file, major_incident, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT (event_id) DO UPDATE SET
         mode = excluded.mode, ref_confirmed = excluded.ref_confirmed,
         ref_admits_children = excluded.ref_admits_children,
         ref_temporary_areas = excluded.ref_temporary_areas, sections = excluded.sections,
         attached_file = excluded.attached_file, major_incident = excluded.major_incident,
         version = plans.version + 1, updated_at = now_stamp()`,
    )
    .run(
      eventId, payload.mode, payload.refConfirmed ? 1 : 0,
      payload.refAdmitsChildren ? 1 : 0, payload.refTemporaryAreas ? 1 : 0,
      JSON.stringify(payload.sections), payload.attachedFile, JSON.stringify(payload.majorIncident),
    );
  // Switching back to writing the plan drops the stored file with the name: a
  // document nothing points at is a document nobody can account for.
  if (payload.attachedFile === null) {
    db.prepare(
      `UPDATE plans SET attached_content_type = NULL, attached_byte_size = NULL,
         attached_bytes = NULL WHERE event_id = ?`,
    ).run(eventId);
  }
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
  const filedRow = getDb().prepare(`SELECT filed FROM events WHERE id = ?`).get(eventId) as { filed: number } | undefined;
  if (filedRow?.filed === 1) {
    const { revisionOpenFor } = await import('../lib/queries');
    if (!revisionOpenFor(eventId)) return { error: 'filed' };
  }
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

  const db = getDb();
  const already = db.prepare(`SELECT filed FROM events WHERE id = ?`).get(eventId) as { filed: number } | undefined;
  if (already?.filed === 1) {
    // A filed submission reopens only on a revision or incomplete outcome. Re-filing
    // archives the version it replaces; the reference number does not change.
    const { revisionOpenFor } = await import('../lib/queries');
    if (!revisionOpenFor(eventId)) return { error: 'not-open-for-revision' };
    const { submissionGateFor } = await import('../lib/submission-facts');
    const gate = submissionGateFor(account.id, eventId);
    if (!gate.canFile) return { error: 'blocked' };
    db.prepare(
      `INSERT INTO submission_versions (event_id, version, declarations, insurance, representative,
         telephone, position, expedited, filed_at)
       SELECT event_id, version, declarations, insurance, representative, telephone, position,
         expedited, filed_at FROM submissions WHERE event_id = ?`,
    ).run(eventId);
    db.prepare(
      `UPDATE submissions SET filed_at = now_stamp(), expedited = ?, version = version + 1
       WHERE event_id = ?`,
    ).run(gate.expedited ? 1 : 0, eventId);
    const ref = (db.prepare(`SELECT moph_reference AS r FROM events WHERE id = ?`).get(eventId) as { r: string }).r;
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/ministry/submissions/${eventId}`);
    return { reference: ref };
  }

  const { submissionGateFor } = await import('../lib/submission-facts');
  const gate = submissionGateFor(account.id, eventId);
  if (!gate.canFile) return { error: 'blocked' };

  // The reference year follows the Beirut clock like every other date computation.
  const { beirutToday: beirutTodayFn } = await import('../lib/clock');
  const year = beirutTodayFn().slice(0, 4);
  const last = db
    .prepare(`SELECT moph_reference AS r FROM events WHERE moph_reference LIKE ? ORDER BY moph_reference DESC LIMIT 1`)
    .get(`MOPH-EV-${year}-%`) as { r: string } | undefined;
  const n = last ? Number.parseInt(last.r.slice(-4), 10) + 1 : 1;
  const reference = `MOPH-EV-${year}-${String(n).padStart(4, '0')}`;

  db.prepare(
    `UPDATE submissions SET filed_at = now_stamp(), moph_reference = ?, expedited = ? WHERE event_id = ?`,
  ).run(reference, gate.expedited ? 1 : 0, eventId);
  db.prepare(`UPDATE events SET filed = 1, moph_reference = ? WHERE id = ?`).run(reference, eventId);
  revalidatePath(`/events/${eventId}`);
  return { reference };
}

export async function reportMaterialChangeAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  refuseIfArchived(eventId);
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
         lessons_none = excluded.lessons_none, lessons_text = excluded.lessons_text,
         -- Revising the report ANSWERS a Director's return: the returned state
         -- clears, and the Director signs the revised version.
         director_returned_at = NULL, director_return_note = NULL`,
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
  // The DERIVED level, like every other call site -- demo_level is the fallback for
  // seeded rows only. Reading demo_level alone let a derived Level 3 event submit its
  // report on one signature.
  const { eventFor, assessmentsFor } = await import('../lib/queries');
  const event = eventFor(account.id, eventId);
  const level = assessmentsFor(account.id, eventId)[0]?.derivation.finalLevel ?? event?.level ?? null;
  const { postEventSignaturesRequired } = await import('../lib/rules');
  const signaturesRequired = level === null ? 1 : postEventSignaturesRequired(level);
  db.prepare(`UPDATE post_event_reports SET organizer_signed_at = now_stamp() WHERE event_id = ?`).run(eventId);
  const row = db.prepare(`SELECT organizer_signed_at, director_signed_at FROM post_event_reports WHERE event_id = ?`).get(eventId) as
    | { organizer_signed_at: string | null; director_signed_at: string | null }
    | undefined;
  if (!row?.organizer_signed_at) return { error: 'not-saved' };
  // Level 3 carries two signatures; it is not complete with one (SPEC 5).
  if (signaturesRequired > 1 && !row.director_signed_at) {
    revalidatePath(`/events/${eventId}/post-event`);
    return { error: 'awaiting-director' };
  }
  db.prepare(`UPDATE post_event_reports SET submitted_at = now_stamp() WHERE event_id = ?`).run(eventId);
  revalidatePath(`/events/${eventId}/post-event`);
  return { ok: true };
}

/** Protocol 13: records the 24-hour serious-incident notification to the Ministry. */
/**
 * Protocol 13 p1: the 24-hour notification. Its own obligation with its own control --
 * available from the moment the event starts, never waiting for the report window.
 * Type and occurrence time are the whole record; no narrative, so nothing to screen.
 */
export async function notifySeriousIncidentAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  refuseIfArchived(eventId);
  const incidentType = String(formData.get('incidentType') ?? '');
  const occurredAt = String(formData.get('occurredAt') ?? '').trim();
  if (!['arrest', 'death', 'major', 'interruption'].includes(incidentType) || occurredAt === '') {
    redirect(`/events/${eventId}/incident?error=incomplete`);
  }
  getDb()
    .prepare(`INSERT INTO serious_incident_notifications (event_id, incident_type, occurred_at) VALUES (?, ?, ?)`)
    .run(eventId, incidentType, occurredAt);
  revalidatePath(`/events/${eventId}/incident`);
  revalidatePath('/ministry/incidents');
  redirect(`/events/${eventId}/incident?notice=notified`);
}

/* ---------------- Slice 3: the venue service ---------------- */

function ownedVenue(accountId: number, venueId: string): boolean {
  return Boolean(
    getDb().prepare(`SELECT id FROM venues WHERE id = ? AND account_id = ?`).get(venueId, accountId),
  );
}

/**
 * Registers the venue and routes to its first annual assessment. Eligibility asks what
 * the recurring-venue condition asks -- regularly hosts organized events, capacity at or
 * above the condition's own threshold; an ineligible venue is not registered, and the
 * screen says the Ministry makes the final call.
 */
export async function registerVenueAction(formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const nameEn = String(formData.get('name') ?? '').trim();
  const nameAr = String(formData.get('nameAr') ?? '').trim() || nameEn;
  const category = String(formData.get('category') ?? '').trim();
  const addressEn = String(formData.get('address') ?? '').trim();
  const addressAr = String(formData.get('addressAr') ?? '').trim() || addressEn;
  const contact = String(formData.get('contact') ?? '').trim();
  const capacity = Number(String(formData.get('capacity') ?? '').replace(/[^0-9]/g, '')) || null;
  const regularlyHosts = formData.get('regularlyHosts') === 'yes';
  const isNightclub = formData.get('isNightclub') === 'yes';
  if (!nameEn || capacity === null || capacity < RECURRING_VENUE_MIN_CAPACITY || !regularlyHosts) {
    redirect('/venues/new?notice=outside');
  }
  const venueId = nextRecordId('VN');
  getDb()
    .prepare(
      `INSERT INTO venues (id, account_id, name_en, name_ar, category, address_municipality_en,
         address_municipality_ar, responsible_contact, licensed_capacity, regularly_hosts, is_nightclub, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(venueId, account.id, nameEn, nameAr, category, addressEn, addressAr, contact, capacity, 1, isNightclub ? 1 : 0, account.isDemo ? 1 : 0);
  revalidatePath('/dashboard');
  redirect(`/venues/${venueId}/assessment`);
}

export interface VenueAssessmentPayload {
  answers: DomainAnswers;
  attendance: number | null;
  representative: string;
  position: string;
}

/**
 * Records the annual assessment: the classification derives from the same engine as
 * events, over one routine operating session, and carries an effective date and an
 * expiry date twelve months on (the Arabic issue's wording). The record identifier
 * exists from registration; the Ministry reference is issued at first classification.
 */
export async function saveVenueAssessmentAction(
  venueId: string,
  payload: VenueAssessmentPayload,
): Promise<{ level: number } | { error: string }> {
  refuseIfVenueArchived(venueId);
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedVenue(account.id, venueId)) return { error: 'not-found' };
  const db = getDb();
  const venue = db
    .prepare(`SELECT licensed_capacity, regularly_hosts, is_nightclub, moph_reference FROM venues WHERE id = ?`)
    .get(venueId) as { licensed_capacity: number | null; regularly_hosts: number; is_nightclub: number; moph_reference: string | null };

  const inputs: MinimumConditionInputs = {
    expectedMaxSimultaneousAttendance: payload.attendance,
    eventDisciplines: [],
    courseDistanceKm: null,
    venueLicensedCapacity: venue.licensed_capacity,
    venueIsNightclubOrDanceVenue: venue.is_nightclub === 1,
  };
  const derivation = deriveLevel({ answers: payload.answers, inputs });
  if (!derivation.complete || derivation.finalLevel === null) return { error: 'incomplete' };

  // THE REGISTRATION FEE GATES THE CLASSIFICATION (register closure, 2026-09-03):
  // the venue's filing moment is here, where the Ministry reference mints and the
  // classification issues. With a venue fee in force and unpaid, both wait --
  // named on the screen before this is reachable, and refused here regardless.
  {
    const { applicationFee, effectiveFlag } = await import('../lib/rules');
    const { capabilityConfigFor, ministryConfig } = await import('../lib/queries');
    const { paymentFor } = await import('../lib/payments');
    const config = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
    const fee = applicationFee('registerVenue', null, effectiveFlag('applicationFees', config), capabilityConfigFor('applicationFees'));
    if (fee !== null && paymentFor(venueId, 'registerVenue') === null) return { error: 'fee-unpaid' };
  }

  const { beirutToday } = await import('../lib/clock');
  const effective = beirutToday();
  const { REASSESSMENT_WINDOW } = await import('../lib/rules');
  const months = REASSESSMENT_WINDOW.venueClassificationMonths;
  const until = new Date(`${effective}T00:00:00Z`);
  until.setUTCMonth(until.getUTCMonth() + months);
  const validUntil = until.toISOString().slice(0, 10);

  const latest = db
    .prepare(`SELECT MAX(version) AS v FROM venue_assessments WHERE venue_id = ?`)
    .get(venueId) as { v: number | null };
  db.prepare(
    `INSERT INTO venue_assessments (venue_id, version, answers, inputs, derivation,
       nehrat_tool_version, effective, valid_until, representative, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    venueId, (latest.v ?? 0) + 1,
    JSON.stringify(payload.answers), JSON.stringify(inputs), JSON.stringify(derivation),
    NEHRAT_TOOL_VERSION, effective, validUntil, payload.representative, payload.position,
  );

  let reference = venue.moph_reference;
  if (!reference) {
    // The Beirut clock, like the event reference and every other date computation.
    const year = effective.slice(0, 4);
    const last = db
      .prepare(`SELECT moph_reference AS r FROM venues WHERE moph_reference LIKE ? ORDER BY moph_reference DESC LIMIT 1`)
      .get(`MOPH-VN-${year}-%`) as { r: string } | undefined;
    const n = last ? Number.parseInt(last.r.slice(-4), 10) + 1 : 1;
    reference = `MOPH-VN-${year}-${String(n).padStart(4, '0')}`;
  }
  db.prepare(
    `UPDATE venues SET level = ?, issued = ?, valid_until = ?, moph_reference = ? WHERE id = ?`,
  ).run(derivation.finalLevel, effective, validUntil, reference, venueId);
  revalidatePath(`/venues/${venueId}`);
  return { level: derivation.finalLevel };
}

export async function reportVenueChangeAction(venueId: string, formData: FormData): Promise<void> {
  refuseIfVenueArchived(venueId);
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedVenue(account.id, venueId)) redirect('/dashboard');
  const aspects = formData.getAll('aspect').map(String);
  const description = String(formData.get('description') ?? '').trim();
  const effectiveDate = String(formData.get('effectiveDate') ?? '').trim();
  if (aspects.length > 0 && description) {
    getDb()
      .prepare(`INSERT INTO venue_changes (venue_id, aspects, description, effective_date) VALUES (?, ?, ?, ?)`)
      .run(venueId, JSON.stringify(aspects), description, effectiveDate);
  }
  revalidatePath(`/venues/${venueId}/change`);
  redirect(`/venues/${venueId}/change?notice=reported`);
}


/* ---------------- Slice 4: the facility service ---------------- */

function ownedFacility(accountId: number, facilityId: string): boolean {
  return Boolean(
    getDb().prepare(`SELECT id FROM facilities WHERE id = ? AND account_id = ?`).get(facilityId, accountId),
  );
}

/**
 * Steps 1-3 of the registration. The category is a determination: where it awaits a
 * Ministry value the journey ended on the screen and this action is never reached
 * with that category -- but the rule is enforced here too, not only in the UI.
 */
export async function registerFacilityAction(formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const categoryKey = String(formData.get('category') ?? '');
  // The gate runs against the GOVERNED category: a published phased schedule opens the
  // education journey the static data alone would end at step 2.
  const { publishedFacilityValues } = await import('../lib/queries');
  const category = categoryWithPublished(categoryKey, publishedFacilityValues());
  if (!category || categoryEndsJourney(category)) redirect('/facilities/new');
  const s = (k: string): string => String(formData.get(k) ?? '').trim();
  const capacityNum = Number(s('capacity'));
  const facilityId = nextRecordId('FC');
  const db = getDb();
  db.prepare(
    `INSERT INTO facilities (id, account_id, name_en, name_ar, category_key, address,
       municipality_en, municipality_ar, operating_hours, phone, email, access_point,
       ems_number, licensed_capacity, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    facilityId, account.id, s('name'), s('nameAr') || s('name'), categoryKey, s('address'),
    s('municipality'), s('municipalityAr') || s('municipality'), s('hours'), s('phone'),
    s('email'), s('accessPoint'), s('emsNumber'),
    s('capacity') !== '' && Number.isFinite(capacityNum) ? capacityNum : null,
    account.isDemo ? 1 : 0,
  );
  const person = db.prepare(
    `INSERT INTO facility_persons (facility_id, role, name_or_position, phone, email)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const role of ['coordinator', 'alternate', 'emsGuide'] as const) {
    person.run(facilityId, role, s(`${role}Name`), s(`${role}Phone`), s(`${role}Email`));
  }
  revalidatePath('/dashboard');
  redirect(`/facilities/${facilityId}/devices`);
}

/** The end of the journey for an awaiting category: an interest, nothing more. */
export async function recordFacilityInterestAction(formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  getDb()
    .prepare(`INSERT INTO facility_interests (account_id, category_key, facility_name) VALUES (?, ?, ?)`)
    .run(account.id, String(formData.get('category') ?? ''), String(formData.get('name') ?? '').trim());
  redirect('/dashboard?notice=interest');
}

/**
 * One action for the five Annex C purposes. What is asked -- and what changes --
 * depends on the purpose; every path stamps updated_at (the ledger's affirmation
 * date) and logs the update with the facility representative who signed it.
 */
export async function saveFacilityDeviceAction(facilityId: string, formData: FormData): Promise<void> {
  refuseIfFacilityArchived(facilityId);
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedFacility(account.id, facilityId)) redirect('/dashboard');
  const db = getDb();
  const purpose = String(formData.get('purpose') ?? 'initial');
  const s = (k: string): string => String(formData.get(k) ?? '').trim();
  const yes = (k: string): number => (formData.get(k) === 'yes' ? 1 : 0);
  let label = s('label');

  if (purpose === 'initial') {
    const last = db
      .prepare(`SELECT label FROM facility_devices WHERE facility_id = ? ORDER BY label DESC LIMIT 1`)
      .get(facilityId) as { label: string } | undefined;
    const n = last ? Number.parseInt(last.label.slice(4), 10) + 1 : 1;
    label = `AED-${String(n).padStart(3, '0')}`;
    db.prepare(
      `INSERT INTO facility_devices (facility_id, label, identification, location_en, location_ar,
         accessible_hours, publicly_accessible, pediatric, pad_expiry, battery_expiry, latest_check)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      facilityId, label, s('identification'), s('location'), s('locationAr') || s('location'),
      yes('accessibleHours'), yes('publiclyAccessible'),
      ['yes', 'no', 'na'].includes(s('pediatric')) ? s('pediatric') : 'no',
      s('padExpiry') || null, s('batteryExpiry') || null, s('latestCheck') || null,
    );
  } else if (purpose === 'annual') {
    db.prepare(
      `UPDATE facility_devices SET latest_check = ?, updated_at = now_stamp()
       WHERE facility_id = ? AND label = ?`,
    ).run(s('latestCheck') || null, facilityId, label);
  } else if (purpose === 'relocation') {
    db.prepare(
      `UPDATE facility_devices SET location_en = ?, location_ar = ?, accessible_hours = ?, updated_at = now_stamp()
       WHERE facility_id = ? AND label = ?`,
    ).run(s('location'), s('locationAr') || s('location'), yes('accessibleHours'), facilityId, label);
  } else if (purpose === 'replacement') {
    db.prepare(
      `UPDATE facility_devices SET identification = ?, pad_expiry = ?, battery_expiry = ?, updated_at = now_stamp()
       WHERE facility_id = ? AND label = ?`,
    ).run(s('identification'), s('padExpiry') || null, s('batteryExpiry') || null, facilityId, label);
  } else if (purpose === 'statusChange') {
    db.prepare(
      `UPDATE facility_devices SET operational = ?, accessible_hours = ?, updated_at = now_stamp()
       WHERE facility_id = ? AND label = ?`,
    ).run(yes('operational'), yes('accessibleHours'), facilityId, label);
  }

  db.prepare(
    `INSERT INTO facility_device_updates (facility_id, device_label, purpose, representative, reason)
     VALUES (?, ?, ?, ?, NULLIF(?, ''))`,
  ).run(facilityId, label, purpose, s('representative'), s('reason'));
  revalidatePath(`/facilities/${facilityId}/devices`);
  revalidatePath(`/facilities/${facilityId}`);
  redirect(`/facilities/${facilityId}/devices?notice=saved`);
}

/** Annex B section 5, signed by the coordinator. Drives the drill and annual rows. */
export async function saveFacilityPlanAction(facilityId: string, formData: FormData): Promise<void> {
  refuseIfFacilityArchived(facilityId);
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedFacility(account.id, facilityId)) redirect('/dashboard');
  const checkKeys = ['trained', 'signage', 'access', 'routes', 'staffKnow', 'drill'];
  const checks = Object.fromEntries(checkKeys.map((k) => [k, formData.get(`check_${k}`) === 'on']));
  getDb()
    .prepare(
      `INSERT INTO facility_plan_confirmations (facility_id, checks, drill_date, coordinator, position)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      facilityId, JSON.stringify(checks),
      String(formData.get('drillDate') ?? '').trim() || null,
      String(formData.get('coordinator') ?? '').trim(),
      String(formData.get('position') ?? '').trim(),
    );
  // Recording the confirmation ANSWERS any open Ministry readiness-confirmation
  // request -- the request closes itself, with the closure naming this recording.
  getDb()
    .prepare(
      `UPDATE facility_requests SET status = 'corrected', corrected_at = now_stamp(),
         close_note = 'Closed by the operator recording the readiness confirmation.', closed_by = ?
       WHERE facility_id = ? AND status = 'open' AND kind = 'confirmation'`,
    )
    .run(account.displayName, facilityId);
  revalidatePath(`/facilities/${facilityId}/plan`);
  revalidatePath(`/facilities/${facilityId}`);
  redirect(`/facilities/${facilityId}?notice=confirmed`);
}

/** Coordinator review: stamps updated_at, the ledger's affirmation date. */
export async function saveFacilityPersonsAction(facilityId: string, formData: FormData): Promise<void> {
  refuseIfFacilityArchived(facilityId);
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedFacility(account.id, facilityId)) redirect('/dashboard');
  const db = getDb();
  const s = (k: string): string => String(formData.get(k) ?? '').trim();
  for (const role of ['coordinator', 'alternate', 'emsGuide'] as const) {
    db.prepare(
      `UPDATE facility_persons SET name_or_position = ?, phone = ?, email = ?, updated_at = now_stamp()
       WHERE facility_id = ? AND role = ?`,
    ).run(s(`${role}Name`), s(`${role}Phone`), s(`${role}Email`), facilityId, role);
  }
  revalidatePath(`/facilities/${facilityId}`);
  redirect(`/facilities/${facilityId}?notice=coordinator`);
}

/**
 * Annex D. The narrative is checked for a personal name ON THE SERVER as well as in
 * the screen (non-negotiable 7): a blocked submit that only the client enforces is
 * not a rule.
 */
export async function submitFacilityIncidentAction(
  facilityId: string,
  formData: FormData,
): Promise<{ error: 'name-detected' } | void> {
  refuseIfFacilityArchived(facilityId);
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedFacility(account.id, facilityId)) redirect('/dashboard');
  const narrative = String(formData.get('narrative') ?? '');
  const corrective = String(formData.get('corrective') ?? '');
  if (detectPersonalName(narrative) || detectPersonalName(corrective)) {
    return { error: 'name-detected' };
  }
  const payload: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k !== 'narrative' && typeof v === 'string') payload[k] = v;
  }
  getDb()
    .prepare(`INSERT INTO facility_incidents (facility_id, payload, narrative) VALUES (?, ?, ?)`)
    .run(facilityId, JSON.stringify(payload), narrative);
  revalidatePath(`/facilities/${facilityId}`);
  redirect(`/facilities/${facilityId}?notice=incident`);
}



/* ---------------- Slice 5: the counterparty roles ---------------- */

function invitationRow(token: string): { event_id: string; kind: 'ems' | 'director'; account_id: number | null; status: string } | null {
  return (getDb()
    .prepare(`SELECT event_id, kind, account_id, status FROM invitations WHERE token = ?`)
    .get(token) ?? null) as { event_id: string; kind: 'ems' | 'director'; account_id: number | null; status: string } | null;
}

function notifyOrganizerOf(eventId: string, subjectEn: string, subjectAr: string, bodyEn: string, bodyAr: string, route: string): void {
  const db = getDb();
  const ev = db.prepare(`SELECT account_id, is_demo FROM events WHERE id = ?`).get(eventId) as { account_id: number; is_demo: number } | undefined;
  if (!ev) return;
  db.prepare(
    `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
     VALUES (?, 'needs_action', ?, ?, ?, ?, ?, now_stamp(), ?)`,
  ).run(ev.account_id, subjectEn, subjectAr, bodyEn, bodyAr, route, ev.is_demo);
}

/**
 * The organizer's side of an open nomination: withdraw it, or remove a confirmed
 * party. Two different acts with two different weights, and the screen says which
 * is which BEFORE the click:
 *
 *  - WITHDRAW an unanswered nomination. Available at every level. The token dies
 *    for registration, the nominee's page shows it withdrawn rather than pending,
 *    and NO material change arises -- nothing was ever confirmed. This closes the
 *    trap where one confirmed provider and one unanswered nomination blocked
 *    filing with nothing the organizer could do.
 *
 *  - REMOVE a confirmed party. Available at every level, and a MATERIAL CHANGE:
 *    the party is notified, and if the submission is already filed the organizer
 *    owes a change report -- the same rule the decline path already applies.
 */
export async function withdrawNominationAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  refuseIfArchived(eventId);
  const token = String(formData.get('token') ?? '');
  const db = getDb();
  const inv = db
    .prepare(`SELECT token, kind, status, account_id, name_en, name_ar FROM invitations WHERE token = ? AND event_id = ?`)
    .get(token, eventId) as { token: string; kind: 'ems' | 'director'; status: string; account_id: number | null; name_en: string; name_ar: string } | undefined;
  // Only an UNANSWERED nomination withdraws; anything else is not this act.
  if (!inv || inv.status !== 'nominated') redirect(`/events/${eventId}/requirements`);
  db.prepare(`UPDATE invitations SET status = 'withdrawn', closed_at = now_stamp() WHERE token = ?`).run(token);
  // A modification-requested nominee holds an account already; they are told, for
  // information -- there is nothing for them to do.
  if (inv.account_id !== null) {
    const ev = db.prepare(`SELECT name_en, name_ar, is_demo FROM events WHERE id = ?`).get(eventId) as { name_en: string; name_ar: string; is_demo: number };
    db.prepare(
      `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
       VALUES (?, 'for_information', ?, ?, ?, ?, '/profile', now_stamp(), ?)`,
    ).run(
      inv.account_id,
      `Nomination withdrawn — ${ev.name_en}`, `سُحب الترشيح — ${ev.name_ar}`,
      'The organizer has withdrawn the nomination before it was answered. No action is owed.',
      'سحب المنظّم الترشيح قبل الإجابة عليه. لا إجراء مستحق.',
      ev.is_demo,
    );
  }
  redirect(`/events/${eventId}/requirements?notice=withdrawn`);
}

export async function removeProviderAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  refuseIfArchived(eventId);
  const token = String(formData.get('token') ?? '');
  const db = getDb();
  const inv = db
    .prepare(`SELECT token, kind, status, account_id, name_en, name_ar FROM invitations WHERE token = ? AND event_id = ?`)
    .get(token, eventId) as { token: string; kind: 'ems' | 'director'; status: string; account_id: number | null; name_en: string; name_ar: string } | undefined;
  // Only a CONFIRMED party removes; an unanswered one withdraws instead.
  if (!inv || inv.status !== 'confirmed') redirect(`/events/${eventId}/requirements`);
  db.prepare(`UPDATE invitations SET status = 'removed', closed_at = now_stamp() WHERE token = ?`).run(token);

  const ev = db.prepare(`SELECT name_en, name_ar, filed, is_demo FROM events WHERE id = ?`).get(eventId) as { name_en: string; name_ar: string; filed: number; is_demo: number };
  const roleEn = inv.kind === 'ems' ? 'EMS provider' : 'Event Medical Director';
  const roleAr = inv.kind === 'ems' ? 'مزوّد خدمات الطوارئ الطبية' : 'المدير الطبي للفعالية';
  // The removed party is told. Their record of the event closes with this.
  if (inv.account_id !== null) {
    db.prepare(
      `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
       VALUES (?, 'for_information', ?, ?, ?, ?, '/profile', now_stamp(), ?)`,
    ).run(
      inv.account_id,
      `Removed as ${roleEn} — ${ev.name_en}`, `إزالة بصفة ${roleAr} — ${ev.name_ar}`,
      `The organizer has removed your organization from this event. Your participation record is closed; nothing further is owed on it.`,
      'أزال المنظّم مؤسستكم من هذه الفعالية. أُغلق سجل مشاركتكم، ولا شيء مستحق عليه بعد الآن.',
      ev.is_demo,
    );
  }
  // Filed: the change report is owed, and the obligation is put in writing -- the
  // same weight the decline path gives it.
  if (ev.filed === 1) {
    notifyOrganizerOf(
      eventId,
      `Change report owed — ${ev.name_en}`, `إبلاغ عن تغيير مستحق — ${ev.name_ar}`,
      `You removed the confirmed ${roleEn}. This is a material change to your filed submission: report it to the Ministry and, where the level requires one, name another party.`,
      `أزلتم ${roleAr} المؤكَّد. هذا تغيير جوهري في ملفكم المقدَّم: أبلغوا الوزارة به، وسمّوا طرفاً آخر حيث يقتضي المستوى ذلك.`,
      `/events/${eventId}/change`,
    );
    redirect(`/events/${eventId}/change?notice=provider-removed`);
  }
  redirect(`/events/${eventId}/requirements?notice=removed`);
}

/**
 * The nomination response. The token is the credential (rule 6): the holder responds
 * to this one nomination and sees nothing else. Accepting links the session's
 * account; declining requires a reason and is a material change the organizer must
 * report; a modification request keeps the nomination open with the reason attached.
 */

/** The counterparty's one page for an event: the Director's event page, or the
    provider's task page (participation forwards Level 3 on to the declaration). */
function counterpartyLanding(kind: 'ems' | 'director', eventId: string): string {
  return kind === 'director' ? `/events/${eventId}` : `/events/${eventId}/participation`;
}

/**
 * The nominee's answer -- STAGE TWO OF THREE, and it stands alone.
 *
 * ACCEPTING IS NEVER THE SAME CLICK AS BEING SIGNED IN (reviewer ruling, 2026-08-28).
 * This action used to create an account, start a session and record the response in
 * one submit: a party could not answer a nomination without simultaneously choosing a
 * password. Declining required registering with the platform in order to say no.
 *
 * The token is the credential (rule 6), and it is sufficient for all three answers.
 * An accepted nomination whose holder has not yet registered is a real state --
 * status confirmed, account_id NULL -- and stage three (/invitations/[token]/account)
 * is where that link is made, or not. The answer stands either way.
 */
export async function respondToInvitationAction(token: string, formData: FormData): Promise<void> {
  const inv = invitationRow(token);
  if (!inv) redirect('/signin');
  // A withdrawn or removed nomination is dead for responding AND for registering:
  // the token page shows the closed state; nothing can be done against it.
  if (inv.status === 'withdrawn' || inv.status === 'removed') {
    redirect(`/invitations/${token}`);
  }
  // A holder who is ALREADY signed in has their account linked by the response; one
  // who is not answers anonymously against the token and is offered stage three.
  const account = await currentAccount();
  const db = getDb();
  const response = String(formData.get('response') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const eventName = db.prepare(`SELECT name_en, name_ar FROM events WHERE id = ?`).get(inv.event_id) as { name_en: string; name_ar: string };

  if (response === 'accept') {
    db.prepare(
      // COALESCE, not overwrite: a nomination already linked to an account keeps it.
      `UPDATE invitations SET status = 'confirmed', account_id = COALESCE(?, account_id),
         answered_at = now_stamp() WHERE token = ?`,
    ).run(account?.id ?? null, token);
    notifyOrganizerOf(
      inv.event_id,
      `A named party has accepted — ${eventName.name_en}`,
      `قبل طرف مُسمّى — ${eventName.name_ar}`,
      `The nominated ${inv.kind === 'ems' ? 'EMS provider' : 'Event Medical Director'} has accepted the nomination.`,
      `قبل ${inv.kind === 'ems' ? 'مزوّد خدمات الطوارئ' : 'المدير الطبي'} المُرشَّح الترشيح.`,
      `/events/${inv.event_id}/requirements`,
    );
    // Stage three. A signed-in holder lands on the standing brief -- the clean event
    // summary every counterparty role can read; anyone else is offered an account --
    // offered, not required.
    if (account) redirect(`${counterpartyLanding(inv.kind, inv.event_id)}?notice=accepted`);
    redirect(`/invitations/${token}/account`);
  }
  if (response === 'decline') {
    if (!reason) redirect(`/invitations/${token}?error=reason`);
    db.prepare(
      `UPDATE invitations SET status = 'declined', account_id = COALESCE(?, account_id),
         response_note = ?, answered_at = now_stamp() WHERE token = ?`,
    ).run(account?.id ?? null, reason, token);
    // Declining is a MATERIAL CHANGE the organizer must report (rule 6) -- but only
    // a FILED submission has anything on file to change. Before filing, the
    // instruction is simply to name another party; the change route would bounce.
    const evFiled = (db.prepare(`SELECT filed FROM events WHERE id = ?`).get(inv.event_id) as { filed: number }).filed === 1;
    notifyOrganizerOf(
      inv.event_id,
      `A named party has declined — ${eventName.name_en}`,
      `اعتذر طرف مُسمّى — ${eventName.name_ar}`,
      evFiled
        ? `The nominated ${inv.kind === 'ems' ? 'EMS provider' : 'Event Medical Director'} has declined. The reason, as written: “${verbatimQuote(reason)}”. This is a material change to your filed submission: report it to the Ministry and name another party.`
        : `The nominated ${inv.kind === 'ems' ? 'EMS provider' : 'Event Medical Director'} has declined. The reason, as written: “${verbatimQuote(reason)}”. Name another party from the requirements screen; nothing is filed yet, so no change report is owed.`,
      evFiled
        ? `اعتذر ${inv.kind === 'ems' ? 'مزوّد خدمات الطوارئ' : 'المدير الطبي'} المُرشَّح. والسبب كما كُتب: «${verbatimQuote(reason)}». هذا تغيير جوهري في ملفكم المقدَّم: أبلغوا الوزارة به وسمّوا طرفاً آخر.`
        : `اعتذر ${inv.kind === 'ems' ? 'مزوّد خدمات الطوارئ' : 'المدير الطبي'} المُرشَّح. والسبب كما كُتب: «${verbatimQuote(reason)}». سمّوا طرفاً آخر من شاشة المتطلبات؛ فلا شيء مقدَّم بعد، ولا يُستحق إبلاغ عن تغيير.`,
      evFiled ? `/events/${inv.event_id}/change` : `/events/${inv.event_id}/requirements`,
    );
    redirect(`/invitations/${token}?notice=declined`);
  }
  if (response === 'modification') {
    if (!reason) redirect(`/invitations/${token}?error=reason`);
    // Not a nomination state: the nomination stays open with the note attached.
    db.prepare(
      `UPDATE invitations SET response_note = ?, account_id = COALESCE(?, account_id) WHERE token = ?`,
    ).run(reason, account?.id ?? null, token);
    notifyOrganizerOf(
      inv.event_id,
      `A named party requests a modification — ${eventName.name_en}`,
      `طلب طرف مُسمّى تعديلاً — ${eventName.name_ar}`,
      `The nominated party can serve the event but not as described. The reason, as written: “${verbatimQuote(reason)}”. The nomination remains open.`,
      `يمكن للطرف المُرشَّح خدمة الفعالية لكن ليس بالصيغة الموصوفة. والسبب كما كُتب: «${verbatimQuote(reason)}». ويبقى الترشيح قائماً.`,
      `/events/${inv.event_id}/requirements`,
    );
    redirect(`/invitations/${token}?notice=modification`);
  }
  redirect(`/invitations/${token}`);
}

/**
 * STAGE THREE: the account, after the answer and never as part of it.
 *
 * Self-registration AGAINST the invitation (rule 6) -- the role comes from the
 * nomination, never from anything the registrant types. Two paths, because a party
 * nominated to a second event already has an account and must not be told to make
 * another: create one, or sign in to the one that exists and have the nomination
 * linked to it.
 *
 * Reachable only from a nomination that has been ANSWERED. There is no account to
 * make against an unanswered one, and making the account first would put us back
 * where the ruling found us.
 */
export async function registerAgainstInvitationAction(
  token: string,
  formData: FormData,
): Promise<void> {
  const inv = invitationRow(token);
  if (!inv) redirect('/signin');
  if (inv.status === 'withdrawn' || inv.status === 'removed') redirect(`/invitations/${token}`);
  if (inv.account_id !== null) redirect(counterpartyLanding(inv.kind, inv.event_id));

  const name = String(formData.get('fullName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!name || !email || !checkPasswordPolicy(password).ok) {
    redirect(`/invitations/${token}/account?error=account`);
  }
  const db = getDb();
  if (db.prepare(`SELECT id FROM accounts WHERE email = ?`).get(email)) {
    // Not an error to correct by choosing another email -- the other path is right
    // there, and this is how a party nominated twice arrives.
    redirect(`/invitations/${token}/account?error=email-taken`);
  }
  const initials = name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const created = db
    .prepare(
      `INSERT INTO accounts (login, email, password_hash, display_name, initials, role, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
    )
    .run(
      `user_${randomBytes(6).toString('hex')}`,
      email,
      hashPassword(password),
      name,
      initials,
      inv.kind === 'ems' ? 'ems' : 'director',
    );
  const accountId = created.lastInsertRowid as number;
  db.prepare(`UPDATE invitations SET account_id = ? WHERE token = ?`).run(accountId, token);
  await startSession(accountId);
  redirect(`${counterpartyLanding(inv.kind, inv.event_id)}?notice=registered`);
}

/** Stage three, the other path: an account already exists, so link this nomination to it. */
export async function signInAgainstInvitationAction(
  token: string,
  formData: FormData,
): Promise<void> {
  const inv = invitationRow(token);
  if (!inv) redirect('/signin');
  if (inv.status === 'withdrawn' || inv.status === 'removed') redirect(`/invitations/${token}`);

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const row = getDb()
    .prepare(`SELECT id, password_hash, role, suspended FROM accounts WHERE email = ?`)
    .get(email) as
    | { id: number; password_hash: string | null; role: string; suspended: number }
    | undefined;
  // One refusal for every failure: a wrong password and an unknown address must not
  // be distinguishable, or this becomes a way to enumerate who holds an account.
  if (!row || !row.password_hash || row.suspended === 1 || !verifyPassword(password, row.password_hash)) {
    await rememberSignInFields({ email });
    redirect(`/invitations/${token}/account?error=credentials`);
  }
  // The nomination names a role, and the account carries one. A Ministry reviewer or
  // an organizer signing in here would be linked to a counterparty nomination and
  // land on a surface their role does not hold.
  const expected = inv.kind === 'ems' ? 'ems' : 'director';
  if (row.role !== expected) redirect(`/invitations/${token}/account?error=role`);

  getDb().prepare(`UPDATE invitations SET account_id = ? WHERE token = ?`).run(row.id, token);
  await forgetSignInFields();
  await startSession(row.id);
  redirect(`${counterpartyLanding(inv.kind, inv.event_id)}?notice=linked`);
}

function ownedInvitation(accountId: number, token: string): boolean {
  return Boolean(
    getDb().prepare(`SELECT token FROM invitations WHERE token = ? AND account_id = ?`).get(token, accountId),
  );
}

/** Level 2: operational detail for the organizer's plan. No declaration exists. */
export async function saveOpsDetailAction(token: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedInvitation(account.id, token)) redirect('/dashboard');
  const detail: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === 'string' && k !== 'token') detail[k] = v;
  }
  const inv = invitationRow(token);
  getDb()
    .prepare(`UPDATE invitations SET ops_detail = ?, status = 'confirmed', answered_at = COALESCE(answered_at, now_stamp()) WHERE token = ?`)
    .run(JSON.stringify(detail), token);
  if (inv) {
    const eventName = getDb().prepare(`SELECT name_en, name_ar FROM events WHERE id = ?`).get(inv.event_id) as { name_en: string; name_ar: string };
    notifyOrganizerOf(
      inv.event_id,
      `Participation confirmed with operational detail — ${eventName.name_en}`,
      `تأكدت المشاركة مع التفاصيل التشغيلية — ${eventName.name_ar}`,
      'A named provider confirmed participation and supplied its operational detail for your health and medical plan.',
      'أكد مزوّد مُسمّى مشاركته وقدّم تفاصيله التشغيلية لخطتكم الصحية والطبية.',
      `/events/${inv.event_id}/requirements`,
    );
  }
  redirect(`/events/${inv?.event_id}/participation?notice=sent`);
}

/** The Level 3 declaration draft: items and certification, visible to the agency only. */
export async function saveDeclarationDraftAction(
  token: string,
  payload: { items: boolean[]; certification: Record<string, string> },
): Promise<{ ok: true } | { error: string }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedInvitation(account.id, token)) return { error: 'not-found' };
  getDb()
    .prepare(`UPDATE invitations SET declaration = 'draft', declaration_items = ?, certification = ? WHERE token = ? AND declaration != 'signed'`)
    .run(JSON.stringify(payload.items), JSON.stringify(payload.certification), token);
  return { ok: true };
}

/**
 * Signing the declaration. The gate is enforced HERE as well as in the screen: ten
 * items, signing blocked until all ten are confirmed (rule 10 -- disabled with the
 * count named, and a client cannot bypass it).
 */
export async function signDeclarationAction(
  token: string,
  payload: { items: boolean[]; certification: Record<string, string> },
): Promise<{ ok: true } | { error: string }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedInvitation(account.id, token)) return { error: 'not-found' };
  const gate = declarationGate(payload.items);
  if (!gate.canSign) return { error: 'items-outstanding' };
  // THE CERTIFICATION BLOCK, which nothing checked. A declaration signed with an
  // empty Date was released to the organizer and counted toward the Level 3 package.
  // Enforced HERE as well as in the form: a disabled button is a courtesy, and this
  // is the rule.
  const missing = missingCertificationFields('ems', payload.certification);
  if (missing.length > 0) return { error: `certification:${missing.map((f) => f.key).join(',')}` };
  const db = getDb();
  db.prepare(
    `UPDATE invitations SET declaration = 'signed', declaration_items = ?, certification = ?,
       status = 'confirmed', signed_at = now_stamp(), answered_at = COALESCE(answered_at, now_stamp())
     WHERE token = ?`,
  ).run(JSON.stringify(payload.items), JSON.stringify(payload.certification), token);
  const inv = invitationRow(token);
  if (inv) {
    const eventName = db.prepare(`SELECT name_en, name_ar FROM events WHERE id = ?`).get(inv.event_id) as { name_en: string; name_ar: string };
    notifyOrganizerOf(
      inv.event_id,
      `EMS readiness declaration signed — ${eventName.name_en}`,
      `وُقّع إقرار جاهزية خدمات الطوارئ الطبية — ${eventName.name_ar}`,
      'A named agency has signed its readiness declaration. It is now one of the Level 3 attachments in your submission package.',
      'وقّعت جهة مُسمّاة إقرار جاهزيتها. وهو الآن أحد مرفقات المستوى 3 في حزمة تقديمكم.',
      `/events/${inv.event_id}/requirements`,
    );
  }
  return { ok: true };
}

export async function addSharedDocumentAction(token: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedInvitation(account.id, token)) redirect('/dashboard');
  const name = String(formData.get('name') ?? '').trim();
  const fileName = String(formData.get('fileName') ?? '').trim();
  if (name) {
    getDb()
      .prepare(
        `INSERT INTO shared_documents (invitation_token, name_en, name_ar, source, file_name, meta_en, meta_ar)
         VALUES (?, ?, ?, 'provider', ?, 'From your organization', 'من مؤسستكم')`,
      )
      .run(token, name, String(formData.get('nameAr') ?? '').trim() || name, fileName || null);
  }
  const inv = invitationRow(token);
  redirect(`/events/${inv?.event_id}/documents?notice=added`);
}

/** The role profile: completed once, reused across every event. */
export async function saveRoleProfileAction(formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const fields: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === 'string') fields[k] = v;
  }
  getDb()
    .prepare(
      `INSERT INTO role_profiles (account_id, fields, updated_at) VALUES (?, ?, now_stamp())
       ON CONFLICT(account_id) DO UPDATE SET fields = excluded.fields, updated_at = excluded.updated_at`,
    )
    .run(account.id, JSON.stringify(fields));
  redirect('/profile?notice=saved');
}

/* ---- Event Medical Director ---- */

function directorFor(accountId: number, eventId: string): boolean {
  return Boolean(
    getDb()
      .prepare(`SELECT token FROM invitations WHERE event_id = ? AND kind = 'director' AND account_id = ? AND status = 'confirmed'`)
      .get(eventId, accountId),
  );
}

/** The Director's text, rendered read-only in the organizer's plan. */
export async function saveGovernanceAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!directorFor(account.id, eventId)) redirect('/dashboard');
  const sections: Record<string, string> = {};
  for (const key of ['clinical', 'command', 'incidentRole']) {
    sections[key] = String(formData.get(key) ?? '');
  }
  getDb()
    .prepare(
      `INSERT INTO event_governance (event_id, sections, updated_at) VALUES (?, ?, now_stamp())
       ON CONFLICT(event_id) DO UPDATE SET sections = excluded.sections, updated_at = excluded.updated_at`,
    )
    .run(eventId, JSON.stringify(sections));
  revalidatePath(`/events/${eventId}/governance`);
  redirect(`/events/${eventId}?notice=saved`);
}

/** The second signature. At Level 3 the report is not complete with one. */
export async function signPostEventReportAction(eventId: string): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!directorFor(account.id, eventId)) redirect('/dashboard');
  getDb()
    .prepare(`UPDATE post_event_reports SET director_signed_at = now_stamp() WHERE event_id = ?`)
    .run(eventId);
  revalidatePath(`/events/${eventId}/report`);
  redirect(`/events/${eventId}/report?notice=signed`);
}

/** Returning the report: the figures are the organizer's to correct, not the Director's. */
export async function returnPostEventReportAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!directorFor(account.id, eventId)) redirect('/dashboard');
  const reason = String(formData.get('reason') ?? '').trim();
  // RECORDED on the report row, not just notified: the Director's own screen shows
  // the returned state, and the organizer's screen shows the reason verbatim.
  getDb()
    .prepare(`UPDATE post_event_reports SET director_returned_at = now_stamp(), director_return_note = ? WHERE event_id = ?`)
    .run(reason, eventId);
  const eventName = getDb().prepare(`SELECT name_en, name_ar FROM events WHERE id = ?`).get(eventId) as { name_en: string; name_ar: string };
  notifyOrganizerOf(
    eventId,
    `Post-event report returned by the Event Medical Director — ${eventName.name_en}`,
    `أعاد المدير الطبي للفعالية التقرير اللاحق — ${eventName.name_ar}`,
    reason
      ? `The Director returned the report rather than signing it. The reason, as written: “${verbatimQuote(reason)}”.`
      : 'The Director returned the report rather than signing it.',
    reason
      ? `أعاد المدير التقرير بدل توقيعه. والسبب كما كُتب: «${verbatimQuote(reason)}».`
      : 'أعاد المدير التقرير بدل توقيعه.',
    `/events/${eventId}/post-event`,
  );
  redirect(`/events/${eventId}/report?notice=returned`);
}

/**
 * Cancellation and postponement (Protocol 8.5 / 9(vii)). A lifecycle, never a
 * deletion: the record and any reference number survive readable. Cancelling
 * closes every remaining obligation; postponing leaves the record open and the
 * recorded determination DOES NOT CARRY to a new date -- the screens say so.
 * The Ministry reads both in its changes lane, from the event row itself.
 */
export async function cancelEventAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  refuseIfArchived(eventId);
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) redirect(`/events/${eventId}/lifecycle?error=reason`);
  const db = getDb();
  const ev = db.prepare(`SELECT lifecycle FROM events WHERE id = ?`).get(eventId) as { lifecycle: string };
  // A POSTPONED event can still be cancelled -- refusing that was a dead end of this
  // action's own making. Only an already-cancelled record refuses.
  if (ev.lifecycle === 'cancelled') redirect(`/events/${eventId}`);
  db.prepare(
    `UPDATE events SET lifecycle = 'cancelled', lifecycle_at = now_stamp(), lifecycle_note = ? WHERE id = ?`,
  ).run(reason, eventId);
  redirect(`/events/${eventId}?notice=cancelled`);
}

export async function postponeEventAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  refuseIfArchived(eventId);
  const reason = String(formData.get('reason') ?? '').trim();
  const newDate = String(formData.get('newDate') ?? '').trim();
  if (!reason) redirect(`/events/${eventId}/lifecycle?error=reason`);
  const db = getDb();
  const ev = db.prepare(`SELECT lifecycle FROM events WHERE id = ?`).get(eventId) as { lifecycle: string };
  // Recording the new date LATER re-runs this action on an already-postponed event.
  if (ev.lifecycle === 'cancelled') redirect(`/events/${eventId}`);
  db.prepare(
    `UPDATE events SET lifecycle = 'postponed', lifecycle_at = COALESCE(lifecycle_at, now_stamp()), lifecycle_note = ?, postponed_to = ? WHERE id = ?`,
  ).run(reason, newDate || null, eventId);
  redirect(`/events/${eventId}?notice=postponed`);
}

/**
 * Remove an attachment -- ONLY while nothing is filed. A filed submission's record
 * corrects by replacement, never by removal: taking a document out of a filed
 * package would silently falsify what the Ministry received.
 */
export async function removeAttachmentAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  refuseIfArchived(eventId);
  const docKey = String(formData.get('docKey') ?? '');
  const db = getDb();
  const ev = db.prepare(`SELECT filed FROM events WHERE id = ?`).get(eventId) as { filed: number };
  if (ev.filed === 1) redirect(`/events/${eventId}/requirements`);
  db.prepare(`DELETE FROM event_attachments WHERE event_id = ? AND doc_key = ?`).run(eventId, docKey);
  redirect(`/events/${eventId}/requirements`);
}

/**
 * Edit the DESCRIPTIVE details of an event: names, venue or route, municipalities,
 * times. The figures the classification depends on are deliberately NOT here --
 * they change through a reassessment, where the level re-derives. Dates ARE here:
 * a date change on a filed event is a material change, and the screen says so.
 */
export async function editEventDetailsAction(eventId: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  refuseIfArchived(eventId);
  // THE RECORD DECIDES, not the screen that hid the link. Once filed, the submission
  // is the Ministry's copy of these facts and editing them in place would desynchronize
  // the two silently -- Report a material change is the route (Protocol 8.5). The UI
  // already hides the link after filing; this is the half that survives a crafted
  // request, and it was missing: a filed, even determined, event accepted edits.
  const filedRow = getDb().prepare(`SELECT filed FROM events WHERE id = ?`).get(eventId) as { filed: number } | undefined;
  if (filedRow?.filed === 1) redirect(`/events/${eventId}?error=filed-record`);
  const nameEn = String(formData.get('nameEn') ?? '').trim();
  const nameAr = String(formData.get('nameAr') ?? '').trim();
  const startDate = String(formData.get('startDate') ?? '').trim();
  const endDate = String(formData.get('endDate') ?? '').trim();
  const venueRoute = String(formData.get('venueRoute') ?? '').trim();
  const municipalities = String(formData.get('municipalities') ?? '').trim();
  if (!nameEn || !nameAr || !startDate || !endDate) redirect(`/events/${eventId}/edit?error=required`);
  getDb()
    .prepare(
      `UPDATE events SET name_en = ?, name_ar = ?, start_date = ?, end_date = ?, venue_route = ?, municipalities = ? WHERE id = ?`,
    )
    .run(nameEn, nameAr, startDate, endDate, venueRoute, municipalities, eventId);
  redirect(`/events/${eventId}?notice=details-saved`);
}

/**
 * Delete a DRAFT -- a never-filed event only. Once filed, the record is the
 * Ministry's too and closes through cancellation, never deletion. Nominated
 * parties who already hold accounts are told the record is gone.
 */
export async function deleteDraftEventAction(eventId: string): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!ownedEvent(account.id, eventId)) redirect('/dashboard');
  refuseIfArchived(eventId);
  const db = getDb();
  const ev = db.prepare(`SELECT filed, name_en, name_ar, is_demo FROM events WHERE id = ?`).get(eventId) as { filed: number; name_en: string; name_ar: string; is_demo: number };
  if (ev.filed === 1) redirect(`/events/${eventId}`);
  const holders = db
    .prepare(`SELECT DISTINCT account_id FROM invitations WHERE event_id = ? AND account_id IS NOT NULL`)
    .all(eventId) as { account_id: number }[];
  for (const h of holders) {
    db.prepare(
      `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar, record_route, sent_at, is_demo)
       VALUES (?, 'for_information', ?, ?, ?, ?, '/profile', now_stamp(), ?)`,
    ).run(
      h.account_id,
      `Draft event deleted — ${ev.name_en}`, `حُذفت مسودة الفعالية — ${ev.name_ar}`,
      'The organizer deleted this draft before anything was filed. Nothing is owed by anyone.',
      'حذف المنظّم هذه المسودة قبل تقديم أي شيء. لا شيء مستحق على أحد.',
      ev.is_demo,
    );
  }
  for (const table of ['attestations', 'invitations', 'event_attachments', 'assessments', 'plans', 'plan_versions', 'submissions', 'submission_versions', 'enquiries', 'material_changes']) {
    db.prepare(`DELETE FROM ${table} WHERE event_id = ?`).run(eventId);
  }
  db.prepare(`DELETE FROM events WHERE id = ?`).run(eventId);
  redirect('/dashboard?notice=draft-deleted');
}

/**
 * The PROVIDER's own withdrawal after confirming -- the counterpart of the
 * organizer's remove. It rides the decline machinery deliberately: a
 * post-confirmation withdrawal is the provider declining to serve, it carries a
 * reason verbatim, and it is a material change on the organizer's record with
 * the same filed/unfiled consequence the decline path already states.
 */
export async function withdrawParticipationAction(token: string, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) redirect('/dashboard');
  const db = getDb();
  const inv = db
    .prepare(`SELECT token, event_id, kind, status FROM invitations WHERE token = ? AND account_id = ?`)
    .get(token, account.id) as { token: string; event_id: string; kind: 'ems' | 'director'; status: string } | undefined;
  if (!inv || inv.status !== 'confirmed') redirect('/dashboard');
  db.prepare(
    `UPDATE invitations SET status = 'declined', response_note = ?, answered_at = now_stamp() WHERE token = ?`,
  ).run(reason, token);
  const ev = db.prepare(`SELECT name_en, name_ar, filed FROM events WHERE id = ?`).get(inv.event_id) as { name_en: string; name_ar: string; filed: number };
  const evFiled = ev.filed === 1;
  notifyOrganizerOf(
    inv.event_id,
    `A confirmed party has withdrawn — ${ev.name_en}`,
    `انسحب طرف مؤكَّد — ${ev.name_ar}`,
    evFiled
      ? `The confirmed ${inv.kind === 'ems' ? 'EMS provider' : 'Event Medical Director'} has withdrawn. The reason, as written: “${verbatimQuote(reason)}”. This is a material change to your filed submission: report it to the Ministry and name another party.`
      : `The confirmed ${inv.kind === 'ems' ? 'EMS provider' : 'Event Medical Director'} has withdrawn. The reason, as written: “${verbatimQuote(reason)}”. Name another party from the requirements screen; nothing is filed yet, so no change report is owed.`,
    evFiled
      ? `انسحب ${inv.kind === 'ems' ? 'مزوّد خدمات الطوارئ' : 'المدير الطبي'} المؤكَّد. والسبب كما كُتب: «${verbatimQuote(reason)}». هذا تغيير جوهري في ملفكم المقدَّم: أبلغوا الوزارة به وسمّوا طرفاً آخر.`
      : `انسحب ${inv.kind === 'ems' ? 'مزوّد خدمات الطوارئ' : 'المدير الطبي'} المؤكَّد. والسبب كما كُتب: «${verbatimQuote(reason)}». سمّوا طرفاً آخر من شاشة المتطلبات؛ فلا شيء مقدَّم بعد، ولا يُستحق إبلاغ عن تغيير.`,
    evFiled ? `/events/${inv.event_id}/change` : `/events/${inv.event_id}/requirements`,
  );
  redirect('/dashboard?notice=withdrawn');
}

/**
 * Re-open a signed declaration after a material change. The signature attested
 * to the event as it was; a change reported after it returns the declaration to
 * DRAFT with the ten confirmations kept -- the provider reviews each against the
 * changed event and signs again. The organizer is told the declaration is no
 * longer signed, because their Level 3 gate just closed.
 */
export async function reopenDeclarationAction(token: string): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const db = getDb();
  const inv = db
    .prepare(`SELECT token, event_id, signed_at FROM invitations WHERE token = ? AND account_id = ? AND declaration = 'signed'`)
    .get(token, account.id) as { token: string; event_id: string; signed_at: string | null } | undefined;
  if (!inv) redirect('/dashboard');
  // Only a change dated after the signature re-opens; the control renders only
  // then, and the action re-checks rather than trusting the screen.
  const change = db
    .prepare(`SELECT id FROM material_changes WHERE event_id = ? AND reported_at > ? LIMIT 1`)
    .get(inv.event_id, inv.signed_at ?? '') as { id: number } | undefined;
  if (!change) redirect(`/events/${inv.event_id}/declaration`);
  db.prepare(`UPDATE invitations SET declaration = 'draft', signed_at = NULL WHERE token = ?`).run(token);
  const ev = db.prepare(`SELECT name_en, name_ar FROM events WHERE id = ?`).get(inv.event_id) as { name_en: string; name_ar: string };
  notifyOrganizerOf(
    inv.event_id,
    `A readiness declaration was re-opened — ${ev.name_en}`,
    `أُعيد فتح إقرار جاهزية — ${ev.name_ar}`,
    'Following your reported material change, a named provider has re-opened their signed readiness declaration to review it against the changed event. The Level 3 package waits on their new signature.',
    'بعد إبلاغكم عن تغيير جوهري، أعاد مزوّد مُسمّى فتح إقرار جاهزيته الموقَّع لمراجعته على الفعالية المتغيّرة. وينتظر ملف المستوى 3 توقيعه الجديد.',
    `/events/${inv.event_id}/requirements`,
  );
  redirect(`/events/${inv.event_id}/declaration?notice=reopened`);
}

/** The Director maintains the credential record the Order verifies against. */
export async function saveCredentialAction(formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (account.role !== 'director') redirect('/dashboard');
  const licence = String(formData.get('licence') ?? '').trim();
  getDb().prepare(`UPDATE accounts SET credential_licence = ? WHERE id = ?`).run(licence, account.id);
  revalidatePath('/credentials');
  redirect('/credentials?notice=saved');
}

/**
 * The counterparty answers a document request on the shared list. THE FILE IS
 * STORED, on the same terms as every other attachment (storage ruling, 2026-08-28);
 * adding turns the row to the provider's, and the organizer sees it on the same
 * shared list -- and can now open it rather than read that it exists.
 */
export async function answerDocumentRequestAction(token: string, docId: number, formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const db = getDb();
  const inv = db
    .prepare(`SELECT token FROM invitations WHERE token = ? AND account_id = ?`)
    .get(token, account.id) as { token: string } | undefined;
  if (!inv) redirect('/dashboard');
  const file = formData.get('file');
  const eventOf = (): string =>
    (db.prepare(`SELECT event_id FROM invitations WHERE token = ?`).get(token) as { event_id: string }).event_id;
  if (!(file instanceof File)) redirect('/dashboard');
  const refusal = refuseUpload({ type: file.type, size: file.size });
  if (refusal) redirect(`/events/${eventOf()}/documents?upload=${refusal.reason}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > maxUploadBytes()) redirect(`/events/${eventOf()}/documents?upload=tooLarge`);
  const fileName = file.name.trim();
  db.prepare(
    `UPDATE shared_documents SET source = 'provider', file_name = ?, content_type = ?,
       byte_size = ?, bytes = ?, meta_en = ?, meta_ar = ?, added_at = now_stamp()
     WHERE id = ? AND invitation_token = ?`,
  ).run(fileName, file.type, bytes.length, bytes, `Added by you · ${fileName}`, `أضفتموه · ${fileName}`, docId, token);
  redirect(`/events/${(db.prepare(`SELECT event_id FROM invitations WHERE token = ?`).get(token) as { event_id: string }).event_id}/documents`);
}
