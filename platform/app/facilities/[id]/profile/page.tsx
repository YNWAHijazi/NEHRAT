import { TRANSPORT_FACILITY_TYPES } from '../../../../lib/rules/facility-intake';
import { notFound, redirect } from 'next/navigation';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { facilityDetail, unreadCountFor } from '../../../../lib/queries';
import { facilityPoint } from '../../../../lib/facility-gis';
import { Header, GovernmentBand } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { LocationPicker } from '../../../../components/maps/LocationPicker';
import { saveFacilityProfileAction } from '../../../actions';
export default async function Profile({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
 const account=await currentAccount();if(!account)redirect('/signin');const {id}=await params;const f=facilityDetail(account.id,id);if(!f)notFound();const q=await searchParams;
 const fields=[['name','Facility name','اسم المنشأة',f.nameEn],['nameAr','Facility name (Arabic)','اسم المنشأة بالعربية',f.nameAr],['address','Address','العنوان',f.address],['municipality','Municipality','البلدية',f.municipalityEn],['municipalityAr','Municipality (Arabic)','البلدية بالعربية',f.municipalityAr],['hours','Operating hours','ساعات العمل',f.operatingHours],['phone','Facility telephone','هاتف المنشأة',f.phone],['email','Facility email','البريد الإلكتروني للمنشأة',f.email],['accessPoint','Main EMS entrance','المدخل الرئيسي للإسعاف',f.accessPoint],['emsNumber','EMS contact number','رقم الاتصال بالإسعاف',f.emsNumber]];
 return <><GovernmentBand/><Header account={account} organization={organizationFor(account.id)} unreadCount={unreadCountFor(account.id)} showBack back={{href:`/facilities/${id}`,en:'Facility record',ar:'سجل المنشأة'}}/><main data-pad="" style={{maxWidth:900,marginInline:'auto',padding:'36px 24px 80px'}}><h1><L en="Facility details" ar="تفاصيل المنشأة"/></h1>{q.error?<p role="alert"><L en="Complete the required details and confirm the map pin." ar="أكملوا البيانات المطلوبة وأكّدوا الموقع على الخريطة."/></p>:null}<form action={saveFacilityProfileAction.bind(null,id)}>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:16}}>{fields.map(([key,en,ar,value])=><label key={key} style={{display:'grid',gap:6}}><L en={en!} ar={ar!}/><input name={key} defaultValue={value} required={!key!.endsWith('Ar')} type={key==='email'?'email':key==='phone'||key==='emsNumber'?'tel':'text'} dir={['phone','email','emsNumber','hours'].includes(key!)?'ltr':undefined} style={{minHeight:44,padding:10,border:'1px solid var(--line)',borderRadius:8,width:'100%'}}/></label>)}</div>
 <label style={{display:'grid',gap:8,marginBlock:16}}><L en="Licensed capacity, if applicable" ar="السعة المرخّصة إن انطبقت"/><input type="number" min="0" name="capacity" style={{minHeight:44,padding:10,border:'1px solid var(--line)',borderRadius:8}} defaultValue={f.licensedCapacity??''}/></label>
 {f.categoryKey==='transport'?<label style={{display:'grid',gap:8,marginBlock:16}}><L en="Facility type" ar="نوع المنشأة"/><select name="facilityType" required defaultValue={f.facilityType}><option value=""></option>{TRANSPORT_FACILITY_TYPES.map(t=><option key={t.key} value={t.key}>{t.en} · {t.ar}</option>)}</select></label>:null}
 <LocationPicker initial={facilityPoint(id)}/><button type="submit" style={{padding:'12px 24px',border:0,borderRadius:24,background:'var(--brand)',color:'var(--bg)'}}><L en="Save facility details" ar="حفظ تفاصيل المنشأة"/></button></form></main></>;
}
