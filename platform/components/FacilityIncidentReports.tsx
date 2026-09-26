import { L } from './L';
import { FACILITY_CONTENT } from '../lib/rules';
export interface FacilityIncidentReport { id:number; created_at:string; payload:string; narrative:string; }
export function FacilityIncidentReports({reports}:{reports:FacilityIncidentReport[]}) {
 const c=FACILITY_CONTENT.incident;
 const labels=[...c.infoFields,...c.immediateResponse,...c.emsAttendance,...c.postIncident,{key:'corrective',en:'Problem and action needed',ar:'المشكلة والإجراء المطلوب'}];
 const answers:Record<string,{en:string;ar:string}>={yes:{en:'Yes',ar:'نعم'},no:{en:'No',ar:'لا'},unknown:{en:'Unknown',ar:'غير معروف'},na:{en:'Not applicable',ar:'غير منطبق'},...Object.fromEntries(c.transportOptions.map(o=>[o.key,{en:o.en,ar:o.ar}]))};
 if(!reports.length)return <p><L en="No incident reports." ar="لا توجد تقارير حوادث."/></p>;
 return <div>{reports.map(r=>{const p=JSON.parse(r.payload) as Record<string,string>;return <details key={r.id} style={{padding:18,border:'1px solid var(--line)',borderRadius:12,marginBlock:12}}><summary><L en={`Report ${r.id} · ${p.date??r.created_at.slice(0,10)}`} ar={`التقرير ${r.id} · ${p.date??r.created_at.slice(0,10)}`}/></summary><dl>{labels.filter(f=>p[f.key]).map(f=><div key={f.key} style={{marginBlock:14}}><dt><L en={f.en} ar={f.ar}/></dt><dd style={{marginInlineStart:0,color:'var(--muted)'}}>{answers[p[f.key]??'']?<L {...answers[p[f.key]!]!}/>:p[f.key]}</dd></div>)}</dl>{r.narrative?<p>{r.narrative}</p>:null}<p><L en={`Submitted ${r.created_at}`} ar={`قُدّم ${r.created_at}`}/></p></details>})}</div>;
}
