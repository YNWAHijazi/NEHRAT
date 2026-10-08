/**
 * THE HOSTING VENUE, END TO END (Hosting Venue Registration, revised logic, 8 October
 * 2026): the operator alone fills the venue steps; no EMS agency or Medical Director is
 * invited and the old invitation actions refuse; the AEDs come from the PAD facility
 * registration on the same site, linked by id; submission freezes what the Ministry
 * reads; the outcome issues the annual certificate; renewal keeps the venue and site.
 */
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
import {venueInvitations} from '../lib/venue/collaboration';
import {submitVenuePackageAction,reopenVenueSectionAction,saveVenueDetailsAction,reviewVenuePackageAction,linkVenueFacilityAction,unlinkVenueFacilityAction} from '../app/venues/actions';
import {inviteVenuePartnerAction,respondVenueInvitationAction} from '../app/venues/team-actions';
import {saveVenueAssessmentAction} from '../app/actions';
import {approveRecordPlanAction,saveRequirementAnswerAction,saveRequirementFileAction} from '../app/record-actions';
import {eventRecordRequirements,requirementSnapshotFor} from '../lib/record-facts';
import {siteIdForFacility,siteIdForVenue} from '../lib/sites';
import type {RequirementInstance} from '../lib/rules';
import {venueSubmissionChecks} from '../lib/rules/venue-workflow';
const folder=mkdtempSync(join(tmpdir(),'moph-venue-team-'));const id='VN-9001';let owner:number;
function as(login:string){const r=getDb().prepare('SELECT id,role FROM accounts WHERE login=?').get(login) as {id:number;role:Account['role']};session.account={...r,login,displayName:login,initials:'T',isDemo:true};return r.id;}
function form(values:Record<string,string|File>){const f=new FormData();for(const[k,v]of Object.entries(values))f.set(k,v);return f;}
const pdf=()=>new File(['%PDF-1.4\nVenue map'],'map.pdf',{type:'application/pdf'});
const state=()=>venuePackageFor(owner,id)!;
const inst=(key:string,venue=id)=>venuePackageFor(owner,venue)!.record!.instances.find(i=>i.key===key)!;
function valuesFor(i:RequirementInstance){const v:Record<string,string|number|boolean>={};for(const f of i.fields){if(f.showWhen)continue;v[f.key]=f.type==='checkbox'?true:f.type==='number'?4:f.type==='choice'?(f.options?.[0]?.value??'yes'):f.type==='date'?'2026-11-01':`${f.key} — recorded`;}return v;}
async function saveRow(key:string,values?:Record<string,unknown>,venue=id){const i=inst(key,venue);const base=i.answeredBy?.version??0;expect(await saveRequirementAnswerAction('venue',venue,key,{baseVersion:base,values:values??valuesFor(i)})).toEqual({ok:true,version:base+1});}
beforeAll(async()=>{vi.stubEnv('DATABASE_PATH',join(folder,'test.db'));vi.stubEnv('REVIEW_CLOCK','2026-08-13');owner=as('test_organizer');const db=getDb();
 db.prepare(`INSERT INTO venues(id,account_id,name_en,name_ar,category,address_municipality_en,address_municipality_ar,responsible_contact,responsible_name,responsible_phone,licensed_capacity,regularly_hosts,is_demo,district,latitude,longitude) VALUES(?,?,'Venue lifecycle test','موقع اختبار','hall','Beirut','بيروت','Operator +9613111111','Operator','+9613111111',5000,1,1,'Beirut',33.9,35.5)`).run(id,owner);
 db.prepare('INSERT INTO venue_packages(venue_id) VALUES(?)').run(id);
 expect(await saveVenueAssessmentAction(id,{answers:[2,2,2,2,2,2,2,2,2],attendance:5000,representative:'Operator',position:'Manager'})).toEqual({level:3});
});
afterAll(()=>{getDb().close();vi.unstubAllEnvs();rmSync(folder,{recursive:true,force:true})});
test('a Level 3 venue asks the operator for its infrastructure only; event rows and medical invitations are refused',async()=>{
 as('test_organizer');expect(state().level).toBe(3);
 expect(state().record!.instances.map(i=>i.key)).toEqual(['V1','V2','V3','V4','V5','V6','V7']);
 await expect(saveVenueDetailsAction(id,null,new FormData())).rejects.toThrow(`redirect:/venues/${id}`);
 expect(await saveVenueAssessmentAction(id,{answers:[0,0,0,0,0,0,0,0,0],attendance:10,representative:'x',position:'x'})).toEqual({error:'locked'});
 // An event row is not a venue row: nothing is stored under it.
 expect(await saveRequirementAnswerAction('venue',id,'B7',{baseVersion:0,values:{units:'Two ambulances'}})).toHaveProperty('error');
 // A field the catalogue does not define is refused with its name; nothing is stored.
 expect(await saveRequirementAnswerAction('venue',id,'V4',{baseVersion:0,values:{exists:'maybe'}})).toEqual({error:'invalid',fields:['exists']});
 await saveRow('V2');expect(inst('V2').state).toBe('complete');
 // A medical party may not write a venue row.
 as('test_ems');expect(await saveRequirementAnswerAction('venue',id,'V3',{baseVersion:0,values:{routes:'x'}})).toHaveProperty('error');
 // The retired invitation actions create nothing and accept nothing.
 as('test_organizer');await expect(inviteVenuePartnerAction(id,form({kind:'ems',name:'Agency',email:'ems@venue.example.test'}))).rejects.toThrow(`redirect:/venues/${id}`);
 expect(venueInvitations(id)).toEqual([]);
 await expect(respondVenueInvitationAction('a'.repeat(48),form({response:'accept'}))).rejects.toThrow(`redirect:/venue-invitations/${'a'.repeat(48)}`);
});
test('incomplete legacy details still need an explicit Edit action',async()=>{
 as('test_organizer');const db=getDb();db.prepare("UPDATE venues SET responsible_phone='' WHERE id=?").run(id);
 try{expect(state().detailsDone).toBe(false);expect(state().detailsEditing).toBe(false);
 await expect(saveVenueDetailsAction(id,null,new FormData())).rejects.toThrow(/^redirect:\/venues\/VN-9001$/);
 await expect(reopenVenueSectionAction(id,'details')).rejects.toThrow(`redirect:/venues/${id}/details`);expect(state().detailsEditing).toBe(true);
 }finally{db.prepare("UPDATE venues SET responsible_phone='+9613111111' WHERE id=?").run(id);db.prepare('UPDATE venue_packages SET details_editing=0 WHERE venue_id=?').run(id);}
});
test('the AED step links the PAD facility on the same site by id, one per site, and unlinks to a site of its own',async()=>{
 as('test_organizer');const venueSite=siteIdForVenue(id)!;expect(venueSite).toMatch(/^SITE-\d{6}$/);
 const ownSite=siteIdForFacility('FC-0021')!;expect(ownSite).not.toBe(venueSite);
 expect(inst('V7').state).toBe('pending');
 await expect(linkVenueFacilityAction(id,form({facility:'FC-0021'}))).rejects.toThrow(`redirect:/venues/${id}?step=V7#req-V7`);
 expect(siteIdForFacility('FC-0021')).toBe(venueSite);
 expect(inst('V7')).toMatchObject({state:'complete',detailEn:expect.stringContaining('(FC-0021)')});
 // The site the facility left is gone: nothing else stood on it.
 expect(getDb().prepare('SELECT 1 FROM sites WHERE id=?').get(ownSite)).toBeUndefined();
 // One facility registration per site: a second link is refused, not stacked.
 await expect(linkVenueFacilityAction(id,form({facility:'FC-0014'}))).rejects.toThrow('pad=refused');
 expect(siteIdForFacility('FC-0014')).not.toBe(venueSite);
 // "This facility is not at this venue": the facility returns to a site of its own.
 await expect(unlinkVenueFacilityAction(id,'FC-0021')).rejects.toThrow(`redirect:/venues/${id}?step=V7#req-V7`);
 expect(siteIdForFacility('FC-0021')).not.toBe(venueSite);expect(inst('V7').state).toBe('pending');
 await saveRow('V7',{none:true});expect(inst('V7')).toMatchObject({state:'complete',detailEn:'Recorded: no facility registration for this place'});
});
test('submission freezes the venue record; the Ministry outcome issues the annual certificate',async()=>{
 as('test_organizer');const db=getDb();
 for(const k of ['V1','V3','V5'])await saveRow(k);await saveRow('V4',{exists:'yes',location:'Ground floor'});
 expect(inst('V1').state).toBe('pending');
 await expect(saveRequirementFileAction('venue',id,'V1',form({file:pdf()}))).rejects.toThrow(`/venues/${id}?saved=V1#req-V1`);
 expect(state().record!.blockers.map(b=>b.key)).toEqual([]);expect(venueSubmissionChecks(venuePackageFacts(state())).canSubmit).toBe(true);
 await expect(submitVenuePackageAction(id,form({}))).rejects.toThrow('error=incomplete');
 await expect(submitVenuePackageAction(id,form({confirm:'yes'}))).rejects.toThrow('submitted=yes');expect(state().status).toBe('submitted');expect(state().editable).toBe(false);
 const frozen=requirementSnapshotFor('venue',id,1)!;expect(frozen.instances.map(i=>i.key)).toEqual(['V1','V2','V3','V4','V5','V6','V7']);expect(frozen.parties).toEqual([]);
 await expect(reopenVenueSectionAction(id,'details')).rejects.toThrow(`redirect:/venues/${id}`);
 expect(await saveRequirementAnswerAction('venue',id,'V2',{baseVersion:1,values:{entry:'x'}})).toEqual({error:'locked'});
 as('test_moph');await expect(reviewVenuePackageAction(id,form({decision:'satisfied',revision:'1'}))).rejects.toThrow('/ministry/venues/');expect(state().status).toBe('accepted');
 expect((db.prepare('SELECT COUNT(*) AS n FROM venue_assessments WHERE venue_id=? AND certificate_issued=1').get(id) as {n:number}).n).toBe(1);
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
test('renewal keeps the venue and its site, the previous certificate and the earlier answers in history, and starts the new cycle clean',async()=>{
 as('test_organizer');const db=getDb();const previous=db.prepare('SELECT snapshot FROM venue_package_history WHERE venue_id=?').get(id);const site=siteIdForVenue(id);
 const answered=(db.prepare("SELECT COUNT(*) AS n FROM requirement_answers WHERE record_kind='venue' AND record_id=?").get(id) as {n:number}).n;expect(answered).toBeGreaterThan(5);
 db.prepare("UPDATE venues SET valid_until='2000-01-01' WHERE id=?").run(id);
 const {renewVenuePackageAction}=await import('../app/venues/actions');await expect(renewVenuePackageAction(id)).rejects.toThrow(`/venues/${id}/details`);
 expect(state().venue.id).toBe(id);expect(siteIdForVenue(id)).toBe(site);expect(state().status).toBe('draft');expect(state().detailsEditing).toBe(true);expect(state().assessmentDone).toBe(false);expect(db.prepare('SELECT snapshot FROM venue_package_history WHERE venue_id=?').get(id)).toEqual(previous);
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

