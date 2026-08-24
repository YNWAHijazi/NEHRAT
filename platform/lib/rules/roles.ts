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

const PARTIES = matrixJson.parties as Record<string, { en: string; ar: string }>;

/**
 * The rows naming the Event Medical Director at the level. At any level below 3 the
 * result is EMPTY -- the role does not exist there, and a screen showing this list
 * at Level 2 is wrong twice over.
 */
export function directorRequirements(level: Level): DirectorRequirement[] {
  if (level !== 3) return [];
  const rows: DirectorRequirement[] = [];
  for (const r of matrixJson.requirements) {
    const partyKeys = (r.parties[level - 1] ?? []) as string[];
    if (!partyKeys.includes('D')) continue;
    const value = r.values[level - 1];
    if (!value) continue;
    rows.push({
      n: r.n,
      en: r.en,
      ar: r.ar,
      valueEn: value.en,
      valueAr: value.ar,
      sole: partyKeys.length === 1,
      others: partyKeys
        .filter((k) => k !== 'D')
        .map((k) => PARTIES[k] ?? { en: k, ar: k }),
    });
  }
  return rows;
}

/* ---------------- the declaration signing gate ---------------- */

export interface DeclarationItem {
  en: string;
  ar: string;
}

/** The ten items, from the compliance form's own data -- Arabic verbatim. */
export const DECLARATION_ITEMS: readonly DeclarationItem[] = complianceJson.sectionB.items;

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
