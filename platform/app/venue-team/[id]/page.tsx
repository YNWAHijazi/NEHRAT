import {notFound,redirect} from 'next/navigation';
import {currentAccount} from '../../../lib/auth';
import {venueAccess} from '../../../lib/venue/collaboration';
import {venuePackageFor} from '../../../lib/venue/workspace';
import {GovernmentBand,Header} from '../../../components/Header';
import {L} from '../../../components/L';
import {VenueRequirementList,VenueLinkedTeam} from '../../../components/VenueRequirementList';
import {unreadCountFor} from '../../../lib/queries';
export default async function VenueMedicalWork({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;saved?:string;approval?:string}>}) {
 const a=await currentAccount();if(!a)redirect('/signin');const {id}=await params;const access=venueAccess(a,id);if(!access?.invitation)notFound();const w=venuePackageFor(access.ownerId,id)!;const q=await searchParams;
 return <><GovernmentBand/><Header account={a} organization={null} unreadCount={unreadCountFor(a.id)} showBack/><main data-pad="" style={{maxWidth:1160,marginInline:'auto',padding:'44px 32px 120px'}}><p>{id} · <L en={`Level ${w.level??'—'}`} ar={`المستوى ${w.level??'—'}`}/></p><h1><bdi>{w.venue.nameEn}</bdi><br/><bdi lang="ar">{w.venue.nameAr}</bdi></h1>
 <details style={{padding:20,border:'1px solid var(--line)',borderRadius:12,marginBlock:24}}><summary><L en="Venue details" ar="تفاصيل الموقع"/></summary><p>{w.venue.addressMunicipalityEn} · {w.district}</p><p><L en={`Licensed capacity: ${w.venue.licensedCapacity}`} ar={`السعة المرخّصة: ${w.venue.licensedCapacity}`}/></p><p>{w.venue.responsibleName} · {w.venue.responsiblePhone}</p>{w.point?<a href={`https://www.openstreetmap.org/?mlat=${w.point.lat}&mlon=${w.point.lng}#map=17/${w.point.lat}/${w.point.lng}`} target="_blank" rel="noreferrer"><L en="View map" ar="عرض الخريطة"/></a>:null}</details>
 <h2><L en="Medical readiness" ar="الجاهزية الطبية"/></h2><p><L en="Complete your team's arrangements below. Shared answers appear for the organizer and the rest of the medical team." ar="أكملوا ترتيبات فريقكم أدناه. تظهر الإجابات المشتركة للمنظّم وباقي الفريق الطبي."/></p>
 {!w.editable?<p role="status"><L en="Submitted package · Read-only" ar="ملف مقدّم · للقراءة فقط"/></p>:null}{q.error?<p role="alert"><L en={q.error==='stale'?'This item changed while you were editing. Review the latest answers and try again.':'Complete all fields, attach a supported file if required, and confirm your arrangements.'} ar={q.error==='stale'?'تغيّر هذا البند أثناء التعديل. راجعوا أحدث الإجابات وحاولوا مجدداً.':'أكملوا الحقول وأرفقوا ملفاً مدعوماً إذا كان مطلوباً وأكّدوا الترتيبات.'}/></p>:null}{q.saved||q.approval?<p role="status"><L en={q.approval?'Medical Director approval recorded.':'Your work is saved and visible to the organizer.'} ar={q.approval?'اعتُمدت الخطة.':'حُفظ عملكم وأصبح ظاهراً للمنظّم.'}/></p>:null}
 <VenueLinkedTeam w={w} organizer={false}/><VenueRequirementList w={w} role={access.role} token={access.invitation.token} saved={q.saved}/></main></>;
}
