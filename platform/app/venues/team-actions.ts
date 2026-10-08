'use server';
import {redirect} from 'next/navigation';

/**
 * A hosting venue's medical team (retired 8 October 2026). The Hosting Venue Registration
 * revised logic makes a venue registration an annual reusable baseline: it names no EMS
 * agency and no Event Medical Director -- each event at the venue names its own. These
 * actions remain only so a form rendered before the change, or a stale link, is refused
 * plainly: nothing is created, answered or accepted.
 */
export async function inviteVenuePartnerAction(id:string,_form:FormData) {
 redirect(`/venues/${encodeURIComponent(id)}`);
}
export async function withdrawVenuePartnerAction(id:string,_token:string) {
 redirect(`/venues/${encodeURIComponent(id)}`);
}
export async function respondVenueInvitationAction(token:string,_form:FormData) {
 redirect(`/venue-invitations/${encodeURIComponent(token)}`);
}
export async function createVenuePartnerAccountAction(token:string,_form:FormData) {
 redirect(`/venue-invitations/${encodeURIComponent(token)}`);
}
export async function signInVenuePartnerAction(token:string,_form:FormData) {
 redirect(`/venue-invitations/${encodeURIComponent(token)}`);
}
