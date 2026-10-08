import { notFound,redirect } from 'next/navigation';
import { currentAccount,organizationFor } from '../../../../lib/auth';
import { beirutToday } from '../../../../lib/clock';
import { facilityDetail,facilityPersons,facilityPlanConfirmation,unreadCountFor } from '../../../../lib/queries';
import { FacilityWorkspaceHeader,facilityPreparation } from '../../../../components/FacilityWorkspaceHeader';
import { GovernmentBand,Header } from '../../../../components/Header';
import { SubmissionChecklist } from '../../../../components/SubmissionChecklist';
import { L } from '../../../../components/L';
import { PlanConfirmation } from '../plan/PlanConfirmation';
export default async function Submit({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
 const a=await currentAccount();if(!a)redirect('/signin');const {id}=await params;const f=facilityDetail(a.id,id);if(!f)notFound();const q=await searchParams;
 const contact=facilityPersons(id).find(p=>p.role==='coordinator');const existing=facilityPlanConfirmation(id);const required=facilityPreparation(id).filter(r=>r.key!=='confirmation');
 return <><GovernmentBand/><Header account={a} organization={organizationFor(a.id)} unreadCount={unreadCountFor(a.id)} showBack/><main data-pad="" style={{maxWidth:1160,marginInline:'auto',padding:'44px 32px 120px'}}><FacilityWorkspaceHeader facility={f} active="submit"/><h2><L en="Review and submit" ar="المراجعة والتقديم"/></h2><SubmissionChecklist required={required} optional={[]}/>{q.error?<p role="alert"><L en="Complete the required items, check every readiness item and enter a drill date within the last 12 months." ar="أكملوا المتطلبات وأكّدوا كل بند جاهزية وأدخلوا تاريخ تمرين خلال آخر 12 شهراً."/></p>:null}
 {f.archivedAt?<p><L en="Archived record · Read-only" ar="سجل مؤرشف · للقراءة فقط"/></p>:<PlanConfirmation facilityId={id} representative={contact?.nameOrPosition??''} today={beirutToday()} existing={existing} ready={required.every(r=>r.done)}/>}
 </main></>;
}
