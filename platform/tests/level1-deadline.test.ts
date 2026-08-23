/**
 * Non-negotiable #10b and #11.
 *
 * Two obligations carry the figure 7 and are not the same thing. Conflating them is the
 * mistake that has already been made twice, so it gets its own file rather than a case
 * inside a general deadline suite.
 *
 *   filing deadline, Level 1   -- 7 calendar days BEFORE the event starts, conditional
 *   post-event report          -- opens the day after the event ENDS, due 7 days later
 */

import { describe, expect, it } from 'vitest';
import {
  filingDeadline,
  postEventReportWindow,
  postEventReportIsOpen,
  toBeirut,
  formatIsoDate,
} from '../lib/rules/deadlines';

// A single-day event: starts and ends 1 October 2026, Beirut.
const EVENT_START = new Date('2026-10-01T18:00:00+03:00');
const EVENT_END = new Date('2026-10-01T23:30:00+03:00');

describe('the Level 1 filing deadline', () => {
  it('returns a date 7 calendar days before the event starts', () => {
    const d = filingDeadline(1, EVENT_START);
    expect(d.leadTimeDays).toBe(7);
    expect(d.date).toBe('2026-09-24');
    expect(d.obligation).toBe('filing');
  });

  it('is conditional, and says so in both languages', () => {
    const d = filingDeadline(1, EVENT_START);
    // "Notification only" describes the nature of the filing, not an exemption from it.
    expect(d.conditional).toBe(true);
    expect(d.conditionEn).toBeTruthy();
    expect(d.conditionAr).toBeTruthy();
    expect(d.conditionEn).not.toBe(d.conditionAr);
  });

  it('is not conditional at Levels 2 and 3', () => {
    expect(filingDeadline(2, EVENT_START).conditional).toBe(false);
    expect(filingDeadline(3, EVENT_START).conditional).toBe(false);
  });

  it.each([
    [1, 7, '2026-09-24'],
    [2, 14, '2026-09-17'],
    [3, 30, '2026-09-01'],
  ] as const)('Level %i files %i days before, on %s', (level, days, date) => {
    const d = filingDeadline(level, EVENT_START);
    expect(d.leadTimeDays).toBe(days);
    expect(d.date).toBe(date);
  });
});

describe('the post-event report window', () => {
  it('opens the day after the event ends, and is due 7 days after that', () => {
    const w = postEventReportWindow(EVENT_END);
    expect(w.opens.date).toBe('2026-10-02');
    expect(w.windowDays).toBe(7);
    expect(w.due.date).toBe('2026-10-09');
    expect(w.obligation).toBe('postEventReport');
  });

  it('keys off the event END, not the start', () => {
    // A festival running 1-4 October. Off the start date the report would open on the 2nd,
    // three days before the event is over.
    const multiDayStart = new Date('2026-10-01T10:00:00+03:00');
    const multiDayEnd = new Date('2026-10-04T23:00:00+03:00');
    const w = postEventReportWindow(multiDayEnd);
    expect(w.opens.date).toBe('2026-10-05');
    expect(w.opens.date).not.toBe(
      formatIsoDate({ ...toBeirut(multiDayStart) }),
    );
  });

  it('opens at 00:00 Asia/Beirut, not the browser zone and not UTC', () => {
    const w = postEventReportWindow(EVENT_END);
    const wall = toBeirut(w.opens.instant);
    expect(wall.hour).toBe(0);
    expect(wall.minute).toBe(0);
    expect(formatIsoDate(wall)).toBe('2026-10-02');
    // 00:00 in Beirut is not 00:00 UTC.
    expect(w.opens.instant.getUTCHours()).not.toBe(0);
  });

  it('is closed a minute before it opens and open a minute after', () => {
    const w = postEventReportWindow(EVENT_END);
    const justBefore = new Date(w.opens.instant.getTime() - 60_000);
    const justAfter = new Date(w.opens.instant.getTime() + 60_000);
    expect(postEventReportIsOpen(EVENT_END, justBefore)).toBe(false);
    expect(postEventReportIsOpen(EVENT_END, justAfter)).toBe(true);
  });
});

describe('the two obligations are distinct', () => {
  it('the same figure of 7 produces two different dates for one event', () => {
    const filing = filingDeadline(1, EVENT_START);
    const post = postEventReportWindow(EVENT_END);
    expect(filing.date).toBe('2026-09-24');
    expect(post.due.date).toBe('2026-10-09');
    expect(filing.date).not.toBe(post.due.date);
  });

  it('one runs before the event and the other after', () => {
    const filing = filingDeadline(1, EVENT_START);
    const post = postEventReportWindow(EVENT_END);
    expect(filing.instant.getTime()).toBeLessThan(EVENT_START.getTime());
    expect(post.opens.instant.getTime()).toBeGreaterThan(EVENT_END.getTime());
  });

  it('carries a distinct obligation tag, so neither can stand in for the other', () => {
    expect(filingDeadline(1, EVENT_START).obligation).toBe('filing');
    expect(postEventReportWindow(EVENT_END).obligation).toBe('postEventReport');
  });
});

describe('daylight saving', () => {
  it('holds across the October transition', () => {
    // Lebanon leaves summer time in late October. A window spanning it must still land
    // on local midnight, not shift by an hour.
    const end = new Date('2026-10-24T20:00:00+03:00');
    const w = postEventReportWindow(end);
    expect(w.opens.date).toBe('2026-10-25');
    expect(toBeirut(w.opens.instant).hour).toBe(0);
    expect(toBeirut(w.due.instant).hour).toBe(0);
  });

  it('holds across the spring transition, where midnight does not exist', () => {
    // Lebanon's clocks jump from 23:59 to 01:00 entering summer time, so 00:00 on
    // 29 March 2026 never occurs. The gate opens at the first instant of that Beirut
    // day -- 01:00 wall clock -- not an hour early and not an hour late.
    const end = new Date('2026-03-28T20:00:00+02:00');
    const w = postEventReportWindow(end);
    expect(w.opens.date).toBe('2026-03-29');
    const wall = toBeirut(w.opens.instant);
    expect(`${wall.year}-${wall.month}-${wall.day}`).toBe('2026-3-29');
    // One minute earlier is still the previous Beirut day: nothing of 29 March
    // precedes the opening instant.
    const minuteBefore = toBeirut(new Date(w.opens.instant.getTime() - 60_000));
    expect(minuteBefore.day).toBe(28);
  });
});
