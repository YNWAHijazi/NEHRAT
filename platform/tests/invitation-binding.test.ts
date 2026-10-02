import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Account } from '../lib/auth';

/**
 * An event nomination binds to the account holding the email the organizer named, on the
 * event's side of the demonstration boundary -- the test venue invitations already applied.
 * Before this, anyone holding the link could accept, decline or register under any account.
 */
const session = vi.hoisted(() => ({ account: null as Account | null }));
vi.mock('../lib/auth', async (original) => ({
  ...(await original<typeof import('../lib/auth')>()),
  currentAccount: async () => session.account,
  rememberSignInFields: async () => {},
  forgetSignInFields: async () => {},
}));
vi.mock('../lib/email-verification', async (original) => ({
  ...(await original<typeof import('../lib/email-verification')>()),
  verifiedSignIn: async () => {},
}));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); }, notFound: () => { throw new Error('notFound'); } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getDb } from '../lib/db';
import { hashPassword } from '../lib/password';
import { accountMayTakeNomination } from '../lib/queries';
import { respondToInvitationAction, registerAgainstInvitationAction, signInAgainstInvitationAction } from '../app/actions';

const folder = mkdtempSync(join(tmpdir(), 'moph-invitation-binding-'));
const PASSWORD = 'Binding-Test-2026';
beforeAll(() => {
  vi.stubEnv('DATABASE_PATH', join(folder, 'test.db'));
  vi.stubEnv('REVIEW_CLOCK', '2026-08-13');
  getDb();
});
afterAll(() => { getDb().close(); vi.unstubAllEnvs(); rmSync(folder, { recursive: true, force: true }); });

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}
/** A fresh, unanswered EMS nomination on the demonstration event EV-0418. */
function nominate(email: string): string {
  const token = `binding-${Math.random().toString(16).slice(2)}`;
  getDb().prepare("INSERT INTO invitations (token, event_id, kind, name_en, name_ar, email) VALUES (?, 'EV-0418', 'ems', 'Named EMS', 'Named EMS', ?)").run(token, email);
  return token;
}
/** A signed-in EMS account with its own email, on the demonstration side unless told otherwise. */
function emsAccount(email: string, isDemo = 1): Account {
  const id = getDb()
    .prepare("INSERT INTO accounts (login, email, password_hash, display_name, initials, role, is_demo) VALUES (?, ?, ?, 'EMS', 'E', 'ems', ?)")
    .run(`binding_${Math.random().toString(16).slice(2)}`, email, hashPassword(PASSWORD), isDemo).lastInsertRowid as number;
  return { id, login: `ems-${id}`, role: 'ems', displayName: 'EMS', initials: 'E', isDemo: isDemo === 1 } as Account;
}
const row = (token: string) => getDb().prepare('SELECT status, account_id FROM invitations WHERE token = ?').get(token) as { status: string; account_id: number | null };

describe('an event nomination binds to the invited email', () => {
  it('refuses acceptance by a signed-in account holding another address', async () => {
    const token = nominate('named@ems.example.test');
    session.account = emsAccount('someone-else@ems.example.test');
    await expect(respondToInvitationAction(token, form({ response: 'accept' }))).rejects.toThrow('error=invited-email');
    expect(row(token)).toEqual({ status: 'nominated', account_id: null });
  });

  it('accepts the account holding the invited address, whatever its case', async () => {
    const token = nominate('Named2@EMS.example.test');
    session.account = emsAccount('named2@ems.example.test');
    await expect(respondToInvitationAction(token, form({ response: 'accept' }))).rejects.toThrow('notice=accepted');
    expect(row(token)).toEqual({ status: 'confirmed', account_id: session.account.id });
  });

  it('refuses an account on the other side of the demonstration boundary', async () => {
    const token = nominate('real@ems.example.test');
    session.account = emsAccount('real@ems.example.test', 0);
    expect(accountMayTakeNomination(session.account.id, token)).toBe(false);
    await expect(respondToInvitationAction(token, form({ response: 'accept' }))).rejects.toThrow('error=invited-email');
  });

  it('does not let a decline or a modification request link another account (the back door to acceptance)', async () => {
    const token = nominate('named3@ems.example.test');
    session.account = emsAccount('intruder@ems.example.test');
    await expect(respondToInvitationAction(token, form({ response: 'modification', reason: 'Can only staff half' }))).rejects.toThrow('notice=modification');
    expect(row(token).account_id).toBeNull();
    await expect(respondToInvitationAction(token, form({ response: 'accept' }))).rejects.toThrow('error=invited-email');
    expect(row(token).status).toBe('nominated');
  });

  it('keeps a nomination already linked to the account (the seeded demonstration ones)', async () => {
    const linked = getDb().prepare("SELECT token, account_id FROM invitations WHERE token = 'demo-lrc-saida-0301'").get() as { token: string; account_id: number };
    expect(accountMayTakeNomination(linked.account_id, linked.token)).toBe(true);
  });

  it('signs in and links only the account holding the invited address', async () => {
    const token = nominate('named4@ems.example.test');
    emsAccount('other4@ems.example.test');
    session.account = null;
    await expect(signInAgainstInvitationAction(token, form({ email: 'other4@ems.example.test', password: PASSWORD }))).rejects.toThrow('error=invited-email');
    expect(row(token).account_id).toBeNull();
    const named = emsAccount('named4@ems.example.test');
    await expect(signInAgainstInvitationAction(token, form({ email: 'named4@ems.example.test', password: PASSWORD }))).rejects.toThrow();
    expect(row(token).account_id).toBe(named.id);
  });

  it('creates a registering account under the invited address, not the one typed', async () => {
    const token = nominate('named5@ems.example.test');
    session.account = null;
    await expect(registerAgainstInvitationAction(token, form({ fullName: 'New Agency', email: 'typed@elsewhere.example.test', phone: '+961 3 123 456', password: PASSWORD }))).rejects.toThrow();
    const created = getDb().prepare('SELECT a.email, a.is_demo FROM invitations i JOIN accounts a ON a.id = i.account_id WHERE i.token = ?').get(token) as { email: string; is_demo: number };
    expect(created).toEqual({ email: 'named5@ems.example.test', is_demo: 1 });
    expect(getDb().prepare("SELECT id FROM accounts WHERE email = 'typed@elsewhere.example.test'").get()).toBeUndefined();
  });
});
