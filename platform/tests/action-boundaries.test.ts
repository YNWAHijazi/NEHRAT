import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Account } from '../lib/auth';

const session = vi.hoisted(() => ({ account: null as Account | null }));
vi.mock('../lib/auth', () => ({ currentAccount: async () => session.account }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getDb } from '../lib/db';
import { fileSubmissionAction, saveComplianceAction, savePostEventReportAction,
  signAndSubmitPostEventAction, saveGovernanceAction, signPostEventReportAction,
  returnPostEventReportAction, saveDeclarationDraftAction, signDeclarationAction,
  respondToInvitationAction, registerAgainstInvitationAction, signInAgainstInvitationAction, withdrawParticipationAction } from '../app/actions';
import { approveRecordPlanAction, saveRequirementAnswerAction } from '../app/record-actions';

const folder = mkdtempSync(join(tmpdir(), 'moph-action-boundaries-'));
beforeAll(() => {
  vi.stubEnv('DATABASE_PATH', join(folder, 'test.db'));
  vi.stubEnv('REVIEW_CLOCK', '2026-08-13');
  getDb();
});
afterAll(() => { getDb().close(); vi.unstubAllEnvs(); rmSync(folder, { recursive: true, force: true }); });
function as(login: string) {
  const row = getDb().prepare('SELECT id, role FROM accounts WHERE login = ?').get(login) as { id: number; role: Account['role'] };
  session.account = { ...row, login, displayName: login, initials: 'T', isDemo: true };
}
/** One plan section's text, saved through the record page's action at whatever version it holds. */
const planText = (text: string) => {
  const stored = getDb().prepare("SELECT version FROM requirement_answers WHERE record_kind = 'event' AND record_id = 'EV-0362' AND key = 'P13'").get() as { version: number } | undefined;
  return saveRequirementAnswerAction('event', 'EV-0362', 'P13', { baseVersion: stored?.version ?? 0, values: { text } });
};

describe('server actions preserve closed records', () => {
  it('refuses organizer, Director and agency writes to an archived event', async () => {
    const db = getDb();
    db.prepare("UPDATE events SET archived_at = '2026-08-12' WHERE id = 'EV-0362'").run();
    const before = db.prepare("SELECT key, answers, version FROM requirement_answers WHERE record_kind = 'event' AND record_id = 'EV-0362' ORDER BY key").all();
    as('test_organizer');
    const organizerWrites = [
      () => saveComplianceAction('EV-0362', { declarations: {}, insurance: {}, representative: '', telephone: '', position: '' }),
      () => fileSubmissionAction('EV-0362'),
      () => savePostEventReportAction('EV-0362', { activity: {}, significant: {}, lessonsNone: true, lessonsText: '' }),
      () => signAndSubmitPostEventAction('EV-0362'),
    ];
    for (const write of organizerWrites) await expect(write()).rejects.toThrow('error=archived');
    // The record page's own action reads the archive as a lock, for every role.
    expect(await saveRequirementAnswerAction('event', 'EV-0362', 'B10', { baseVersion: 0, values: { entrance: 'x', keeper: 'y' } })).toEqual({ error: 'locked' });
    as('test_director');
    for (const write of [
      () => saveGovernanceAction('EV-0362', new FormData()),
      () => signPostEventReportAction('EV-0362'),
      () => returnPostEventReportAction('EV-0362', new FormData()),
    ]) await expect(write()).rejects.toThrow('error=archived');
    expect(await planText('Archived override')).toEqual({ error: 'locked' });
    const confirm = new FormData(); confirm.set('confirm', 'yes');
    await expect(approveRecordPlanAction('event', 'EV-0362', confirm)).rejects.toThrow('error=approval');
    as('test_ems');
    expect(await planText('Archived override')).toEqual({ error: 'locked' });
    const inv = db.prepare("SELECT token FROM invitations WHERE event_id = 'EV-0362' AND kind = 'ems' AND account_id = ?").get(session.account!.id) as { token: string };
    const form = new FormData(); form.set('reason', 'Old browser tab'); form.set('response', 'decline');
    for (const write of [
      () => withdrawParticipationAction(inv.token, form),
      () => respondToInvitationAction(inv.token, form),
      () => registerAgainstInvitationAction(inv.token, form),
      () => signInAgainstInvitationAction(inv.token, form),
    ]) await expect(write()).rejects.toThrow('error=archived');
    expect(db.prepare("SELECT key, answers, version FROM requirement_answers WHERE record_kind = 'event' AND record_id = 'EV-0362' ORDER BY key").all()).toEqual(before);
    db.prepare("UPDATE events SET archived_at = NULL WHERE id = 'EV-0362'").run();
  });

  it('cannot revive a removed nomination through an old declaration form or the record page', async () => {
    as('test_ems');
    const db = getDb();
    const inv = db.prepare("SELECT token FROM invitations WHERE event_id = 'EV-0362' AND kind = 'ems' AND account_id = ?").get(session.account!.id) as { token: string };
    db.prepare("UPDATE invitations SET status = 'removed' WHERE token = ?").run(inv.token);
    const payload = { items: [], certification: {} };
    expect(await saveDeclarationDraftAction(inv.token, payload)).toEqual({ error: 'not-found' });
    expect(await signDeclarationAction(inv.token, payload)).toEqual({ error: 'not-found' });
    // A removed party has no standing on the record: the shared rows are not its to enter.
    expect(await planText('Removed agency')).toEqual({ error: 'not-found' });
    expect((db.prepare('SELECT status FROM invitations WHERE token = ?').get(inv.token) as { status: string }).status).toBe('removed');
    db.prepare("UPDATE invitations SET status = 'confirmed' WHERE token = ?").run(inv.token);
  });

  it('does not overwrite a signed declaration on a repeated signing request', async () => {
    as('test_ems');
    const db = getDb();
    const before = db.prepare("SELECT token, certification, signed_at FROM invitations WHERE event_id = 'EV-0362' AND kind = 'ems' AND account_id = ?").get(session.account!.id) as { token: string; certification: string; signed_at: string };
    expect(before.signed_at).toBeTruthy();
    expect(await signDeclarationAction(before.token, { items: [], certification: { name: 'Overwrite attempt' } })).toEqual({ ok: true });
    expect(db.prepare('SELECT token, certification, signed_at FROM invitations WHERE token = ?').get(before.token)).toEqual(before);
  });
});
