import {getDb} from './db';
/** Approval belongs to this plan version, assessment and the currently assigned Director. */
export function eventPlanApproval(eventId:string) {
 return getDb().prepare(`SELECT ap.approved_at,a.display_name,ap.plan_version FROM event_plan_approvals ap
 JOIN plans p ON p.event_id=ap.event_id AND p.version=ap.plan_version
 JOIN invitations i ON i.token=ap.invitation_token AND i.event_id=ap.event_id AND i.kind='director' AND i.status='confirmed'
 JOIN accounts a ON a.id=i.account_id AND a.suspended=0
 WHERE ap.event_id=? AND ap.assessment_version=COALESCE((SELECT MAX(version) FROM assessments WHERE event_id=ap.event_id),0)
 ORDER BY ap.id DESC LIMIT 1`).get(eventId) as {approved_at:string;display_name:string;plan_version:number}|undefined;
}
