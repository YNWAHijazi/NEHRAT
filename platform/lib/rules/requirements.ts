/**
 * Annex B, computed for a level. Plain TypeScript, like everything in lib/rules/.
 *
 * Responsible parties are computed from the data's party keys per level, never written
 * as strings (SPEC 3). A requirement that does not apply at the level is ABSENT from the
 * result -- no row, not "not required" (non-negotiable #10).
 */

import matrixJson from './data/requirements-matrix.json';
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
}

const PARTIES = matrixJson.parties as Record<string, { en: string; ar: string }>;

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
    });
  }
  return rows;
}

/** Requirement 15: the event medical command function, the Director's alone, Level 3 only. */
export function commandFunctionRow(level: Level): RequirementRow | null {
  return requirementsForLevel(level).find((r) => r.n === 15) ?? null;
}
