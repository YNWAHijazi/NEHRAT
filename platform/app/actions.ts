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
import { deriveLevel } from '../lib/rules';
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

export interface AssessmentSubmission {
  nameEn: string;
  nameAr: string;
  startDate: string;
  endDate: string;
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
  db.prepare(
    `INSERT INTO events (id, account_id, name_en, name_ar, start_date, end_date, filed, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(
    eventId,
    account.id,
    payload.nameEn.trim(),
    payload.nameAr.trim(),
    payload.startDate,
    payload.endDate,
    account.isDemo ? 1 : 0,
  );
  db.prepare(
    `INSERT INTO assessments (event_id, version, answers, inputs, derivation)
     VALUES (?, 1, ?, ?, ?)`,
  ).run(
    eventId,
    JSON.stringify(payload.answers),
    JSON.stringify(payload.inputs),
    JSON.stringify(derivation),
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
    `INSERT INTO assessments (event_id, version, answers, inputs, derivation)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(eventId, version, JSON.stringify(payload.answers), JSON.stringify(payload.inputs), JSON.stringify(derivation));
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
