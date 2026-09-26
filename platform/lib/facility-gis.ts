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

export function facilityAedDecisions(id:string):{requirement:string;reason:string;created_at:string;actor:string}[] {
 return getDb().prepare('SELECT d.requirement,d.reason,d.created_at,a.display_name AS actor FROM facility_aed_decisions d LEFT JOIN accounts a ON a.id=d.actor_id WHERE d.facility_id=? ORDER BY d.id DESC').all(id) as unknown as {requirement:string;reason:string;created_at:string;actor:string}[];
}
