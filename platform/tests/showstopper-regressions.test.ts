/**
 * Regression traps for the Pass A showstoppers. Each of these was a real defect that
 * survived six slices of a green suite; the trap is written against the WIRED rule.
 */

import { describe, expect, it } from 'vitest';
import {
  applicableDeclarations,
  declarationsAreComplete,
  planIsComplete,
  type PlanShape,
} from '../lib/rules/submission';
import { seriousIncidentGate } from '../lib/rules/gates';
import { facilityLedger, type LedgerInputs } from '../lib/rules/facility';
import { effectiveCycles } from '../lib/rules/ministry';

describe('showstopper 1 — the declaration gate counts what the form renders', () => {
  it('Level 1 renders six declarations and completes on exactly those six', () => {
    const applicable = applicableDeclarations(1);
    expect(applicable).toHaveLength(6);
    const ticked: Record<string, boolean> = {};
    applicable.forEach((_, i) => {
      ticked[String(i)] = true;
    });
    // The old hard-coded count demanded a seventh tick the form never showed --
    // filing was silently impossible at Levels 1 and 2.
    expect(declarationsAreComplete(ticked, 1)).toBe(true);
  });

  it('Level 2 completes on six; Level 3 needs all eight', () => {
    expect(applicableDeclarations(2)).toHaveLength(6);
    expect(applicableDeclarations(3)).toHaveLength(8);
    const six = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [String(i), true]));
    expect(declarationsAreComplete(six, 2)).toBe(true);
    expect(declarationsAreComplete(six, 3)).toBe(false);
  });

  it('one untick blocks, and null blocks', () => {
    const five = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [String(i), true]));
    expect(declarationsAreComplete(five, 1)).toBe(false);
    expect(declarationsAreComplete(null, 1)).toBe(false);
  });
});

describe('showstopper 2 — the eleven major-incident items gate filing at Level 2 and 3', () => {
  const fullSections = Object.fromEntries(
    Array.from({ length: 16 }, (_, i) => [String(i + 1), { text: 'addressed' }]),
  );
  const allMi = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [String(i + 1), { covered: true }]));
  const plan = (majorIncident: PlanShape['majorIncident']): PlanShape => ({
    mode: 'write',
    attachedFile: null,
    sections: fullSections,
    majorIncident,
  });

  it('sixteen sections alone are NOT a complete Level 2 plan', () => {
    expect(planIsComplete(plan({}), 2)).toBe(false);
  });

  it('ten of eleven confirmed still blocks', () => {
    const tenOfEleven = { ...allMi };
    delete tenOfEleven['11'];
    expect(planIsComplete(plan(tenOfEleven), 3)).toBe(false);
  });

  it('all eleven confirmed completes at Level 2 and 3', () => {
    expect(planIsComplete(plan(allMi), 2)).toBe(true);
    expect(planIsComplete(plan(allMi), 3)).toBe(true);
  });

  it('Level 1 does not carry the eleven', () => {
    expect(planIsComplete(plan({}), 1)).toBe(true);
  });
});

describe('showstopper 3 — the notification gate opens at the event, not at the report window', () => {
  const ctx = (over: Partial<Parameters<typeof seriousIncidentGate>[0]>) => ({
    finalLevel: 3 as const,
    eventEndDate: '2026-09-20',
    eventStartDate: '2026-09-19',
    filed: true,
    organizationStatus: 'recorded' as const,
    now: new Date('2026-09-19T08:00:00+03:00'),
    ...over,
  });

  it('open mid-event — hours after the start, days before the report window', () => {
    expect(seriousIncidentGate(ctx({})).behaviour).toBe('enabled');
  });

  it('disabled with the date before the event begins', () => {
    const g = seriousIncidentGate(ctx({ now: new Date('2026-09-18T23:00:00+03:00') }));
    expect(g.behaviour).toBe('disabled');
    expect(g.params?.['date']).toBe('2026-09-19');
  });

  it('disabled before filing — an unfiled event is not in the process', () => {
    expect(seriousIncidentGate(ctx({ filed: false })).behaviour).toBe('disabled');
  });
});

describe('showstopper 5 — published cycles govern the ledger', () => {
  const inputs = (cycles?: LedgerInputs['cycles']): LedgerInputs => {
    const base: LedgerInputs = {
      earliestPadExpiry: null,
      padAffirmed: null,
      earliestBatteryExpiry: null,
      batteryAffirmed: null,
      oldestCheck: '2026-08-01',
      drillDate: null,
      confirmedAt: null,
      coordinatorUpdatedAt: null,
      hasDevices: false,
      today: '2026-08-13',
    };
    return cycles ? { ...base, cycles } : base;
  };

  it('a published check cycle changes the derived date; the provisional applies only unset', () => {
    const provisional = facilityLedger(inputs());
    const published = facilityLedger(
      inputs(effectiveCycles({ checkCycleDays: 10, lapseWindowDays: 5 })),
    );
    const check = (rows: typeof provisional) => rows.find((r) => r.key === 'latestCheck')!;
    expect(check(published).until).toBe('2026-08-11');
    expect(check(published).until).not.toBe(check(provisional).until);
    expect(check(published).status).toBe('lapsed');
  });

  it('effectiveCycles reports provisional only while a value is unset', () => {
    expect(effectiveCycles({}).provisional).toBe(true);
    expect(effectiveCycles({ checkCycleDays: 10, lapseWindowDays: 5 }).provisional).toBe(false);
  });
});
