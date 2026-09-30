'use server';
import {notFound,redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {currentAccount} from '../../lib/auth';
import {getDb} from '../../lib/db';
import {planAccess} from '../../lib/plan-access';
import {derivedLevelFor,planFor} from '../../lib/queries';
import {planIsComplete} from '../../lib/rules';
export async function approveEventPlanAction(id:string,form:FormData) {
 const a=await currentAccount();if(!a)redirect('/signin');const access=planAccess(a,id);if(!access||access.editor!=='director'||!access.canEdit)notFound();
 const db=getDb();db.exec('BEGIN IMMEDIATE');let ok=false;
 try{const inv=db.prepare("SELECT token FROM invitations WHERE event_id=? AND account_id=? AND kind='director' AND status='confirmed'").get(id,a.id) as {token:string}|undefined;
 const plan=planFor(access.ownerId,id);const assessment=(db.prepare('SELECT COALESCE(MAX(version),0) AS v FROM assessments WHERE event_id=?').get(id) as {v:number}).v;
 if(inv&&derivedLevelFor(id)===3&&plan&&plan.version===Number(form.get('version'))&&assessment===Number(form.get('assessmentVersion'))&&planIsComplete(plan,3)&&form.get('confirm')==='yes'){
 db.prepare('INSERT INTO event_plan_approvals(event_id,plan_version,assessment_version,invitation_token) VALUES(?,?,?,?)').run(id,plan.version,assessment,inv.token);ok=true;}
 db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 revalidatePath(`/events/${id}`,'layout');redirect(`/events/${id}/plan?${ok?'approved=yes':'error=approval'}`);
}
