import Link from 'next/link';
import {VenueWorkspace} from '../../../../components/VenueWorkspace';
import {VenueRequirementList} from '../../../../components/VenueRequirementList';
import {ownedVenuePage} from '../../../../lib/venue/page';
import {L} from '../../../../components/L';
export default async function Requirements({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;saved?:string}>}){
 const {id}=await params;const {account,w}=await ownedVenuePage(id);const q=await searchParams;
 return <VenueWorkspace account={account} w={w} active="requirements"><h2><L en="Requirements" ar="المتطلبات"/></h2>{q.error?<p role="alert"><L en={q.error==='stale'?'This item changed while you were editing. Review the latest answers and try again.':'Complete the fields and attach a supported file, then try again.'} ar={q.error==='stale'?'تغيّر هذا البند أثناء التعديل. راجعوا أحدث الإجابات وحاولوا مجدداً.':'أكملوا الحقول وأرفقوا ملفاً مدعوماً ثم حاولوا مجدداً.'}/></p>:null}{q.saved?<p role="status"><L en="Saved." ar="حُفظ."/></p>:null}{!w.assessmentDone?<p><Link href={`/venues/${id}/assessment`}><L en="Complete the assessment to see your requirements." ar="أكملوا التقييم للاطلاع على المتطلبات."/></Link></p>:<><VenueRequirementList w={w} saved={q.saved}/><Link href={`/venues/${id}/submit`} style={{display:'inline-flex',padding:'12px 24px',borderRadius:24,background:'var(--brand)',color:'var(--bg)'}}><L en="Review and submit" ar="المراجعة والتقديم"/></Link></>}</VenueWorkspace>;
}
