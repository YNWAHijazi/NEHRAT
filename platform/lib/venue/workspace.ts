import { venueInvitations } from './collaboration';
import { venueRequirementEditors } from '../rules/venue-workflow';
import { getDb } from '../db';
import { venueById, venueAssessmentsFor, venueAttachmentsFor } from '../queries';
import { venuePackageEditable, venueRequirements, type VenueAnswers, type VenuePackageStatus } from '../rules/venue-workflow';
import type { Level } from '../rules';
import { readMapPoint, type MapPoint } from '../rules/geolocation';
import { VENUE_TYPES, VENUE_DISTRICTS } from '../rules/venue-intake';

export function venuePackageFor(accountId:number,id:string) {
 const venue=venueById(accountId,id); if(!venue)return null;
 const row=getDb().prepare('SELECT * FROM venue_packages WHERE venue_id=?').get(id) as {status:VenuePackageStatus;answers:string;assessment_version:number|null;revision:number;submitted_at:string|null;accepted_at:string|null;review_note:string;work_revision:number;details_editing:number;assessment_editing:number}|undefined;
 const geo=getDb().prepare('SELECT district,latitude,longitude FROM venues WHERE id=?').get(id) as {district:string;latitude:number|null;longitude:number|null};
 const versions=venueAssessmentsFor(accountId,id);
 const assessmentVersion=row?row.assessment_version:(versions[0]?.version??null);
 const level=assessmentVersion?versions.find(v=>v.version===assessmentVersion)?.derivation.finalLevel??null:null;
 const answers:VenueAnswers=row?JSON.parse(row.answers):{};
 const invitations=venueInvitations(id);
 const confirmed=invitations.filter(i=>i.status==='confirmed');
 const director=confirmed.find(i=>i.kind==='director'&&i.licence);
 const contributions=getDb().prepare(`SELECT c.*,a.display_name FROM venue_contributions c JOIN venue_invitations i ON i.token=c.invitation_token JOIN accounts a ON a.id=i.account_id WHERE c.venue_id=? AND c.assessment_version=? AND i.status='confirmed' AND a.suspended=0`).all(id,assessmentVersion??0) as unknown as {requirement_key:string;invitation_token:string;answers:string;completed_at:string;display_name:string}[];
 const approval=getDb().prepare(`SELECT p.approved_at,a.display_name FROM venue_plan_approvals p JOIN venue_invitations i ON i.token=p.invitation_token JOIN accounts a ON a.id=i.account_id WHERE p.venue_id=? AND p.assessment_version=? AND i.kind='director' AND i.status='confirmed' AND a.suspended=0`).get(id,assessmentVersion??0) as {approved_at:string;display_name:string}|undefined;
 const frozen=row?.status==='submitted'||row?.status==='accepted';
 if(!frozen){
 answers['1']={name:venue.responsibleName,phone:venue.responsiblePhone};
 answers['3']=director?{name:director.name,phone:String((getDb().prepare('SELECT phone FROM accounts WHERE id=?').get(director.account_id) as {phone:string})?.phone??''),license:director.licence}:{};
 }

 const files=venueAttachmentsFor(accountId,id);
 const status=row?.status??'draft';
 const point:MapPoint|null=geo.latitude!==null&&geo.longitude!==null?{lat:geo.latitude,lng:geo.longitude}:null;
 const requirements=level?venueRequirements(level as Level,answers,new Set(files.filter(f=>f.hasFile).map(f=>f.docKey))).map(r=>{
 const receipts=contributions.filter(c=>c.requirement_key===String(r.n));
 const clinical=!venueRequirementEditors(r.n,level as Level).includes('organizer')&&r.n!==1&&r.n!==3;
 let done=r.n===3?Boolean(director):r.done;
 if(clinical)done=done&&receipts.length>0;
 if(r.n===2&&level===3)done=done&&Boolean(approval);
 if(r.n===20){const agencies=confirmed.filter(i=>i.kind==='ems');done=agencies.length>0&&agencies.every(i=>receipts.some(c=>c.invitation_token===i.token));}
 // Submitted packages are immutable; older accepted packages retain their recorded completion.
 if(frozen){const h=getDb().prepare('SELECT snapshot FROM venue_package_history WHERE venue_id=? AND revision=?').get(id,row!.revision) as {snapshot:string}|undefined;const old=h?JSON.parse(h.snapshot).requirements?.find((x:{n:number})=>x.n===r.n):null;if(old)done=old.done;}
 return {...r,done,receipts,clinical,awaitingApproval:r.n===2&&level===3&&r.done&&receipts.length>0&&!approval};
 }):[];
 return {venue,status,answers,workRevision:row?.work_revision??0,invitations,contributions,approval,detailsEditing:Boolean(row?.details_editing),assessmentEditing:Boolean(row?.assessment_editing),assessmentVersion,level:level as Level|null,requirements,files,point,district:geo.district,revision:row?.revision??0,note:row?.review_note??'',submittedAt:row?.submitted_at??null,
 editable:venuePackageEditable(status,Boolean(venue.archivedAt)),
 assessmentDone:assessmentVersion!==null,
 detailsDone:Boolean(point&&geo.district&&venue.nameEn&&venue.category&&venue.responsibleName&&venue.responsiblePhone&&venue.licensedCapacity),
 };
}
export function ensureVenuePackage(accountId:number,id:string) {
 const w=venuePackageFor(accountId,id);if(!w)return null;
 getDb().prepare('INSERT OR IGNORE INTO venue_packages(venue_id,assessment_version) VALUES (?,?)').run(id,w.assessmentVersion);
 return w;
}
export function readVenueDetails(form:FormData) {
 const s=(k:string)=>String(form.get(k)??'').trim();const point=readMapPoint(form);const capacity=Number(s('capacity'));
 if(!s('name')||!s('nameAr')||!s('address')||!s('contactName')||!s('contactPhone')||!/^\+?[0-9 ()-]{7,24}$/.test(s('contactPhone'))||!point||!Number.isSafeInteger(capacity)||capacity<=0||!VENUE_TYPES.some(t=>t.key===s('category'))||!VENUE_DISTRICTS.some(d=>d.en===s('district'))||!['yes','no'].includes(s('regularlyHosts'))||!['yes','no'].includes(s('isNightclub'))||(s('category')==='other'&&!s('categoryOther')))return null;
 return {nameEn:s('name'),nameAr:s('nameAr'),address:s('address'),addressAr:s('addressAr')||s('address'),contact:`${s('contactName')} ${s('contactPhone')}`,contactName:s('contactName'),contactPhone:s('contactPhone'),category:s('category')==='other'?s('categoryOther'):s('category'),district:s('district'),capacity,point,regular:s('regularlyHosts')==='yes',nightclub:s('category')==='nightclub'||s('isNightclub')==='yes'};
}
