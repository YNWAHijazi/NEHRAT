import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Account } from '../lib/auth';

/**
 * A hosting venue's medical-team invitation answers like an event nomination (owner,
 * 8 October 2026: "make it the same interface, how they accept and so on"): read on the
 * token, accept / decline / ask a question, then sign in or create an account under the
 * invited email. The venue's own security properties stay: the invited role and email,
 * the demonstration boundary, the decline reported to the operator, no other venue.
 */
const session = vi.hoisted(() => ({ account: null as Account | null }));
vi.mock('../lib/auth', async (original) => ({
  ...(await original<typeof import('../lib/auth')>()),
  currentAccount: async () => session.account,
  rememberSignInFields: async () => {},
  forgetSignInFields: async () => {},
}));
// Signing in here is the session switching to the account, as the cookie would.
vi.mock('../lib/email-verification', async (original) => ({
  ...(await original<typeof import('../lib/email-verification')>()),
  verifiedSignIn: async (accountId: number) => {
    const { getDb } = await import('../lib/db');
    const r = getDb().prepare('SELECT id, login, role, display_name, is_demo FROM accounts WHERE id = ?').get(accountId) as { id: number; login: string; role: Account['role']; display_name: string; is_demo: number };
    session.account = { id: r.id, login: r.login, role: r.role, displayName: r.display_name, initials: 'X', isDemo: r.is_demo === 1 };
  },
}));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); }, notFound: () => { throw new Error('not-found'); } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getDb } from '../lib/db';
import { hashPassword } from '../lib/password';
import { saveVenueAssessmentAction } from '../app/actions';
import { createVenuePartnerAccountAction, respondVenueInvitationAction, signInVenuePartnerAction } from '../app/venues/team-actions';
import { rowsForVenueParty, venueInvitationState, venueNominationBriefing } from '../lib/venue/briefing';
import { venueAccess, venueAccountMayTake } from '../lib/venue/collaboration';
import { venueRecordRequirements } from '../lib/record-facts';

const folder = mkdtempSync(join(tmpdir(), 'moph-venue-invitation-'));
const id = 'VN-9101';
const PASSWORD = 'Venue-Invite-2026';
let owner: number;

