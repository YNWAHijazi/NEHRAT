/**
 * The attestation gate on the submission review. Plain TypeScript, like everything
 * in lib/rules/.
 *
 * An attestation is NOT an outcome. The three outcomes remain the only regulatory
 * determinations; a pending attestation blocks only 'satisfied', and the other two
 * outcomes stay available at all times. There are two states -- pending and complete.
 * A deficiency does not create a third state: it is recorded as the reason an item
 * is pending.
 *
 * HOW THIS WAS MISSED FOR A WHOLE SLICE. The reference prototype carries this panel
 * as a blocking gate, six items with an assigned authority each. Slice 6 excused it
 * with a visual-comparison exception claiming the panel "summarizes organizer content
 * already compared on the organizer side" -- a claim with no reference locator that
 * nothing ever checked, and which was wrong. Worse, outcomeAvailability's docstring
 * promised "any blocking attestation" among the satisfied-outcome blockers while no
 * data, no table and no computation existed behind the word. This module is the
 * delivery behind that docstring.
 *
 * THE LANE FALLBACK (open decision 19, build ruling awaiting the Ministry): items
 * assigned to the Order of Physicians are recordable by the Order while its lane is
 * active. While the lane is off -- the default -- the Ministry records them itself,
 * because a pending item nobody may record would make 'satisfied' permanently
 * unreachable at Level 3. The prototype shows Order items read-only to the Ministry
 * AND shows the lane off on its own Order screen; both cannot hold, reported not
 * reconciled. Assignment is unchanged by the fallback: the row still names the Order.
 */

import attestationsJson from './data/attestations.json';
import { orderLaneActive } from './roles';
import type { Level } from './types';

export const ATTESTATIONS_CONTENT = attestationsJson;

export type AttestationAuthority = 'moph' | 'order';
export type AttestationState = 'pending' | 'complete';

export interface AttestationItemDef {
  key: string;
  en: string;
  ar: string;
  authority: AttestationAuthority;
}

/** A stored record for one item on one event; absent means pending with no reason. */
export interface AttestationRecord {
  itemKey: string;
  state: AttestationState;
  attestedBy: string | null;
  attestedAt: string | null;
  reasonEn: string | null;
  reasonAr: string | null;
  reasonBy: string | null;
  reasonAt: string | null;
}

export interface AttestationRow extends AttestationItemDef {
  state: AttestationState;
  attestedBy: string | null;
  attestedAt: string | null;
  reasonEn: string | null;
  reasonAr: string | null;
  /**
   * Who holds the pen for this item, given the lane -- state-independent. Attesting
   * is possible only while pending; recording a deficiency is possible in EITHER
   * state, because a deficiency discovered after attestation is a real event and it
   * returns the item to pending. Completion must not lock an item beyond correction.
   */
  recorder: 'reviewer' | 'order';
  /** Who may ATTEST right now: the recorder while pending, nobody once complete. */
  recordableBy: 'reviewer' | 'order' | null;
  /** True when an Order item is recordable by the Ministry because the lane is off. */
  laneFallback: boolean;
}

/** Do any attestation items apply at this level? Levels come from the data. */
export function attestationsApplyAt(level: Level): boolean {
  return (attestationsJson.appliesAtLevels as number[]).includes(level);
}

/**
 * The full derived row set for one event: every applicable item joined to its stored
 * record, with who-may-record resolved against the lane. Returns [] below the
 * applicable levels -- the SCREEN then shows the explicit empty state, never nothing.
 */
export function attestationRows(
  level: Level,
  records: readonly AttestationRecord[],
  laneActive: boolean = orderLaneActive(),
): AttestationRow[] {
  if (!attestationsApplyAt(level)) return [];
  const byKey = new Map(records.map((r) => [r.itemKey, r]));
  return (attestationsJson.items as AttestationItemDef[]).map((item) => {
    const rec = byKey.get(item.key);
    const state: AttestationState = rec?.state === 'complete' ? 'complete' : 'pending';
    const fallback = item.authority === 'order' && !laneActive;
    const recorder: 'reviewer' | 'order' =
      item.authority === 'moph' || fallback ? 'reviewer' : 'order';
    return {
      ...item,
      state,
      attestedBy: rec?.attestedBy ?? null,
      attestedAt: rec?.attestedAt ?? null,
      reasonEn: rec?.reasonEn ?? null,
      reasonAr: rec?.reasonAr ?? null,
      recorder,
      recordableBy: state === 'complete' ? null : recorder,
      laneFallback: fallback && state === 'pending',
    };
  });
}

/**
 * The panel's one-line summary, the prototype's own wording. Counts group by the
 * ASSIGNED authority, not by who may record under the fallback -- assignment is the
 * regulatory fact; the fallback is a recording path.
 */
export function attestationSummary(rows: readonly AttestationRow[]): { en: string; ar: string } {
  const pending = rows.filter((r) => r.state === 'pending');
  if (pending.length === 0) {
    return { en: attestationsJson.panel.allCompleteEn, ar: attestationsJson.panel.allCompleteAr };
  }
  const moph = pending.filter((r) => r.authority === 'moph').length;
  const order = pending.filter((r) => r.authority === 'order').length;
  const fill = (t: string): string =>
    t
      .replace('{pending}', String(pending.length))
      .replace('{total}', String(rows.length))
      .replace('{moph}', String(moph))
      .replace('{order}', String(order));
  return {
    en: fill(attestationsJson.panel.summaryPendingEn),
    ar: fill(attestationsJson.panel.summaryPendingAr),
  };
}

/**
 * The satisfied-outcome blockers this gate contributes: one per pending applicable
 * item, named. Fed into the same blocker list as inspections and added measures --
 * outcomeAvailability treats all three classes identically, which is what its
 * docstring promised all along.
 */
export function attestationBlockers(
  rows: readonly AttestationRow[],
): { en: string; ar: string }[] {
  return rows
    .filter((r) => r.state === 'pending')
    .map((r) => ({
      en: `${attestationsJson.blocker.prefixEn} — ${r.en}`,
      ar: `${attestationsJson.blocker.prefixAr} — ${r.ar}`,
    }));
}

/** The empty-state body with the level written in, both languages. */
export function attestationEmptyBody(level: Level): { en: string; ar: string } {
  return {
    en: attestationsJson.emptyState.bodyEn.replace('{level}', String(level)),
    ar: attestationsJson.emptyState.bodyAr.replace('{level}', String(level)),
  };
}
