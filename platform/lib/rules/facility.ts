/**
 * The cardiac-arrest instrument's derivations. Plain TypeScript, like everything in
 * lib/rules/: no React, no next/*, callable from a screen, a route handler and a test.
 *
 * Three rules live here and no screen re-implements them:
 *  - the category determination (which of the four state chips, and whether the
 *    registration journey ends at step 2 -- ROADMAP 2d);
 *  - the validity ledger (each obligation's last-affirmed and stops-counting dates,
 *    derived from the device records, the plan and the coordinator -- never entered);
 *  - the 12 cross-module reference (what an event plan may reference from a facility
 *    record, and which shortfalls surface by name).
 *
 * Status labels are PROVISIONAL (the policy prescribes no status vocabulary); the
 * screens must render facility.json's provisionalNote wherever they appear.
 */

import facilityJson from './data/facility.json';
import { addDays, formatIsoDate, type CalendarDate } from './deadlines';
import type { StateChip } from './gates';

/* ---------------- categories ---------------- */

export interface FacilityCategory {
  key: string;
  en: string;
  ar: string;
  state: StateChip;
  alsoRecurringVenue: boolean;
  ruleEn: string;
  ruleAr: string;
  basisEn: string;
  basisAr: string;
  /** Present exactly when the state is awaitingMinistryValue: the value's name. */
  missingEn?: string | undefined;
  missingAr?: string | undefined;
}

export const FACILITY_CATEGORIES: readonly FacilityCategory[] = facilityJson.categories.map(
  (c) => ({
    key: c.key,
    en: c.en,
    ar: c.ar,
    state: c.state as StateChip,
    alsoRecurringVenue: Boolean((c as { alsoRecurringVenue?: boolean }).alsoRecurringVenue),
    ruleEn: c.ruleEn,
    ruleAr: c.ruleAr,
    basisEn: c.basisEn,
    basisAr: c.basisAr,
    missingEn: (c as { missingEn?: string }).missingEn,
    missingAr: (c as { missingAr?: string }).missingAr,
  }),
);

export function facilityCategory(key: string): FacilityCategory | null {
  return FACILITY_CATEGORIES.find((c) => c.key === key) ?? null;
}

/**
 * Whether step 2 ends the journey. Only awaitingMinistryValue ends it (no Continue
 * button at all -- rule 10's second behaviour: absent, not greyed). A category
 * determined by review still registers; the review states what is required.
 */
export function categoryEndsJourney(category: FacilityCategory): boolean {
  return category.state === 'awaitingMinistryValue';
}

/* ---------------- the validity ledger ---------------- */

export type ObligationStatus = 'current' | 'lapsing' | 'lapsed' | 'notRecorded';

export interface LedgerRow {
  key: string;
  /** ISO date the obligation was last affirmed, null when never recorded. */
  lastAffirmed: string | null;
  /** ISO date it stops counting, null when never recorded. */
  until: string | null;
  status: ObligationStatus;
}

export interface LedgerInputs {
  /** Earliest electrode-pad expiry across registered devices, null if none carry one. */
  earliestPadExpiry: string | null;
  /** The date that pad expiry was last affirmed (the device's latest update). */
  padAffirmed: string | null;
  earliestBatteryExpiry: string | null;
  batteryAffirmed: string | null;
  /** Oldest latest-readiness-check date across devices. */
  oldestCheck: string | null;
  /** Latest drill date recorded on the plan. */
  drillDate: string | null;
  /** Date the plan's readiness confirmation was last recorded. */
  confirmedAt: string | null;
  /** Date the coordinator record was last reviewed or updated. */
  coordinatorUpdatedAt: string | null;
  /** Whether any device is registered at all. */
  hasDevices: boolean;
  /** Today, Asia/Beirut, ISO. */
  today: string;
}

const CYCLES = facilityJson.ledger.cycles;

function isoToCalendar(iso: string): CalendarDate {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y ?? 1970, month: m ?? 1, day: d ?? 1 };
}

