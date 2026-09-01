/**
 * The gating module. Every screen asks this rather than deciding for itself; if two
 * screens disagree about whether something is available, this is the only place to fix it.
 *
 * Plain TypeScript, like everything in lib/rules/.
 *
 * Two behaviours, and conflating them is the mistake that matters (SPEC 5b):
 *
 *   'disabled'  -- the action WILL become available; it waits on a date or a state.
 *                  Rendered greyed, with the condition in plain words beside it.
 *   'absent'    -- the action does not apply to this record and never will (level,
 *                  category, instrument). Rendered as NOTHING: no row, no grey control.
 *
 * 'enabled' is the third result. There is no fourth: "not built yet" is a build fact,
 * not a gate, and must never be expressed through this module.
 */

import { addDays, formatIsoDate, postEventReportWindow, filingDeadline, startOfBeirutDay, type FilingDeadline } from './deadlines';
import { REASSESSMENT_WINDOW } from './load';
import type { Level } from './types';

export type GateBehaviour = 'enabled' | 'disabled' | 'absent';

export interface Gate {
  behaviour: GateBehaviour;
  /** Message key into the catalogues, present exactly when behaviour is 'disabled'. */
  reasonKey?: string;
  /** Values interpolated into the reason string, e.g. { date: '2026-10-02' }. */
  params?: Record<string, string | number>;
}

const ENABLED: Gate = { behaviour: 'enabled' };
const ABSENT: Gate = { behaviour: 'absent' };

export interface EventGateContext {
  /** Null while the assessment is incomplete. */
  finalLevel: Level | null;
  /** YYYY-MM-DD, null until captured. */
  eventEndDate: string | null;
  eventStartDate: string | null;
  filed: boolean;
  organizationStatus: 'none' | 'pending' | 'recorded' | 'returned';
  now: Date;
  /** Cancellation closes the record; the report is not owed. Defaults to active. */
  lifecycle?: EventLifecycle;
}

function endInstant(eventEndDate: string): Date {
  // The gate opens at 00:00 Asia/Beirut the day after the END date; the window module
  // owns that arithmetic. Represent the end as its calendar date at Beirut noon to
  // avoid any boundary ambiguity in conversion.
  return new Date(`${eventEndDate}T12:00:00+03:00`);
}

/**
 * Post-event report: a time gate. Visible and disabled before it opens, with the date --
 * because it is coming (SPEC 5b: "A post-event report before the event IS shown, greyed,
 * with its date").
 */
export function postEventReportGate(ctx: EventGateContext): Gate {
  // A cancelled event owes no report -- the gate is ABSENT, not merely shut, and the
  // record's cancellation band is the stated reason. Postponement changes nothing
  // here: the original date's obligations stand until a revised filing replaces them.
  if (!lifecyclePermits(ctx.lifecycle ?? 'active').postEventReport) {
    return { behaviour: 'absent' };
  }
  if (ctx.eventEndDate === null) {
    return { behaviour: 'disabled', reasonKey: 'gate.postEventNeedsEventDate' };
  }
  const window = postEventReportWindow(endInstant(ctx.eventEndDate));
  if (ctx.now.getTime() >= window.opens.instant.getTime()) return ENABLED;
  return {
    behaviour: 'disabled',
    reasonKey: 'gate.postEventNotYetOpen',
    params: { date: window.opens.date },
  };
}

/**
 * Serious-incident notification (Protocol 13 p1): a state-then-time gate. Nothing can
 * have occurred at an event that has not begun; once it has, the control must be live
 * regardless of the post-event report window.
 */
export function seriousIncidentGate(ctx: EventGateContext): Gate {
  if (!ctx.filed) return { behaviour: 'disabled', reasonKey: 'gate.seriousIncidentBeforeFiling' };
  if (ctx.eventStartDate === null) {
    return { behaviour: 'disabled', reasonKey: 'gate.seriousIncidentNeedsEventDate' };
  }
  // startOfBeirutDay, NOT a hand-built `+03:00`. Lebanon is +03:00 in summer and
  // +02:00 in winter, so the literal offset was wrong for half the year -- and at
  // MIDNIGHT a one-hour error moves the instant to 23:00 the PREVIOUS Beirut day,
  // opening this gate a calendar day early for every winter event. The other five
  // hard-coded offsets in the codebase all sit at noon, where an hour cannot change
  // the date; this was the only one at a boundary. startOfBeirutDay resolves the
  // offset for the actual instant and refines it, which is why the post-event window
  // was already correct.
  const [y, m, d] = ctx.eventStartDate.split('-').map(Number) as [number, number, number];
  const start = startOfBeirutDay({ year: y, month: m, day: d });
  if (ctx.now.getTime() >= start.getTime()) return ENABLED;
  return {
    behaviour: 'disabled',
    reasonKey: 'gate.seriousIncidentBeforeStart',
    params: { date: ctx.eventStartDate },
  };
}

/**
 * The record's stage on the six-stage rail -- ONE derivation, shared by the
 * dashboard tile and the event record so the two can never disagree again.
 * A seeded row whose level exists without stored answers counts as assessed:
 * the level is the assessment's product.
 */
/** The rail has six stages; stage six is the post-event report. */
export const RAIL_STAGE_COUNT = 6;
export const POST_EVENT_STAGE = 6;

