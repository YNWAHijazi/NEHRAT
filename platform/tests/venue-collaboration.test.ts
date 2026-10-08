import {beforeAll,afterAll,expect,test,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Account} from '../lib/auth';
const session=vi.hoisted(()=>({account:null as Account|null}));
vi.mock('../lib/auth',async original=>({...await original<typeof import('../lib/auth')>(),currentAccount:async()=>session.account}));
vi.mock('next/navigation',()=>({redirect:(url:string)=>{throw new Error(`redirect:${url}`)},notFound:()=>{throw new Error('not-found')}}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import {getDb} from '../lib/db';
import {venuePackageFor,venuePackageFacts} from '../lib/venue/workspace';
import {venueAccess,venueInvitations} from '../lib/venue/collaboration';
import {submitVenuePackageAction,reopenVenueSectionAction,saveVenueDetailsAction,reviewVenuePackageAction,signVenueDeclarationAction} from '../app/venues/actions';
import {inviteVenuePartnerAction,respondVenueInvitationAction,withdrawVenuePartnerAction} from '../app/venues/team-actions';
import {saveVenueAssessmentAction} from '../app/actions';
import {approveRecordPlanAction,saveRequirementAnswerAction,saveRequirementFileAction} from '../app/record-actions';
import {eventRecordRequirements,requirementSnapshotFor} from '../lib/record-facts';
import {mayAuthor,planTextKeys,type AuthorRole,type RequirementInstance} from '../lib/rules';
import {venueSubmissionChecks} from '../lib/rules/venue-workflow';
const folder=mkdtempSync(join(tmpdir(),'moph-venue-team-'));const id='VN-9001';let owner:number;
function as(login:string){const r=getDb().prepare('SELECT id,role FROM accounts WHERE login=?').get(login) as {id:number;role:Account['role']};session.account={...r,login,displayName:login,initials:'T',isDemo:true};return r.id;}
function form(values:Record<string,string|File>){const f=new FormData();for(const[k,v]of Object.entries(values))f.set(k,v);return f;}
const pdf=()=>new File(['%PDF-1.4\nReadiness document'],'medical.pdf',{type:'application/pdf'});
const state=()=>venuePackageFor(owner,id)!;
const nameOf=(login:string)=>(getDb().prepare('SELECT display_name FROM accounts WHERE login=?').get(login) as {display_name:string}).display_name;
const inst=(key:string,venue=id)=>venuePackageFor(owner,venue)!.record!.instances.find(i=>i.key===key)!;
function valuesFor(i:RequirementInstance){const v:Record<string,string|number|boolean>={};for(const f of i.fields){if(f.showWhen)continue;v[f.key]=f.type==='checkbox'?true:f.type==='number'?4:f.type==='choice'?'yes':f.type==='date'?'2026-11-01':`${f.key} — confirmed arrangement`;}return v;}
/** Saves one row as the signed-in account, at the version the page would have read. */
async function saveRow(key:string,values?:Record<string,unknown>,venue=id){const i=inst(key,venue);const base=i.answeredBy?.version??0;expect(await saveRequirementAnswerAction('venue',venue,key,{baseVersion:base,values:values??valuesFor(i)})).toEqual({ok:true,version:base+1});}
async function saveText(key:string){const stored=state().record!.facts!.answers[key];expect(await saveRequirementAnswerAction('venue',id,key,{baseVersion:stored?.version??0,values:{text:`${key} — confirmed arrangement`}})).toHaveProperty('ok',true);}
/** Every open row the role may enter, in page order; plan text and the deployment map for the medical roles. */
async function fillAs(role:AuthorRole){for(const i of state().record!.instances)if(i.fields.length>0&&i.state!=='complete'&&mayAuthor(i,role))await saveRow(i.key);}
async function upload(key:string,back:string){await expect(saveRequirementFileAction('venue',id,key,form({file:pdf()}))).rejects.toThrow(`${back}?saved=${key}#req-${key}`);}
async function approve(expected:string){const r=state().record!;await expect(approveRecordPlanAction('venue',id,form({confirm:'yes',planVersion:String(r.planVersion),assessmentVersion:String(r.assessmentVersion??0)}))).rejects.toThrow(expected);}
beforeAll(async()=>{vi.stubEnv('DATABASE_PATH',join(folder,'test.db'));vi.stubEnv('REVIEW_CLOCK','2026-08-13');owner=as('test_organizer');const db=getDb();for(const r of ['ems','director'])db.prepare('UPDATE accounts SET email=? WHERE login=?').run(`${r}@venue.example.test`,`test_${r}`);
 db.prepare(`INSERT INTO venues(id,account_id,name_en,name_ar,category,address_municipality_en,address_municipality_ar,responsible_contact,responsible_name,responsible_phone,licensed_capacity,regularly_hosts,is_demo,district,latitude,longitude) VALUES(?,?,'Venue clinical test','موقع طبي','hall','Beirut','بيروت','Operator +9613111111','Operator','+9613111111',5000,1,1,'Beirut',33.9,35.5)`).run(id,owner);
 db.prepare('INSERT INTO venue_packages(venue_id) VALUES(?)').run(id);
 expect(await saveVenueAssessmentAction(id,{answers:[2,2,2,2,2,2,2,2,2],attendance:5000,representative:'Operator',position:'Manager'})).toEqual({level:3});
});
afterAll(()=>{getDb().close();vi.unstubAllEnvs();rmSync(folder,{recursive:true,force:true})});
test('saved facts are locked, the contact is prefilled, and the organizer cannot enter a clinical row',async()=>{
 as('test_organizer');expect(state().level).toBe(3);expect(inst('B1')).toMatchObject({state:'complete',values:{name:'Operator',phone:'+9613111111'}});
 await expect(saveVenueDetailsAction(id,null,new FormData())).rejects.toThrow(`redirect:/venues/${id}`);
 expect(await saveVenueAssessmentAction(id,{answers:[0,0,0,0,0,0,0,0,0],attendance:10,representative:'x',position:'x'})).toEqual({error:'locked'});
 // The AED row is the medical team's at Level 3; the catalogue, not the screen, refuses the organizer.
 expect(await saveRequirementAnswerAction('venue',id,'B8',{baseVersion:0,values:{location:'Fake organizer answer'}})).toEqual({error:'forbidden'});expect(inst('B8').answeredBy).toBeNull();
 // A field the catalogue does not define is refused with its name; nothing is stored.
 expect(await saveRequirementAnswerAction('venue',id,'B5',{baseVersion:0,values:{bls:true,firstAid:'maybe'}})).toEqual({error:'invalid',fields:['firstAid']});
 await saveRow('B10');expect(inst('B10').state).toBe('complete');
 for(const kind of ['ems','director'])await expect(inviteVenuePartnerAction(id,form({kind,name:`Venue ${kind}`,email:`${kind}@venue.example.test`}))).rejects.toThrow('invited=yes');
 const inv=venueInvitations(id);expect(inv).toHaveLength(2);expect(inv[0]?.token).toMatch(/^[a-f0-9]{48}$/);expect(inv.every(i=>i.delivery==='demo')).toBe(true);
 expect(inst('B7').state).toBe('waiting');expect(inst('B3').state).toBe('waiting');
 as('test_director');await expect(respondVenueInvitationAction(inv.find(i=>i.kind==='ems')!.token,form({response:'accept',phone:'+9613111111'}))).rejects.toThrow('error=account');expect(venueAccess(session.account!,id)).toBeNull();
});
test('incomplete legacy details still need an explicit Edit action',async()=>{
 as('test_organizer');const db=getDb();db.prepare("UPDATE venues SET responsible_phone='' WHERE id=?").run(id);
 try{expect(state().detailsDone).toBe(false);expect(state().detailsEditing).toBe(false);
 await expect(saveVenueDetailsAction(id,null,new FormData())).rejects.toThrow(/^redirect:\/venues\/VN-9001$/);
 await expect(reopenVenueSectionAction(id,'details')).rejects.toThrow(`redirect:/venues/${id}/details`);expect(state().detailsEditing).toBe(true);
 }finally{db.prepare("UPDATE venues SET responsible_phone='+9613111111' WHERE id=?").run(id);db.prepare('UPDATE venue_packages SET details_editing=0 WHERE venue_id=?').run(id);}
});
test('accepted medical partners share one answer per row; a stale save conflicts; the Director approves the current plan version',async()=>{
 const inv=venueInvitations(id);as('test_ems');await expect(respondVenueInvitationAction(inv.find(i=>i.kind==='ems')!.token,form({response:'accept',phone:'+9613111111'}))).rejects.toThrow('/venue-team/');
 expect(inst('B7').state).toBe('pending');expect(state().record!.parties.find(p=>p.kind==='ems')).toMatchObject({name:'Venue ems',status:'confirmed',declarationSigned:false});
 await fillAs('ems');for(const k of planTextKeys())await saveText(k);await upload('P-D',`/venue-team/${id}`);
 expect(inst('B5')).toMatchObject({state:'complete',answeredBy:{role:'ems',name:'test_ems — Venue ems',version:1}});expect(inst('B7').state).toBe('complete');
 // The organizer gets ONE progress notice for the medical team's work, updated in place -- not one per row.
 const progress=getDb().prepare("SELECT kind,subject_en FROM notifications WHERE account_id=? AND record_route=? AND (subject_en LIKE 'Medical requirements:%' OR subject_en='Your medical team has completed its requirements')").all(owner,`/venues/${id}`) as {kind:string;subject_en:string}[];
 expect(progress).toHaveLength(1);expect(progress[0]!.subject_en).toMatch(/^Medical requirements: \d+ of \d+ complete$/);expect(progress[0]!.kind).toBe('for_information');
 // A save at the version the page read before another save is a conflict, never an overwrite.
 expect(await saveRequirementAnswerAction('venue',id,'B5',{baseVersion:0,values:valuesFor(inst('B5'))})).toEqual({error:'conflict'});expect(inst('B5').answeredBy?.version).toBe(1);
 // The plan reads the Director's medical command row (section 10): until the Director is named and answers it, the plan is not prepared, and nobody but the Director can approve it.
 expect(state().record!.plan.filter(s=>!s.complete).map(s=>s.key)).toEqual(['P10']);expect(inst('B2').state).toBe('pending');
 await expect(approveRecordPlanAction('venue',id,form({confirm:'yes'}))).rejects.toThrow('/dashboard');
 as('test_organizer');await expect(approveRecordPlanAction('venue',id,form({confirm:'yes'}))).rejects.toThrow('/dashboard');
 as('test_director');await expect(respondVenueInvitationAction(inv.find(i=>i.kind==='director')!.token,form({response:'accept',phone:'+9613111111',licence:'LIC-123'}))).rejects.toThrow('/venue-team/');
 expect(inst('B3').state).toBe('complete');await saveRow('B15');
 expect(state().record!.plan.filter(s=>!s.complete).map(s=>s.key)).toEqual([]);expect(inst('B2').state).toBe('waiting');
 await expect(approveRecordPlanAction('venue',id,form({confirm:'yes',planVersion:'999',assessmentVersion:'1'}))).rejects.toThrow('error=approval');
 await approve('approval=recorded');expect(inst('B2').state).toBe('complete');expect(state().approval?.by).toBe(nameOf('test_director'));
 // A later change to anything the plan reads reopens the approval (D4).
 as('test_ems');await saveRow('B7');expect(state().approval).toBeNull();expect(inst('B2').state).toBe('waiting');
 as('test_director');await approve('approval=recorded');expect(inst('B2').state).toBe('complete');
});
test('each EMS agency signs its own declaration, then submission freezes the record the Ministry reads',async()=>{
 as('test_organizer');const db=getDb();db.prepare("INSERT INTO accounts(login,email,display_name,initials,role,is_demo) VALUES('venue_second_ems','second@venue.example.test','Second EMS','SE','ems',1)").run();
 await expect(inviteVenuePartnerAction(id,form({kind:'ems',name:'Second EMS',email:'second@venue.example.test'}))).rejects.toThrow('invited=yes');
 as('venue_second_ems');const inv=venueInvitations(id).find(i=>i.email==='second@venue.example.test')!;await expect(respondVenueInvitationAction(inv.token,form({response:'accept',phone:'+9613111111'}))).rejects.toThrow('/venue-team/');
 expect(inst('B20').state).toBe('waiting');expect(inst('B20').detailEn).toContain('Second EMS');
 await expect(signVenueDeclarationAction(id,form({file:pdf()}))).rejects.toThrow('error=incomplete');
 await expect(signVenueDeclarationAction(id,form({file:pdf(),confirm:'yes'}))).rejects.toThrow(`/venue-team/${id}?saved=B20#req-B20`);
 expect(inst('B20').state).toBe('waiting');as('test_ems');await expect(signVenueDeclarationAction(id,form({file:pdf(),confirm:'yes'}))).rejects.toThrow('saved=B20');expect(inst('B20').state).toBe('complete');
 as('test_organizer');await expect(signVenueDeclarationAction(id,form({file:pdf(),confirm:'yes'}))).rejects.toThrow('not-found');
 // Inviting a second agency reopened the approval; the Director approves the version every party now reads.
 as('test_director');await approve('approval=recorded');
 as('test_organizer');await saveRow('B17');await upload('B17',`/venues/${id}`);await upload('P-M',`/venues/${id}`);
 expect(state().record!.blockers.map(b=>b.key)).toEqual([]);expect(venueSubmissionChecks(venuePackageFacts(state())).canSubmit).toBe(true);
 await expect(submitVenuePackageAction(id,form({}))).rejects.toThrow('error=incomplete');
 await expect(submitVenuePackageAction(id,form({confirm:'yes'}))).rejects.toThrow('submitted=yes');expect(state().status).toBe('submitted');expect(state().editable).toBe(false);
 const frozen=requirementSnapshotFor('venue',id,1)!;expect(frozen.instances.find(i=>i.key==='B20')?.state).toBe('complete');expect(frozen.approval?.by).toBe(nameOf('test_director'));expect(frozen.parties.filter(p=>p.kind==='ems'&&p.declarationSigned)).toHaveLength(2);
 const h=db.prepare('SELECT snapshot FROM venue_package_history WHERE venue_id=?').get(id) as {snapshot:string};const snapshot=JSON.parse(h.snapshot);expect(snapshot.approval.by).toBe(nameOf('test_director'));expect(snapshot.instances.length).toBe(frozen.instances.length);
 expect((db.prepare('SELECT COUNT(*) AS n FROM venue_package_files WHERE doc_key LIKE ?').get('20-%') as {n:number}).n).toBe(2);
 await expect(reopenVenueSectionAction(id,'details')).rejects.toThrow(`redirect:/venues/${id}`);await expect(withdrawVenuePartnerAction(id,inv.token)).rejects.toThrow('not-found');
 as('test_ems');expect(await saveRequirementAnswerAction('venue',id,'B5',{baseVersion:1,values:valuesFor(inst('B5'))})).toEqual({error:'locked'});
 as('test_moph');await expect(reviewVenuePackageAction(id,form({decision:'satisfied',revision:'1'}))).rejects.toThrow('/ministry/venues/');expect(state().status).toBe('accepted');expect(JSON.parse((db.prepare('SELECT snapshot FROM venue_package_history WHERE venue_id=?').get(id) as {snapshot:string}).snapshot)).toEqual(snapshot);
});
test('each EMS agency opens its own readiness declaration and never another agency\'s',async()=>{
 const {GET}=await import('../app/api/venue-documents/[id]/[key]/route');
 const ems=venueInvitations(id).filter(i=>i.kind==='ems'&&i.status==='confirmed');
 const first=ems.find(i=>i.email==='ems@venue.example.test')!.token,second=ems.find(i=>i.email==='second@venue.example.test')!.token;
 const get=async(key:string,rev?:string)=>(await GET(new Request(`http://test/api/venue-documents/${id}/${key}${rev?`?revision=${rev}`:''}`),{params:Promise.resolve({id,key})})).status;
 as('test_ems');expect(await get(`20-${first}`)).toBe(200);expect(await get(`20-${second}`)).toBe(404);expect(await get(`20-${second}`,'1')).toBe(404);
 as('venue_second_ems');expect(await get(`20-${second}`)).toBe(200);expect(await get(`20-${first}`)).toBe(404);
 as('test_director');expect(await get(`20-${first}`)).toBe(404);expect(await get('P-D')).toBe(200);
 as('test_organizer');expect(await get(`20-${first}`)).toBe(200);expect(await get(`20-${second}`)).toBe(200);
 as('test_moph');expect(await get(`20-${first}`,'1')).toBe(200);expect(await get(`20-${first}`)).toBe(404);expect(await get('P-M','1')).toBe(200);
});
test('events enforce the same version-specific Medical Director approval and reopen it after edits',async()=>{
 const db=getDb();db.prepare("UPDATE events SET filed=0,archived_at=NULL WHERE id='EV-0362'").run();const rec=()=>eventRecordRequirements(owner,'EV-0362')!;
 expect(rec().plan.filter(s=>!s.complete).map(s=>s.key)).toEqual([]);
 as('test_ems');const p13=rec().facts!.answers['P13'];expect(await saveRequirementAnswerAction('event','EV-0362','P13',{baseVersion:p13?.version??0,values:{text:'Weather plan revised'}})).toHaveProperty('ok',true);
 expect(rec().approval).toBeNull();expect(rec().instances.find(i=>i.key==='B2')?.state).toBe('waiting');
 const f=()=>form({confirm:'yes',planVersion:String(rec().planVersion),assessmentVersion:String(rec().assessmentVersion??0)});
 await expect(approveRecordPlanAction('event','EV-0362',f())).rejects.toThrow('/dashboard');
 as('test_director');await expect(approveRecordPlanAction('event','EV-0362',f())).rejects.toThrow('approval=recorded');expect(rec().approval).toBeTruthy();expect(rec().instances.find(i=>i.key==='B2')?.state).toBe('complete');
 as('test_ems');const p14=rec().facts!.answers['P14'];expect(await saveRequirementAnswerAction('event','EV-0362','P14',{baseVersion:p14?.version??0,values:{text:'Cover revised'}})).toHaveProperty('ok',true);expect(rec().approval).toBeNull();expect(rec().instances.find(i=>i.key==='B2')?.state).toBe('waiting');
});
test('renewal keeps the ID, the previous certificate and the earlier answers in history, but starts the new cycle clean',async()=>{
 as('test_organizer');const db=getDb();const previous=db.prepare('SELECT snapshot FROM venue_package_history WHERE venue_id=?').get(id);
 const answered=(db.prepare("SELECT COUNT(*) AS n FROM requirement_answers WHERE record_kind='venue' AND record_id=?").get(id) as {n:number}).n;expect(answered).toBeGreaterThan(5);
 db.prepare("UPDATE venues SET valid_until='2000-01-01' WHERE id=?").run(id);
 const {renewVenuePackageAction}=await import('../app/venues/actions');await expect(renewVenuePackageAction(id)).rejects.toThrow(`/venues/${id}/details`);
 expect(state().venue.id).toBe(id);expect(state().status).toBe('draft');expect(state().detailsEditing).toBe(true);expect(state().assessmentDone).toBe(false);expect(state().contributions).toEqual([]);expect(state().invitations.every(i=>i.status==='withdrawn')).toBe(true);expect(db.prepare('SELECT snapshot FROM venue_package_history WHERE venue_id=?').get(id)).toEqual(previous);
 expect((db.prepare("SELECT COUNT(*) AS n FROM requirement_answers WHERE record_kind='venue' AND record_id=?").get(id) as {n:number}).n).toBe(0);
 expect((db.prepare("SELECT COUNT(*) AS n FROM requirement_answer_history WHERE record_kind='venue' AND record_id=?").get(id) as {n:number}).n).toBeGreaterThanOrEqual(answered);
 expect(requirementSnapshotFor('venue',id,1)).not.toBeNull();
 expect((db.prepare('SELECT COUNT(*) AS n FROM venue_assessments WHERE venue_id=? AND certificate_issued=1').get(id) as {n:number}).n).toBe(1);
});
test('record ID lookup supports historical aliases and still requires the event date and real-data scope',async()=>{
 const {findSubmissionByReference}=await import('../lib/queries');const {resolvePublicLookup}=await import('../lib/rules/public-lookup');const db=getDb();
 const r=db.prepare("SELECT id,moph_reference,start_date FROM events WHERE filed=1 AND moph_reference IS NOT NULL LIMIT 1").get() as {id:string;moph_reference:string;start_date:string};
 expect(findSubmissionByReference(r.id)?.referenceNumber).toBe(r.id);expect(findSubmissionByReference(r.moph_reference)?.referenceNumber).toBe(r.id);
 expect(resolvePublicLookup({referenceNumber:r.id,eventStartDate:r.start_date},findSubmissionByReference).exists).toBe(false);
 db.prepare('UPDATE events SET is_demo=0 WHERE id=?').run(r.id);
 try{expect(resolvePublicLookup({referenceNumber:r.id},findSubmissionByReference).exists).toBe(false);expect(resolvePublicLookup({referenceNumber:r.id,eventStartDate:'1900-01-01'},findSubmissionByReference).exists).toBe(false);expect(resolvePublicLookup({referenceNumber:r.id,eventStartDate:r.start_date},findSubmissionByReference).exists).toBe(true);expect(resolvePublicLookup({referenceNumber:r.moph_reference,eventStartDate:r.start_date},findSubmissionByReference).exists).toBe(true);}finally{db.prepare('UPDATE events SET is_demo=1 WHERE id=?').run(r.id);}
});

test('Level 1 records one confirmed local EMS contact by the operator, and locks it after filing',async()=>{
 as('test_organizer');const venue='VN-0032';const row=()=>inst('B7',venue);
 // The seeded venue holds a certificate (read-only). This test needs it as a Level 1 package in preparation,
 // so it says so explicitly rather than relying on a missing package row reading as a draft.
 getDb().prepare("INSERT OR REPLACE INTO venue_packages(venue_id,status,assessment_version) VALUES(?,'draft',(SELECT MAX(version) FROM venue_assessments WHERE venue_id=?))").run(venue,venue);
 expect(venuePackageFor(owner,venue)!.level).toBe(1);expect(row()).toMatchObject({state:'pending',labelEn:'Local EMS access',authors:['organizer']});
 await saveRow('B7',{how:' '},venue);expect(row()).toMatchObject({state:'pending',missing:['how']});
 await saveRow('B7',{how:'Call 140; the station knows the operating times'},venue);expect(row().state).toBe('complete');
 as('test_ems');expect(await saveRequirementAnswerAction('venue',venue,'B7',{baseVersion:2,values:{how:'x'}})).toMatchObject({error:expect.stringMatching(/^(not-found|forbidden)$/)});
 as('test_organizer');getDb().prepare("UPDATE venue_packages SET status='submitted' WHERE venue_id=?").run(venue);
 expect(await saveRequirementAnswerAction('venue',venue,'B7',{baseVersion:2,values:{how:'x'}})).toEqual({error:'locked'});expect(row().state).toBe('complete');
});
