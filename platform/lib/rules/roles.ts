/**
 * The counterparty roles' derivations. Plain TypeScript, like everything in lib/rules/.
 *
 * Three rules live here and no screen re-implements them:
 *  - which requirements name the Event Medical Director, derived from the matrix per
 *    level, never written as a list (SPEC: responsible parties are computed) -- and
 *    which of them is the Director's alone;
 *  - the declaration signing gate: ten items, signing blocked until all ten are
 *    confirmed, with the outstanding count named (rule 10: disabled with a reason);
 *  - the Order of Physicians lane state: configurable, non-determinative, off by
 *    default -- the off state is a first-class answer.
 */

import matrixJson from './data/requirements-matrix.json';
import { bilingualMap } from './bilingual-map';
import rolesJson from './data/roles.json';
import complianceJson from './data/compliance-form.json';
import type { Level } from './types';

export const ROLES_CONTENT = rolesJson;

/* ---------------- the Director's requirements, derived ---------------- */

export interface DirectorRequirement {
  n: number;
  en: string;
  ar: string;
  valueEn: string;
  valueAr: string;
  /** True where the Director is the ONLY named party -- requirement 15. */
  sole: boolean;
  /** The other named parties, absent for a sole requirement. */
  others: { en: string; ar: string }[];
}

import { requirementsForParty } from './requirements';

const PARTIES = bilingualMap(matrixJson.parties);

/**
 * The rows naming the Event Medical Director at the level. At any level below 3 the
 * result is EMPTY -- the role does not exist there, and a screen showing this list
 * at Level 2 is wrong twice over.
 *
 * DELEGATES to requirementsForParty. This used to walk the matrix itself, and when
 * the nomination briefing needed the same thing for an EMS provider a second walk was
 * written beside it -- two derivations of one rule, which is how they drift. The
 * general one is the only one; this keeps the Director's shape (it carries `others`,
 * which the briefing does not need) and stops deciding anything for itself.
 */
export function directorRequirements(level: Level): DirectorRequirement[] {
  return requirementsForParty(level, 'D').map((r) => ({
    n: r.n,
    en: r.en,
    ar: r.ar,
    valueEn: r.valueEn,
    valueAr: r.valueAr,
    sole: r.sole,
    others: r.partyKeys
      .filter((k) => k !== 'D')
      .map((k) => PARTIES[k] ?? { en: k, ar: k }),
  }));
}

/* ---------------- the declaration signing gate ---------------- */

export interface DeclarationItem {
  en: string;
  ar: string;
}

/** The ten items, from the compliance form's own data -- Arabic verbatim. */
export const DECLARATION_ITEMS: readonly DeclarationItem[] = complianceJson.sectionB.items;

/**
 * The recorded divergence on section B item 10 (README divergence 6): the Arabic
 * issue adds that the agency confirmed its READINESS to perform the role. Follow
 * the English, report the difference where the item is signed.
 */
export const DECLARATION_ITEM10_DIVERGENCE: { index: number; en: string; ar: string } | null = (() => {
  const c = complianceJson as { item10DivergenceEn?: string; item10DivergenceAr?: string };
  return c.item10DivergenceEn && c.item10DivergenceAr
    ? { index: 9, en: c.item10DivergenceEn, ar: c.item10DivergenceAr }
    : null;
})();

export interface DeclarationGate {
  canSign: boolean;
  confirmedCount: number;
  totalCount: number;
  /** Present exactly when signing is blocked. */
  reasonKey?: string;
  params?: Record<string, string | number>;
}

/** Signing is blocked until every item is confirmed, with the count named. */
export function declarationGate(confirmed: readonly boolean[]): DeclarationGate {
  const total = DECLARATION_ITEMS.length;
  const done = confirmed.slice(0, total).filter(Boolean).length;
  if (done >= total) return { canSign: true, confirmedCount: done, totalCount: total };
  return {
    canSign: false,
    confirmedCount: done,
    totalCount: total,
    reasonKey: 'gate.declarationItemsOutstanding',
    params: { count: total - done, total },
  };
}

/* ---------------- the Order of Physicians lane ---------------- */

/** Off by default (SPEC). Activation is a Ministry act recorded in the data. */
export function orderLaneActive(): boolean {
  return rolesJson.lanes.orderOfPhysicians.active === true;
}

/**
 * Where a role lands, and which roles the organizer surface belongs to.
 *
 * ONE derivation, because there were two and they disagreed. The demonstration
 * sign-in routed by role; the password sign-in redirected everyone to /dashboard.
 * So a Ministry administrator signing in with credentials landed on the organizer's
 * surface -- Events, Venues, Facilities, Start a service, and their own name over an
 * organizer's dashboard. A reviewer does not organize events, and should never have
 * been shown the controls for doing so.
 *
 * Kept here rather than in ministry.ts because it spans every role, not just the
 * console's. Both sign-in paths and the dashboard route read it.
 */

/** The roles the organizer dashboard is FOR. Everyone else is refused there. */
const ORGANIZER_SURFACE_ROLES = ['organizer', 'ems', 'director'] as const;

export function usesOrganizerSurface(role: string): boolean {
  return (ORGANIZER_SURFACE_ROLES as readonly string[]).includes(role);
}

/**
 * The surface a role lands on after signing in. An unknown role gets the sign-in
 * screen rather than a guess -- landing somewhere plausible is how this broke.
 */
export function landingRouteFor(role: string): string {
  if (usesOrganizerSurface(role)) return '/dashboard';
  if (role === 'response') return '/first-response/readiness';
  if (role === 'reviewer' || role === 'inspector' || role === 'ministry_admin') return '/ministry';
  if (role === 'order') return '/ministry/order';
  // Unchanged from what the demonstration sign-in already did.
  if (role === 'platform_owner') return '/platform/admin';
  return '/signin';
}
