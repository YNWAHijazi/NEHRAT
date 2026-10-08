'use server';
import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { venueAccess, invalidateVenueMedicalWork } from '../../lib/venue/collaboration';
import { currentAccount } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { ensureVenuePackage, parseVenueDetails, venuePackageFor, venuePackageFacts } from '../../lib/venue/workspace';
import type { VenueFormState } from '../actions';
import { venueSubmissionChecks, venueStatusForDecision, VENUE_STATUS } from '../../lib/rules/venue-workflow';
import { maxUploadBytes, refuseUpload } from '../../lib/rules/uploads';
import { can, REASSESSMENT_WINDOW, venueReassessmentGate } from '../../lib/rules';
import { venueChangeSinceAssessment } from '../../lib/queries';
import { writeRequirementSnapshot } from '../../lib/record-facts';
import { beirutToday } from '../../lib/clock';
import { notifyVenue as notify, notifyVenueMedicalProgress } from '../../lib/venue/notify';

async function owned(id:string) {
 const a=await currentAccount();if(!a)redirect('/signin');const w=venuePackageFor(a.id,id);if(!w)notFound();return {a,w};
}
function refresh(id:string) { revalidatePath(`/venues/${id}`,'layout');revalidatePath(`/venue-team/${id}`);revalidatePath('/dashboard');revalidatePath('/ministry/venues'); }
export async function saveVenueDetailsAction(id:string,_prev:VenueFormState,form:FormData):Promise<VenueFormState> {
 const {a,w}=await owned(id);if(!w.editable||!w.detailsEditing)redirect(`/venues/${id}`);const parsed=parseVenueDetails(form);if('refused' in parsed)return {refused:parsed.refused};const v=parsed.value;
 ensureVenuePackage(a.id,id);
 getDb().prepare(`UPDATE venues SET name_en=?,name_ar=?,category=?,address_municipality_en=?,address_municipality_ar=?,responsible_contact=?,licensed_capacity=?,regularly_hosts=?,is_nightclub=?,district=?,latitude=?,longitude=?,responsible_name=?,responsible_phone=? WHERE id=?`).run(v.nameEn,v.nameAr,v.category,v.address,v.addressAr,v.contact,v.capacity,+v.regular,+v.nightclub,v.district,v.point.lat,v.point.lng,v.contactName,v.contactPhone,id);
 getDb().prepare('UPDATE venue_packages SET details_editing=0 WHERE venue_id=?').run(id);
 invalidateVenueMedicalWork(id);
 // Facts that set the minimum level require a fresh assessment before submission.
 if(v.capacity!==w.venue.licensedCapacity||v.nightclub!==w.venue.isNightclub) getDb().prepare('UPDATE venue_packages SET assessment_version=NULL WHERE venue_id=?').run(id);
 refresh(id);redirect(`/venues/${id}/assessment`);
}
export async function reopenVenueSectionAction(id:string,section:'details'|'assessment') {
 const {a,w}=await owned(id);if(!w.editable)redirect(`/venues/${id}`);ensureVenuePackage(a.id,id);
 if(section==='details')getDb().prepare('UPDATE venue_packages SET details_editing=1 WHERE venue_id=?').run(id);
 else if(section==='assessment')getDb().prepare('UPDATE venue_packages SET assessment_editing=1 WHERE venue_id=?').run(id);
 refresh(id);redirect(`/venues/${id}/${section}`);
}
/**
 * A participating EMS agency signs its own readiness declaration for the venue (Level 3,
 * catalogue row B20): the signed document and the agency's confirmation, recorded against
 * its invitation. The organizer, another agency and the plan approval cannot sign it.
 */
