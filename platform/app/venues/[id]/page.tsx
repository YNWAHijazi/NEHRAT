import Link from 'next/link';
import { VenueWorkspace, VenueProgress } from '../../../components/VenueWorkspace';
import { ownedVenuePage } from '../../../lib/venue/page';
import { getDb } from '../../../lib/db';
import { L } from '../../../components/L';
import { InfoNote } from '../../../components/InfoNote';
import { beirutToday } from '../../../lib/clock';
import { venueReassessmentGate } from '../../../lib/rules';
import { venueChangeSinceAssessment } from '../../../lib/queries';
import { renewVenuePackageAction } from '../actions';
export default async function Venue({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const {account,w}=await ownedVenuePage(id);const v=w.venue;
 const certificates=getDb().prepare('SELECT version,effective,valid_until FROM venue_assessments WHERE venue_id=? AND certificate_issued=1 ORDER BY version DESC').all(id) as unknown as {version:number;effective:string;valid_until:string}[];
 const gate=venueReassessmentGate({validUntil:v.validUntil,today:beirutToday(),changeReportedSinceAssessment:venueChangeSinceAssessment(account.id,id)});
 const next=!w.detailsDone?{path:'details',en:'Complete venue details',ar:'إكمال تفاصيل الموقع'}:!w.assessmentDone?{path:'assessment',en:'Complete the assessment',ar:'إكمال التقييم'}:w.requirements.some(r=>!r.optional&&!r.done)?{path:'requirements',en:'Complete requirements',ar:'إكمال المتطلبات'}:{path:'submit',en:'Review and submit',ar:'المراجعة والتقديم'};
 return <VenueWorkspace account={account} w={w} active="overview">
 <VenueProgress w={w}/>
 {w.editable?<div style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:16,padding:24,borderRadius:16,background:'var(--accent-soft)',marginBlockEnd:24}}><strong><L en="Next step" ar="الخطوة التالية"/></strong><Link href={`/venues/${id}/${next.path}`} style={{padding:'12px 22px',borderRadius:24,background:'var(--bg)'}}><L en={next.en} ar={next.ar}/></Link></div>:null}
 {w.status==='accepted'?<div style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'center',marginBlock:24}}><Link href={`/venues/${id}/certificate`} style={{padding:'12px 24px',background:'var(--brand)',color:'var(--bg)',borderRadius:24}}><L en="Download venue certificate" ar="تنزيل شهادة الموقع"/></Link><form action={renewVenuePackageAction.bind(null,id)}><button disabled={gate.behaviour!=='enabled'||Boolean(v.archivedAt)} style={{padding:'12px 24px',border:'1px solid var(--line)',borderRadius:24,background:'var(--bg)'}}><L en="Renew certificate" ar="تجديد الشهادة"/></button></form>{gate.behaviour==='disabled'?<InfoNote><L en={`Renewal opens ${gate.params?.date??''}. Report a change if the venue has changed.`} ar={`يبدأ التجديد في ${gate.params?.date??''}. أبلغوا عن أي تغيير في الموقع.`}/></InfoNote>:null}</div>:null}
 <section style={{padding:24,border:'1px solid var(--line)',borderRadius:12,marginBlock:24}}><h2 style={{fontSize:20,marginBlockStart:0}}><L en="After registration" ar="بعد التسجيل"/></h2><div style={{display:'flex',flexWrap:'wrap',gap:20}}><Link href={`/venues/${id}/change`}><L en="Report a venue change" ar="الإبلاغ عن تغيير في الموقع"/></Link><Link href="/dashboard"><L en="Events and post-event reports" ar="الفعاليات وتقارير ما بعد الفعاليات"/></Link><InfoNote><L en="Each event keeps its own incident reports and post-event medical report. Venue renewal keeps this record ID and previous certificates." ar="تحتفظ كل فعالية بتقارير حوادثها وتقريرها الطبي. يحافظ تجديد الموقع على المعرّف والشهادات السابقة."/></InfoNote></div></section>
 <section data-region="history"><h2><L en="Previous certificates" ar="الشهادات السابقة"/></h2>{certificates.length?certificates.map(c=><p key={c.version}><Link href={`/venues/${id}/certificate?version=${c.version}`}><L en={`Certificate ${c.version}`} ar={`الشهادة ${c.version}`}/> · {c.effective} — {c.valid_until}</Link></p>):<p><L en="No certificate issued yet." ar="لم تصدر شهادة بعد."/></p>}</section>
 </VenueWorkspace>;
}
