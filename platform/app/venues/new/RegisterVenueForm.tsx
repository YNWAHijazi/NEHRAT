'use client';
import { OptionText } from '../../../components/OptionText';
import { VENUE_CAPACITY_FIELD, VENUE_ELIGIBILITY_QUESTIONS } from '../../../lib/rules';
import { useEffect, useState, useTransition } from 'react';
import { L } from '../../../components/L';
import { LocationPicker } from '../../../components/maps/LocationPicker';
import { YesNoPair } from '../../../components/YesNoPair';
import { registerVenueAction, type VenueFormState } from '../../actions';
import { saveVenueDetailsAction } from '../actions';
import { VENUE_TYPES, VENUE_DISTRICTS } from '../../../lib/rules/venue-intake';
import type { MapPoint } from '../../../lib/rules/geolocation';
import type { VenueDetail } from '../../../lib/queries';
import { VenueAssessmentForm } from '../[id]/assessment/VenueAssessmentForm';
import type { Band, Domain, MinimumCondition } from '../../../lib/rules/load';

/** The assessment's data, passed from the server page so the registration carries the assessment on the same page. */
export interface RegistrationAssessment { domains: Domain[]; conditions: MinimumCondition[]; bands: Band[]; maxScore: number; triggers: { en: string; ar: string }[] }
const input:React.CSSProperties={width:'100%',minHeight:44,padding:'10px 12px',border:'1px solid var(--line)',borderRadius:8,background:'var(--bg)',fontSize:15};
const refusedInput:React.CSSProperties={...input,border:'1px solid var(--bad)'};

/** What a refusal says, by the field it names (lib/venue/workspace parseVenueDetails). */
const REASONS:Record<string,{en:string;ar:string}>={
 name:{en:'Enter the venue name in English.',ar:'أدخلوا اسم الموقع بالإنكليزية.'},
 nameAr:{en:'Enter the venue name in Arabic.',ar:'أدخلوا اسم الموقع بالعربية.'},
 category:{en:'Choose the venue type.',ar:'اختاروا نوع الموقع.'},
 categoryOther:{en:'Specify the venue type.',ar:'حدّدوا نوع الموقع.'},
 district:{en:'Choose the district.',ar:'اختاروا القضاء.'},
 address:{en:'Enter the town and street address.',ar:'أدخلوا البلدة وعنوان الشارع.'},
 contactName:{en:'Enter the name of the responsible person.',ar:'أدخلوا اسم الشخص المسؤول.'},
 contactPhone:{en:'Enter a telephone number in digits, for example +961 3 123 456.',ar:'أدخلوا رقم هاتف بالأرقام، مثلاً +961 3 123 456.'},
 capacity:{en:'Enter the licensed capacity as a whole number.',ar:'أدخلوا السعة المرخّصة رقماً صحيحاً.'},
 regularlyHosts:{en:'Answer Yes or No to the question about hosting events.',ar:'أجيبوا بنعم أو لا عن سؤال استضافة الفعاليات.'},
 isNightclub:{en:'Answer Yes or No to the question about the nightclub or dance venue.',ar:'أجيبوا بنعم أو لا عن سؤال الملهى الليلي أو مكان الرقص.'},
 map:{en:'Choose the location on the map and confirm the pin.',ar:'اختاروا الموقع على الخريطة وأكّدوا العلامة.'},
 assessment:{en:'Answer every assessment question and the attendance figure, and name the authorized representative and position.',ar:'أجيبوا عن جميع أسئلة التقييم ورقم الحضور، وسمّوا الممثل المفوّض وصفته.'},
};

/**
 * The venue's identity fields and, on registration, the annual assessment below them on
 * the same page -- the event's one-page intake (owner, 8 October 2026). Everything typed
 * stays on the screen when the server refuses the form: the refusal names the field, the
 * message sits beside it and it takes focus.
 */
