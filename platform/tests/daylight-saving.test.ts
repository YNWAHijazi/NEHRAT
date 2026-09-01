/**
 * Daylight saving, which the suite did not cover.
 *
 * A status report claimed "existing boundary tests cover one minute before/after and
 * DST transitions." Half true: tests/level1-deadline.test.ts covers the Beirut midnight
 * boundary and multi-day events, and there was no DST test anywhere. Writing it found
 * a real defect, which is the argument for writing rather than citing.
 *
 * WHY IT MATTERS HERE. Lebanon is UTC+03:00 in summer (EEST) and UTC+02:00 in winter
 * (EET). A hard-coded `+03:00` is therefore wrong for roughly half the year. At NOON
 * that is harmless -- an hour either way cannot change the calendar day, which is why
 * five of the six hard-coded offsets in this codebase were fine. At MIDNIGHT it is not:
 * `2026-01-15T00:00:00+03:00` is 23:00 on the 14th in Beirut, so a gate keyed to it
 * opens a calendar day early, all winter, without failing.
 *
 * seriousIncidentGate held the sixth. It now uses startOfBeirutDay like everything
 * else, which resolves the offset for the actual instant and refines it.
 *
 * Lebanon's changeovers are the last Sunday of March and the last Sunday of October:
 * 29 March 2026 and 25 October 2026. Note that the country has moved a changeover by
 * decision before -- in 2023 the spring transition was postponed mid-season -- which is
 * exactly why these dates are derived from the IANA database at runtime rather than
 * written into the rules.
 */

import { describe, expect, it } from 'vitest';
import { filesUnder, read, relative } from './helpers/files';
import { startOfBeirutDay, toBeirut, fromBeirut, postEventReportWindow } from '../lib/rules/deadlines';
import { seriousIncidentGate } from '../lib/rules/gates';

/** The UTC offset Beirut is on at a given instant, in hours. */
function beirutOffsetHours(instant: Date): number {
  const wall = toBeirut(instant);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return Math.round((asUtc - instant.getTime()) / 3_600_000);
}