export async function signVenueDeclarationAction(id:string,form:FormData) {
 const a=await currentAccount();if(!a)redirect('/signin');const access=venueAccess(a,id);if(!access?.invitation||access.role!=='ems')notFound();
 const w=venuePackageFor(access.ownerId,id)!;const back=`/venue-team/${id}`;
 if(!w.editable||w.level!==3)redirect(`${back}?error=forbidden#req-B20`);
 const file=form.get('file');
 if(!(file instanceof File)||!file.size||form.get('confirm')!=='yes')redirect(`${back}?error=incomplete#req-B20`);
 if(refuseUpload({type:file.type,size:file.size}))redirect(`${back}?upload=wrongType&doc=B20#req-B20`);
 const bytes=Buffer.from(await file.arrayBuffer());if(bytes.length>maxUploadBytes())redirect(`${back}?upload=tooLarge&doc=B20#req-B20`);
 const fileKey=`20-${access.invitation.token}`;const db=getDb();db.exec('BEGIN IMMEDIATE');
 try{
 const current=venuePackageFor(access.ownerId,id)!;if(!current.editable||current.level!==3)throw new Error('STALE_VENUE_FORM');
 db.prepare(`INSERT INTO venue_attachments(venue_id,doc_key,file_name,content_type,byte_size,bytes) VALUES(?,?,?,?,?,?) ON CONFLICT(venue_id,doc_key) DO UPDATE SET file_name=excluded.file_name,content_type=excluded.content_type,byte_size=excluded.byte_size,bytes=excluded.bytes,attached_at=now_stamp()`).run(id,fileKey,file.name.trim(),file.type,bytes.length,bytes);
 db.prepare(`INSERT INTO venue_contributions(venue_id,requirement_key,invitation_token,answers,assessment_version) VALUES(?,'20',?,?,?) ON CONFLICT(venue_id,requirement_key,invitation_token) DO UPDATE SET answers=excluded.answers,assessment_version=excluded.assessment_version,completed_at=now_stamp()`).run(id,access.invitation.token,JSON.stringify({fileKey,agency:access.invitation.name}),current.assessmentVersion??0);
 db.prepare('UPDATE venue_packages SET work_revision=work_revision+1 WHERE venue_id=?').run(id);
 db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');if(e instanceof Error&&e.message==='STALE_VENUE_FORM')redirect(`${back}?error=stale#req-B20`);throw e;}
 notifyVenueMedicalProgress(access.ownerId,a.isDemo,id);
 refresh(id);redirect(`${back}?saved=B20#req-B20`);
}
export async function submitVenuePackageAction(id:string,form:FormData) {
 const {a}=await owned(id); const db=getDb();db.exec('BEGIN IMMEDIATE');let blocked=false;
 try{const w=ensureVenuePackage(a.id,id)!;
 // The same checks the record page's final review shows (lib/rules venueSubmissionChecks), plus the declaration on the form.
 if(!venueSubmissionChecks(venuePackageFacts(w)).canSubmit||form.get('confirm')!=='yes'||!w.record)blocked=true;
 else {const revision=w.revision+1;
 // THE IMMUTABLE SUBMITTED PACKAGE: the resolved instances, the plan, the parties and the approval, with the files.
 const snapshot=JSON.stringify({venue:w.venue,point:w.point,district:w.district,level:w.level,assessmentVersion:w.assessmentVersion,instances:w.record.instances,plan:w.record.plan,parties:w.record.parties,approval:w.record.approval,catalogue:'requirement-catalogue'});
 const result=db.prepare('INSERT INTO venue_package_history(venue_id,revision,snapshot) VALUES(?,?,?)').run(id,revision,snapshot);
 db.prepare(`INSERT INTO venue_package_files(package_id,doc_key,file_name,content_type,bytes) SELECT ?,doc_key,file_name,content_type,bytes FROM venue_attachments WHERE venue_id=? AND length(bytes)>0`).run(result.lastInsertRowid,id);
 writeRequirementSnapshot('venue',w.record,revision);
 db.prepare("UPDATE venue_packages SET status='submitted',revision=?,submitted_at=now_stamp(),review_note='' WHERE venue_id=?").run(revision,id);
 db.prepare('UPDATE venues SET moph_reference=COALESCE(moph_reference,id) WHERE id=?').run(id);
 const reviewers=db.prepare('SELECT id,role FROM accounts WHERE is_demo=?').all(+a.isDemo) as unknown as {id:number;role:string}[];for(const reviewer of reviewers)if(can(reviewer.role,'recordOutcome'))notify(reviewer.id,a.isDemo,`/ministry/venues/${id}`,`Venue submission: ${id}`,`طلب موقع استضافة: ${id}`);
 }db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 refresh(id);redirect(`/venues/${id}?${blocked?'error=incomplete':'submitted=yes'}#final-review`);
}
export async function reviewVenuePackageAction(id:string,form:FormData) {
 const a=await currentAccount();if(!a||!can(a.role,'recordOutcome'))notFound();const db=getDb();const v=db.prepare('SELECT account_id,is_demo,archived_at FROM venues WHERE id=?').get(id) as {account_id:number;is_demo:number;archived_at:string|null}|undefined;
 if(!v||v.is_demo!==+a.isDemo||v.archived_at)notFound();const decision=String(form.get('decision'));const note=String(form.get('note')??'').trim();const revision=Number(form.get('revision'));
 if(!['satisfied','revision','incomplete'].includes(decision)||(decision!=='satisfied'&&!note))redirect(`/ministry/venues/${id}?error=note`);
 db.exec('BEGIN IMMEDIATE');let stale=false;
 try{const w=venuePackageFor(v.account_id,id)!;if(w.status!=='submitted'||w.revision!==revision)stale=true;else{
 db.prepare(`UPDATE venue_packages SET status=?,review_note=?,reviewer_id=?,accepted_at=CASE WHEN ?='satisfied' THEN now_stamp() ELSE NULL END WHERE venue_id=?`).run(venueStatusForDecision(decision as 'satisfied'|'revision'|'incomplete'),note,a.id,decision,id);
 db.prepare('UPDATE venue_package_history SET decision=?,review_note=?,reviewer_id=?,reviewed_at=now_stamp() WHERE venue_id=? AND revision=?').run(decision,note,a.id,id,revision);
 if(decision==='satisfied') { const date=beirutToday(), d=new Date(`${date}T00:00:00Z`);const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+REASSESSMENT_WINDOW.venueClassificationMonths);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));const until=d.toISOString().slice(0,10);
 db.prepare('UPDATE venue_assessments SET certificate_issued=1,effective=?,valid_until=?,certificate_snapshot=? WHERE venue_id=? AND version=?').run(date,until,JSON.stringify({nameEn:w.venue.nameEn,nameAr:w.venue.nameAr,addressEn:w.venue.addressMunicipalityEn,addressAr:w.venue.addressMunicipalityAr,capacity:w.venue.licensedCapacity}),id,w.assessmentVersion);
 db.prepare('UPDATE venues SET level=?,issued=?,valid_until=? WHERE id=?').run(w.level,date,until,id);
 }
 // The operator is told the outcome the Ministry recorded, in the compliance form's words.
 const outcome=VENUE_STATUS[venueStatusForDecision(decision as 'satisfied'|'revision'|'incomplete')];
 notify(v.account_id,a.isDemo,`/venues/${id}`,`${w.venue.nameEn}: ${outcome.en}`,`${w.venue.nameAr}: ${outcome.ar}`);
 }db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}refresh(id);redirect(`/ministry/venues/${id}${stale?'?error=stale':'?recorded=1'}`);
}
export async function renewVenuePackageAction(id:string) {
 const {a,w}=await owned(id);const gate=venueReassessmentGate({validUntil:w.venue.validUntil,today:beirutToday(),changeReportedSinceAssessment:venueChangeSinceAssessment(a.id,id)});
 if(w.venue.archivedAt||w.status!=='accepted'||gate.behaviour!=='enabled')redirect(`/venues/${id}`);
 const db=getDb();db.exec('BEGIN IMMEDIATE');try{
 // A venue certified before packages existed has no package row yet; renewal starts its first one.
 db.prepare("INSERT OR IGNORE INTO venue_packages(venue_id,status) VALUES(?,'accepted')").run(id);
 db.prepare("UPDATE venue_packages SET status='draft',assessment_version=NULL,answers='{}',review_note='',accepted_at=NULL,details_editing=1,assessment_editing=0 WHERE venue_id=?").run(id);
 // The earlier cycle's answers and files stay readable in its frozen submission and in the answer
 // history (D7 keeps the same venue ID and prior certificates); the new cycle starts clean.
 db.prepare(`INSERT INTO requirement_answer_history (record_kind,record_id,key,answers,author_id,author_role,author_name,version,saved_at) SELECT record_kind,record_id,key,answers,author_id,author_role,author_name,version,saved_at FROM requirement_answers WHERE record_kind='venue' AND record_id=?`).run(id);
 db.prepare("DELETE FROM requirement_answers WHERE record_kind='venue' AND record_id=?").run(id);
 db.prepare('DELETE FROM venue_attachments WHERE venue_id=?').run(id);
 invalidateVenueMedicalWork(id);db.prepare("UPDATE venue_invitations SET status='withdrawn' WHERE venue_id=? AND status IN ('nominated','confirmed')").run(id);
 db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}refresh(id);redirect(`/venues/${id}/details`);
}
