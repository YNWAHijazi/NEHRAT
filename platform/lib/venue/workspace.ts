import { venueInvitations } from './collaboration';
import { getDb } from '../db';
import { venueById, venueAssessmentsFor, venueAttachmentsFor } from '../queries';
import { venuePackageEditable, type VenuePackageStatus } from '../rules/venue-workflow';
import type { Level } from '../rules';
import { readMapPoint, type MapPoint } from '../rules/geolocation';
import { VENUE_TYPES, VENUE_DISTRICTS, normalizePhone, plausiblePhone } from '../rules/venue-intake';
import { applicationFee, effectiveFlag } from '../rules';
import { capabilityConfigFor, ministryConfig } from '../queries';
import { paymentFor } from '../payments';
import type { VenuePackageFacts } from '../rules/venue-workflow';
import { venueRecordRequirements, type RecordRequirements } from '../record-facts';

/**
 * The venue workspace: the package's lifecycle facts plus the record the resolver
 * derives (lib/record-facts.ts, service 'venue'). Since the single record page the
 * requirement rows, their completion and the plan come from the same catalogue as an
 * event's; this module no longer carries a venue-only field list.
 */
export function venuePackageFor(accountId:number,id:string) {
 const venue=venueById(accountId,id); if(!venue)return null;
 const row=getDb().prepare('SELECT * FROM venue_packages WHERE venue_id=?').get(id) as {status:VenuePackageStatus;assessment_version:number|null;revision:number;submitted_at:string|null;accepted_at:string|null;review_note:string;work_revision:number;details_editing:number;assessment_editing:number}|undefined;
 const geo=getDb().prepare('SELECT district,latitude,longitude FROM venues WHERE id=?').get(id) as {district:string;latitude:number|null;longitude:number|null};
 const versions=venueAssessmentsFor(accountId,id);
 const assessmentVersion=row?row.assessment_version:(versions[0]?.version??null);
 // A venue certified before packages existed has no package row: it is certified, not "in preparation".
 const status:VenuePackageStatus=row?.status??(venue.issued?'accepted':'draft');
 const record:RecordRequirements|null=venueRecordRequirements(accountId,id);
 const level=record?.level??null;
 const invitations=venueInvitations(id);
 const contributions=getDb().prepare(`SELECT c.requirement_key,c.invitation_token,c.answers,c.completed_at,a.display_name FROM venue_contributions c JOIN venue_invitations i ON i.token=c.invitation_token JOIN accounts a ON a.id=i.account_id WHERE c.venue_id=? AND i.status='confirmed' AND a.suspended=0`).all(id) as unknown as {requirement_key:string;invitation_token:string;answers:string;completed_at:string;display_name:string}[];
 const files=venueAttachmentsFor(accountId,id);
 const point:MapPoint|null=geo.latitude!==null&&geo.longitude!==null?{lat:geo.latitude,lng:geo.longitude}:null;
 return {venue,status,record,workRevision:row?.work_revision??0,invitations,contributions,approval:record?.approval??null,detailsEditing:Boolean(row?.details_editing),assessmentEditing:Boolean(row?.assessment_editing),assessmentVersion,level:level as Level|null,files,point,district:geo.district,revision:row?.revision??0,note:row?.review_note??'',submittedAt:row?.submitted_at??null,
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
/** The registration fields, in form order; a refusal names the first one that fails. */
export type VenueDetailField = 'name'|'nameAr'|'category'|'categoryOther'|'district'|'address'|'contactName'|'contactPhone'|'capacity'|'regularlyHosts'|'isNightclub'|'map';
export interface VenueDetails { nameEn:string;nameAr:string;address:string;addressAr:string;contact:string;contactName:string;contactPhone:string;category:string;district:string;capacity:number;point:MapPoint;regular:boolean;nightclub:boolean }
/**
 * Reads the registration form. A refusal names the field (partner report, 8 October
 * 2026: the first page cleared on Continue with nothing said), so the screen can keep
 * what was typed and point at the one thing to fix. The phone accepts Arabic-Indic
 * digits and the separators people actually type; it is stored with Western digits.
 */
export function parseVenueDetails(form:FormData):{value:VenueDetails}|{refused:VenueDetailField} {
 const s=(k:string)=>String(form.get(k)??'').trim();const point=readMapPoint(form);const capacity=Number(s('capacity'));const phone=normalizePhone(s('contactPhone'));
 if(!s('name'))return {refused:'name'};if(!s('nameAr'))return {refused:'nameAr'};
 if(!VENUE_TYPES.some(t=>t.key===s('category')))return {refused:'category'};if(s('category')==='other'&&!s('categoryOther'))return {refused:'categoryOther'};
 if(!VENUE_DISTRICTS.some(d=>d.en===s('district')))return {refused:'district'};if(!s('address'))return {refused:'address'};
 if(!s('contactName'))return {refused:'contactName'};if(!plausiblePhone(phone))return {refused:'contactPhone'};
 if(!Number.isSafeInteger(capacity)||capacity<=0)return {refused:'capacity'};
 if(!['yes','no'].includes(s('regularlyHosts')))return {refused:'regularlyHosts'};if(!['yes','no'].includes(s('isNightclub')))return {refused:'isNightclub'};
 if(!point)return {refused:'map'};
 return {value:{nameEn:s('name'),nameAr:s('nameAr'),address:s('address'),addressAr:s('addressAr')||s('address'),contact:`${s('contactName')} ${phone}`,contactName:s('contactName'),contactPhone:phone,category:s('category')==='other'?s('categoryOther'):s('category'),district:s('district'),capacity,point,regular:s('regularlyHosts')==='yes',nightclub:s('category')==='nightclub'||s('isNightclub')==='yes'}};
}
export function readVenueDetails(form:FormData):VenueDetails|null { const r=parseVenueDetails(form);return 'value' in r?r.value:null; }

export type VenueWorkspace = NonNullable<ReturnType<typeof venuePackageFor>>;

/** The plain facts lib/rules reads to derive the venue's checks, next step and rail -- from the resolver's instances. */
export function venuePackageFacts(w: VenueWorkspace): VenuePackageFacts {
  const config = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
  const fee = applicationFee('registerVenue', null, effectiveFlag('applicationFees', config), capabilityConfigFor('applicationFees'));
  return {
    editable: w.editable,
    status: w.status,
    detailsDone: w.detailsDone && !w.detailsEditing,
    assessmentDone: w.assessmentDone && !w.assessmentEditing,
    level: w.level,
    assessmentVersion: w.assessmentVersion,
    pendingInvitations: w.invitations.filter((i) => i.status === 'nominated').map((i) => ({ name: i.name, token: i.token })),
    medicalTeamLinked: w.invitations.some((i) => ['nominated', 'confirmed'].includes(i.status)),
    requirements: (w.record?.instances ?? []).filter((i) => i.section === 'requirement' && i.group !== 'later').map((i) => ({
      key: i.key, en: i.labelEn, ar: i.labelAr, optional: i.group === 'recommended', done: i.state === 'complete',
      clinical: !i.authors.includes('organizer') && i.authors.length > 0,
      awaitingInvitation: i.state === 'waiting',
    })),
    fee: fee ? { amount: fee.amount, currency: fee.currency, paid: Boolean(paymentFor(w.venue.id, 'registerVenue')) } : null,
    submittedAt: w.submittedAt,
    validUntil: w.venue.validUntil ?? null,
  };
}
