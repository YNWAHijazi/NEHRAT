import { redirect } from 'next/navigation';

/**
 * Hosting venue registration is replaced by Facility/Site registration (owner, 9 October 2026:
 * "Two services: Register an event; Register a facility/site"). An event-hosting venue at or
 * above the capacity threshold registers as a Facility/Site; an old link lands there.
 */
export default function RegisterVenueRedirect(): never {
  redirect('/facilities/new');
}