function form(values: Record<string, string>) { const f = new FormData(); for (const [k, v] of Object.entries(values)) f.set(k, v); return f; }
function as(login: string) {
  const r = getDb().prepare('SELECT id, role, is_demo FROM accounts WHERE login = ?').get(login) as { id: number; role: Account['role']; is_demo: number };
  session.account = { id: r.id, login, role: r.role, displayName: login, initials: 'T', isDemo: r.is_demo === 1 };
  return r.id;
}
function account(role: 'ems' | 'director', email: string, isDemo = 1): string {
  const login = `venue_inv_${randomBytes(4).toString('hex')}`;
  getDb().prepare('INSERT INTO accounts (login, email, password_hash, display_name, initials, role, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?)').run(login, email, hashPassword(PASSWORD), login, 'VI', role, isDemo);
  return login;
}
function invite(kind: 'ems' | 'director', email: string, expiresInDays = 30): string {
  const token = randomBytes(24).toString('hex');
  getDb().prepare('INSERT INTO venue_invitations (token, venue_id, kind, name, email, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(token, id, kind, `Named ${kind}`, email, new Date(Date.now() + expiresInDays * 86400000).toISOString());
  return token;
}
const row = (token: string) => getDb().prepare('SELECT status, account_id, note FROM venue_invitations WHERE token = ?').get(token) as { status: string; account_id: number | null; note: string };
const operatorNotices = () => getDb().prepare("SELECT kind, subject_en, body_en, body_ar, record_route FROM notifications WHERE account_id = ? AND subject_en LIKE 'A named party%' ORDER BY id").all(owner) as { kind: string; subject_en: string; body_en: string; body_ar: string; record_route: string }[];

beforeAll(async () => {
  vi.stubEnv('DATABASE_PATH', join(folder, 'test.db'));
  vi.stubEnv('REVIEW_CLOCK', '2026-08-13');
  owner = as('test_organizer');
  const db = getDb();
  db.prepare(`INSERT INTO venues(id,account_id,name_en,name_ar,category,address_municipality_en,address_municipality_ar,responsible_contact,responsible_name,responsible_phone,licensed_capacity,regularly_hosts,is_demo,district,latitude,longitude) VALUES(?,?,'Invitation parity venue','موقع اختبار الدعوة','hall','Beirut','بيروت','Operator +9613111111','Operator','+9613111111',5000,1,1,'Beirut',33.9,35.5)`).run(id, owner);
  db.prepare('INSERT INTO venue_packages(venue_id) VALUES(?)').run(id);
  expect(await saveVenueAssessmentAction(id, { answers: [2, 2, 2, 2, 2, 2, 2, 2, 2], attendance: 5000, representative: 'Operator', position: 'Manager' })).toEqual({ level: 3 });
});
afterAll(() => { getDb().close(); vi.unstubAllEnvs(); rmSync(folder, { recursive: true, force: true }); });

describe('the venue briefing reads the record resolver', () => {
  it('names the rows the role carries at the venue level, and no other party token', () => {
    const ems = invite('ems', 'briefing-ems@venue.example.test');
    const director = invite('director', 'briefing-director@venue.example.test');
    const record = venueRecordRequirements(owner, id)!;
    const e = venueNominationBriefing(ems)!;
    expect(e.level).toBe(3);
    expect(e.rows.map((r) => r.key)).toEqual(rowsForVenueParty(record.instances, 'ems').map((r) => r.key));
    // The EMS readiness declaration is the agency's alone; medical command is the Director's alone.
    expect(e.rows.find((r) => r.key === 'B20')).toMatchObject({ sole: true });
    expect(e.rows.map((r) => r.key)).not.toContain('B15');
    expect(venueNominationBriefing(director)!.rows.find((r) => r.key === 'B15')).toMatchObject({ sole: true });
    // Every row carries its matrix wording in both languages.
    for (const r of e.rows) { expect(r.en).not.toBe(''); expect(r.ar).not.toBe(''); expect(r.valueAr).not.toBe(''); }
    // Who else is named -- without anybody's token, which is a credential.
    expect(JSON.stringify(e.otherParties)).not.toContain(director);
    expect(e.otherParties.find((p) => p.isThisOne)).toMatchObject({ kind: 'ems', status: 'nominated' });
    expect(venueNominationBriefing('0'.repeat(48))).toBeNull();
    expect(venueNominationBriefing('EV-0418')).toBeNull();
  });
});

describe('the three answers, on the token, as on an event', () => {
  it('declines without an account, with a reason, and reports it to the operator as written', async () => {
    session.account = null;
    const token = invite('ems', 'decline@venue.example.test');
    await expect(respondVenueInvitationAction(token, form({ response: 'decline' }))).rejects.toThrow(`redirect:/venue-invitations/${token}?error=reason`);
    expect(row(token).status).toBe('nominated');
    await expect(respondVenueInvitationAction(token, form({ response: 'decline', reason: 'No crew on Fridays' }))).rejects.toThrow(`redirect:/venue-invitations/${token}?notice=declined`);
    expect(row(token)).toMatchObject({ status: 'declined', note: 'No crew on Fridays', account_id: null });
    const notice = operatorNotices().at(-1)!;
    expect(notice).toMatchObject({ kind: 'needs_action', record_route: `/venues/${id}?step=B7#req-B7` });
    expect(notice.body_en).toContain('“No crew on Fridays”');
    expect(notice.body_ar).toContain('«No crew on Fridays»');
    // An answered invitation answers nothing more.
    await expect(respondVenueInvitationAction(token, form({ response: 'accept' }))).rejects.toThrow(`redirect:/venue-invitations/${token}`);
    expect(row(token).status).toBe('declined');
  });

  it('asks a question without changing the invitation', async () => {
    session.account = null;
    const token = invite('director', 'question@venue.example.test');
    await expect(respondVenueInvitationAction(token, form({ response: 'modification', reason: 'Which nights?' }))).rejects.toThrow('notice=modification');
    expect(row(token)).toMatchObject({ status: 'nominated', note: 'Which nights?' });
    expect(operatorNotices().at(-1)!.record_route).toBe(`/venues/${id}?step=B3#req-B3`);
  });

  it('accepts only through the invited role and email, on the venue side of the demonstration boundary', async () => {
    const email = 'accept@venue.example.test';
    const token = invite('ems', email);
    session.account = null;
    await expect(respondVenueInvitationAction(token, form({ response: 'accept' }))).rejects.toThrow(`redirect:/venue-invitations/${token}/account`);
    as(account('ems', 'someone-else@venue.example.test'));
    await expect(respondVenueInvitationAction(token, form({ response: 'accept' }))).rejects.toThrow(`/account?error=invited-email`);
    const live = account('ems', email, 0);
    expect(venueAccountMayTake(as(live), token)).toBe(false);
    await expect(respondVenueInvitationAction(token, form({ response: 'accept' }))).rejects.toThrow(`/account?error=invited-email`);
    as(account('director', 'director-for-ems@venue.example.test'));
    await expect(respondVenueInvitationAction(token, form({ response: 'accept' }))).rejects.toThrow(`redirect:/venue-invitations/${token}/account`);
    expect(row(token)).toMatchObject({ status: 'nominated', account_id: null });
  });

  it('refuses a response to an expired invitation', async () => {
    session.account = null;
    const token = invite('ems', 'expired@venue.example.test', -1);
    expect(venueInvitationState(token)!.open).toBe(false);
    await expect(respondVenueInvitationAction(token, form({ response: 'decline', reason: 'Late' }))).rejects.toThrow(`redirect:/venue-invitations/${token}`);
    expect(row(token).status).toBe('nominated');
  });
});

describe('stage three: create an account or sign in, then the acceptance completes', () => {
  it('creates the account under the invited email and lands the partner on the venue', async () => {
    session.account = null;
    const email = 'new-partner@venue.example.test';
    const token = invite('ems', email);
    await expect(createVenuePartnerAccountAction(token, form({ fullName: 'New Partner', phone: '+9613111111', password: 'short' }))).rejects.toThrow(`/account?error=account`);
    await expect(createVenuePartnerAccountAction(token, form({ fullName: 'New Partner', phone: '+9613111111', password: PASSWORD, email: 'typed@elsewhere.test' }))).rejects.toThrow(`redirect:/venue-team/${id}?notice=accepted`);
    const created = getDb().prepare('SELECT id, role, is_demo, phone FROM accounts WHERE email = ?').get(email) as { id: number; role: string; is_demo: number; phone: string };
    expect(created).toMatchObject({ role: 'ems', is_demo: 1, phone: '+9613111111' });
    expect(getDb().prepare('SELECT id FROM accounts WHERE email = ?').get('typed@elsewhere.test')).toBeUndefined();
    expect(row(token)).toMatchObject({ status: 'confirmed', account_id: created.id });
    expect(venueAccess(session.account!, id)?.role).toBe('ems');
    expect(operatorNotices().at(-1)).toMatchObject({ kind: 'for_information', subject_en: 'A named party has accepted — Invitation parity venue' });
  });

  it('sends an existing address to sign in, then links and accepts', async () => {
    session.account = null;
    const email = 'existing-partner@venue.example.test';
    account('director', email);
    const token = invite('director', email);
    await expect(createVenuePartnerAccountAction(token, form({ fullName: 'Existing', phone: '+9613111111', password: PASSWORD }))).rejects.toThrow(`/account?error=email-taken`);
    await expect(signInVenuePartnerAction(token, form({ email, password: 'wrong-password' }))).rejects.toThrow(`/account?error=credentials`);
    const other = 'other-ems@venue.example.test';
    account('ems', other);
    await expect(signInVenuePartnerAction(token, form({ email: other, password: PASSWORD }))).rejects.toThrow(`/account?error=role`);
    await expect(signInVenuePartnerAction(token, form({ email, password: PASSWORD }))).rejects.toThrow(`redirect:/venue-team/${id}?notice=accepted`);
    expect(row(token).status).toBe('confirmed');
    expect(venueAccess(session.account!, id)?.role).toBe('director');
  });
});
