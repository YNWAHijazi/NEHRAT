/**
 * Annex B, computed for a level. Plain TypeScript, like everything in lib/rules/.
 *
 * Responsible parties are computed from the data's party keys per level, never written
 * as strings (SPEC 3). A requirement that does not apply at the level is ABSENT from the
 * result -- no row, not "not required" (non-negotiable #10).
 */

import matrixJson from './data/requirements-matrix.json';
import { bilingualMap } from './bilingual-map';
import type { Level } from './types';

export interface RequirementRow {
  n: number;
  en: string;
  ar: string;
  valueEn: string;
  valueAr: string;
  respEn: string;
  respAr: string;
  /** Raised or newly applicable relative to the level below. */
  raised: boolean;
  raisedEn: string;
  raisedAr: string;
  attach: boolean;
  ems: boolean;
  divergence: string | null;
  /** The user-facing bilingual statement of the divergence, rendered where the row is read. */
  divergenceNoteEn: string | null;
  divergenceNoteAr: string | null;
  /** The party keys carrying this row at this level, in the data's own order. */
  partyKeys: readonly string[];
}

const PARTIES = bilingualMap(matrixJson.parties);

export function requirementsForLevel(level: Level): RequirementRow[] {
  const rows: RequirementRow[] = [];
  for (const r of matrixJson.requirements) {
    const value = r.values[level - 1];
    if (!value) continue; // absent, not greyed
    const prev = level > 1 ? r.values[level - 2] : null;
    const raised = level > 1 && (!prev || prev.en !== value.en);
    const partyKeys = (r.parties[level - 1] ?? []) as string[];
    rows.push({
      n: r.n,
      en: r.en,
      ar: r.ar,
      valueEn: value.en,
      valueAr: value.ar,
      respEn: partyKeys.map((k) => PARTIES[k]?.en ?? k).join(' / '),
      respAr: partyKeys.map((k) => PARTIES[k]?.ar ?? k).join(' / '),
      raised,
      raisedEn: `${prev ? 'Raised at Level ' : 'New at Level '}${level}`,
      raisedAr: `${prev ? 'رُفع في المستوى ' : 'جديد في المستوى '}${level}`,
      attach: r.attach,
      ems: r.ems,
      divergence: (r as { divergence?: string }).divergence ?? null,
      divergenceNoteEn: (r as { divergenceNoteEn?: string }).divergenceNoteEn ?? null,
      divergenceNoteAr: (r as { divergenceNoteAr?: string }).divergenceNoteAr ?? null,
      partyKeys,
    });
  }
  return rows;
}

/** Requirement 15: the event medical command function, the Director's alone, Level 3 only. */
export function commandFunctionRow(level: Level): RequirementRow | null {
  return requirementsForLevel(level).find((r) => r.n === 15) ?? null;
}

/**
 * The rows a NAMED PARTY carries at a level, and which of them are theirs alone.
 *
 * A nominated party deciding whether to accept is being asked to take on specific
 * requirements, and until now the nomination screen told them so in prose written by
 * hand. This derives it: at Level 3 the Event Medical Director carries five rows, and
 * requirement 15 -- the event medical command function -- names no other party at any
 * level. The prose said "four are shared, one is yours alone" and happened to be
 * right; this makes it TRUE BY DERIVATION rather than by a sentence somebody kept in
 * step. If the Ministry re-issues the matrix, the screen follows.
 *
 * `sole` is not "important" -- it is the mechanical fact that no other party is named
 * against the row, which is what makes it undischargeable by anyone else.
 */
export interface PartyRequirementRow extends RequirementRow {
  readonly sole: boolean;
}

export function requirementsForParty(level: Level, party: string): PartyRequirementRow[] {
  return requirementsForLevel(level)
    .filter((r) => r.partyKeys.includes(party))
    .map((r) => ({ ...r, sole: r.partyKeys.length === 1 }));
}
