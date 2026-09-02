/**
 * Previous services (partner ruling, 2026-09-02): a record is archived when the
 * Ministry or the owner shelves it, OR automatically once the configured window
 * has elapsed after the event ends. One rule decides the dashboard partition,
 * the read-only band and every mutating action's refusal — these tests hold the
 * rule to its edges and the window to its configured-not-constant promise.
 */

import { describe, expect, it } from 'vitest';
import { ARCHIVE_WINDOW, isArchivedRecord } from '../lib/rules';

describe('the archive rule', () => {
  it('an explicit archive wins regardless of dates', () => {
    expect(isArchivedRecord({ archivedAt: '2026-01-01T00:00:00', endDate: null }, '2026-01-02', 30)).toBe(true);
    expect(isArchivedRecord({ archivedAt: '2026-01-01T00:00:00', endDate: '2099-01-01' }, '2026-01-02', 30)).toBe(true);
  });

  it('a record with no end date never auto-archives', () => {
    expect(isArchivedRecord({ archivedAt: null, endDate: null }, '2099-01-01', 30)).toBe(false);
  });

  it('auto-archive turns exactly at the window boundary', () => {
    const rec = { archivedAt: null, endDate: '2026-06-01' };
    // 30 days after 2026-06-01 is 2026-07-01: the day it moves.
    expect(isArchivedRecord(rec, '2026-06-30', 30)).toBe(false);
    expect(isArchivedRecord(rec, '2026-07-01', 30)).toBe(true);
    expect(isArchivedRecord(rec, '2026-07-02', 30)).toBe(true);
  });

  it('the window is data, not a constant in the rule', () => {
    const rec = { archivedAt: null, endDate: '2026-06-01' };
    expect(isArchivedRecord(rec, '2026-06-15', 7)).toBe(true);
    expect(isArchivedRecord(rec, '2026-06-15', 60)).toBe(false);
  });

  it('the default window comes from lifecycle data and is positive', () => {
    expect(ARCHIVE_WINDOW.windowDays).toBeGreaterThan(0);
  });
});
