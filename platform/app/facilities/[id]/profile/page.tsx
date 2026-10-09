import { OptionText } from '../../../../components/OptionText';
import { PhoneInput } from '../../../../components/PhoneInput';
import { FacilityWorkspace } from '../../../../components/FacilityWorkspace';
import { InfoNote } from '../../../../components/InfoNote';
import { TRANSPORT_FACILITY_TYPES } from '../../../../lib/rules/facility-intake';
import { notFound, redirect } from 'next/navigation';
import { currentAccount } from '../../../../lib/auth';
import { facilityDetail, facilityPersons } from '../../../../lib/queries';
import { facilityPoint } from '../../../../lib/facility-gis';
import { FACILITY_CONTENT } from '../../../../lib/rules';
import { L } from '../../../../components/L';
import { LocationPicker } from '../../../../components/maps/LocationPicker';
import { saveFacilityPersonsAction, saveFacilityProfileAction } from '../../../actions';

/**
 * The facility details, and under them the ONE responsible facility contact
 * (partner audit, 2026-10-08): edited here, shown read-only on the response plan. The
 * record page's details card and contact lead here with Edit (owner, 9 October 2026).
 * Two forms, because the two records are stamped and audited separately.
 */
export default async function Profile({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;notice?:string}>}) {
 const account=await currentAccount();if(!account)redirect('/signin');const {id}=await params;const f=facilityDetail(account.id,id);if(!f)notFound();const q=await searchParams;
 const contact=facilityPersons(id).find(p=>p.role==='coordinator')??null;const content=FACILITY_CONTENT;
 const fields=[['name','Facility name','اسم المنشأة',f.nameEn],['nameAr','Facility name (Arabic)','اسم المنشأة بالعربية',f.nameAr],['address','Address','العنوان',f.address],['municipality','Municipality','البلدية',f.municipalityEn],['municipalityAr','Municipality (Arabic)','البلدية بالعربية',f.municipalityAr],['hours','Operating hours','ساعات العمل',f.operatingHours],['phone','Facility telephone','هاتف المنشأة',f.phone],['email','Facility email','البريد الإلكتروني للمنشأة',f.email],['accessPoint','Main EMS entrance','المدخل الرئيسي للإسعاف',f.accessPoint],['emsNumber',content.accessFields[1]!.en,content.accessFields[1]!.ar,f.emsNumber]];
 const inputStyle:React.CSSProperties={minHeight:44,padding:10,border:'1px solid var(--line)',borderRadius:8,width:'100%'};
 return <FacilityWorkspace account={account} facility={f} active="details"><h2><L en="Facility details" ar="تفاصيل المنشأة"/></h2>{q.error==='details'?<p role="alert"><L en="Complete the required details and confirm the map pin." ar="أكملوا البيانات المطلوبة وأكّدوا الموقع على الخريطة."/></p>:null}<form action={saveFacilityProfileAction.bind(null,id)}>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:16}}>{fields.map(([key,en,ar,value])=><label key={key} style={{display:'grid',gap:6}}><L en={en!} ar={ar!}/><input name={key} defaultValue={value} required={!key!.endsWith('Ar')} type={key==='email'?'email':key==='phone'||key==='emsNumber'?'tel':'text'} dir={['phone','email','emsNumber','hours'].includes(key!)?'ltr':undefined} style={inputStyle}/></label>)}</div>
 <label style={{display:'grid',gap:8,marginBlock:16}}><L en="Licensed capacity, if applicable" ar="السعة المرخّصة إن انطبقت"/><input type="number" min="0" name="capacity" style={{minHeight:44,padding:10,border:'1px solid var(--line)',borderRadius:8}} defaultValue={f.licensedCapacity??''}/></label>
 {f.categoryKey==='transport'?<label style={{display:'grid',gap:8,marginBlock:16}}><L en="Facility type" ar="نوع المنشأة"/><select name="facilityType" required defaultValue={f.facilityType}><option value=""></option>{TRANSPORT_FACILITY_TYPES.map(t=><option key={t.key} value={t.key}><OptionText en={t.en} ar={t.ar} /></option>)}</select></label>:null}
 <LocationPicker initial={facilityPoint(id)}/><button type="submit" style={{minHeight:44,padding:'12px 24px',border:0,borderRadius:24,background:'var(--brand)',color:'var(--bg)',cursor:'pointer'}}><L en="Save facility details" ar="حفظ تفاصيل المنشأة"/></button></form>

 <section id="contact" data-region="responsible-contact" style={{marginBlockStart:44,padding:29,background:'var(--surface2)',borderRadius:16,maxWidth:900}}>
  <h2 style={{margin:'0 0 6px',fontSize:22,fontWeight:600,letterSpacing:'-.025em'}}><L en={content.persons[0]!.en} ar={content.persons[0]!.ar}/> <InfoNote><L en={content.coordinatorOneRecord.en} ar={content.coordinatorOneRecord.ar}/></InfoNote></h2>
  {q.notice==='contact'?<p role="status"><L en="The responsible facility contact has been recorded." ar="سُجِّلت جهة الاتصال المسؤولة في المنشأة."/></p>:null}
  {q.error==='contact'?<p role="alert"><L en="Enter the responsible contact’s name or position, telephone and email." ar="أدخلوا اسم جهة الاتصال المسؤولة أو مسماها الوظيفي ورقم الهاتف والبريد الإلكتروني."/></p>:null}
  <form action={saveFacilityPersonsAction.bind(null,id)} style={{display:'grid',gap:16,marginBlockStart:16}}>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16}}>
    {content.personFields.map(pf=>{const name=pf.key==='nameOrPosition'?'coordinatorName':pf.key==='phone'?'coordinatorPhone':'coordinatorEmail';const value=pf.key==='nameOrPosition'?contact?.nameOrPosition:pf.key==='phone'?contact?.phone:contact?.email;
     return <label key={pf.key} style={{display:'grid',gap:6}}><L en={pf.en} ar={pf.ar}/>{pf.key==='phone'?<PhoneInput name={name} defaultValue={value??''} required/>:<input name={name} defaultValue={value??''} required type={pf.key==='email'?'email':'text'} dir={pf.key==='nameOrPosition'?undefined:'ltr'} style={inputStyle}/>}</label>;})}
   </div>
   <button type="submit" style={{minHeight:44,padding:'12px 24px',border:0,borderRadius:24,background:'var(--brand)',color:'var(--bg)',cursor:'pointer',justifySelf:'start'}}><L en="Save responsible contact" ar="حفظ جهة الاتصال المسؤولة"/></button>
  </form>
 </section>
 </FacilityWorkspace>;
}
