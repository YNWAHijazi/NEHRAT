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

import { addDays, formatIsoDate, postEventReportWindow, filingDeadline, type FilingDeadline } from './deadlines';
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
  organizationStatus: 'none' | 'pending' | 'recorded';
  now: Date;
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
  const start = new Date(`${ctx.eventStartDate}T00:00:00+03:00`);
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