export function eventStage(input: {
  assessed: boolean;
  filed: boolean;
  outcome: string | null;
  finalLevel: Level | null;
  eventEndDate: string | null;
  reportSubmitted: boolean;
  now: Date;
}): { stage: number; en: string; ar: string } {
  if (!input.assessed) return { stage: 2, en: 'Assessment', ar: 'التقييم' };
  if (!input.filed) return { stage: 3, en: 'Requirements and attachments', ar: 'المتطلبات والمرفقات' };
  if (
    input.finalLevel === 3 &&
    !input.reportSubmitted &&
    input.eventEndDate !== null &&
    input.now.getTime() >= postEventReportWindow(endInstant(input.eventEndDate)).opens.instant.getTime()
  ) {
    return { stage: POST_EVENT_STAGE, en: 'Post-event report', ar: 'التقرير الطبي لما بعد الفعالية' };
  }
  if (input.outcome) return { stage: 5, en: 'Ministry outcome recorded', ar: 'تسجيل نتيجة الوزارة' };
  return { stage: 4, en: 'Submitted', ar: 'التقديم' };
}

/** Material change: a state gate. Disabled until the submission is filed. */
export function materialChangeGate(ctx: EventGateContext): Gate {
  if (ctx.filed) return ENABLED;
  return { behaviour: 'disabled', reasonKey: 'gate.materialChangeBeforeFiling' };
}

/**
 * Event Medical Director: a level gate. The role exists only at Level 3 -- below it the
 * row is ABSENT, not greyed. Showing a greyed row implies there could be one.
 */
export function eventMedicalDirectorGate(ctx: EventGateContext): Gate {
  if (ctx.finalLevel === 3) return ENABLED;
  return ABSENT;
}

/**
 * The EMS readiness declaration: a level gate, like the Director. The ten-item
 * declaration exists only at Level 3; at Levels 1 and 2 there is no declaration at all,
 * so the row is ABSENT rather than greyed (rule 10).
 *
 * This test used to be written inline in the declaration route as `eventLevel !== 3`,
 * which meant the invitation screen could not consult it -- and it did not: it promised
 * every accepting provider that "the declaration opens", including at Level 2 where
 * nothing opens. One rule, both callers.
 */
export function emsDeclarationGate(finalLevel: Level | null): Gate {
  return finalLevel === 3 ? ENABLED : ABSENT;
}

/** The filing deadline for the record, derived -- never entered. */
export function eventFilingDeadline(ctx: EventGateContext): FilingDeadline | null {
  if (ctx.finalLevel === null || ctx.eventStartDate === null) return null;
  return filingDeadline(ctx.finalLevel, new Date(`${ctx.eventStartDate}T12:00:00+03:00`));
}

export interface VenueGateContext {
  /** YYYY-MM-DD; null when the venue has never been assessed. */
  validUntil: string | null;
  /** Today in Asia/Beirut, YYYY-MM-DD. */
  today: string;
  /** A reported change since the last assessment requires reassessment regardless. */
  changeReportedSinceAssessment: boolean;
}

/**
 * Annual reassessment: a time gate. Opens 60 days before the classification expires
 * (configured, not hard-coded); always open when the venue has never been assessed or
 * has expired; and a reported material change overrides the window entirely -- the
 * change cannot wait for the annual renewal.
 */
export function venueReassessmentGate(ctx: VenueGateContext): Gate {
  if (ctx.validUntil === null) return { behaviour: 'enabled' };
  if (ctx.changeReportedSinceAssessment) return { behaviour: 'enabled' };
  const windowDays = REASSESSMENT_WINDOW.opensDaysBeforeExpiry;
  const opens = addDays(isoToCalendar(ctx.validUntil), -windowDays);
  const opensIso = formatIsoDate(opens);
  if (ctx.today >= opensIso) return { behaviour: 'enabled' };
  return {
    behaviour: 'disabled',
    reasonKey: 'gate.venueReassessmentNotYetOpen',
    params: { date: opensIso, days: windowDays },
  };
}

function isoToCalendar(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y ?? 1970, month: m ?? 1, day: d ?? 1 };
}

/**
 * The four state chips (ROADMAP 1), used identically everywhere.
 * Slice 1 renders 'inForceNow' paths only; the other three arrive with the facility
 * service, but the vocabulary is fixed here so no screen invents its own.
 */
export type StateChip =
  | 'inForceNow'
  | 'partlyInForce'
  | 'awaitingMinistryValue'
  | 'determinedByReview';

/* ---------------- cancellation and postponement ---------------- */

import lifecycleJson from './data/lifecycle.json';

export const LIFECYCLE_CONTENT = lifecycleJson;

export type EventLifecycle = 'active' | 'cancelled' | 'postponed';

/**
 * What a lifecycle state permits. Cancellation closes the record: nothing further
 * files, the post-event report is not owed, the serious-incident route stays (an
 * incident before the cancellation may still need notifying inside its 24 hours).
 * Postponement leaves filing OPEN -- the revised submission for the new date is
 * filed through the normal route -- and the determination note rides wherever a
 * recorded determination shows.
 */
export function lifecyclePermits(lifecycle: EventLifecycle): {
  filing: boolean;
  postEventReport: boolean;
  determinationCarries: boolean;
} {
  if (lifecycle === 'cancelled') {
    return { filing: false, postEventReport: false, determinationCarries: true };
  }
  if (lifecycle === 'postponed') {
    return { filing: true, postEventReport: true, determinationCarries: false };
  }
  return { filing: true, postEventReport: true, determinationCarries: true };
}
