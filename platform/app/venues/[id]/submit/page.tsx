import { VenueWorkspace } from '../../../../components/VenueWorkspace';
import { SubmissionChecklist } from '../../../../components/SubmissionChecklist';
import { ownedVenuePage } from '../../../../lib/venue/page';
import { L } from '../../../../components/L';
import { submitVenuePackageAction } from '../../actions';
import { applicationFee,effectiveFlag } from '../../../../lib/rules';
import { capabilityConfigFor,ministryConfig } from '../../../../lib/queries';
import { paymentFor } from '../../../../lib/payments';
export default async function Submit({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;submitted?:string}>}){
 const {id}=await params;const {account,w}=await ownedVenuePage(id);const q=await searchParams;
 const config=new Map([...ministryConfig()].map(([k,v])=>[k,v.value]));const fee=applicationFee('registerVenue',null,effectiveFlag('applicationFees',config),capabilityConfigFor('applicationFees'));const paid=!fee||Boolean(paymentFor(id,'registerVenue'));
 const base=[{key:'details',en:'Venue details and map pin',ar:'تفاصيل الموقع وعلامة الخريطة',done:w.detailsDone,href:`/venues/${id}/details`},{key:'assessment',en:'Annual assessment',ar:'التقييم السنوي',done:w.assessmentDone,href:`/venues/${id}/assessment`}];
 const rows=w.requirements.map(r=>({key:String(r.n),en:r.en,ar:r.ar,done:r.done,href:`/venues/${id}/requirements#r-${r.n}`,optional:r.optional}));
 const required=[...base,...rows.filter(r=>!r.optional),...(fee?[{key:'fee',en:`Fee: ${fee.amount} ${fee.currency}`,ar:`الرسم: ${fee.amount} ${fee.currency}`,done:paid,href:'#fee'}]:[])];
 return <VenueWorkspace account={account} w={w} active="submit"><h2><L en="Submission package" ar="حزمة التقديم"/></h2>
 {q.submitted?<p role="status"><L en="Submitted. You can follow the Ministry’s review here." ar="تم التقديم. يمكنكم متابعة مراجعة الوزارة هنا."/></p>:null}
 {q.error?<p role="alert"><L en="Complete the required items and confirm the declaration before submitting." ar="أكملوا البنود المطلوبة وأكّدوا الإقرار قبل التقديم."/></p>:null}
 <SubmissionChecklist required={required} optional={rows.filter(r=>r.optional)}/>
 {fee&&!paid?<p id="fee"><L en="Payment must be recorded before submission. Follow the Ministry’s payment instructions." ar="يجب تسجيل السداد قبل التقديم. اتبعوا تعليمات الوزارة للدفع."/></p>:null}
 {w.editable?<form action={submitVenuePackageAction.bind(null,id)}><label style={{display:'flex',gap:12,alignItems:'start',marginBlock:24}}><input type="checkbox" name="confirm" value="yes" required/><L en="I confirm these details and documents are accurate and cover the venue’s routine operations." ar="أؤكّد أن هذه البيانات والمستندات صحيحة وتشمل التشغيل الاعتيادي للموقع."/></label><button type="submit" disabled={!required.every(r=>r.done)} style={{padding:'12px 26px',border:0,borderRadius:24,background:'var(--brand)',color:'var(--bg)'}}><L en="Submit to the Ministry" ar="التقديم إلى الوزارة"/></button></form>:null}
 </VenueWorkspace>;
}
