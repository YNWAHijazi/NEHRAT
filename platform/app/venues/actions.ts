'use server';
import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { venueAccess, venueMayWrite, invalidateVenueMedicalWork } from '../../lib/venue/collaboration';
import { currentAccount } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { ensureVenuePackage, readVenueDetails, venuePackageFor } from '../../lib/venue/workspace';
import { refuseUpload } from '../../lib/rules/uploads';
import { can, REASSESSMENT_WINDOW, venueReassessmentGate, applicationFee, effectiveFlag } from '../../lib/rules';
import { capabilityConfigFor, ministryConfig, venueChangeSinceAssessment } from '../../lib/queries';
import { paymentFor } from '../../lib/payments';
import { beirutToday } from '../../lib/clock';

async function owned(id:string) {
 const a=await currentAccount();if(!a)redirect('/signin');const w=venuePackageFor(a.id,id);if(!w)notFound();return {a,w};
}
function notify(accountId:number,isDemo:boolean,route:string,en:string,ar:string) { getDb().prepare("INSERT INTO notifications(account_id,kind,subject_en,subject_ar,body_en,body_ar,record_route,sent_at,is_demo) VALUES(?,'needs_action',?,?,?, ?,?,now_stamp(),?)").run(accountId,en,ar,en,ar,route,+isDemo); }
function refresh(id:string) { revalidatePath(`/venues/${id}`,'layout');revalidatePath('/dashboard');revalidatePath('/ministry/venues'); }
export async function saveVenueDetailsAction(id:string,form:FormData) {
 const {a,w}=await owned(id);if(!w.editable||(w.detailsDone&&!w.detailsEditing))redirect(`/venues/${id}`);const v=readVenueDetails(form);if(!v)redirect(`/venues/${id}/details?error=details`);
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
export async function saveVenueRequirementAction(id:string,key:string,form:FormData) {
 const a=await currentAccount();if(!a)redirect('/signin');const access=venueAccess(a,id);if(!access)notFound();
 const w=venuePackageFor(access.ownerId,id)!;const back=access.role==='organizer'?`/venues/${id}/requirements`:`/venue-team/${id}`;
 if(!w.editable||!w.level||!venueMayWrite(a,id,Number(key),w.level))redirect(back);
 const req=w.requirements.find(r=>String(r.n)===key);if(!req)notFound();
 const values=Object.fromEntries(req.fields.map(f=>[f.key,String(form.get(f.key)??'').trim().slice(0,5000)]));
 const file=form.get('file');let upload:{name:string;type:string;bytes:Buffer}|null=null;
 if(file instanceof File&&file.size){if(refuseUpload(file))redirect(`${back}?error=upload#r-${key}`);upload={name:file.name.trim(),type:file.type,bytes:Buffer.from(await file.arrayBuffer())};}
 const fileKey=key==='20'&&access.invitation?`${key}-${access.invitation.token}`:key;
 const hasFile=upload||w.files.some(f=>f.docKey===fileKey&&f.hasFile);
 if(Object.values(values).some(v=>!v)||req.fileRequired&&!hasFile||(access.role!=='organizer'&&form.get('confirm')!=='yes'))redirect(`${back}?error=incomplete#r-${key}`);
 const db=getDb();let stale=false;db.exec('BEGIN IMMEDIATE');
 try{const current=ensureVenuePackage(access.ownerId,id);const liveAccess=current?.level?venueMayWrite(a,id,Number(key),current.level):null;
 if(!current?.editable||!liveAccess||current.assessmentVersion!==Number(form.get('assessmentVersion'))||current.workRevision!==Number(form.get('workRevision')))throw new Error('STALE_VENUE_FORM');
 db.prepare('UPDATE venue_packages SET answers=?,work_revision=work_revision+1 WHERE venue_id=?').run(JSON.stringify({...current.answers,[key]:values}),id);
 if(upload)db.prepare(`INSERT INTO venue_attachments(venue_id,doc_key,file_name,content_type,byte_size,bytes) VALUES(?,?,?,?,?,?) ON CONFLICT(venue_id,doc_key) DO UPDATE SET file_name=excluded.file_name,content_type=excluded.content_type,byte_size=excluded.byte_size,bytes=excluded.bytes,attached_at=now_stamp()`).run(id,fileKey,upload.name,upload.type,upload.bytes.length,upload.bytes);
 if(liveAccess.invitation){
 if(key!=='20')db.prepare('DELETE FROM venue_contributions WHERE venue_id=? AND requirement_key=?').run(id,key);
 db.prepare(`INSERT INTO venue_contributions(venue_id,requirement_key,invitation_token,answers,assessment_version) VALUES(?,?,?,?,?) ON CONFLICT(venue_id,requirement_key,invitation_token) DO UPDATE SET answers=excluded.answers,assessment_version=excluded.assessment_version,completed_at=now_stamp()`).run(id,key,liveAccess.invitation.token,JSON.stringify({...values,...(key==='20'?{fileKey}: {})}),current.assessmentVersion);
 // A plan approval covers the medical arrangements as a whole; changed clinical answers need approval again.
 db.prepare('DELETE FROM venue_plan_approvals WHERE venue_id=?').run(id);
 notify(access.ownerId,a.isDemo,`/venues/${id}/requirements`,`Medical requirement completed: ${req.en}`,`اكتمل متطلب طبي: ${req.ar}`);
 }
 db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');if(e instanceof Error&&e.message==='STALE_VENUE_FORM')stale=true;else throw e;}
 refresh(id);revalidatePath(`/venue-team/${id}`);redirect(`${back}?${stale?'error=stale':`saved=${key}`}#r-${key}`);
}
export async function approveVenuePlanAction(id:string,form:FormData) {
 const a=await currentAccount();if(!a)redirect('/signin');const access=venueAccess(a,id);if(!access?.invitation||access.role!=='director')notFound();
 const db=getDb();db.exec('BEGIN IMMEDIATE');let refused=false;
 try{const w=venuePackageFor(access.ownerId,id)!;const plan=w.requirements.find(r=>r.n===2);
 if(!w.editable||w.level!==3||w.assessmentVersion!==Number(form.get('assessmentVersion'))||form.get('confirm')!=='yes'||w.workRevision!==Number(form.get('workRevision'))||!plan?.awaitingApproval)refused=true;
 else{db.prepare('UPDATE venue_packages SET work_revision=work_revision+1 WHERE venue_id=?').run(id);db.prepare('INSERT OR REPLACE INTO venue_plan_approvals(venue_id,invitation_token,assessment_version) VALUES(?,?,?)').run(id,access.invitation.token,w.assessmentVersion);notify(access.ownerId,a.isDemo,`/venues/${id}/requirements`,'Medical Director approved the plan','اعتمد المدير الطبي الخطة');}
 db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 refresh(id);revalidatePath(`/venue-team/${id}`);redirect(`/venue-team/${id}?${refused?'error=incomplete':'approval=recorded'}`);
}
export async function submitVenuePackageAction(id:string,form:FormData) {
 const {a}=await owned(id); const db=getDb();db.exec('BEGIN IMMEDIATE');let blocked=false;
 try{const w=ensureVenuePackage(a.id,id)!;const config=new Map([...ministryConfig()].map(([k,v])=>[k,v.value]));const fee=applicationFee('registerVenue',null,effectiveFlag('applicationFees',config),capabilityConfigFor('applicationFees'));
 if(!w.editable||!w.assessmentDone||!w.detailsDone||w.detailsEditing||w.assessmentEditing||w.invitations.some(i=>i.status==='nominated')||w.requirements.some(r=>!r.optional&&!r.done)||form.get('confirm')!=='yes'||(fee&&!paymentFor(id,'registerVenue')))blocked=true;
 else {const revision=w.revision+1;const snapshot=JSON.stringify({venue:w.venue,point:w.point,district:w.district,level:w.level,assessmentVersion:w.assessmentVersion,requirements:w.requirements,answers:w.answers,approval:w.approval});
 const result=db.prepare('INSERT INTO venue_package_history(venue_id,revision,snapshot) VALUES(?,?,?)').run(id,revision,snapshot);
 db.prepare(`INSERT INTO venue_package_files(package_id,doc_key,file_name,content_type,bytes) SELECT ?,doc_key,file_name,content_type,bytes FROM venue_attachments WHERE venue_id=? AND length(bytes)>0`).run(result.lastInsertRowid,id);
 db.prepare("UPDATE venue_packages SET status='submitted',revision=?,submitted_at=now_stamp(),review_note='',answers=? WHERE venue_id=?").run(revision,JSON.stringify(w.answers),id);
 db.prepare('UPDATE venues SET moph_reference=COALESCE(moph_reference,id) WHERE id=?').run(id);
 const reviewers=db.prepare('SELECT id,role FROM accounts WHERE is_demo=?').all(+a.isDemo) as unknown as {id:number;role:string}[];for(const reviewer of reviewers)if(can(reviewer.role,'recordOutcome'))notify(reviewer.id,a.isDemo,`/ministry/venues/${id}`,`Venue submission: ${id}`,`طلب موقع استضافة: ${id}`);
 }db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 refresh(id);redirect(`/venues/${id}/submit?${blocked?'error=incomplete':'submitted=yes'}`);
}
export async function reviewVenuePackageAction(id:string,form:FormData) {
 const a=await currentAccount();if(!a||!can(a.role,'recordOutcome'))notFound();const db=getDb();const v=db.prepare('SELECT account_id,is_demo,archived_at FROM venues WHERE id=?').get(id) as {account_id:number;is_demo:number;archived_at:string|null}|undefined;
 if(!v||v.is_demo!==+a.isDemo||v.archived_at)notFound();const decision=String(form.get('decision'));const note=String(form.get('note')??'').trim();const revision=Number(form.get('revision'));
 if(!['satisfied','revision','incomplete'].includes(decision)||(decision!=='satisfied'&&!note))redirect(`/ministry/venues/${id}?error=note`);
 db.exec('BEGIN IMMEDIATE');let stale=false;
 try{const w=venuePackageFor(v.account_id,id)!;if(w.status!=='submitted'||w.revision!==revision)stale=true;else{
 db.prepare(`UPDATE venue_packages SET status=?,review_note=?,reviewer_id=?,accepted_at=CASE WHEN ?='satisfied' THEN now_stamp() ELSE NULL END WHERE venue_id=?`).run(decision==='satisfied'?'accepted':'revision',note,a.id,decision,id);
 db.prepare('UPDATE venue_package_history SET decision=?,review_note=?,reviewer_id=?,reviewed_at=now_stamp() WHERE venue_id=? AND revision=?').run(decision,note,a.id,id,revision);
 if(decision==='satisfied') { const date=beirutToday(), d=new Date(`${date}T00:00:00Z`);const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+REASSESSMENT_WINDOW.venueClassificationMonths);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));const until=d.toISOString().slice(0,10);
 db.prepare('UPDATE venue_assessments SET certificate_issued=1,effective=?,valid_until=?,certificate_snapshot=? WHERE venue_id=? AND version=?').run(date,until,JSON.stringify({nameEn:w.venue.nameEn,nameAr:w.venue.nameAr,addressEn:w.venue.addressMunicipalityEn,addressAr:w.venue.addressMunicipalityAr,capacity:w.venue.licensedCapacity}),id,w.assessmentVersion);
 db.prepare('UPDATE venues SET level=?,issued=?,valid_until=? WHERE id=?').run(w.level,date,until,id);
 }
 notify(v.account_id,a.isDemo,`/venues/${id}`,decision==='satisfied'?'Venue certificate available':'Venue changes requested',decision==='satisfied'?'شهادة الموقع متاحة':'تعديلات مطلوبة على الموقع');
 }db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}refresh(id);redirect(`/ministry/venues/${id}${stale?'?error=stale':''}`);
}
export async function renewVenuePackageAction(id:string) {
 const {a,w}=await owned(id);const gate=venueReassessmentGate({validUntil:w.venue.validUntil,today:beirutToday(),changeReportedSinceAssessment:venueChangeSinceAssessment(a.id,id)});
 if(w.venue.archivedAt||w.status!=='accepted'||gate.behaviour!=='enabled')redirect(`/venues/${id}`);
 const db=getDb();db.exec('BEGIN IMMEDIATE');try{
 db.prepare("UPDATE venue_packages SET status='draft',assessment_version=NULL,answers='{}',review_note='',accepted_at=NULL,details_editing=1,assessment_editing=0 WHERE venue_id=?").run(id);
 // Old files stay in the immutable submission snapshot; the new cycle needs fresh confirmation.
 db.prepare('DELETE FROM venue_attachments WHERE venue_id=?').run(id);
 invalidateVenueMedicalWork(id);db.prepare("UPDATE venue_invitations SET status='withdrawn' WHERE venue_id=? AND status IN ('nominated','confirmed')").run(id);
 db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}refresh(id);redirect(`/venues/${id}/details`);
}
