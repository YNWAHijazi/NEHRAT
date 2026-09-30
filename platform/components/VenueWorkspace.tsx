import Link from 'next/link';
import { GovernmentBand, Header } from './Header';
import { L } from './L';
import { InfoNote } from './InfoNote';
import { organizationFor, type Account } from '../lib/auth';
import { unreadCountFor } from '../lib/queries';
import { venuePackageFor } from '../lib/venue/workspace';
import { VENUE_STATUS } from '../lib/rules/venue-workflow';
export type VenueTab='overview'|'details'|'assessment'|'requirements'|'submit'|'team';
export type VenueWorkspaceData=NonNullable<ReturnType<typeof venuePackageFor>>;
const tabs=[{key:'overview',path:'',en:'Overview',ar:'نظرة عامة'},{key:'details',path:'/details',en:'Details',ar:'التفاصيل'},{key:'assessment',path:'/assessment',en:'Assessment',ar:'التقييم'},{key:'team',path:'/team',en:'Medical team',ar:'الفريق الطبي'},{key:'requirements',path:'/requirements',en:'Requirements',ar:'المتطلبات'},{key:'submit',path:'/submit',en:'Submit',ar:'تقديم الطلب'}];
export function VenueWorkspace({account,w,active,children}:{account:Account;w:VenueWorkspaceData;active:VenueTab;children:React.ReactNode}){
 const v=w.venue;const state=VENUE_STATUS[w.status];
 return <><GovernmentBand/><Header account={account} organization={organizationFor(account.id)} unreadCount={unreadCountFor(account.id)} showBack/>
 <main data-pad="" style={{maxWidth:1160,marginInline:'auto',padding:'44px 32px 120px'}}>
 <div data-region="venue-workspace-header">
 <div data-region="record-header" style={{marginBlockEnd:28}}>
 <div style={{display:'flex',flexWrap:'wrap',gap:28,marginBlockEnd:14}}>{[
 {en:'Record ID',ar:'معرّف السجل',value:v.id},
 {en:'Level',ar:'المستوى',value:w.level}, {en:'Certificate valid until',ar:'الشهادة صالحة حتى',value:v.validUntil},
 ].map(x=><div key={x.en}><div style={{fontSize:12,color:'var(--muted)',marginBlockEnd:4}}><L en={x.en} ar={x.ar}/></div><strong>{x.value??'—'}</strong></div>)}</div>
 <h1 style={{fontSize:34,margin:'0 0 12px',overflowWrap:'anywhere'}}><bdi lang="en">{v.nameEn}</bdi>{v.nameAr!==v.nameEn?<span style={{display:'block'}}><bdi lang="ar" style={{fontSize:24,fontWeight:400,marginBlockStart:4}}>({v.nameAr})</bdi></span>:null}</h1>
 <span style={{background:w.status==='accepted'?'var(--brand-soft)':'var(--accent-soft)',color:w.status==='accepted'?'var(--brand)':'var(--accent-ink)',padding:'5px 12px',borderRadius:20,fontSize:14}}><L en={state.en} ar={state.ar}/></span>
 </div>
 <nav aria-label="Venue sections" data-region="venue-workspace-nav" style={{display:'flex',flexWrap:'wrap',gap:6,paddingBlockEnd:12,borderBlockEnd:'1px solid var(--line)',marginBlockEnd:28}}>{tabs.map(t=><Link key={t.key} href={`/venues/${v.id}${t.path}`} aria-current={active===t.key?'page':undefined} style={{padding:'10px 16px',borderRadius:8,background:active===t.key?'var(--brand-soft)':'transparent',color:active===t.key?'var(--brand)':'var(--muted)',fontWeight:active===t.key?600:400}}><L en={t.en} ar={t.ar}/></Link>)}</nav>
 </div>
 {!w.editable?<p role="status" style={{padding:16,background:'var(--surface2)',borderRadius:10}}><L en={v.archivedAt?'Archived record · Read-only':w.status==='accepted'?'Accepted package · Read-only':'Submitted package · Read-only'} ar={v.archivedAt?'سجل مؤرشف · للقراءة فقط':w.status==='accepted'?'ملف مستوفٍ · للقراءة فقط':'ملف مقدّم · للقراءة فقط'}/></p>:null}
 {w.note?<div role="status" style={{padding:16,border:'1px solid var(--accent)',borderRadius:10,marginBlockEnd:24}}><strong><L en="Ministry feedback" ar="ملاحظات الوزارة"/></strong><p style={{whiteSpace:'pre-wrap'}}>{w.note}</p></div>:null}
 {children}</main></>;
}
export function VenueProgress({w}:{w:VenueWorkspaceData}){
 const required=w.requirements.filter(r=>!r.optional);const missing=required.filter(r=>!r.done).length;
 const pending=w.invitations.filter(i=>i.status==='nominated').length;
 const checks=[w.detailsDone&&!w.detailsEditing,w.assessmentDone&&!w.assessmentEditing,required.length>0&&missing===0,w.status==='submitted'||w.status==='accepted',w.status==='accepted'];
 const labels=[
 {en:'Venue details',ar:'تفاصيل الموقع',detailEn:w.detailsDone?'Contact and map location saved':'Add contact details and a map pin',detailAr:w.detailsDone?'حُفظت بيانات الاتصال والموقع':'أضيفوا بيانات الاتصال والموقع'},
 {en:'Assessment',ar:'التقييم',detailEn:w.assessmentDone?`Level ${w.level} · Assessment ${w.assessmentVersion}`:'Assess one routine operating session',detailAr:w.assessmentDone?`المستوى ${w.level} · التقييم ${w.assessmentVersion}`:'قيّموا جلسة تشغيل اعتيادية واحدة'},
 {en:'Requirements',ar:'المتطلبات',detailEn:`${required.length-missing} of ${required.length} complete${pending?` · ${pending} invitations pending`:''}`,detailAr:`${required.length-missing} من ${required.length} مكتمل${pending?` · ${pending} دعوات بانتظار الرد`:''}`},
 {en:'Submitted',ar:'تم التقديم',detailEn:w.submittedAt?`Submitted ${w.submittedAt.slice(0,10)}`:'Submit the completed package',detailAr:w.submittedAt?`قُدّم في ${w.submittedAt.slice(0,10)}`:'قدّموا الملف المكتمل'},
 {en:'Ministry review',ar:'مراجعة الوزارة',detailEn:w.status==='accepted'?`Certificate valid until ${w.venue.validUntil??'—'}`:w.status==='revision'?'Changes requested':w.status==='submitted'?'Waiting for the Ministry':'Starts after submission',detailAr:w.status==='accepted'?`الشهادة صالحة حتى ${w.venue.validUntil??'—'}`:w.status==='revision'?'تعديلات مطلوبة':w.status==='submitted'?'بانتظار الوزارة':'تبدأ بعد التقديم'},
 ];
 const current=checks.findIndex(x=>!x);
 return <section data-region="rail" style={{background:'var(--surface2)',padding:24,borderRadius:16,marginBlock:'24px 32px'}}><div style={{display:'flex',justifyContent:'space-between',gap:16,marginBlockEnd:20}}><h2 style={{fontSize:18,margin:0}}><L en="Venue progress" ar="تقدّم الطلب"/></h2><span style={{fontSize:13,color:'var(--muted)'}}><L en={`Stage ${current<0?5:current+1} of 5`} ar={`المرحلة ${current<0?5:current+1} من 5`}/></span></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:16}}>{labels.map((l,i)=><div key={l.en} style={{borderBlockStart:`3px solid ${checks[i]?'var(--brand)':i===current?'var(--accent)':'var(--line)'}`,paddingBlockStart:12}}><small><L en={checks[i]?'Complete':i===current?'Current':'Not yet'} ar={checks[i]?'مكتمل':i===current?'الحالية':'لم تبدأ'}/></small><div style={{fontWeight:600,marginBlockStart:8}}><L en={l.en} ar={l.ar}/></div><p style={{fontSize:13,color:'var(--muted)',lineHeight:1.5,marginBlockEnd:0}}><L en={l.detailEn} ar={l.detailAr}/></p></div>)}</div></section>;
}
