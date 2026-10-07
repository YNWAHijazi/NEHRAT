import { PLAN_SECTIONS } from './content';

/** The same section list drives entry, completeness and review. */
export function planSectionsForLevel(level: number | null) {
  if (level !== 2 && level !== 3) return [];
  return PLAN_SECTIONS.filter(section => level === 3 || section.n !== 12);
}

/** Revised Annex B: no Level 1 plan; recommended at Level 2 unless requested. */
export function planRequirement(level: number | null, ministryRequested = false): 'notRequired' | 'recommended' | 'required' {
  if (level === 3 || (level === 2 && ministryRequested)) return 'required';
  return level === 2 ? 'recommended' : 'notRequired';
}

/**
 * The owner assigns plan entry to confirmed medical partners at every applicable level:
 * the EMS agency at Level 2, the agency or the Director at Level 3. There is no Director
 * below Level 3 (decision D1, partner review 2026-10-07).
 */
export function canPreparePlan(level: number | null, role: 'organizer' | 'director' | 'ems'): boolean {
  return (level === 2 && role === 'ems') || (level === 3 && (role === 'director' || role === 'ems'));
}
