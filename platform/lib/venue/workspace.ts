import { venueInvitations } from './collaboration';
import { venueRequirementIsClinical, venueLocalEmsContactApplies } from '../rules/venue-workflow';
import { getDb } from '../db';
import { venueById, venueAssessmentsFor, venueAttachmentsFor } from '../queries';
import { venuePackageEditable, venueRequirements, type VenueAnswers, type VenuePackageStatus } from '../rules/venue-workflow';
import type { Level } from '../rules';
import { readMapPoint, type MapPoint } from '../rules/geolocation';
import { VENUE_TYPES, VENUE_DISTRICTS } from '../rules/venue-intake';
import { applicationFee, effectiveFlag } from '../rules';
import { capabilityConfigFor, ministryConfig } from '../queries';
import { paymentFor } from '../payments';
import { venueRowAwaitsInvitation, type VenuePackageFacts } from '../rules/venue-workflow';

export function venuePackageFor(accountId:number,id:string) {
 const venue=venueById(accountId,id); if(!venue)return null;
 const row=getDb().prepare('SELECT * FROM venue_packages WHERE venue_id=?').get(id) as {status:VenuePackageStatus;answers:string;assessment_version:number|null;revision:number;submitted_at:string|null;accepted_at:string|null;review_note:string;work_revision:number;details_editing:number;assessment_editing:number}|undefined;
 const geo=getDb().prepare('SELECT district,latitude,longitude FROM venues WHERE id=?').get(id) as {district:string;latitude:number|null;longitude:number|null};
 const versions=venueAssessmentsFor(accountId,id);
 const assessmentVersion=row?row.assessment_version:(versions[0]?.version??null);
 // A venue certified before packages existed has no package row: it is certified, not "in preparation".
 const status:VenuePackageStatus=row?.status??(venue.issued?'accepted':'draft');
 // A certified venue's level is the level written on its certificate (venues.level, set when the
 // Ministry accepted the package). Re-deriving old answers must not silently change an issued certificate.
 const derivedLevel=assessmentVersion?versions.find(v=>v.version===assessmentVersion)?.derivation.finalLevel??null:null;
 const level=status==='accepted'&&venue.level?venue.level:derivedLevel;
 const answers:VenueAnswers=row?JSON.parse(row.answers):{};
 const invitations=venueInvitations(id);
 const confirmed=invitations.filter(i=>i.status==='confirmed'&&i.active);
 const director=confirmed.find(i=>i.kind==='director'&&i.licence);
 const contributions=getDb().prepare(`SELECT c.*,a.display_name FROM venue_contributions c JOIN venue_invitations i ON i.token=c.invitation_token JOIN accounts a ON a.id=i.account_id WHERE c.venue_id=? AND c.assessment_version=? AND i.status='confirmed' AND a.suspended=0`).all(id,assessmentVersion??0) as unknown as {requirement_key:string;invitation_token:string;answers:string;completed_at:string;display_name:string}[];
 const approval=getDb().prepare(`SELECT p.approved_at,a.display_name FROM venue_plan_approvals p JOIN venue_invitations i ON i.token=p.invitation_token JOIN accounts a ON a.id=i.account_id WHERE p.venue_id=? AND p.assessment_version=? AND i.kind='director' AND i.status='confirmed' AND a.suspended=0`).get(id,assessmentVersion??0) as {approved_at:string;display_name:string}|undefined;
 const frozen=row?.status==='submitted'||row?.status==='accepted';
 if(!frozen){
 answers['1']={name:venue.responsibleName,phone:venue.responsiblePhone};
 answers['3']=director?{name:director.name,phone:director.phone,license:director.licence}:{};
 const agencies=confirmed.filter(i=>i.kind==='ems');
 // Invitation identity is the only source of agency/contact details when a team is linked.
 const linkedEms=invitations.some(i=>i.kind==='ems'&&['nominated','confirmed'].includes(i.status));
 if(!venueLocalEmsContactApplies(level as Level|null,linkedEms)){
 const agency=agencies.map(i=>i.name).join('\n'),phone=agencies.map(i=>i.phone).join('\n');
 answers['7']={...answers['7'],agency,phone};
 }
 answers['5']={...answers['5'],agency:agencies.map(i=>i.name).join('\n'),contact:agencies.map(i=>`${i.name} · ${i.phone}`).join('\n')};
 answers['15']={...answers['15'],lead:director?.name??''};
 const author=contributions.find(c=>c.requirement_key==='2');
 answers['2']={...answers['2'],preparedBy:author?.display_name??''};
 answers['20']={...answers['20'],agencies:agencies.map(i=>i.name).join('\n')};
 }

 const files=venueAttachmentsFor(accountId,id);
 const point:MapPoint|null=geo.latitude!==null&&geo.longitude!==null?{lat:geo.latitude,lng:geo.longitude}:null;
 const requirements=level?venueRequirements(level as Level,answers,new Set(files.filter(f=>f.hasFile).map(f=>f.docKey))).map(r=>{
 const receipts=contributions.filter(c=>c.requirement_key===String(r.n));
 const clinical=venueRequirementIsClinical(r.n,level as Level);
 let done=r.n===3?Boolean(director):r.done;
 if(clinical)done=done&&receipts.length>0;
 if(String(r.n)==='7'&&level===1)done=r.done&&(confirmed.some(i=>i.kind==='ems')||answers['7']?.localConfirmed==='yes');
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
 // The same conditions, named, so the details screen can say which ones are missing.
 detailsMissing:([
  [venue.nameEn,'Venue name','اسم الموقع'],[venue.category,'Venue type','نوع الموقع'],[geo.district,'District','القضاء'],
  [venue.responsibleName,'Responsible person','الشخص المسؤول'],[venue.responsiblePhone,'Phone number','رقم الهاتف'],
  [venue.licensedCapacity,'Approved or licensed capacity','السعة المعتمدة أو المرخّصة'],[point,'Map pin','علامة الخريطة'],
 ] as const).filter(([value])=>!value).map(([,en,ar])=>({en,ar})),
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

export type VenueWorkspace = NonNullable<ReturnType<typeof venuePackageFor>>;

/** The plain facts lib/rules reads to derive the venue's checks, next step and rail. */
export function venuePackageFacts(w: VenueWorkspace): VenuePackageFacts {
  const config = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
  const fee = applicationFee('registerVenue', null, effectiveFlag('applicationFees', config), capabilityConfigFor('applicationFees'));
  const nominated = {
    director: w.invitations.some((i) => i.kind === 'director' && i.status === 'nominated'),
    ems: w.invitations.some((i) => i.kind === 'ems' && i.status === 'nominated'),
  };
  return {
    editable: w.editable,
    status: w.status,
    detailsDone: w.detailsDone && !w.detailsEditing,
    assessmentDone: w.assessmentDone && !w.assessmentEditing,
    level: w.level,
    assessmentVersion: w.assessmentVersion,
    pendingInvitations: w.invitations.filter((i) => i.status === 'nominated').map((i) => ({ name: i.name, token: i.token })),
    medicalTeamLinked: w.invitations.some((i) => ['nominated', 'confirmed'].includes(i.status)),
    requirements: w.requirements.map((r) => ({
      n: r.n, en: r.en, ar: r.ar, optional: r.optional, done: r.done, clinical: r.clinical,
      awaitingInvitation: !r.done && venueRowAwaitsInvitation(r.n, w.level, nominated),
    })),
    fee: fee ? { amount: fee.amount, currency: fee.currency, paid: Boolean(paymentFor(w.venue.id, 'registerVenue')) } : null,
    submittedAt: w.submittedAt,
    validUntil: w.venue.validUntil ?? null,
  };
}
