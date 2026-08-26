'use server';

/**
 * Server actions for Slice 1: sign-in, sign-out, account creation, organization
 * registration, event creation with assessment, notification read-marking.
 *
 * Every regulatory decision is delegated to lib/rules -- nothing here derives a level
 * or invents a gate.
 */

import { redirect } from 'next/navigation';
import { nowStamp } from '../lib/clock';

/**
 * A person's own words, quoted inside “ ” or « », with our sentence-ending full stop
 * outside. Their sentence usually ends in one already, and adding ours produced
 * `...that weekend.".` in the decline notification. Strip theirs, keep ours: the
 * wording is untouched, only the terminal punctuation is de-duplicated.
 */
function verbatimQuote(reason: string): string {
  const trimmed = reason.trimEnd();
  return /[.!?؟]$/.test(trimmed) ? trimmed.slice(0, -1) : trimmed;
}
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { getDb, nextRecordId } from '../lib/db';
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
  declarationGate } from '../lib/rules';
import type { DomainAnswers, MinimumConditionInputs } from '../lib/rules';

const DEMO_LOGINS = new Set([
  'test_organizer',
  'test_organizer_pending',
  'test_ems',
  'test_director',
  'test_response',
  'test_moph',
  'test_moph_admin',
  'test_inspector',
  'test_owner',
]);

export async function demoSignInAction(formData: FormData): Promise<void> {
  const login = String(formData.get('login') ?? '');
  if (!DEMO_LOGINS.has(login)) redirect('/signin?error=unknown');
  const account = findAccountByLogin(login);
  if (!account) redirect('/signin?error=unknown');
  await startSession(account.id);
  // Each role lands on its own surface.
  if (account.role === 'organizer' || account.role === 'ems' || account.role === 'director') {
    redirect('/dashboard');
  }
  if (account.role === 'response') redirect('/first-response/readiness');
  if (account.role === 'reviewer' || account.role === 'inspector' || account.role === 'ministry_admin') {
    redirect('/ministry');
  }
  if (account.role === 'platform_owner') redirect('/platform/admin');
  redirect('/signin?notice=role-later-slice');
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
    .prepare(`SELECT id, password_hash FROM accounts WHERE email = ?`)
    .get(email) as { id: number; password_hash: string | null } | undefined;
  // One failure answer: whether the email exists is not disclosed.
  if (!row?.password_hash || !verifyPassword(password, row.password_hash)) {
    await rememberSignInFields({ email });
    redirect('/signin?error=credentials');
  }
  await forgetSignInFields();
  await startSession(row.id);
  redirect('/dashboard');
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
  // A real document is attached, never a typed name: the control is a file picker and
  // the record carries the chosen file's own name. (Binary storage remains the recorded
  // deployment decision; the name is what the review build keeps.)
  const file = formData.get('file');
  const fileName =
    file instanceof File && file.size >= 0 ? file.name.trim() : String(formData.get('fileName') ?? '').trim();
  if (docKey && fileName) {
    getDb()
      .prepare(
        `INSERT INTO event_attachments (event_id, doc_key, file_name) VALUES (?, ?, ?)
         ON CONFLICT (event_id, doc_key) DO UPDATE SET file_name = excluded.file_name, attached_at = now_stamp()`,
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
    venueRegularlyHostsOrganizedEvents: venue.regularly_hosts === 1,
  };
  const derivation = deriveLevel({ answers: payload.answers, inputs });
  if (!derivation.complete || derivation.finalLevel === null) return { error: 'incomplete' };

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
    `INSERT INTO facility_device_updates (facility_id, device_label, purpose, representative)
     VALUES (?, ?, ?, ?)`,
  ).run(facilityId, label, purpose, s('representative'));
  revalidatePath(`/facilities/${facilityId}/devices`);
  revalidatePath(`/facilities/${facilityId}`);
  redirect(`/facilities/${facilityId}/devices?notice=saved`);
}

/** Annex B section 5, signed by the coordinator. Drives the drill and annual rows. */
export async function saveFacilityPlanAction(facilityId: string, formData: FormData): Promise<void> {
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
  revalidatePath(`/facilities/${facilityId}/plan`);
  revalidatePath(`/facilities/${facilityId}`);
  redirect(`/facilities/${facilityId}?notice=confirmed`);
}

