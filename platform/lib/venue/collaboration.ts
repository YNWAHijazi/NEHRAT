import { getDb } from '../db';
import type { Account } from '../auth';
import { authorsFor, type AuthorRole, type Level } from '../rules';
export type VenueEditor = AuthorRole;
export interface VenueInvitation {
 token:string;venue_id:string;kind:'ems'|'director';name:string;email:string;
 status:'nominated'|'confirmed'|'declined'|'withdrawn';account_id:number|null;
 invited_at:string;expires_at:string;responded_at:string|null;note:string;licence:string;delivery:string;
}
export type VenueTeamMember = VenueInvitation & {phone:string;active:number};
export function venueInvitations(id:string):VenueTeamMember[] {
 return getDb().prepare("SELECT i.*,COALESCE(a.phone,'') AS phone,CASE WHEN a.suspended=0 THEN 1 ELSE 0 END AS active FROM venue_invitations i LEFT JOIN accounts a ON a.id=i.account_id WHERE i.venue_id=? ORDER BY i.invited_at,i.token").all(id) as unknown as VenueTeamMember[];
}
export function venueInvitation(token:string):VenueInvitation|null {
 if(!/^[a-f0-9]{48}$/.test(token))return null;
 return getDb().prepare('SELECT * FROM venue_invitations WHERE token=?').get(token) as unknown as VenueInvitation|null;
}
export function venueAccess(a:Account,id:string) {
 const venue=getDb().prepare('SELECT account_id,is_demo FROM venues WHERE id=?').get(id) as {account_id:number;is_demo:number}|undefined;
 if(!venue||venue.is_demo!==+a.isDemo)return null;
 if(venue.account_id===a.id)return {ownerId:venue.account_id,role:'organizer' as VenueEditor,invitation:null};
 const inv=venueInvitations(id).find(i=>i.account_id===a.id&&i.kind===a.role&&i.status==='confirmed');
 return inv?{ownerId:venue.account_id,role:inv.kind as VenueEditor,invitation:inv}:null;
}
/** Who may write a catalogue key on this venue: the catalogue's authors for the level, held by this account's standing. */
export function venueMayWrite(a:Account,id:string,key:string,level:Level) {
 const access=venueAccess(a,id);
 return access&&authorsFor(key,level,'venue').includes(access.role)?access:null;
}
export function invalidateVenueMedicalWork(id:string) {
 // Keep submitted packages intact. Fresh confirmation is needed after changed venue facts or assessment.
 getDb().prepare('UPDATE venue_packages SET work_revision=work_revision+1 WHERE venue_id=?').run(id);
 getDb().prepare('DELETE FROM venue_contributions WHERE venue_id=?').run(id);
 getDb().prepare('DELETE FROM venue_plan_approvals WHERE venue_id=?').run(id);
}
export function venueAssignments(a:Account) {
 return getDb().prepare(`SELECT i.*,v.name_en,v.name_ar FROM venue_invitations i JOIN venues v ON v.id=i.venue_id
 WHERE v.is_demo=? AND (i.account_id=? OR (i.email=(SELECT email FROM accounts WHERE id=?) AND i.kind=?))
 AND i.status IN ('nominated','confirmed') AND v.archived_at IS NULL ORDER BY i.invited_at DESC`).all(+a.isDemo,a.id,a.id,a.role) as unknown as (VenueInvitation&{name_en:string;name_ar:string})[];
}
