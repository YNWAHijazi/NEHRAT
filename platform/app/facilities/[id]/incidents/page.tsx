import { redirect,notFound } from 'next/navigation';
import { currentAccount,organizationFor } from '../../../../lib/auth';
import { facilityDetail,unreadCountFor } from '../../../../lib/queries';
import { getDb } from '../../../../lib/db';
import { GovernmentBand,Header } from '../../../../components/Header';
import { FacilityIncidentReports,type FacilityIncidentReport } from '../../../../components/FacilityIncidentReports';
import { L } from '../../../../components/L';
export default async function Reports({params}:{params:Promise<{id:string}>}) {const a=await currentAccount();if(!a)redirect('/signin');const {id}=await params;const f=facilityDetail(a.id,id);if(!f)notFound();const reports=getDb().prepare('SELECT id,payload,narrative,created_at FROM facility_incidents WHERE facility_id=? ORDER BY id DESC').all(id) as unknown as FacilityIncidentReport[];
return <><GovernmentBand/><Header account={a} organization={organizationFor(a.id)} unreadCount={unreadCountFor(a.id)} showBack back={{href:`/facilities/${id}`,en:'Facility record',ar:'سجل المنشأة'}}/><main data-pad="" style={{maxWidth:900,marginInline:'auto',padding:32}}><h1><L en="Incident reports" ar="تقارير الحوادث"/></h1><p>{f.nameEn}</p><FacilityIncidentReports reports={reports}/></main></>;}
