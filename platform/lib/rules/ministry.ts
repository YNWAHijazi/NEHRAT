/**
 * The Ministry console's rules. Plain TypeScript, like everything in lib/rules/.
 *
 * Three rules live here and no screen re-implements them:
 *  - the permission matrix: every role against every action, from the data --
 *    asked by every Ministry screen AND every server action. An administrator
 *    cannot record an outcome; an inspector records corrective actions and none
 *    of the three; the platform owner performs no regulatory action at all.
 *  - the outcome gate: "requirements satisfied" is disabled while any blocking
 *    item is outstanding, each named -- and THE OTHER TWO OUTCOMES STAY
 *    AVAILABLE (a gate on one determination is not a gate on determining).
 *  - the configuration value states: unset is a first-class answer; a published
 *    value carries an effective date; the Slice 4 provisional cycles yield to
 *    published configuration wherever both exist.
 */

import ministryJson from './data/ministry.json';
import facilityJson from './data/facility.json';

export const MINISTRY_CONTENT = ministryJson;

/* ---------------- the permission matrix ---------------- */

export type MinistryRole =
  | 'organizer'
  | 'ems'
  | 'director'
  | 'response'
  | 'reviewer'
  | 'inspector'
  | 'ministry_admin'
  | 'order'
  | 'platform_owner';

export type MinistryAction =
  | 'viewMinistry'
  | 'viewQueue'
  | 'viewSubmission'
  | 'assignReview'
  | 'recordOutcome'
  | 'recordAttestation'
  | 'requireMeasures'
  | 'recordOrganization'
  | 'respondEnquiry'
  | 'scheduleInspection'
  | 'recordCorrective'
  | 'viewFacilityLane'
  | 'designateCovered'
  | 'configureMassGathering'
  | 'configureCardiac'
  | 'manageUsers'
  | 'viewRegistry'
  | 'orderVerify'
  | 'viewPlatformActivity'
  | 'manageFlags';

const MATRIX = ministryJson.matrix as Record<string, string[]>;

/** May this role perform this action? Unknown roles hold nothing. */
export function can(role: string, action: MinistryAction): boolean {
  return (MATRIX[role] ?? []).includes(action);
}

/** The full matrix, for the handback and the users screen: action -> role -> bool. */
export function permissionMatrix(): { action: { key: string; en: string; ar: string }; roles: Record<string, boolean> }[] {
  const roleKeys = Object.keys(MATRIX);
  return ministryJson.actions.map((a) => ({
    action: a,
    roles: Object.fromEntries(roleKeys.map((r) => [r, can(r, a.key as MinistryAction)])),
  }));
}

/* ---------------- the outcome gate ---------------- */

export interface OutcomeBlocker {
  en: string;
  ar: string;
}

export interface OutcomeAvailability {
  key: 'incomplete' | 'revision' | 'satisfied';
  en: string;
  ar: string;
  /** False only ever for 'satisfied', and only while blockers are outstanding. */
  available: boolean;
  blockers: OutcomeBlocker[];
}

/**
 * Which outcomes a reviewer may record right now. 'satisfied' is DISABLED WITH
 * THE REASONS while any blocking attestation, inspection or added measure is
 * outstanding -- each named. The other two are always available: an incomplete
 * or revision determination needs no cleared checklist.
 */
export function outcomeAvailability(blockers: OutcomeBlocker[]): OutcomeAvailability[] {
  return ministryJson.outcomes.map((o) => ({
    key: o.key as OutcomeAvailability['key'],
    en: o.en,
    ar: o.ar,
    available: o.key !== 'satisfied' || blockers.length === 0,
    blockers: o.key === 'satisfied' ? blockers : [],
  }));
}

export type OutcomeKey = OutcomeAvailability['key'];

/**
 * The organizer-facing state for an event, ONE derivation for every surface that
 * shows it -- dashboard, event screen, public lookup. A recorded outcome wins,
 * in the compliance form's verbatim wording; a filed event without one shows a
 * grey non-determination; otherwise the assessment progress speaks.
 */
export function organizerEventState(input: {
  outcome: OutcomeKey | null;
  filed: boolean;
  assessed: boolean;
}): { en: string; ar: string } {
  if (input.outcome) {
    const o = ministryJson.outcomes.find((x) => x.key === input.outcome);
    if (o) return { en: o.en, ar: o.ar };
  }
  if (input.filed) return { en: 'Filed — under review', ar: 'مقدَّمة — قيد المراجعة' };
  return input.assessed
    ? { en: 'Assessed — not submitted', ar: 'مُقيَّمة — غير مقدَّمة' }
    : { en: 'Assessment in progress', ar: 'التقييم قيد الإجراء' };
}

/* ---------------- configuration values ---------------- */

export interface ConfigValue {
  key: string;
  /** Null while unset -- the first-class answer. */
  value: string | null;
  effective: string | null;
  publishedAt: string | null;
}

/**
 * The cycles the facility ledger runs on: published configuration where it
 * exists, the Slice 4 provisional figures where it does not. The caller reads
 * the published values from the store and passes them in; this stays plain.
 */
export function effectiveCycles(published: {
  checkCycleDays?: number | null;
  lapseWindowDays?: number | null;
}): { checkCycleDays: number; lapseWindowDays: number; annualMonths: number; provisional: boolean } {
  const base = facilityJson.ledger.cycles;
  const check = published.checkCycleDays ?? null;
  const lapse = published.lapseWindowDays ?? null;
  return {
    checkCycleDays: check ?? base.checkCycleDays,
    lapseWindowDays: lapse ?? base.lapseWindowDays,
    annualMonths: base.annualMonths,
    provisional: check === null || lapse === null,
  };
}
