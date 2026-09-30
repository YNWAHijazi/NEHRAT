import {eventPlanApproval} from '../lib/plan-approval';
import {approveEventPlanAction} from '../app/events/plan-approval-actions';
import {planFor,assessmentsFor} from '../lib/queries';
import {planIsComplete} from '../lib/rules';
import {L} from './L';
export function EventPlanApproval({id,ownerId,canApprove}:{id:string;ownerId:number;canApprove:boolean}) {
 const approval=eventPlanApproval(id),plan=planFor(ownerId,id);const version=assessmentsFor(ownerId,id)[0]?.version??0;
 return <section data-region="plan-approval" style={{padding:20,border:'1px solid var(--line)',borderRadius:12,marginBlock:24}}><strong><L en="Medical Director approval" ar="اعتماد المدير الطبي"/></strong>{approval?<p><L en="Medical Director approval" ar="اعتمدها"/> {approval.display_name} · {approval.approved_at.slice(0,10)}</p>:<p><L en="The Medical Director must approve the completed plan before submission." ar="يجب أن يعتمد المدير الطبي الخطة المكتملة قبل تقديم الطلب."/></p>}{!approval&&canApprove&&plan&&planIsComplete(plan,3)?<form action={approveEventPlanAction.bind(null,id)}><input type="hidden" name="version" value={plan.version}/><input type="hidden" name="assessmentVersion" value={version}/><label style={{display:'flex',gap:12,marginBlock:16}}><input type="checkbox" name="confirm" value="yes" required/><L en="I have reviewed and approve this plan." ar="راجعت هذه الخطة وأعتمدها."/></label><button><L en="Approve medical plan" ar="اعتماد الخطة الطبية"/></button></form>:null}</section>;
}
