import { MinistryShell } from '../../../../components/MinistryShell';
import { L } from '../../../../components/L';
import { FacilityMap } from '../../../../components/maps/FacilityMap';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { facilityMapRecords } from '../../../../lib/facility-gis';
export default async function MapPage(){const account=await requireMinistryPage('viewFacilityLane');const rows=facilityMapRecords(account.isDemo);
 return <MinistryShell account={account} back={{href:'/ministry/facilities',en:'Facilities',ar:'المنشآت'}}><h1><L en="Facilities and AEDs" ar="المنشآت وأجهزة إزالة الرجفان"/></h1><FacilityMap records={rows}/><p><L en="Locations are confirmed by the facility. AEDs without a separate pin use the facility location." ar="تؤكّد المنشأة المواقع. تستخدم الأجهزة التي لا تحمل علامة منفصلة موقع المنشأة."/></p><a href="/api/facilities/geojson"><L en="Download map data" ar="تنزيل بيانات الخريطة"/></a><ul>{rows.map(r=><li key={r.id} style={{marginBlock:12}}>{r.id} · {r.name} · {r.point?<L en="Location recorded" ar="الموقع مسجّل"/>:<L en="Map pin needed" ar="موقع الخريطة مطلوب"/>}</li>)}</ul></MinistryShell>;
}
