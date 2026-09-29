import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Account } from '../lib/auth';
const session = vi.hoisted(() => ({ account: null as Account | null }));
vi.mock('../lib/auth', async importOriginal => ({ ...await importOriginal<typeof import('../lib/auth')>(), currentAccount: async () => session.account }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getDb } from '../lib/db';
import { planAccess } from '../lib/plan-access';
import { planFor, derivedLevelFor } from '../lib/queries';
import { submissionGateFor } from '../lib/submission-facts';
import { savePlanAction, uploadPlanFileAction, type PlanPayload } from '../app/actions';
import { GET as planState } from '../app/api/events/[id]/plan-state/route';
import { documentsForLevel, planIsComplete, submissionGate, type SubmissionFacts } from '../lib/rules/submission';
import { planRequirement } from '../lib/rules/plan-responsibility';
import { requirementsForLevel } from '../lib/rules/requirements';
const folder = mkdtempSync(join(tmpdir(), 'moph-annex-b-'));
let owner: number;
function as(login: string) {
  const row = getDb().prepare('SELECT id, role FROM accounts WHERE login = ?').get(login) as { id: number; role: Account['role'] };
  session.account = { ...row, login, displayName: login, initials: 'T', isDemo: true };
  return row.id;
}
beforeAll(() => {
  vi.stubEnv('DATABASE_PATH', join(folder, 'test.db'));
  vi.stubEnv('REVIEW_CLOCK', '2026-08-13');
  owner = as('test_organizer');
  for (const role of ['ems', 'director'] as const) {
    const id = as(`test_${role}`);
    getDb().prepare("INSERT INTO invitations (token,event_id,kind,name_en,email,status,account_id) VALUES (?, 'EV-0418', ?, ?, ?, 'confirmed', ?)").run(`annex-b-${role}`, role, role, `${role}@example.test`, id);
  }
});
afterAll(() => { getDb().close(); vi.unstubAllEnvs(); rmSync(folder, { recursive: true, force: true }); });
function facts(level: 1 | 2 | 3): SubmissionFacts {
  return { level, organizationStatus: 'none', documentState: Object.fromEntries(documentsForLevel(level).map(d => [d.key, d.key !== 'plan'])), certification: { representative: 'Tester', telephone: '+9613111111', position: 'Organizer' }, grandfather: { today: '2026-09-29', filedAt: null, determined: false }, providers: [{name:'EMS',status:'confirmed',declaration:'signed'}], director: {status:'confirmed'}, declarationsComplete: true, today:'2026-09-29',filingDeadline:null,fee:null };
}
test('revised English and Arabic matrix has 19 unique requirements and no legacy notification row', () => {
  const revised = requirementsForLevel(3);
  expect(revised).toHaveLength(19);
  expect(new Set(revised.map(r => r.n)).size).toBe(19);
  expect(revised.some(r => r.n === 13)).toBe(false);
  for (const level of [1,2,3] as const) for (const row of requirementsForLevel(level)) { expect(row.valueEn.trim()).not.toBe(''); expect(row.valueAr.trim()).not.toBe(''); }
  for (const level of [1,2,3] as const) expect(requirementsForLevel(level).some(r => r.n === 16)).toBe(true);
  expect(requirementsForLevel(2).find(r => r.n === 2)?.valueEn).toMatch(/Recommended/);
  expect(requirementsForLevel(3).find(r => r.n === 2)?.valueEn).toContain('Event Medical Director');
});
test('Level 1 needs no plan or medical-arrangements upload; Level 2 plan does not block filing', () => {
  expect(planRequirement(1)).toBe('notRequired');
  expect(documentsForLevel(1).some(d => ['arrangements','plan'].includes(d.key))).toBe(false);
  expect(submissionGate(facts(1)).canFile).toBe(true);
  expect(planRequirement(2)).toBe('recommended');
  expect(submissionGate(facts(2)).canFile).toBe(true);
  expect(submissionGate(facts(3)).blockers).toContainEqual(expect.objectContaining({docKey:'plan'}));
});
test('an active Ministry request makes the Level 2 plan mandatory; clearing it removes only that gate', () => {
  expect(submissionGate({...facts(2),planRequested:true}).blockers).toContainEqual(expect.objectContaining({docKey:'plan'}));
  expect(submissionGate({...facts(2),planRequested:true,documentState:{...facts(2).documentState,plan:true}}).canFile).toBe(true);
  getDb().prepare("DELETE FROM plans WHERE event_id='EV-0418'").run();
  expect(derivedLevelFor('EV-0418')).toBe(2);
  expect(submissionGateFor(owner,'EV-0418').blockers.some(b=>b.docKey==='plan')).toBe(false);
  const id = getDb().prepare("INSERT INTO added_measures (event_id,catalog_key,recorded_by) VALUES ('EV-0418','plan','Test reviewer')").run().lastInsertRowid;
  expect(submissionGateFor(owner,'EV-0418').blockers.some(b=>b.docKey==='plan')).toBe(true);
  getDb().prepare('UPDATE added_measures SET cleared_at=now_stamp() WHERE id=?').run(id);
  expect(submissionGateFor(owner,'EV-0418').blockers.some(b=>b.docKey==='plan')).toBe(false);
});
test('both confirmed Level 2 medical roles read and update one plan; stale edits cannot overwrite it', async () => {
  as('test_ems');
  const payload: PlanPayload = {baseVersion:0,mode:'write',sections:{'1':{text:'EMS shared plan'}},majorIncident:{},attachedFile:null,refConfirmed:false,refAdmitsChildren:false,refTemporaryAreas:false};
  expect(planAccess(session.account!,'EV-0418')?.canEdit).toBe(true);
  expect(await savePlanAction('EV-0418',payload)).toEqual({ok:true,version:1});
  as('test_director');
  const access = planAccess(session.account!,'EV-0418')!;
  expect(access.canEdit).toBe(true);
  expect(planFor(access.ownerId,'EV-0418')?.sections['1']?.text).toBe('EMS shared plan');
  expect(await savePlanAction('EV-0418',payload)).toEqual({error:'conflict'});
  expect(await savePlanAction('EV-0418',{...payload,baseVersion:1,sections:{'1':{text:'Director reviewed shared content'}}})).toEqual({ok:true,version:2});
  as('test_organizer');
  expect(planAccess(session.account!,'EV-0418')?.canEdit).toBe(false);
  expect(planFor(owner,'EV-0418')?.sections['1']?.text).toBe('Director reviewed shared content');
  expect(await savePlanAction('EV-0418',{...payload,baseVersion:2})).toEqual({error:'not-authorized'});
  const data = new FormData(); data.set('baseVersion','2');
  expect(await uploadPlanFileAction('EV-0418',data)).toHaveProperty('error');
});
test('plan sync requires ownership or a confirmed medical invitation, with demo isolation', async () => {
  const request = () => planState(new Request('http://localhost/api/events/EV-0418/plan-state'),{params:Promise.resolve({id:'EV-0418'})});
  as('test_organizer'); expect((await request()).status).toBe(200);
  as('test_director'); expect(await (await request()).json()).toEqual({version:2});
  session.account!.isDemo=false;expect((await request()).status).toBe(404);
  session.account=null;expect((await request()).status).toBe(404);
  as('test_director');getDb().prepare("UPDATE invitations SET status='removed' WHERE token='annex-b-director'").run();
  expect((await request()).status).toBe(404);
  expect(planAccess(session.account!,'EV-0301')).toBeNull();
});

test('an attachment name without stored bytes cannot complete a medical plan', () => {
  const plan = {mode:'attach' as const,attachedFile:'plan.pdf',attachedHasFile:false,sections:Object.fromEntries(Array.from({length:16},(_,i)=>[String(i+1),{covered:true}])),majorIncident:Object.fromEntries(Array.from({length:11},(_,i)=>[String(i+1),{covered:true}]))};
  expect(planIsComplete(plan,2)).toBe(false);
  expect(planIsComplete(plan,3)).toBe(false);
  expect(planIsComplete({...plan,attachedHasFile:true},3)).toBe(true);
});

test('the reviewer sees medical answers and signed declarations, but not private agency drafts', async () => {
  const { reviewEvidenceFor } = await import('../lib/review-evidence');
  const reviewer = { role: 'reviewer' as const, isDemo: true };
  expect(reviewEvidenceFor({role:'organizer',isDemo:true},'EV-0362')).toBeNull();
  expect(reviewEvidenceFor({...reviewer,isDemo:false},'EV-0362')).toBeNull();
  expect(reviewEvidenceFor(reviewer,'EV-0418')).toBeNull(); // not filed
  const db = getDb();
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE invitations SET ops_detail=?, declaration='draft', declaration_items='[true]', certification=? WHERE event_id='EV-0362' AND kind='ems'").run(JSON.stringify({teams:'Two BLS teams at the north gate',phone:'01234567'}),JSON.stringify({representative:'PRIVATE DRAFT'}));
    const evidence = reviewEvidenceFor(reviewer,'EV-0362')!;
    const agency = evidence.parties.find(p=>p.kind==='ems')!;
    expect(agency.opsDetail.teams).toBe('Two BLS teams at the north gate');
    expect(agency).not.toHaveProperty('token');
    expect(agency.certification).toEqual({});
    expect(agency.declarationItems).toEqual([]);
    expect(agency.signedAt).toBeNull();
    db.prepare("UPDATE invitations SET declaration='signed' WHERE event_id='EV-0362' AND kind='ems'").run();
    expect(reviewEvidenceFor(reviewer,'EV-0362')!.parties.find(p=>p.kind==='ems')!.certification.representative).toBe('PRIVATE DRAFT');
  } finally { db.exec('ROLLBACK'); }
});

