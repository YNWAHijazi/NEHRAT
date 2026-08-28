/**
 * What a nominated party may read. Plain TypeScript, like everything in lib/rules/.
 *
 * ONE ALLOW-LIST, TWO READERS: the briefing query builds the document panel from it,
 * and the serving route checks against it. They must not drift -- a panel that lists a
 * document the route refuses is a dead control, and a route that serves one the panel
 * never lists is a hole nobody can see. Neither screen decides this for itself.
 *
 * AN ALLOW-LIST, NOT A SUBTRACTION. The failure mode of "everything except" is silent
 * over-disclosure: a document added to the catalogue tomorrow would be handed to every
 * nominated party until somebody noticed. Here it is invisible until somebody decides
 * it concerns them.
 *
 * The reviewer's list for stage one is the site or route map and the deployment map,
 * plus the plan sections on access and extraction, receiving hospitals, communications
 * and major incident. The PLAN SECTIONS ARE NOT HERE and are not served by this list:
 * they are text inside the organizer's plan, not attachments, and handing a nominee a
 * slice of the plan document is a different mechanism from handing them a file. That
 * part is named as unbuilt in the report rather than half-built here.
 */

export const NOMINEE_DOCUMENT_KEYS: Record<'ems' | 'director', readonly string[]> = {
  // Where the event is and where the medical response sits on it. Both parties need
  // both: an EMS provider deploying to a route, and a Director commanding on it.
  ems: ['siteMap', 'deploymentMap'],
  director: ['siteMap', 'deploymentMap'],
};

export function nomineeMayReadDocument(kind: 'ems' | 'director', docKey: string): boolean {
  return NOMINEE_DOCUMENT_KEYS[kind].includes(docKey);
}
