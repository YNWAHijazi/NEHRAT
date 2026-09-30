import Link from 'next/link';
import { L } from './L';
import { facilityDetail, facilityDevices, facilityPersons, facilityPlanConfirmation } from '../lib/queries';
import { facilityPoint, facilityAedStatus } from '../lib/facility-gis';
export type FacilityTab='overview'|'profile'|'devices'|'plan'|'submit'|'incidents';
export function FacilityWorkspaceHeader({facility:f,active}:{facility:NonNullable<ReturnType<typeof facilityDetail>>;active:FacilityTab}) {
 const tabs=[['overview','','Overview','نظرة عامة'],['profile','/profile','Details','التفاصيل'],['devices','/devices','AEDs','الأجهزة'],['plan','/plan','Response plan','خطة الاستجابة'],['submit','/submit','Submit','التقديم'],['incidents','/incidents','Reports','التقارير']];
 return <div data-region="facility-workspace-header" style={{marginBlockEnd:28}}><div data-region="record-header" style={{marginBlockEnd:28}}><div style={{fontSize:13,color:'var(--muted)',marginBlockEnd:12}}>{f.id} · <L en={f.municipalityEn} ar={f.municipalityAr}/></div><h1 style={{fontSize:34,margin:0,overflowWrap:'anywhere'}}><bdi lang="en">{f.nameEn}</bdi>{f.nameAr!==f.nameEn?<bdi lang="ar" style={{display:'block',fontWeight:400,fontSize:24,marginBlockStart:4}}>({f.nameAr})</bdi>:null}</h1></div><nav aria-label="Facility sections" data-region="facility-workspace-nav" style={{display:'flex',flexWrap:'wrap',gap:6,paddingBlockEnd:12,borderBlockEnd:'1px solid var(--line)'}}>{tabs.map(([key,path,en,ar])=><Link key={key} href={`/facilities/${f.id}${path}`} aria-current={active===key?'page':undefined} style={{padding:'10px 16px',borderRadius:8,background:active===key?'var(--brand-soft)':'transparent',color:active===key?'var(--brand)':'var(--muted)',fontWeight:active===key?600:400}}><L en={en!} ar={ar!}/></Link>)}</nav></div>;
}
export function facilityPreparation(id:string) {
 const devices=facilityDevices(id),persons=facilityPersons(id),confirmation=facilityPlanConfirmation(id);
 return [
 {key:'details',en:'Facility map',ar:'خريطة المنشأة',done:Boolean(facilityPoint(id)),href:`/facilities/${id}/profile`},
 {key:'devices',en:'AEDs recorded and available',ar:'الأجهزة مسجّلة ومتاحة',done:(facilityAedStatus(id)!=='required'||devices.length>0)&&devices.every(d=>d.operational&&d.accessibleHours),href:`/facilities/${id}/devices`},
 {key:'persons',en:'Responsible contact',ar:'جهة الاتصال المسؤولة',done:persons.some(p=>p.role==='coordinator'&&p.nameOrPosition&&p.phone&&p.email),href:`/facilities/${id}/plan#persons`},
 {key:'confirmation',en:'Readiness confirmation',ar:'تأكيد الجاهزية',done:Boolean(confirmation?.current),href:`/facilities/${id}/submit`},
 ];
}
export function FacilityProgress({id}:{id:string}) {return <section data-region="facility-progress" style={{padding:24,background:'var(--surface2)',borderRadius:16,marginBlockEnd:28}}><h2 style={{fontSize:18,margin:'0 0 20px'}}><L en="Registration progress" ar="تقدّم التسجيل"/></h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:16}}>{facilityPreparation(id).map(r=><Link key={r.key} href={r.href} style={{borderBlockStart:`3px solid ${r.done?'var(--brand)':'var(--accent-ink)'}`,paddingBlockStart:12}}><small><L en={r.done?'Complete':'Pending'} ar={r.done?'مكتمل':'قيد الانتظار'}/></small><div style={{marginBlockStart:8,fontWeight:600}}><L en={r.en} ar={r.ar}/></div></Link>)}</div></section>;}