export function RegisterVenueForm({fields:unused,initial,point=null,district='',locked=false,assessment=null}:{fields?:unknown[];initial?:VenueDetail;point?:MapPoint|null;district?:string;locked?:boolean;assessment?:RegistrationAssessment|null}){
 const [assessed,setAssessed]=useState(false);
 const [pin,setPin]=useState(point);const [regular,setRegular]=useState<boolean|null>(initial?.regularlyHosts??null);const [nightclub,setNightclub]=useState<boolean|null>(initial?.isNightclub??null);
 const known=VENUE_TYPES.some(t=>t.key===initial?.category);const [category,setCategory]=useState(initial?known?initial.category:'other':'');
 const [districtValue,setDistrict]=useState(district);
 const [values,setValues]=useState<Record<string,string>>({name:initial?.nameEn??'',nameAr:initial?.nameAr??'',categoryOther:known?'':initial?.category??'',address:initial?.addressMunicipalityEn??'',addressAr:initial?.addressMunicipalityAr??'',contactName:initial?.responsibleName||initial?.responsibleContact||'',contactPhone:initial?.responsiblePhone??'',capacity:initial?.licensedCapacity?String(initial.licensedCapacity):''});
 const action=initial?saveVenueDetailsAction.bind(null,initial.id):registerVenueAction;
 // Submitted by hand rather than through the form's action: React resets a form after an
 // action completes, and a controlled select loses its choice in that reset.
 const [state,setState]=useState<VenueFormState>(null);const [pending,start]=useTransition();
 const submit=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const data=new FormData(e.currentTarget);start(async()=>{setState(await action(null,data));});};
 const refused=state?.refused??null;
 useEffect(()=>{if(!refused||pending)return;const el=document.querySelector<HTMLElement>(`[data-region="registration-form"] [name="${refused}"], [data-refused-anchor="${refused}"]`);el?.focus();el?.scrollIntoView({block:'center'});},[refused,state,pending]);
 const reason=(name:string)=>refused===name?<span data-region="field-reason" role="alert" style={{fontSize:'13.5px',color:'var(--bad)'}}><L en={REASONS[name]!.en} ar={REASONS[name]!.ar}/></span>:null;
 const text=(name:string,en:string,ar:string,required=true,type='text')=><label style={{display:'grid',gap:6}} key={name}><L en={en} ar={ar}/><input name={name} type={type} inputMode={type==='tel'?'tel':undefined} value={values[name]??''} onChange={e=>setValues(v=>({...v,[name]:e.target.value}))} required={required} aria-invalid={refused===name||undefined} style={refused===name?refusedInput:input} dir={name.endsWith('Ar')?'rtl':undefined}/>{reason(name)}</label>;
 return <form onSubmit={submit}>
 <fieldset disabled={locked||pending} style={{border:0,padding:0,margin:0,minWidth:0}}>
 {refused?<p data-region="registration-refused" role="alert" style={{margin:'0 0 18px',padding:'12px 16px',border:'1px solid var(--bad)',borderRadius:10,fontSize:'14.5px',lineHeight:1.55}}><L en="The venue was not saved. One field needs attention:" ar="لم يُحفظ الموقع. حقل واحد يحتاج إلى مراجعة:"/> <L en={REASONS[refused]?.en??''} ar={REASONS[refused]?.ar??''}/></p>:null}
 <div data-region="registration-form" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,240px),1fr))',gap:20}}>
 {text('name','Venue name (English)','اسم الموقع (بالإنكليزية)')}{text('nameAr','Venue name (Arabic)','اسم الموقع (بالعربية)')}
 <label style={{display:'grid',gap:6}}><L en="Venue type" ar="نوع الموقع"/><select name="category" value={category} onChange={e=>{setCategory(e.target.value);if(e.target.value==='nightclub')setNightclub(true);}} required aria-invalid={refused==='category'||undefined} style={refused==='category'?refusedInput:input}><option value=""></option>{VENUE_TYPES.map(t=><option key={t.key} value={t.key}><OptionText en={t.en} ar={t.ar} /></option>)}</select>{reason('category')}</label>
 {category==='other'?text('categoryOther','Specify venue type','حدّد نوع الموقع'):null}
 <label style={{display:'grid',gap:6}}><L en="District" ar="القضاء"/><select name="district" value={districtValue} onChange={e=>setDistrict(e.target.value)} required aria-invalid={refused==='district'||undefined} style={refused==='district'?refusedInput:input}><option value=""></option>{VENUE_DISTRICTS.map(d=><option key={d.en} value={d.en}><OptionText en={d.en} ar={d.ar} /></option>)}</select>{reason('district')}</label>
 {text('address','Town and street address','البلدة وعنوان الشارع')}{text('addressAr','Address (Arabic, optional)','العنوان (بالعربية، اختياري)',false)}
 {text('contactName','Responsible person','الشخص المسؤول')}{text('contactPhone','Phone number','رقم الهاتف',true,'tel')}
 <label style={{display:'grid',gap:6}}><L en={VENUE_CAPACITY_FIELD.en} ar={VENUE_CAPACITY_FIELD.ar}/><input style={refused==='capacity'?refusedInput:input} name="capacity" type="number" min="1" step="1" required inputMode="numeric" value={values['capacity']??''} onChange={e=>setValues(v=>({...v,capacity:e.target.value}))} aria-invalid={refused==='capacity'||undefined}/>{reason('capacity')}</label>
 </div>
 <div data-refused-anchor="regularlyHosts" tabIndex={-1} style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'center',marginBlock:24}}><L en={VENUE_ELIGIBILITY_QUESTIONS.regularlyHosts.en} ar={VENUE_ELIGIBILITY_QUESTIONS.regularlyHosts.ar}/><YesNoPair value={regular} onPick={setRegular}/><input type="hidden" name="regularlyHosts" value={regular===null?'':regular?'yes':'no'}/>{reason('regularlyHosts')}</div>
 <div data-refused-anchor="isNightclub" tabIndex={-1} style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'center',marginBlock:24}}><L en={VENUE_ELIGIBILITY_QUESTIONS.nightclub.en} ar={VENUE_ELIGIBILITY_QUESTIONS.nightclub.ar}/><YesNoPair value={nightclub} onPick={setNightclub}/><input type="hidden" name="isNightclub" value={nightclub===null?'':nightclub?'yes':'no'}/>{reason('isNightclub')}</div>
 <div data-refused-anchor="map" tabIndex={-1}>
 {!locked?<LocationPicker initial={point} onChange={setPin}/>:point?<p><L en="Confirmed map location" ar="الموقع المؤكّد على الخريطة"/>: <a href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=17/${point.lat}/${point.lng}`} target="_blank" rel="noreferrer"><L en="View map" ar="عرض الخريطة"/></a></p>:null}
 {reason('map')}
 </div>
 {!initial&&assessment&&!locked?<VenueAssessmentForm embedded onComplete={setAssessed} venueId="" venueNameEn={values['name']||''} venueNameAr={values['nameAr']||''} domains={assessment.domains} conditions={assessment.conditions} bands={assessment.bands} maxScore={assessment.maxScore}
   venueFacts={{licensedCapacity:Number.isSafeInteger(Number(values['capacity']))&&Number(values['capacity'])>0?Number(values['capacity']):null,regularlyHosts:regular===true,isNightclub:nightclub===true||category==='nightclub'}}
   initialAnswers={null} initialAttendance={null} feeDue={null} effectivePreview="" validPreview="" triggers={assessment.triggers}/>:null}
 {reason('assessment')}
 {!locked?<button type="submit" disabled={!pin||regular===null||nightclub===null||(!initial&&Boolean(assessment)&&!assessed)||pending} style={{minHeight:48,padding:'12px 26px',border:0,borderRadius:24,background:'var(--brand)',color:'var(--bg)',fontSize:'14.5px',fontWeight:500,marginBlockStart:8}}><L en={initial?'Save the details':'Continue to requirements'} ar={initial?'حفظ التفاصيل':'المتابعة إلى المتطلبات'}/></button>:null}
 {!locked&&(!pin||regular===null||nightclub===null||(!initial&&Boolean(assessment)&&!assessed))?<p data-region="before-continue" style={{margin:'10px 0 0',fontSize:'13.5px',color:'var(--muted)'}}><L en={initial?'Before saving: answer both questions and confirm the map pin.':'Before continuing: answer both questions, confirm the map pin, answer every assessment question and the attendance figure, and name the representative.'} ar={initial?'قبل الحفظ: أجيبوا عن السؤالين وأكّدوا العلامة على الخريطة.':'قبل المتابعة: أجيبوا عن السؤالين، وأكّدوا العلامة على الخريطة، وأجيبوا عن جميع أسئلة التقييم ورقم الحضور، وسمّوا الممثل.'}/></p>:null}
 </fieldset></form>;
}
