/**
 * Sessions. Cookie-backed, server-side rows, httpOnly.
 *
 * Slice 1 authentication is deliberately thin: demonstration logins (SPEC 3b) and a
 * passwordless account creation for review. Production credential handling is not
 * built yet and is reported as such in the slice handback -- it is a deferral, not a
 * gate, and nothing in the UI presents it as a product state.
 */

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { getDb } from './db';

const SESSION_COOKIE = 'session';

export interface Account {
  id: number;
  login: string;
  displayName: string;
  initials: string;
  role:
    | 'organizer'
    | 'ems'
    | 'director'
    | 'response'
    | 'reviewer'
    | 'ministry_admin'
    | 'platform_owner';
  isDemo: boolean;
}

export interface Organization {
  id: number;
  nameEn: string;
  nameAr: string;
  status: 'none' | 'pending' | 'recorded';
}

interface AccountRow {
  id: number;
  login: string;
  display_name: string;
  initials: string;
  role: Account['role'];
  is_demo: number;
}

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    login: row.login,
    displayName: row.display_name,
    initials: row.initials,
    role: row.role,
    isDemo: row.is_demo === 1,
  };
}

export async function currentAccount(): Promise<Account | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT a.id, a.login, a.display_name, a.initials, a.role, a.is_demo
       FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token = ?`,
    )
    .get(token) as AccountRow | undefined;
  return row ? toAccount(row) : null;
}

export function organizationFor(accountId: number): Organization | null {
  const row = getDb()
    .prepare(
      `SELECT id, name_en, name_ar, status FROM organizations WHERE account_id = ?`,
    )
    .get(accountId) as
    | { id: number; name_en: string; name_ar: string; status: Organization['status'] }
    | undefined;
  return row
    ? { id: row.id, nameEn: row.name_en, nameAr: row.name_ar, status: row.status }
    : null;
}

export async function startSession(accountId: number): Promise<void> {
  const token = randomBytes(32).toString('hex');
  getDb().prepare(`INSERT INTO sessions (token, account_id) VALUES (?, ?)`).run(token, accountId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) getDb().prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  jar.delete(SESSION_COOKIE);
}

export function findAccountByLogin(login: string): Account | null {
  const row = getDb()
    .prepare(
      `SELECT id, login, display_name, initials, role, is_demo FROM accounts WHERE login = ?`,
    )
    .get(login) as AccountRow | undefined;
  return row ? toAccount(row) : null;
}
