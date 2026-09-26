import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { getDb } from '../../../../lib/db';
import { MinistryShell } from '../../../../components/MinistryShell';
import { L } from '../../../../components/L';
import { FacilityIncidentReports,type FacilityIncidentReport } from '../../../../components/FacilityIncidentReports';
export default async function Reports({searchParams}:{searchParams:Promise<{facility?:string}>}){const a=await requireMinistryPage('viewFacilityLane');const q=await searchParams;const rows=getDb().prepare(`SELECT i.id,i.payload,i.narrative,i.created_at,f.name_en,f.id AS facility_id FROM facility_incidents i JOIN facilities f ON f.id=i.facility_id WHERE f.is_demo=? AND (?='' OR f.id=?) ORDER BY i.id DESC`).all(Number(a.isDemo),q.facility??'',q.facility??'') as unknown as (FacilityIncidentReport & {name_en:string;facility_id:string})[];
return <MinistryShell account={a} back={{href:'/ministry/facilities',en:'Facilities',ar:'المنشآت'}}><h1><L en="Facility incident reports" ar="تقارير حوادث المنشآت"/></h1>{rows.length?rows.map(r=><section key={r.id}><h2>{r.facility_id} · {r.name_en}</h2><FacilityIncidentReports reports={[r]}/></section>):<p><L en="No incident reports." ar="لا توجد تقارير حوادث."/></p>}</MinistryShell>;}