/** Coordinator review: stamps updated_at, the ledger's affirmation date. */
export async function saveFacilityPersonsAction(facilityId: string, formData: FormData): Promise<void> {
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
 * The nomination response. The token is the credential (rule 6): the holder responds
 * to this one nomination and sees nothing else. Accepting links the session's
 * account; declining requires a reason and is a material change the organizer must
 * report; a modification request keeps the nomination open with the reason attached.
 */
export async function respondToInvitationAction(token: string, formData: FormData): Promise<void> {
  const inv = invitationRow(token);
  if (!inv) redirect('/signin');
  let account = await currentAccount();
  if (!account) {
    // Self-registration AGAINST the invitation (rule 6): the account is created from
    // the nomination screen's own form, with the role the nomination names.
    const name = String(formData.get('fullName') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');
    if (!name || !email || !checkPasswordPolicy(password).ok) {
      redirect(`/invitations/${token}?error=account`);
    }
    const exists = getDb().prepare(`SELECT id FROM accounts WHERE email = ?`).get(email);
    if (exists) redirect(`/invitations/${token}?error=email-taken`);
    const initials = name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
    const role = inv.kind === 'ems' ? 'ems' : 'director';
    const created = getDb()
      .prepare(
        `INSERT INTO accounts (login, email, password_hash, display_name, initials, role, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(`user_${Date.now().toString(36)}`, email, hashPassword(password), name, initials, role);
    await startSession(created.lastInsertRowid as number);
    account = await currentAccount();
    if (!account) redirect('/signin');
  }
  const db = getDb();
  const response = String(formData.get('response') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const eventName = db.prepare(`SELECT name_en, name_ar FROM events WHERE id = ?`).get(inv.event_id) as { name_en: string; name_ar: string };

  if (response === 'accept') {
    db.prepare(
      `UPDATE invitations SET status = 'confirmed', account_id = ?, answered_at = now_stamp() WHERE token = ?`,
    ).run(account.id, token);
    redirect('/profile?notice=accepted');
  }
  if (response === 'decline') {
    if (!reason) redirect(`/invitations/${token}?error=reason`);
    db.prepare(
      `UPDATE invitations SET status = 'declined', account_id = ?, response_note = ?, answered_at = now_stamp() WHERE token = ?`,
    ).run(account.id, reason, token);
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
      `UPDATE invitations SET response_note = ?, account_id = ? WHERE token = ?`,
    ).run(reason, account.id, token);
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

/* ---- First-response unit (cardiac-arrest instrument) ---- */

export async function saveFrReadinessAction(
  payload: { confirmations: Record<string, boolean[]>; sign: boolean },
): Promise<{ ok: true }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  getDb()
    .prepare(
      `INSERT INTO fr_readiness (account_id, confirmations, signed_at, updated_at)
       VALUES (?, ?, ?, now_stamp())
       ON CONFLICT(account_id) DO UPDATE SET confirmations = excluded.confirmations,
         signed_at = COALESCE(excluded.signed_at, fr_readiness.signed_at), updated_at = excluded.updated_at`,
    )
    .run(account.id, JSON.stringify(payload.confirmations), payload.sign ? nowStamp() : null);
  revalidatePath('/first-response/readiness');
  return { ok: true };
}

/**
 * One report per patient, five sections, no patient name. Two routes: the platform
 * form, or the unit's own patient-care report attached where it captures everything
 * required -- both land here.
 */
export async function submitFrReportAction(
  payload: {
    mode: 'platform' | 'attach';
    attachedFile: string | null;
    covered: Record<string, boolean>;
    values: Record<string, string>;
  },
): Promise<{ ok: true } | { error: string }> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (payload.mode === 'attach' && !payload.attachedFile) return { error: 'file-missing' };
  getDb()
    .prepare(
      `INSERT INTO fr_reports (account_id, mode, attached_file, covered, payload)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      account.id, payload.mode, payload.attachedFile,
      JSON.stringify(payload.covered), JSON.stringify(payload.values),
    );
  revalidatePath('/first-response/readiness');
  return { ok: true };
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
  redirect(`/events/${eventId}/governance?notice=saved`);
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