describe('Beirut observes daylight saving, and the rules must too', () => {
  it('the zone really does shift between +02:00 and +03:00 (wired to real data)', () => {
    // Without this the tests below could all pass in a runtime with no zone data,
    // where every offset is 0 and every assertion about "the same wall clock" holds
    // vacuously.
    const january = new Date('2026-01-15T10:00:00Z');
    const july = new Date('2026-07-15T10:00:00Z');
    expect(beirutOffsetHours(january)).toBe(2);
    expect(beirutOffsetHours(july)).toBe(3);
  });

  it('startOfBeirutDay is real midnight in BOTH seasons, not a fixed offset', () => {
    for (const [label, date] of [
      ['winter', { year: 2026, month: 1, day: 15 }],
      ['summer', { year: 2026, month: 7, day: 15 }],
    ] as const) {
      const instant = startOfBeirutDay(date);
      const wall = toBeirut(instant);
      expect(wall.hour, `${label}: not midnight`).toBe(0);
      expect(wall.day, `${label}: wrong day`).toBe(date.day);
      expect(wall.month, `${label}: wrong month`).toBe(date.month);
    }
  });

  it('a hard-coded +03:00 midnight lands on the WRONG DAY in winter — the defect', () => {
    // The bug that was in seriousIncidentGate, demonstrated rather than described.
    const handBuilt = new Date('2026-01-15T00:00:00+03:00');
    expect(toBeirut(handBuilt).day, 'the literal offset should slip to the 14th').toBe(14);
    expect(toBeirut(handBuilt).hour).toBe(23);

    // And the corrected form does not.
    const correct = startOfBeirutDay({ year: 2026, month: 1, day: 15 });
    expect(toBeirut(correct).day).toBe(15);
    expect(toBeirut(correct).hour).toBe(0);
  });

  it('the serious-incident gate opens on the event day in winter, not the day before', () => {
    const base = {
      filed: true,
      eventStartDate: '2026-01-15',
      eventEndDate: '2026-01-15',
      lifecycle: 'active' as const,
    };
    // 23:30 Beirut on the 14th — after the hand-built instant, before real midnight.
    const eveningBefore = fromBeirut({ year: 2026, month: 1, day: 14, hour: 23, minute: 30, second: 0 });
    expect(
      seriousIncidentGate({ ...base, now: eveningBefore } as never).behaviour,
      'the gate opened before the event day began',
    ).toBe('disabled');

    const justAfterMidnight = fromBeirut({ year: 2026, month: 1, day: 15, hour: 0, minute: 1, second: 0 });
    expect(seriousIncidentGate({ ...base, now: justAfterMidnight } as never).behaviour).toBe('enabled');
  });

  it('the post-event window opens on the right calendar DAY across both changeovers', () => {
    // Autumn: clocks go back at 03:00 on 25 October 2026. Midnight that day exists
    // and is ordinary, so the window opens at 00:00 as the rule says.
    const endedBeforeAutumn = fromBeirut({ year: 2026, month: 10, day: 24, hour: 22, minute: 0, second: 0 });
    const autumn = postEventReportWindow(endedBeforeAutumn);
    expect(autumn.opens.date).toBe('2026-10-25');
    const autumnWall = toBeirut(autumn.opens.instant);
    expect(autumnWall.day).toBe(25);
    expect(autumnWall.hour).toBe(0);

    // SPRING IS THE INTERESTING ONE, and it is why this asserts the DAY rather than
    // the hour. Lebanon springs forward at 00:00 on 29 March 2026: the clock goes from
    // 23:59:59 on the 28th straight to 01:00:00 on the 29th. MIDNIGHT DOES NOT EXIST
    // THAT DAY. Non-negotiable 11 says the window opens "00:00 Asia/Beirut the day
    // after the event ends", and once a year that instant is not on the calendar.
    //
    // startOfBeirutDay resolves it to 01:00 on the 29th -- the first instant of the
    // correct day, which is the only defensible reading. Asserting hour === 0 here
    // would have been asserting that a nonexistent time exists, and would have failed
    // once a year against correct code.
    const endedBeforeSpring = fromBeirut({ year: 2026, month: 3, day: 28, hour: 22, minute: 0, second: 0 });
    const spring = postEventReportWindow(endedBeforeSpring);
    expect(spring.opens.date).toBe('2026-03-29');
    const springWall = toBeirut(spring.opens.instant);
    expect(springWall.day, 'the window must open on the day after the event ends').toBe(29);
    expect(springWall.hour, 'the first instant of a day with no midnight is 01:00').toBe(1);

    // And it is genuinely the FIRST instant of that day: a minute earlier is the 28th.
    const aMinuteEarlier = new Date(spring.opens.instant.getTime() - 60_000);
    expect(toBeirut(aMinuteEarlier).day).toBe(28);
  });

  it('no rule builds a Beirut midnight from a literal offset', () => {
    // Swept, not named. A literal offset at midnight is the defect above; anywhere it
    // appears again it is the same defect. Noon literals are left alone deliberately —
    // an hour cannot move the date — so this looks only for boundary times.
    // SWEPT, NOT NAMED. Named inputs were refused here once already, for good
    // reason: a file added with a literal midnight would join the codebase without
    // joining this check. Noon literals are deliberately left alone — an hour cannot
    // move the calendar date — so this looks only at boundary times.
    const sources = [...filesUnder('lib', ['.ts']), ...filesUnder('app', ['.ts', '.tsx'])];
    expect(sources.length, 'the sweep found no files').toBeGreaterThan(50);
    const offenders: string[] = [];
    for (const file of sources) {
      for (const line of read(file).split('\n')) {
        if (/T00:00:00\+0[23]:00/.test(line)) offenders.push(`${relative(file)}: ${line.trim()}`);
      }
    }
    expect(
      offenders,
      'A midnight built from a literal offset is a calendar-day error for half the ' +
        'year. Use startOfBeirutDay, which resolves the offset for the actual instant.',
    ).toEqual([]);
  });
});
