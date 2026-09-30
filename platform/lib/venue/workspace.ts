import { getDb } from '../db';
import { venueById, venueAssessmentsFor, venueAttachmentsFor } from '../queries';
import { venuePackageEditable, venueRequirements, type VenueAnswers, type VenuePackageStatus } from '../rules/venue-workflow';
import type { Level } from '../rules';
import { readMapPoint, type MapPoint } from '../rules/geolocation';
import { VENUE_TYPES, VENUE_DISTRICTS } from '../rules/venue-intake';

export function venuePackageFor(accountId:number,id:string) {
 const venue=venueById(accountId,id); if(!venue)return null;
 const row=getDb().prepare('SELECT * FROM venue_packages WHERE venue_id=?').get(id) as {status:VenuePackageStatus;answers:string;assessment_version:number|null;revision:number;submitted_at:string|null;accepted_at:string|null;review_note:string}|undefined;
 const geo=getDb().prepare('SELECT district,latitude,longitude FROM venues WHERE id=?').get(id) as {district:string;latitude:number|null;longitude:number|null};
 const versions=venueAssessmentsFor(accountId,id);
 const assessmentVersion=row?row.assessment_version:(versions[0]?.version??null);
 const level=assessmentVersion?versions.find(v=>v.version===assessmentVersion)?.derivation.finalLevel??null:null;
 const answers:VenueAnswers=row?JSON.parse(row.answers):{};
 const files=venueAttachmentsFor(accountId,id);
 const status=row?.status??'draft';
 const point:MapPoint|null=geo.latitude!==null&&geo.longitude!==null?{lat:geo.latitude,lng:geo.longitude}:null;
 const requirements=level?venueRequirements(level as Level,answers,new Set(files.filter(f=>f.hasFile).map(f=>f.docKey))):[];
 return {venue,status,answers,assessmentVersion,level:level as Level|null,requirements,files,point,district:geo.district,revision:row?.revision??0,note:row?.review_note??'',submittedAt:row?.submitted_at??null,
 editable:venuePackageEditable(status,Boolean(venue.archivedAt)),
 assessmentDone:assessmentVersion!==null,
 detailsDone:Boolean(point&&geo.district&&venue.nameEn&&venue.category&&venue.responsibleContact&&venue.licensedCapacity),
 };
}
export function ensureVenuePackage(accountId:number,id:string) {
 const w=venuePackageFor(accountId,id);if(!w)return null;
 getDb().prepare('INSERT OR IGNORE INTO venue_packages(venue_id,assessment_version) VALUES (?,?)').run(id,w.assessmentVersion);
 return w;
}
export function readVenueDetails(form:FormData) {
 const s=(k:string)=>String(form.get(k)??'').trim();const point=readMapPoint(form);const capacity=Number(s('capacity'));
 if(!s('name')||!s('nameAr')||!s('address')||!s('contact')||!point||!Number.isSafeInteger(capacity)||capacity<=0||!VENUE_TYPES.some(t=>t.key===s('category'))||!VENUE_DISTRICTS.some(d=>d.en===s('district'))||!['yes','no'].includes(s('regularlyHosts'))||!['yes','no'].includes(s('isNightclub'))||(s('category')==='other'&&!s('categoryOther')))return null;
 return {nameEn:s('name'),nameAr:s('nameAr'),address:s('address'),addressAr:s('addressAr')||s('address'),contact:s('contact'),category:s('category')==='other'?s('categoryOther'):s('category'),district:s('district'),capacity,point,regular:s('regularlyHosts')==='yes',nightclub:s('category')==='nightclub'||s('isNightclub')==='yes'};
}