test('review checklist treats a recommended plan and missing attachment bytes correctly', async () => {
  const { reviewEvidenceFor } = await import('../lib/review-evidence');
  const { documentStateFor } = await import('../lib/queries');
  const db=getDb();db.exec('BEGIN');
  try {
    db.prepare("DELETE FROM assessments WHERE event_id='EV-0362'").run();
    db.prepare("UPDATE events SET demo_level=2 WHERE id='EV-0362'").run();
    db.prepare("DELETE FROM added_measures WHERE event_id='EV-0362' AND catalog_key='plan'").run();
    db.prepare("UPDATE event_attachments SET bytes=NULL WHERE event_id='EV-0362' AND doc_key='siteMap'").run();
    expect(documentStateFor(owner,'EV-0362',2).siteMap).toBe(false);
    const evidence=reviewEvidenceFor({role:'reviewer',isDemo:true},'EV-0362')!;
    expect(evidence.documents.find(d=>d.key==='plan')!.optional).toBe(true);
    expect(evidence.documents.find(d=>d.key==='siteMap')!.complete).toBe(false);
    db.prepare("INSERT INTO added_measures (event_id,catalog_key,recorded_by) VALUES ('EV-0362','plan','Reviewer')").run();
    expect(reviewEvidenceFor({role:'reviewer',isDemo:true},'EV-0362')!.documents.find(d=>d.key==='plan')!.optional).toBe(false);
  } finally {db.exec('ROLLBACK');}
});

test('the same plan sections drive medical entry and Ministry review, with no separate Director approval', async () => {
  const {planSectionsForLevel}=await import('../lib/rules/plan-responsibility');
  expect(planSectionsForLevel(1)).toHaveLength(0);
  expect(planSectionsForLevel(2)).toHaveLength(15);
  expect(planSectionsForLevel(2).some(s=>s.n===12)).toBe(false);
  expect(planSectionsForLevel(3)).toHaveLength(16);
  expect(requirementsForLevel(3).find(r=>r.n===2)!.valueEn).toBe('Required; completed by the Event Medical Director or EMS agency');
  const complete={mode:'write' as const,attachedFile:null,sections:Object.fromEntries(planSectionsForLevel(3).map(s=>[String(s.n),{text:'Specific arrangements prepared by EMS'}])),majorIncident:Object.fromEntries(Array.from({length:11},(_,i)=>[String(i+1),{covered:true}]))};
  expect(planIsComplete(complete,3)).toBe(true);
  expect(submissionGate({...facts(3),documentState:{...facts(3).documentState,plan:true}}).canFile).toBe(true);
});
