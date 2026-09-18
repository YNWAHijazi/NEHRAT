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
import { fileSubmissionAction, saveComplianceAction, savePlanAction, savePostEventReportAction,
  signAndSubmitPostEventAction, saveGovernanceAction, signPostEventReportAction,
  returnPostEventReportAction, saveDeclarationDraftAction, signDeclarationAction, saveOpsDetailAction,
  respondToInvitationAction, registerAgainstInvitationAction, signInAgainstInvitationAction, withdrawParticipationAction,
  type PlanPayload } from '../app/actions';

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
const plan: PlanPayload = { baseVersion: 1, mode: 'write', sections: { '1': { text: 'Unsaved text' } }, majorIncident: {}, attachedFile: null, refConfirmed: false, refAdmitsChildren: false, refTemporaryAreas: false };

describe('server actions preserve closed records', () => {
  it('refuses organizer and Director writes to an archived event', async () => {
    const db = getDb();
    db.prepare("UPDATE events SET archived_at = '2026-08-12' WHERE id = 'EV-0362'").run();
    const before = db.prepare("SELECT version, sections FROM plans WHERE event_id = 'EV-0362'").get();
    as('test_organizer');
    const organizerWrites = [
      () => savePlanAction('EV-0362', plan),
      () => saveComplianceAction('EV-0362', { declarations: {}, insurance: {}, representative: '', telephone: '', position: '' }),
      () => fileSubmissionAction('EV-0362'),
      () => savePostEventReportAction('EV-0362', { activity: {}, significant: {}, lessonsNone: true, lessonsText: '' }),
      () => signAndSubmitPostEventAction('EV-0362'),
    ];
    for (const write of organizerWrites) await expect(write()).rejects.toThrow('error=archived');
    as('test_director');
    for (const write of [
      () => savePlanAction('EV-0362', plan),
      () => saveGovernanceAction('EV-0362', new FormData()),
      () => signPostEventReportAction('EV-0362'),
      () => returnPostEventReportAction('EV-0362', new FormData()),
    ]) await expect(write()).rejects.toThrow('error=archived');
    as('test_ems');
    const inv = db.prepare("SELECT token FROM invitations WHERE event_id = 'EV-0362' AND kind = 'ems' AND account_id = ?").get(session.account!.id) as { token: string };
    const form = new FormData(); form.set('reason', 'Old browser tab'); form.set('response', 'decline');
    for (const write of [
      () => saveOpsDetailAction(inv.token, form),
      () => withdrawParticipationAction(inv.token, form),
      () => respondToInvitationAction(inv.token, form),
      () => registerAgainstInvitationAction(inv.token, form),
      () => signInAgainstInvitationAction(inv.token, form),
    ]) await expect(write()).rejects.toThrow('error=archived');
    expect(db.prepare("SELECT version, sections FROM plans WHERE event_id = 'EV-0362'").get()).toEqual(before);
    db.prepare("UPDATE events SET archived_at = NULL WHERE id = 'EV-0362'").run();
  });

  it('cannot revive a removed nomination through an old declaration or operations form', async () => {
    as('test_ems');
    const db = getDb();
    const inv = db.prepare("SELECT token FROM invitations WHERE event_id = 'EV-0362' AND kind = 'ems' AND account_id = ?").get(session.account!.id) as { token: string };
    db.prepare("UPDATE invitations SET status = 'removed' WHERE token = ?").run(inv.token);
    const payload = { items: [], certification: {} };
    expect(await saveDeclarationDraftAction(inv.token, payload)).toEqual({ error: 'not-found' });
    expect(await signDeclarationAction(inv.token, payload)).toEqual({ error: 'not-found' });
    await expect(saveOpsDetailAction(inv.token, new FormData())).rejects.toThrow('redirect:/dashboard');
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
