'use client';
import { OptionText } from '../../../components/OptionText';
import { VENUE_CAPACITY_FIELD, VENUE_ELIGIBILITY_QUESTIONS } from '../../../lib/rules';
import { useState } from 'react';
import { L } from '../../../components/L';
import { LocationPicker } from '../../../components/maps/LocationPicker';
import { YesNoPair } from '../../../components/YesNoPair';
import { registerVenueAction } from '../../actions';
import { saveVenueDetailsAction } from '../actions';
import { VENUE_TYPES, VENUE_DISTRICTS } from '../../../lib/rules/venue-intake';
import type { MapPoint } from '../../../lib/rules/geolocation';
import type { VenueDetail } from '../../../lib/queries';
const input:React.CSSProperties={width:'100%',minHeight:44,padding:'10px 12px',border:'1px solid var(--line)',borderRadius:8,background:'var(--bg)',fontSize:15};
export function RegisterVenueForm({fields:unused,initial,point=null,district='',locked=false}:{fields?:unknown[];initial?:VenueDetail;point?:MapPoint|null;district?:string;locked?:boolean}){
 const [pin,setPin]=useState(point);const [regular,setRegular]=useState<boolean|null>(initial?.regularlyHosts??null);const [nightclub,setNightclub]=useState<boolean|null>(initial?.isNightclub??null);
 const known=VENUE_TYPES.some(t=>t.key===initial?.category);const [category,setCategory]=useState(initial?known?initial.category:'other':'');
 const text=(name:string,en:string,ar:string,value='',required=true)=><label style={{display:'grid',gap:6}} key={name}><L en={en} ar={ar}/><input name={name} defaultValue={value} required={required} style={input} dir={name.endsWith('Ar')?'rtl':undefined}/></label>;
 return <form action={initial?saveVenueDetailsAction.bind(null,initial.id):registerVenueAction}>
 <fieldset disabled={locked} style={{border:0,padding:0,margin:0,minWidth:0}}>
 <div data-region="registration-form" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,240px),1fr))',gap:20}}>
 {text('name','Venue name (English)','اسم الموقع (بالإنكليزية)',initial?.nameEn)}{text('nameAr','Venue name (Arabic)','اسم الموقع (بالعربية)',initial?.nameAr)}
 <label style={{display:'grid',gap:6}}><L en="Venue type" ar="نوع الموقع"/><select name="category" value={category} onChange={e=>{setCategory(e.target.value);if(e.target.value==='nightclub')setNightclub(true);}} required style={input}><option value=""></option>{VENUE_TYPES.map(t=><option key={t.key} value={t.key}><OptionText en={t.en} ar={t.ar} /></option>)}</select></label>
 {category==='other'?text('categoryOther','Specify venue type','حدّد نوع الموقع',known?'':initial?.category):null}
 <label style={{display:'grid',gap:6}}><L en="District" ar="القضاء"/><select name="district" defaultValue={district} required style={input}><option value=""></option>{VENUE_DISTRICTS.map(d=><option key={d.en} value={d.en}><OptionText en={d.en} ar={d.ar} /></option>)}</select></label>
 {text('address','Town and street address','البلدة وعنوان الشارع',initial?.addressMunicipalityEn)}{text('addressAr','Address (Arabic, optional)','العنوان (بالعربية، اختياري)',initial?.addressMunicipalityAr,false)}
 {text('contactName','Responsible person','الشخص المسؤول',initial?.responsibleName || initial?.responsibleContact)}{text('contactPhone','Phone number','رقم الهاتف',initial?.responsiblePhone)}
 <label style={{display:'grid',gap:6}}><L en={VENUE_CAPACITY_FIELD.en} ar={VENUE_CAPACITY_FIELD.ar}/><input style={input} name="capacity" type="number" min="1" step="1" required defaultValue={initial?.licensedCapacity??''}/></label>
 </div>
 <div style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'center',marginBlock:24}}><L en={VENUE_ELIGIBILITY_QUESTIONS.regularlyHosts.en} ar={VENUE_ELIGIBILITY_QUESTIONS.regularlyHosts.ar}/><YesNoPair value={regular} onPick={setRegular}/><input type="hidden" name="regularlyHosts" value={regular===null?'':regular?'yes':'no'}/></div>
 <div style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'center',marginBlock:24}}><L en={VENUE_ELIGIBILITY_QUESTIONS.nightclub.en} ar={VENUE_ELIGIBILITY_QUESTIONS.nightclub.ar}/><YesNoPair value={nightclub} onPick={setNightclub}/><input type="hidden" name="isNightclub" value={nightclub===null?'':nightclub?'yes':'no'}/></div>
 {!locked?<LocationPicker initial={point} onChange={setPin}/>:point?<p><L en="Confirmed map location" ar="الموقع المؤكّد على الخريطة"/>: <a href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=17/${point.lat}/${point.lng}`} target="_blank" rel="noreferrer"><L en="View map" ar="عرض الخريطة"/></a></p>:null}
 {!locked?<button type="submit" disabled={!pin||regular===null||nightclub===null} style={{padding:'12px 24px',border:0,borderRadius:24,background:'var(--brand)',color:'var(--bg)'}}><L en="Continue to assessment" ar="المتابعة إلى التقييم"/></button>:null}
 </fieldset></form>;
}
