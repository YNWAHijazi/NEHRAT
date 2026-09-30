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
import {venuePackageFor} from '../lib/venue/workspace';
import {venueAccess,venueInvitations} from '../lib/venue/collaboration';
import {saveVenueRequirementAction,approveVenuePlanAction,submitVenuePackageAction,reopenVenueSectionAction,saveVenueDetailsAction,reviewVenuePackageAction} from '../app/venues/actions';
import {inviteVenuePartnerAction,respondVenueInvitationAction,withdrawVenuePartnerAction,saveVenueLocalEmsContactAction} from '../app/venues/team-actions';
import {saveVenueAssessmentAction,savePlanAction} from '../app/actions';
import {venueRequirementEditors} from '../lib/rules/venue-workflow';
import {approveEventPlanAction} from '../app/events/plan-approval-actions';
import {eventPlanApproval} from '../lib/plan-approval';
import {documentStateFor,planFor,assessmentsFor} from '../lib/queries';
import {PLAN_SECTIONS,MAJOR_INCIDENT_ITEMS} from '../lib/rules';
const folder=mkdtempSync(join(tmpdir(),'moph-venue-team-'));const id='VN-9001';let owner:number;
function as(login:string){const r=getDb().prepare('SELECT id,role FROM accounts WHERE login=?').get(login) as {id:number;role:Account['role']};session.account={...r,login,displayName:login,initials:'T',isDemo:true};return r.id;}
function form(values:Record<string,string>){const f=new FormData();for(const[k,v]of Object.entries(values))f.set(k,v);return f;}
const state=()=>venuePackageFor(owner,id)!;
async function save(key:string){const w=state(),r=w.requirements.find(r=>String(r.n)===key)!;const f=form({...Object.fromEntries(r.fields.filter(f=>!f.source).map(f=>[f.key,`${f.key} — confirmed arrangement`])),assessmentVersion:String(w.assessmentVersion),workRevision:String(w.workRevision),confirm:'yes'});if(r.fileRequired)f.set('file',new File(['%PDF-1.4\nReadiness document'],'medical.pdf',{type:'application/pdf'}));await expect(saveVenueRequirementAction(id,key,f)).rejects.toThrow(`saved=${key}`);return f;}
beforeAll(async()=>{vi.stubEnv('DATABASE_PATH',join(folder,'test.db'));vi.stubEnv('REVIEW_CLOCK','2026-08-13');owner=as('test_organizer');const db=getDb();for(const r of ['ems','director'])db.prepare('UPDATE accounts SET email=? WHERE login=?').run(`${r}@venue.example.test`,`test_${r}`);
 db.prepare(`INSERT INTO venues(id,account_id,name_en,name_ar,category,address_municipality_en,address_municipality_ar,responsible_contact,responsible_name,responsible_phone,licensed_capacity,regularly_hosts,is_demo,district,latitude,longitude) VALUES(?,?,'Venue clinical test','موقع طبي','hall','Beirut','بيروت','Operator +9613111111','Operator','+9613111111',5000,1,1,'Beirut',33.9,35.5)`).run(id,owner);
 db.prepare('INSERT INTO venue_packages(venue_id) VALUES(?)').run(id);
 expect(await saveVenueAssessmentAction(id,{answers:[2,2,2,2,2,2,2,2,2],attendance:5000,representative:'Operator',position:'Manager'})).toEqual({level:3});
});
afterAll(()=>{getDb().close();vi.unstubAllEnvs();rmSync(folder,{recursive:true,force:true})});
test('saved facts are locked, contact is automatic, clinical answers cannot be fabricated by the organizer',async()=>{
 as('test_organizer');expect(state().answers['1']).toEqual({name:'Operator',phone:'+9613111111'});expect(state().requirements.find(r=>r.n===1)?.done).toBe(true);
 await expect(saveVenueDetailsAction(id,new FormData())).rejects.toThrow(`redirect:/venues/${id}`);
 expect(await saveVenueAssessmentAction(id,{answers:[0,0,0,0,0,0,0,0,0],attendance:10,representative:'x',position:'x'})).toEqual({error:'locked'});
 await expect(saveVenueRequirementAction(id,'5',form({agency:'Fake organizer answer'}))).rejects.toThrow('/requirements');expect(state().answers['5']?.agency).toBe('');expect(state().answers['5']?.teams).toBeUndefined();
 for(const kind of ['ems','director'])await expect(inviteVenuePartnerAction(id,form({kind,name:`Venue ${kind}`,email:`${kind}@venue.example.test`}))).rejects.toThrow('invited=yes');
 const inv=venueInvitations(id);expect(inv).toHaveLength(2);expect(inv[0]?.token).toMatch(/^[a-f0-9]{48}$/);expect(inv.every(i=>i.delivery==='demo')).toBe(true);
 as('test_director');await expect(respondVenueInvitationAction(inv.find(i=>i.kind==='ems')!.token,form({response:'accept',phone:'+9613111111'}))).rejects.toThrow('error=account');expect(venueAccess(session.account!,id)).toBeNull();
});
test('incomplete legacy details still need an explicit Edit action',async()=>{
 as('test_organizer');const db=getDb();db.prepare("UPDATE venues SET responsible_phone='' WHERE id=?").run(id);
 try{expect(state().detailsDone).toBe(false);expect(state().detailsEditing).toBe(false);
 await expect(saveVenueDetailsAction(id,new FormData())).rejects.toThrow(/^redirect:\/venues\/VN-9001$/);
 await expect(reopenVenueSectionAction(id,'details')).rejects.toThrow(`redirect:/venues/${id}/details`);expect(state().detailsEditing).toBe(true);
 }finally{db.prepare("UPDATE venues SET responsible_phone='+9613111111' WHERE id=?").run(id);db.prepare('UPDATE venue_packages SET details_editing=0 WHERE venue_id=?').run(id);}
});
test('accepted medical partners share completed answers; a stale form cannot overwrite them; Director approval is required',async()=>{
 const inv=venueInvitations(id);as('test_ems');await expect(respondVenueInvitationAction(inv.find(i=>i.kind==='ems')!.token,form({response:'accept',phone:'+9613111111'}))).rejects.toThrow('/venue-team/');
 expect(state().answers['7']?.agency).toBe('Venue ems');expect(state().answers['7']?.phone).toBe('+9613111111');expect(state().requirements.find(r=>r.n===7)?.done).toBe(false);
 let stale:FormData|undefined;
 for(const r of state().requirements.filter(r=>!r.optional&&venueRequirementEditors(r.n,3).includes('ems'))){const f=await save(String(r.n));if(r.n===5)stale=f;}
 const before=state();await expect(saveVenueRequirementAction(id,'7',form({arrangements:'Confirmed coverage',agency:'FORGED AGENCY',phone:'00000000',assessmentVersion:String(before.assessmentVersion),workRevision:String(before.workRevision),confirm:'yes'}))).rejects.toThrow('saved=7');
 expect(state().answers['7']).toEqual({arrangements:'Confirmed coverage',agency:'Venue ems',phone:'+9613111111'});
 expect(JSON.parse(state().contributions.find(c=>c.requirement_key==='7')!.answers).agency).toBe('Venue ems');
 expect(JSON.parse(state().contributions.find(c=>c.requirement_key==='2')!.answers).preparedBy).toBe('test_ems');
 expect(state().requirements.find(r=>r.n===2)?.awaitingApproval).toBe(true);expect(state().requirements.find(r=>r.n===2)?.done).toBe(false);
 await expect(approveVenuePlanAction(id,form({confirm:'yes'}))).rejects.toThrow('not-found');
 await expect(saveVenueRequirementAction(id,'5',stale!)).rejects.toThrow('error=stale');
 as('test_director');await expect(respondVenueInvitationAction(inv.find(i=>i.kind==='director')!.token,form({response:'accept',phone:'+9613111111',licence:'LIC-123'}))).rejects.toThrow('/venue-team/');
 expect(state().requirements.find(r=>r.n===3)?.done).toBe(true);await save('15');
 let w=state();await expect(approveVenuePlanAction(id,form({confirm:'yes',assessmentVersion:String(w.assessmentVersion),workRevision:String(w.workRevision)}))).rejects.toThrow('approval=recorded');expect(state().requirements.find(r=>r.n===2)?.done).toBe(true);
 as('test_ems');await save('7');expect(state().approval).toBeUndefined();expect(state().requirements.find(r=>r.n===2)?.done).toBe(false);
 as('test_director');w=state();await expect(approveVenuePlanAction(id,form({confirm:'yes',assessmentVersion:String(w.assessmentVersion),workRevision:String(w.workRevision)}))).rejects.toThrow('approval=recorded');
});
test('each EMS agency must confirm its own declaration, then submission freezes a reviewable snapshot',async()=>{
 as('test_organizer');const db=getDb();db.prepare("INSERT INTO accounts(login,email,display_name,initials,role,is_demo) VALUES('venue_second_ems','second@venue.example.test','Second EMS','SE','ems',1)").run();
 await expect(inviteVenuePartnerAction(id,form({kind:'ems',name:'Second EMS',email:'second@venue.example.test'}))).rejects.toThrow('invited=yes');
 as('venue_second_ems');const inv=venueInvitations(id).find(i=>i.email==='second@venue.example.test')!;await expect(respondVenueInvitationAction(inv.token,form({response:'accept',phone:'+9613111111'}))).rejects.toThrow('/venue-team/');expect(state().requirements.find(r=>r.n===20)?.done).toBe(false);await save('20');expect(state().requirements.find(r=>r.n===20)?.done).toBe(true);
 as('test_director');let w=state();await expect(approveVenuePlanAction(id,form({confirm:'yes',assessmentVersion:String(w.assessmentVersion),workRevision:String(w.workRevision)}))).rejects.toThrow('approval=recorded');
 as('test_organizer');await save('10');await save('17');expect(state().requirements.filter(r=>!r.optional&&!r.done)).toEqual([]);
 await expect(submitVenuePackageAction(id,form({confirm:'yes'}))).rejects.toThrow('submitted=yes');expect(state().status).toBe('submitted');
 const h=db.prepare('SELECT snapshot FROM venue_package_history WHERE venue_id=?').get(id) as {snapshot:string};const snapshot=JSON.parse(h.snapshot);expect(snapshot.approval.display_name).toBeTruthy();expect(snapshot.requirements.find((r:{n:number})=>r.n===20).receipts).toHaveLength(2);expect((db.prepare('SELECT COUNT(*) AS n FROM venue_package_files WHERE doc_key LIKE ?').get('20-%') as {n:number}).n).toBe(2);
 db.prepare("UPDATE accounts SET phone='+9613999999' WHERE login='test_ems'").run();expect(state().answers['7']?.phone).toContain('+9613111111');expect(JSON.parse(h.snapshot).answers['7'].agency).toContain('Venue ems');
 await expect(reopenVenueSectionAction(id,'details')).rejects.toThrow(`redirect:/venues/${id}`);await expect(withdrawVenuePartnerAction(id,inv.token)).rejects.toThrow('not-found');
 as('test_ems');const before=state().answers['7'];await expect(saveVenueRequirementAction(id,'7',form({agency:'tampered'}))).rejects.toThrow('/venue-team/');expect(state().answers['7']).toEqual(before);
 as('test_moph');await expect(reviewVenuePackageAction(id,form({decision:'satisfied',revision:'1'}))).rejects.toThrow('/ministry/venues/');expect(state().status).toBe('accepted');expect(JSON.parse((db.prepare('SELECT snapshot FROM venue_package_history WHERE venue_id=?').get(id) as {snapshot:string}).snapshot)).toEqual(snapshot);
});
test('each EMS agency opens its own readiness declaration and never another agency\'s',async()=>{
 const {GET}=await import('../app/api/venue-documents/[id]/[key]/route');
 const ems=venueInvitations(id).filter(i=>i.kind==='ems'&&i.status==='confirmed');
 const first=ems.find(i=>i.email==='ems@venue.example.test')!.token,second=ems.find(i=>i.email==='second@venue.example.test')!.token;
 const get=async(key:string,rev?:string)=>(await GET(new Request(`http://test/api/venue-documents/${id}/${key}${rev?`?revision=${rev}`:''}`),{params:Promise.resolve({id,key})})).status;
 as('test_ems');expect(await get(`20-${first}`)).toBe(200);expect(await get(`20-${second}`)).toBe(404);expect(await get(`20-${second}`,'1')).toBe(404);
 as('venue_second_ems');expect(await get(`20-${second}`)).toBe(200);expect(await get(`20-${first}`)).toBe(404);
 as('test_director');expect(await get(`20-${first}`)).toBe(404);
 as('test_organizer');expect(await get(`20-${first}`)).toBe(200);expect(await get(`20-${second}`)).toBe(200);
 as('test_moph');expect(await get(`20-${first}`,'1')).toBe(200);expect(await get(`20-${first}`)).toBe(404);
});
test('events enforce the same version-specific Medical Director approval and invalidate it after edits',async()=>{
 const db=getDb();as('test_ems');db.prepare("UPDATE events SET filed=0,archived_at=NULL WHERE id='EV-0362'").run();
 const payload={baseVersion:planFor(owner,'EV-0362')?.version??0,mode:'write' as const,sections:Object.fromEntries(PLAN_SECTIONS.map(s=>[String(s.n),{text:'Medical arrangements confirmed'}])),majorIncident:Object.fromEntries(MAJOR_INCIDENT_ITEMS.map(s=>[String(s.n),{covered:true}])),attachedFile:null,refConfirmed:false,refAdmitsChildren:false,refTemporaryAreas:false};
 expect(await savePlanAction('EV-0362',payload)).toHaveProperty('ok');expect(documentStateFor(owner,'EV-0362',3).plan).toBe(false);
 const plan=planFor(owner,'EV-0362')!;const f=form({confirm:'yes',version:String(plan.version),assessmentVersion:String(assessmentsFor(owner,'EV-0362')[0]?.version??0)});
 as('test_ems');await expect(approveEventPlanAction('EV-0362',f)).rejects.toThrow('not-found');
 as('test_director');await expect(approveEventPlanAction('EV-0362',f)).rejects.toThrow('approved=yes');expect(eventPlanApproval('EV-0362')).toBeTruthy();expect(documentStateFor(owner,'EV-0362',3).plan).toBe(true);
 as('test_ems');expect(await savePlanAction('EV-0362',{...payload,baseVersion:plan.version})).toHaveProperty('ok');expect(eventPlanApproval('EV-0362')).toBeUndefined();expect(documentStateFor(owner,'EV-0362',3).plan).toBe(false);
});
test('renewal keeps the ID and previous certificates, but requires fresh medical confirmations',async()=>{
 as('test_organizer');const db=getDb();const previous=db.prepare('SELECT snapshot FROM venue_package_history WHERE venue_id=?').get(id);
 db.prepare("UPDATE venues SET valid_until='2000-01-01' WHERE id=?").run(id);
 const {renewVenuePackageAction}=await import('../app/venues/actions');await expect(renewVenuePackageAction(id)).rejects.toThrow(`/venues/${id}/details`);
 expect(state().venue.id).toBe(id);expect(state().status).toBe('draft');expect(state().detailsEditing).toBe(true);expect(state().assessmentDone).toBe(false);expect(state().contributions).toEqual([]);expect(state().invitations.every(i=>i.status==='withdrawn')).toBe(true);expect(db.prepare('SELECT snapshot FROM venue_package_history WHERE venue_id=?').get(id)).toEqual(previous);
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

test('Level 1 uses one confirmed local contact or an accepted invitation and locks it after filing',async()=>{
 as('test_organizer');const venue='VN-0032',w=()=>venuePackageFor(owner,venue)!;
 expect(w().level).toBe(1);expect(w().requirements.find(r=>r.n===7)?.done).toBe(false);
 await expect(saveVenueLocalEmsContactAction(venue,form({agency:'Local EMS',phone:'+9613111111'}))).rejects.toThrow('error=local');
 await expect(saveVenueLocalEmsContactAction(venue,form({agency:'Local EMS',phone:'+9613111111',confirm:'yes'}))).rejects.toThrow('saved=contact');
 expect(w().requirements.find(r=>r.n===7)?.done).toBe(true);
 await expect(saveVenueRequirementAction(venue,'7',form({agency:'Duplicate',phone:'00000000'}))).rejects.toThrow('/requirements');
 expect(w().answers['7']?.agency).toBe('Local EMS');
 await expect(inviteVenuePartnerAction(venue,form({kind:'ems',name:'Invited EMS',email:'ems@venue.example.test'}))).rejects.toThrow('invited=yes');
 expect(w().requirements.find(r=>r.n===7)?.done).toBe(false);
 await expect(saveVenueLocalEmsContactAction(venue,form({agency:'Bypass',phone:'+9613111111',confirm:'yes'}))).rejects.toThrow(`redirect:/venues/${venue}/team`);
 const inv=venueInvitations(venue).find(i=>i.kind==='ems')!;as('test_ems');
 await expect(respondVenueInvitationAction(inv.token,form({response:'accept',phone:'+9613222222'}))).rejects.toThrow('/venue-team/');
 expect(w().answers['7']?.agency).toBe('Invited EMS');expect(w().answers['7']?.phone).toBe('+9613222222');expect(w().requirements.find(r=>r.n===7)?.done).toBe(true);
 as('test_organizer');await expect(withdrawVenuePartnerAction(venue,inv.token)).rejects.toThrow(`/venues/${venue}/team`);
 expect(w().requirements.find(r=>r.n===7)?.done).toBe(false);
 await expect(saveVenueLocalEmsContactAction(venue,form({agency:'Local EMS',phone:'+9613111111',confirm:'yes'}))).rejects.toThrow('saved=contact');
 const before=w().answers['7'];getDb().prepare("UPDATE venue_packages SET status='submitted' WHERE venue_id=?").run(venue);
 await expect(saveVenueLocalEmsContactAction(venue,form({agency:'Changed after filing',phone:'+9613333333',confirm:'yes'}))).rejects.toThrow(`redirect:/venues/${venue}/team`);
 expect(w().answers['7']).toEqual(before);
});
