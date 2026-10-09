/**
 * THE HOSTING VENUE IS RETIRED (owner, 9 October 2026: "Two services: Register an event;
 * Register a facility/site. The event becomes the main thing. Link between event and facility,
 * no longer venue."). Hosting venue registration is replaced by Facility/Site registration: no
 * venue is registered, assessed, filed, reviewed, renewed or changed, and nothing about an
 * existing venue is deleted -- its rows stay as the history the owner and the Ministry read.
 *
 * Replaces the venue lifecycle test of 8 October 2026. The two event tests that lived beside it
 * (the Medical Director's version-bound approval, the record ID lookup) are kept here unchanged.
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
import {venuePackageFor} from '../lib/venue/workspace';
import {venueInvitations} from '../lib/venue/collaboration';
import {submitVenuePackageAction,reopenVenueSectionAction,saveVenueDetailsAction,reviewVenuePackageAction,renewVenuePackageAction,linkVenueFacilityAction,unlinkVenueFacilityAction} from '../app/venues/actions';
import {inviteVenuePartnerAction,respondVenueInvitationAction} from '../app/venues/team-actions';
import {registerVenueAction,reportVenueChangeAction,saveVenueAssessmentAction} from '../app/actions';
import {approveRecordPlanAction,saveRequirementAnswerAction} from '../app/record-actions';
import {eventRecordRequirements} from '../lib/record-facts';
import {siteIdForFacility,siteIdForVenue} from '../lib/sites';
import {VENUE_SERVICE_RETIRED} from '../lib/rules/venue-workflow';
import {deriveLevel} from '../lib/rules';
const folder=mkdtempSync(join(tmpdir(),'moph-venue-retired-'));const id='VN-9001';let owner:number;
function as(login:string){const r=getDb().prepare('SELECT id,role FROM accounts WHERE login=?').get(login) as {id:number;role:Account['role']};session.account={...r,login,displayName:login,initials:'T',isDemo:true};return r.id;}
function form(values:Record<string,string|File>){const f=new FormData();for(const[k,v]of Object.entries(values))f.set(k,v);return f;}
const state=()=>venuePackageFor(owner,id)!;
const snapshot=()=>{const db=getDb();return {
 venue:db.prepare('SELECT * FROM venues WHERE id=?').get(id),
 pkg:db.prepare('SELECT * FROM venue_packages WHERE venue_id=?').get(id),
 assessments:db.prepare('SELECT * FROM venue_assessments WHERE venue_id=? ORDER BY version').all(id),
 answers:db.prepare("SELECT * FROM requirement_answers WHERE record_kind='venue' AND record_id=? ORDER BY key").all(id),
 changes:db.prepare('SELECT * FROM venue_changes WHERE venue_id=?').all(id),
};};
beforeAll(()=>{vi.stubEnv('DATABASE_PATH',join(folder,'test.db'));vi.stubEnv('REVIEW_CLOCK','2026-08-13');owner=as('test_organizer');const db=getDb();
 db.prepare(`INSERT INTO venues(id,account_id,name_en,name_ar,category,address_municipality_en,address_municipality_ar,responsible_contact,responsible_name,responsible_phone,licensed_capacity,regularly_hosts,is_demo,district,latitude,longitude) VALUES(?,?,'Venue lifecycle test','موقع اختبار','hall','Beirut','بيروت','Operator +9613111111','Operator','+9613111111',5000,1,1,'Beirut',33.9,35.5)`).run(id,owner);
 // A venue registered before the change: a draft package with an assessment, written as it was then.
 const answers=[2,2,2,2,2,2,2,2,2] as [2,2,2,2,2,2,2,2,2];const inputs={expectedMaxSimultaneousAttendance:5000,eventDisciplines:[],courseDistanceKm:null,venueLicensedCapacity:5000,venueIsNightclubOrDanceVenue:false};
 db.prepare(`INSERT INTO venue_assessments(venue_id,version,answers,inputs,derivation,nehrat_tool_version,effective,valid_until,representative,position,certificate_issued) VALUES(?,1,?,?,?,'','','','Operator','Manager',0)`).run(id,JSON.stringify(answers),JSON.stringify(inputs),JSON.stringify(deriveLevel({answers,inputs})));
 db.prepare('INSERT INTO venue_packages(venue_id,assessment_version) VALUES(?,1)').run(id);
 db.prepare("INSERT INTO requirement_answers(record_kind,record_id,key,answers,author_role,author_name,version) VALUES('venue',?,'V2','{\"entry\":\"North gate\"}','organizer','Operator',1)").run(id);
});
afterAll(()=>{getDb().close();vi.unstubAllEnvs();rmSync(folder,{recursive:true,force:true})});

test('no venue is registered: a registration posted from an old form lands on the facility/site service',async()=>{
 expect(VENUE_SERVICE_RETIRED).toBe(true);as('test_organizer');
 const before=(getDb().prepare('SELECT COUNT(*) AS n FROM venues').get() as {n:number}).n;
 await expect(registerVenueAction(null,form({nameEn:'New hall'}))).rejects.toThrow('redirect:/facilities/new');
 expect((getDb().prepare('SELECT COUNT(*) AS n FROM venues').get() as {n:number}).n).toBe(before);
});

test('an existing venue is history: every act on it is refused and nothing about it changes or is deleted',async()=>{
 as('test_organizer');const site=siteIdForVenue(id);const before=snapshot();
 expect(state().editable).toBe(false);expect(state().record!.editable).toBe(false);
 await expect(saveVenueDetailsAction(id,null,new FormData())).rejects.toThrow(`redirect:/venues/${id}`);
 await expect(reopenVenueSectionAction(id,'details')).rejects.toThrow(`redirect:/venues/${id}`);
 expect(await saveVenueAssessmentAction(id,{answers:[0,0,0,0,0,0,0,0,0],attendance:10,representative:'x',position:'x'})).toEqual({error:'locked'});
 expect(await saveRequirementAnswerAction('venue',id,'V2',{baseVersion:1,values:{entry:'South gate'}})).toEqual({error:'locked'});
 await expect(submitVenuePackageAction(id,form({confirm:'yes'}))).rejects.toThrow(`redirect:/venues/${id}`);
 await expect(renewVenuePackageAction(id)).rejects.toThrow(`redirect:/venues/${id}`);
 await expect(reportVenueChangeAction(id,form({aspect:'name',description:'Renamed',effectiveDate:'2026-09-01'}))).rejects.toThrow(`redirect:/venues/${id}`);
 await expect(linkVenueFacilityAction(id,form({facility:'FC-0021'}))).rejects.toThrow(`redirect:/venues/${id}`);
 expect(siteIdForFacility('FC-0021')).not.toBe(site);
 await expect(unlinkVenueFacilityAction(id,'FC-0021')).rejects.toThrow(`redirect:/venues/${id}`);
 await expect(inviteVenuePartnerAction(id,form({kind:'ems',name:'Agency',email:'ems@venue.example.test'}))).rejects.toThrow(`redirect:/venues/${id}`);
 expect(venueInvitations(id)).toEqual([]);
 await expect(respondVenueInvitationAction('a'.repeat(48),form({response:'accept'}))).rejects.toThrow(`redirect:/venue-invitations/${'a'.repeat(48)}`);
 // The Ministry records no outcome on a venue file.
 getDb().prepare("UPDATE venue_packages SET status='submitted',revision=1,submitted_at='2026-08-01 10:00' WHERE venue_id=?").run(id);
 const submitted=snapshot();
 as('test_moph');await expect(reviewVenuePackageAction(id,form({decision:'satisfied',revision:'1'}))).rejects.toThrow(`redirect:/ministry/venues/${id}`);
 expect(snapshot()).toEqual(submitted);
 expect(before.venue).toEqual(submitted.venue);expect(before.answers).toEqual(submitted.answers);expect(before.assessments).toEqual(submitted.assessments);
 expect(siteIdForVenue(id)).toBe(site);
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

test('record ID lookup supports historical aliases and still requires the event date and real-data scope',async()=>{
 const {findSubmissionByReference}=await import('../lib/queries');const {resolvePublicLookup}=await import('../lib/rules/public-lookup');const db=getDb();
 const r=db.prepare("SELECT id,moph_reference,start_date FROM events WHERE filed=1 AND moph_reference IS NOT NULL LIMIT 1").get() as {id:string;moph_reference:string;start_date:string};
 expect(findSubmissionByReference(r.id)?.referenceNumber).toBe(r.id);expect(findSubmissionByReference(r.moph_reference)?.referenceNumber).toBe(r.id);
 expect(resolvePublicLookup({referenceNumber:r.id,eventStartDate:r.start_date},findSubmissionByReference).exists).toBe(false);
 db.prepare('UPDATE events SET is_demo=0 WHERE id=?').run(r.id);
 try{expect(resolvePublicLookup({referenceNumber:r.id},findSubmissionByReference).exists).toBe(false);expect(resolvePublicLookup({referenceNumber:r.id,eventStartDate:'1900-01-01'},findSubmissionByReference).exists).toBe(false);expect(resolvePublicLookup({referenceNumber:r.id,eventStartDate:r.start_date},findSubmissionByReference).exists).toBe(true);expect(resolvePublicLookup({referenceNumber:r.moph_reference,eventStartDate:r.start_date},findSubmissionByReference).exists).toBe(true);}finally{db.prepare('UPDATE events SET is_demo=1 WHERE id=?').run(r.id);}
});
