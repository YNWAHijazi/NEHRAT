/**
 * Date gates, computed in Asia/Beirut.
 *
 * Non-negotiable #11: not the browser's zone, not UTC. Lebanon observes daylight saving,
 * so an offset cannot be hard-coded; every conversion goes through the IANA zone.
 *
 * Two obligations carry the same figure of 7 days and are NOT the same thing:
 *
 *   filingDeadline(1, ...)      -- 7 calendar days BEFORE the event starts, conditional
 *   postEventReportDue(...)     -- 7 calendar days AFTER the report opens, which is the
 *                                  day after the event ENDS
 *
 * They are named apart, typed apart and tested apart on purpose.
 */

import { TIMEZONE, filingDeadlineRule, POST_EVENT_REPORT } from './load';
import type { Level } from './types';

export interface CalendarDate {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
}

/** `YYYY-MM-DD`, the only date format this platform renders. Never reversed under RTL. */
export function formatIsoDate(d: CalendarDate): string {
  const mm = String(d.month).padStart(2, '0');
  const dd = String(d.day).padStart(2, '0');
  return `${d.year}-${mm}-${dd}`;
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

interface WallClock extends CalendarDate {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

/** The Beirut wall-clock reading of an instant. */
export function toBeirut(instant: Date): WallClock {
  const parts = partsFormatter.formatToParts(instant);
  const get = (type: string): number => {
    const found = parts.find((p) => p.type === type);
    if (!found) throw new Error(`Missing date part: ${type}`);
    return Number(found.value);
  };
  // Intl renders midnight as hour 24 in some engines; normalise it.
  const hour = get('hour') % 24;
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

function offsetMsAt(instant: Date): number {
  const w = toBeirut(instant);
  const asIfUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asIfUtc - instant.getTime();
}

/**
 * The instant at which a given Beirut wall-clock time occurs.
 *
 * Resolved by refining the offset, so it stays correct across a daylight-saving boundary
 * rather than only away from one.
 */
export function fromBeirut(wall: WallClock): Date {
  const target = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  let instant = new Date(target - offsetMsAt(new Date(target)));
  const refined = offsetMsAt(instant);
  const corrected = new Date(target - refined);
  if (corrected.getTime() !== instant.getTime()) instant = corrected;
  return instant;
}

/** Calendar arithmetic on the date parts, immune to daylight saving. */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * The first instant of a Beirut calendar day.
 *
 * Usually 00:00. On the night Lebanon enters summer time the clocks jump from 23:59 to
 * 01:00, so midnight does not exist; this returns the first instant that does -- 01:00
 * wall clock. Nothing of that calendar day precedes the returned instant, which is the
 * property every date gate actually needs.
 */
export function startOfBeirutDay(date: CalendarDate): Date {
  return fromBeirut({ ...date, hour: 0, minute: 0, second: 0 });
}

export interface Deadline {
  /** The date to render. Deadlines are shown as dates, never as "soon" or "3 days left". */
  readonly date: string;
  readonly calendarDate: CalendarDate;
  /** 00:00 Asia/Beirut on that date. */
  readonly instant: Date;
}

function deadlineFrom(date: CalendarDate): Deadline {
  return { date: formatIsoDate(date), calendarDate: date, instant: startOfBeirutDay(date) };
}

/**
 * The filing deadline: the last day on which the submission may be filed.
 *
 * Level 1 is conditional -- filed before final event authorization is issued, and where no
 * external authorization is required, at least the configured lead time before the event.
 * The word "notification" describes the nature of the filing, not an exemption from it.
 */
export interface FilingDeadline extends Deadline {
  readonly level: Level;
  readonly leadTimeDays: number;
  readonly conditional: boolean;
  readonly conditionEn: string | null;
  readonly conditionAr: string | null;
  readonly obligation: 'filing';
}

export function filingDeadline(level: Level, eventStart: Date): FilingDeadline {
  const rule = filingDeadlineRule(level);
  const startDate = toBeirut(eventStart);
  const due = addDays(startDate, -rule.leadTimeDays);
  return {
    ...deadlineFrom(due),
    level,
    leadTimeDays: rule.leadTimeDays,
    conditional: rule.conditional,
    conditionEn: rule.conditionEn ?? null,
    conditionAr: rule.conditionAr ?? null,
    obligation: 'filing',
  };
}

/**
 * When the post-event report becomes available: 00:00 Asia/Beirut on the day after the
 * event ENDS. Not the start date -- non-negotiable #11.
 */
export interface PostEventWindow {
  readonly opens: Deadline;
  readonly due: Deadline;
  readonly windowDays: number;
  readonly obligation: 'postEventReport';
}

export function postEventReportWindow(eventEnd: Date): PostEventWindow {
  const endDate = toBeirut(eventEnd);
  const opensDate = addDays(endDate, 1);
  const windowDays = POST_EVENT_REPORT.windowDays;
  const dueDate = addDays(opensDate, windowDays);
  return {
    opens: deadlineFrom(opensDate),
    due: deadlineFrom(dueDate),
    windowDays,
    obligation: 'postEventReport',
  };
}