/** Calendar-month addition, clamping to the target month's last day. */
export function addMonthsIso(iso: string, months: number): string {
  const { year, month, day } = isoToCalendar(iso);
  const total = year * 12 + (month - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return formatIsoDate({ year: y, month: m, day: Math.min(day, lastDay) });
}

export function addDaysIso(iso: string, days: number): string {
  return formatIsoDate(addDays(isoToCalendar(iso), days));
}

/** Status of one obligation from its stops-counting date. The window is data. */
export function obligationStatus(until: string | null, today: string): ObligationStatus {
  if (until === null) return 'notRecorded';
  if (today > until) return 'lapsed';
  if (addDaysIso(today, CYCLES.lapseWindowDays) >= until) return 'lapsing';
  return 'current';
}

/** The six ledger rows, derived. An unset input is 'notRecorded', never a guess. */
export function facilityLedger(inputs: LedgerInputs): LedgerRow[] {
  const annual = (affirmed: string | null): { lastAffirmed: string | null; until: string | null } => ({
    lastAffirmed: affirmed,
    until: affirmed === null ? null : addMonthsIso(affirmed, CYCLES.annualMonths),
  });
  const fixed = (affirmed: string | null, until: string | null) => ({ lastAffirmed: affirmed, until });
  const rows: { lastAffirmed: string | null; until: string | null }[] = [
    fixed(inputs.padAffirmed, inputs.hasDevices ? inputs.earliestPadExpiry : null),
    fixed(inputs.batteryAffirmed, inputs.hasDevices ? inputs.earliestBatteryExpiry : null),
    fixed(
      inputs.oldestCheck,
      inputs.oldestCheck === null ? null : addDaysIso(inputs.oldestCheck, CYCLES.checkCycleDays),
    ),
    annual(inputs.drillDate),
    annual(inputs.confirmedAt),
    annual(inputs.coordinatorUpdatedAt),
  ];
  return facilityJson.ledger.obligations.map((o, i) => {
    const r = rows[i] ?? { lastAffirmed: null, until: null };
    return { key: o.key, lastAffirmed: r.lastAffirmed, until: r.until, status: obligationStatus(r.until, inputs.today) };
  });
}

export interface Standing {
  kind: 'met' | 'lapsing' | 'lapsed';
  lapsedCount: number;
  lapsingCount: number;
  notRecordedCount: number;
}

/** The standing summary. Anything never recorded counts as not being met. */
export function facilityStanding(rows: LedgerRow[]): Standing {
  const lapsed = rows.filter((r) => r.status === 'lapsed').length;
  const lapsing = rows.filter((r) => r.status === 'lapsing').length;
  const notRecorded = rows.filter((r) => r.status === 'notRecorded').length;
  return {
    kind: lapsed + notRecorded > 0 ? 'lapsed' : lapsing > 0 ? 'lapsing' : 'met',
    lapsedCount: lapsed + notRecorded,
    lapsingCount: lapsing,
    notRecordedCount: notRecorded,
  };
}

/* ---------------- the 12 reference (event plan <- facility record) ---------------- */

export interface ReferenceDeviceFacts {
  count: number;
  locationsEn: string[];
  locationsAr: string[];
  anyPediatric: boolean;
  planConfirmed: boolean;
}

export interface ReferenceAnswers {
  admitsChildren: boolean;
  temporaryAreas: boolean;
}

export interface ReferenceShortfall {
  key: 'pediatric' | 'footprint';
}

/**
 * Which shortfalls surface by name (ROADMAP 2e condition 2). Each derives from a
 * captured event fact plus the facility record -- never asserted by hand:
 *  - pediatric: the event admits children and no registered device carries
 *    pediatric capability;
 *  - footprint: the event adds temporary areas outside the registered footprint,
 *    which the registered devices by definition do not cover.
 */
export function referenceShortfalls(
  facts: ReferenceDeviceFacts,
  answers: ReferenceAnswers,
): ReferenceShortfall[] {
  const out: ReferenceShortfall[] = [];
  if (answers.admitsChildren && !facts.anyPediatric) out.push({ key: 'pediatric' });
  if (answers.temporaryAreas) out.push({ key: 'footprint' });
  return out;
}
