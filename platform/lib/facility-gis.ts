import { randomBytes } from 'node:crypto';
import { facilityAedRequirement } from './rules/facility-intake';
import { beirutToday } from './clock';
import { getDb } from './db';
import { validMapPoint, type MapPoint } from './rules/geolocation';
export function facilityPoint(id: string): MapPoint | null {
  const row=getDb().prepare('SELECT latitude AS lat, longitude AS lng FROM facilities WHERE id=?').get(id);
  return validMapPoint(row)?{lat:row.lat,lng:row.lng}:null;
}
export function devicePoint(id: string,label: string): { point: MapPoint | null; separate: boolean } {
  const row=getDb().prepare('SELECT latitude AS lat,longitude AS lng FROM facility_devices WHERE facility_id=? AND label=?').get(id,label);
  return validMapPoint(row)?{point:{lat:row.lat,lng:row.lng},separate:true}:{point:facilityPoint(id),separate:false};
}
export function facilitySnapshot(id: string): string {
  const db=getDb();return JSON.stringify({facility:db.prepare('SELECT * FROM facilities WHERE id=?').get(id),people:db.prepare('SELECT * FROM facility_persons WHERE facility_id=?').all(id),devices:db.prepare('SELECT * FROM facility_devices WHERE facility_id=? ORDER BY label').all(id)});
}
export function bumpFacilityRevision(id: string) { getDb().prepare('UPDATE facilities SET details_revision=details_revision+1 WHERE id=?').run(id); }
export interface FacilityMapRecord { id:string;name:string;category:string;point:MapPoint|null;devices:{label:string;point:MapPoint|null;separate:boolean;operational:boolean;publiclyAccessible:boolean}[] }
/** Ministry-only callers must authorize before asking. SQL enforces the demo boundary. */
export function facilityMapRecords(isDemo:boolean):FacilityMapRecord[] {
 const db=getDb();const rows=db.prepare('SELECT id,name_en,category_key FROM facilities WHERE is_demo=? AND archived_at IS NULL ORDER BY name_en').all(Number(isDemo)) as unknown as {id:string;name_en:string;category_key:string}[];
 return rows.map(f=>({id:f.id,name:f.name_en,category:f.category_key,point:facilityPoint(f.id),devices:(db.prepare('SELECT label,operational,publicly_accessible FROM facility_devices WHERE facility_id=?').all(f.id) as unknown as {label:string;operational:number;publicly_accessible:number}[]).map(d=>({label:d.label,...devicePoint(f.id,d.label),operational:d.operational===1,publiclyAccessible:d.publicly_accessible===1}))}));
}

export function facilityAedStatus(id:string):'required'|'notRequired'|'review' {
 const db=getDb();const f=db.prepare('SELECT category_key,facility_type,licensed_capacity FROM facilities WHERE id=?').get(id) as {category_key:string;facility_type:string;licensed_capacity:number|null}|undefined;
 if(!f)return 'review';
 const decision=db.prepare('SELECT requirement FROM facility_aed_decisions WHERE facility_id=? ORDER BY id DESC LIMIT 1').get(id) as {requirement:string}|undefined;
 const threshold=db.prepare("SELECT value,effective FROM ministry_config WHERE key='capacityThreshold'").get() as {value:string;effective:string|null}|undefined;
 const number=threshold && (!threshold.effective||threshold.effective<=beirutToday())?Number(threshold.value):NaN;
 return facilityAedRequirement({category:f.category_key,type:f.facility_type,capacity:f.licensed_capacity,threshold:Number.isFinite(number)?number:null,decision:decision?.requirement});
}

/** The current photo of an installed AED: its metadata, never the bytes (the serving route reads those). */
export function devicePhotoMeta(id:string,label:string):{fileName:string;contentType:string;byteSize:number;uploadedAt:string}|null {
 const row=getDb().prepare('SELECT file_name,content_type,byte_size,uploaded_at FROM facility_device_photos WHERE facility_id=? AND label=? AND bytes IS NOT NULL').get(id,label) as {file_name:string;content_type:string;byte_size:number;uploaded_at:string}|undefined;
 return row?{fileName:row.file_name,contentType:row.content_type,byteSize:row.byte_size,uploadedAt:row.uploaded_at}:null;
}

/**
 * The certificate's verification token (non-negotiable 5b): unguessable, minted once,
 * never the sequential record id. Minted lazily, the first time the completed
 * certificate is rendered, so an incomplete registration never has one to verify.
 */
export function ensureFacilityCertificateToken(id:string):string {
 const db=getDb();const row=db.prepare('SELECT certificate_token FROM facilities WHERE id=?').get(id) as {certificate_token:string|null}|undefined;
 if(row?.certificate_token)return row.certificate_token;
 const token=randomBytes(24).toString('hex');db.prepare('UPDATE facilities SET certificate_token=? WHERE id=? AND certificate_token IS NULL').run(token,id);
 return (db.prepare('SELECT certificate_token FROM facilities WHERE id=?').get(id) as {certificate_token:string}).certificate_token;
}

export interface FacilityCertificateFacts { id:string;nameEn:string;nameAr:string;categoryKey:string;registeredOn:string;archivedAt:string|null;isDemo:boolean }
/** What a certificate states, by token. Demonstration records never resolve publicly (lib/rules/scope.ts). */
export function facilityByCertificateToken(token:string):FacilityCertificateFacts|null {
 if(!/^[a-f0-9]{48}$/.test(token))return null;
 const r=getDb().prepare('SELECT id,name_en,name_ar,category_key,created_at,archived_at,is_demo FROM facilities WHERE certificate_token=?').get(token) as {id:string;name_en:string;name_ar:string;category_key:string;created_at:string;archived_at:string|null;is_demo:number}|undefined;
 return r?{id:r.id,nameEn:r.name_en,nameAr:r.name_ar,categoryKey:r.category_key,registeredOn:r.created_at.slice(0,10),archivedAt:r.archived_at,isDemo:r.is_demo===1}:null;
}

export function facilityAedDecisions(id:string):{requirement:string;reason:string;created_at:string;actor:string}[] {
 return getDb().prepare('SELECT d.requirement,d.reason,d.created_at,a.display_name AS actor FROM facility_aed_decisions d LEFT JOIN accounts a ON a.id=d.actor_id WHERE d.facility_id=? ORDER BY d.id DESC').all(id) as unknown as {requirement:string;reason:string;created_at:string;actor:string}[];
}
