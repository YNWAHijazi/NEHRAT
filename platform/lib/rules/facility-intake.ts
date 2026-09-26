import { detectPersonalName } from './pii';
export function facilityIncidentError(p:Record<string,string>,today:string):'name-detected'|'incomplete'|'invalid-date'|null {
 if(detectPersonalName(p.corrective??'')||detectPersonalName(p.narrative??''))return 'name-detected';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date??'')||!Number.isFinite(Date.parse(p.date!))||new Date(p.date!).toISOString().slice(0,10)!==p.date||p.date!>today)return 'invalid-date';
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time??'')||!p.location?.trim())return 'incomplete';
 const sets:Record<string,string[]>={emsContacted:['yes','no','unknown'],cprStarted:['yes','no','unknown'],aedAvailable:['yes','no'],aedApplied:['yes','no','unknown'],shock:['yes','no','unknown'],guided:['yes','no','na'],emsAttended:['yes','no','unknown'],transportedBy:['ems','private','other','none','unknown'],returned:['yes','no','na'],problem:['yes','no']};
 for(const [k,values]of Object.entries(sets))if(!values.includes(p[k]??''))return 'incomplete';
 if(p.problem==='yes'&&!p.corrective?.trim())return 'incomplete';
 return null;
}

export const TRANSPORT_FACILITY_TYPES=[
 {key:'airport',en:'Airport',ar:'مطار'}, {key:'port',en:'Passenger port',ar:'مرفأ ركاب'},
 {key:'terminal',en:'Central transport terminal',ar:'محطة نقل مركزية'}, {key:'mall',en:'Shopping mall',ar:'مركز تسوّق'},
 {key:'publicVenue',en:'Public venue',ar:'مكان عام'},
];
export function facilityAedRequirement(f:{category:string;type:string;capacity:number|null;threshold:number|null;decision?:string|undefined}):'required'|'notRequired'|'review' {
 if(f.category==='sports')return 'required';
 if(f.category==='transport' && ['airport','port','terminal','mall'].includes(f.type))return 'required';
 if(f.category==='transport'&&f.type==='publicVenue'&&f.capacity!==null&&f.threshold!==null&&f.capacity>f.threshold)return 'required';
 if(f.decision==='required'||f.decision==='notRequired')return f.decision;
 if(f.category==='transport'&&f.type==='publicVenue'&&f.capacity!==null&&f.threshold!==null)return f.capacity>f.threshold?'required':'notRequired';
 return 'review';
}
