import { venueDistrictLabel } from '../../../lib/rules/venue-intake';
import {notFound,redirect} from 'next/navigation';
import {currentAccount} from '../../../lib/auth';
import {venueAccess} from '../../../lib/venue/collaboration';
import {venuePackageFor} from '../../../lib/venue/workspace';
import {GovernmentBand,Header} from '../../../components/Header';
import {L} from '../../../components/L';
import {RecordHeader} from '../../../components/RecordHeader';
import {RecordRequirements} from '../../../components/record/RecordRequirements';
import {unreadCountFor} from '../../../lib/queries';
import {ROLES_CONTENT} from '../../../lib/rules';

/**
 * A medical partner's venue page: the SAME record the operator reads, with the rows that
 * name the partner's role open to it (the first authorized completion counts once), the
 * plan prepared here, and -- for the Medical Director at Level 3 -- the approval.
 */
export default async function VenueMedicalWork({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;saved?:string;approval?:string;upload?:string;doc?:string;notice?:string}>}) {
 const a=await currentAccount();if(!a)redirect('/signin');const {id}=await params;const access=venueAccess(a,id);if(!access?.invitation)notFound();const w=venuePackageFor(access.ownerId,id)!;const q=await searchParams;
 const v=w.venue;
 const contentTypes:Record<string,string|null>={};for(const f of w.files)contentTypes[f.docKey]=null;
 const derived={
  scheduleEn:`${v.nameEn} · routine operating session · capacity ${v.licensedCapacity??'—'}`,
  scheduleAr:`${v.nameAr} · جلسة تشغيل اعتيادية · السعة ${v.licensedCapacity??'—'}`,
  contactsEn:[v.responsibleName,...w.invitations.filter(i=>i.status==='confirmed').map(i=>`${i.name} (${i.kind==='ems'?'EMS agency':'Medical Director'})`)].filter(Boolean).join(' · '),
  contactsAr:[v.responsibleName,...w.invitations.filter(i=>i.status==='confirmed').map(i=>`${i.name} (${i.kind==='ems'?'جهة الإسعاف':'المدير الطبي'})`)].filter(Boolean).join(' · '),
  organizerPhoneMissing:!v.responsiblePhone,
 };
 return <><GovernmentBand/><Header account={a} organization={null} unreadCount={unreadCountFor(a.id)} showBack/><main data-pad="" style={{maxWidth:1160,marginInline:'auto',padding:'44px 32px 120px'}}><RecordHeader facts={[{en:'Record ID',ar:'معرّف السجل',value:id,strong:true},{en:'Your role',ar:'دوركم',value:<L en={access.role==='director'?'Medical Director':'EMS agency'} ar={access.role==='director'?'المدير الطبي':'جهة الإسعاف'}/>}]} nameEn={w.venue.nameEn} nameAr={w.venue.nameAr} stats={[{en:'Level',ar:'المستوى',value:w.level??'—',valueStyle:{color:w.level?`var(--l${w.level})`:'var(--muted)'}}]}/>
 <details style={{padding:20,border:'1px solid var(--line)',borderRadius:12,marginBlock:24}}><summary><L en="Venue details" ar="تفاصيل الموقع"/></summary><p><L en={w.venue.addressMunicipalityEn} ar={w.venue.addressMunicipalityAr||w.venue.addressMunicipalityEn}/> · <L en={venueDistrictLabel(w.district).en} ar={venueDistrictLabel(w.district).ar}/></p><p><L en={`Licensed capacity: ${w.venue.licensedCapacity}`} ar={`السعة المرخّصة: ${w.venue.licensedCapacity}`}/></p><p>{w.venue.responsibleName} · {w.venue.responsiblePhone}</p>{w.point?<a href={`https://www.openstreetmap.org/?mlat=${w.point.lat}&mlon=${w.point.lng}#map=17/${w.point.lat}/${w.point.lng}`} target="_blank" rel="noreferrer"><L en="View map" ar="عرض الخريطة"/></a>:null}</details>
 {/* The post-accept landing, as on an event: the answer is confirmed where the work is. */}
 {q.notice==='accepted'||q.notice==='registered'||q.notice==='linked'?<div role="status" data-region="landing-notice" style={{padding:'18px 24px',border:'1px solid var(--brand)',background:'var(--brand-soft)',borderRadius:12,marginBlock:'24px',fontSize:15,lineHeight:1.65}}>{q.notice==='accepted'?<L en={ROLES_CONTENT.nomination.venue.landingAcceptedEn} ar={ROLES_CONTENT.nomination.venue.landingAcceptedAr}/>:q.notice==='registered'?<L en={ROLES_CONTENT.nomination.venue.landingRegisteredEn} ar={ROLES_CONTENT.nomination.venue.landingRegisteredAr}/>:<L en="This nomination is now linked to your account." ar="رُبط هذا الترشيح بحسابكم."/>}</div>:null}
 <h2 style={{fontSize:28,marginBlock:'8px 8px'}}><L en="The venue's record" ar="سجل الموقع"/></h2>
 <p style={{margin:'0 0 20px',fontSize:15,lineHeight:1.65,color:'var(--muted)',maxWidth:'76ch'}}><L en="Shared with the operator. You may enter the rows that name your role; the operator sees your answer immediately and it counts once." ar="مشترك مع الجهة المشغّلة. يمكنكم إدخال الصفوف التي تسمّي دوركم؛ ترى الجهة المشغّلة إجابتكم فوراً وتُحتسب مرة واحدة."/></p>
 {!w.editable?<p role="status" style={{padding:'16px 22px',background:'var(--surface2)',borderRadius:12,color:'var(--muted)'}}><L en="Submitted package · Read-only" ar="ملف مقدّم · للقراءة فقط"/></p>:null}
 {q.error?<p role="alert"><L en={q.error==='stale'?'This item changed while you were editing. Review the latest answers and try again.':q.error==='incomplete'?'Attach the signed declaration and confirm it.':'That action is not open to your role on this venue.'} ar={q.error==='stale'?'تغيّر هذا البند أثناء التعديل. راجعوا أحدث الإجابات وحاولوا مجدداً.':q.error==='incomplete'?'أرفقوا الإقرار الموقَّع وأكّدوه.':'هذا الإجراء غير متاح لدوركم في هذا الموقع.'}/></p>:null}
 {q.saved||q.approval?<p role="status"><L en={q.approval?'Your approval of the current plan version is recorded.':'Saved and visible to the operator.'} ar={q.approval?'سُجّل اعتمادكم لنسخة الخطة الحالية.':'حُفظ وأصبح ظاهراً للجهة المشغّلة.'}/></p>:null}
 {w.record&&w.level!==null?<RecordRequirements record={w.record} viewerRole={access.role} viewerConfirmed contentTypes={contentTypes} refusal={q.upload&&q.doc?{key:q.doc,reason:q.upload}:null} derived={derived} viewerParty={w.record.parties.find(p=>p.token===access.invitation!.token)??null}/>:<p><L en="The operator has not completed the assessment yet." ar="لم تُكمل الجهة المشغّلة التقييم بعد."/></p>}
 </main></>;
}
