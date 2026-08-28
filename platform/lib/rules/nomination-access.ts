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
 * TWO LISTS, because they are two mechanisms. Documents are files served by a route;
 * plan sections are text inside the organizer's plan. Both are allow-lists and both
 * are read by the query that builds the panel AND by the thing that serves it, so a
 * panel cannot list what the server refuses and the server cannot serve what no panel
 * shows.
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

/**
 * THE PLAN SECTIONS A NAMED PARTY MAY READ.
 *
 * Four, by reviewer instruction (2026-08-28): patient access and extraction (9),
 * coordination and communications (10), receiving emergency departments (11), and
 * major-incident and mass-casualty arrangements (12).
 *
 * These four and no others. A provider deciding whether it can meet the
 * major-incident arrangements needs the arrangements, not a note that they exist --
 * but the plan also carries the organizer's staffing, their equipment, their
 * contingencies and their contacts, and being named in an event is not being named in
 * all of it. Widening this list is a disclosure decision, not a convenience.
 *
 * NUMBERS, not keys, because the plan's own sections are numbered in the instrument
 * and the numbering is what the regulation refers to.
 */
export const NOMINEE_PLAN_SECTIONS: readonly number[] = [9, 10, 11, 12];

export function nomineeMayReadSection(n: number): boolean {
  return NOMINEE_PLAN_SECTIONS.includes(n);
}
