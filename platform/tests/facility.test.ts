/**
 * The cardiac-arrest instrument's derivations (Slice 4).
 *
 * The rules under test: the category determination ends the journey exactly for
 * awaitingMinistryValue (a school leaves having done everything available to it --
 * ROADMAP 2d); the validity ledger derives every date and returns notRecorded, never
 * a guess, for an unset input; the 12 shortfalls derive from captured facts.
 */
import { describe, expect, it } from 'vitest';
import {
  FACILITY_CATEGORIES,
  categoryEndsJourney,
  facilityCategory,
  facilityLedger,
  facilityStanding,
  obligationStatus,
  addMonthsIso,
  referenceShortfalls,
  type LedgerInputs,
} from '../lib/rules/facility';
import { detectPersonalName } from '../lib/rules/pii';

const BASE: LedgerInputs = {
  earliestPadExpiry: '2026-10-02',
  padAffirmed: '2024-10-02',
  earliestBatteryExpiry: '2027-03-18',
  batteryAffirmed: '2025-03-18',
  oldestCheck: '2026-07-28',
  drillDate: '2025-11-04',
  confirmedAt: '2025-09-12',
  coordinatorUpdatedAt: '2026-06-01',
  hasDevices: true,
  today: '2026-08-13',
};

describe('the category determination', () => {
  it('carries six categories, each with one of the four state chips', () => {
    expect(FACILITY_CATEGORIES).toHaveLength(6);
    for (const c of FACILITY_CATEGORIES) {
      expect(['inForceNow', 'partlyInForce', 'awaitingMinistryValue', 'determinedByReview']).toContain(c.state);
    }
  });

  it('ends the journey exactly where a Ministry value is awaited', () => {
    const ended = FACILITY_CATEGORIES.filter(categoryEndsJourney).map((c) => c.key);
    expect(ended).toEqual(['education', 'remote', 'designated']);
  });

  it('a school leaves with the missing value named', () => {
    const education = facilityCategory('education');
    expect(education).not.toBeNull();
    expect(education?.missingEn).toBe('The phased implementation schedule');
    expect(education?.missingAr).toBe('خطة التنفيذ المرحلية');
  });

  it('a review category proceeds -- the review states what is required', () => {
    const prior = facilityCategory('priorArrest');
    expect(prior?.state).toBe('determinedByReview');
    expect(categoryEndsJourney(prior!)).toBe(false);
  });

  it('the sports category is also a recurring venue cross-reference', () => {
    expect(facilityCategory('sports')?.alsoRecurringVenue).toBe(true);
  });
});

describe('the validity ledger', () => {
  it('reproduces the reference ledger dates at the review clock', () => {
    const rows = facilityLedger(BASE);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey['padExpiry']?.until).toBe('2026-10-02');
    expect(byKey['batteryExpiry']?.until).toBe('2027-03-18');
    expect(byKey['latestCheck']?.until).toBe('2026-10-26'); // +90 days, data not code
    expect(byKey['drill']?.until).toBe('2026-11-04');
    expect(byKey['annualConfirmation']?.until).toBe('2026-09-12');
    expect(byKey['coordinator']?.until).toBe('2027-06-01');
  });

  it('statuses follow the lapse window from data', () => {
    expect(obligationStatus('2026-10-02', '2026-08-13')).toBe('lapsing'); // 50 days out
    expect(obligationStatus('2027-03-18', '2026-08-13')).toBe('current');
    expect(obligationStatus('2026-08-12', '2026-08-13')).toBe('lapsed');
    expect(obligationStatus(null, '2026-08-13')).toBe('notRecorded');
  });

  it('an unset input is notRecorded, never a level or a guess', () => {
    const rows = facilityLedger({
      ...BASE,
      drillDate: null,
      confirmedAt: null,
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey['drill']?.status).toBe('notRecorded');
    expect(byKey['annualConfirmation']?.status).toBe('notRecorded');
  });

  it('a facility with no devices has device obligations notRecorded', () => {
    const rows = facilityLedger({
      ...BASE,
      hasDevices: false,
      earliestPadExpiry: null,
      padAffirmed: null,
      earliestBatteryExpiry: null,
      batteryAffirmed: null,
      oldestCheck: null,
    });
    expect(rows.filter((r) => r.status === 'notRecorded')).toHaveLength(3);
  });

  it('standing treats notRecorded as not being met', () => {
    const rows = facilityLedger({ ...BASE, drillDate: null });
    expect(facilityStanding(rows).kind).toBe('lapsed');
  });

  it('standing is lapsing when something lapses inside the window and nothing is out', () => {
    const rows = facilityLedger({ ...BASE, today: '2026-08-13' });
    // pad expiry 2026-10-02 and annual confirmation 2026-09-12 are inside 60 days
    expect(facilityStanding(rows).kind).toBe('lapsing');
    expect(facilityStanding(rows).lapsingCount).toBeGreaterThan(0);
  });

  it('month addition clamps to the target month', () => {
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsIso('2025-09-12', 12)).toBe('2026-09-12');
  });
});

describe('the 12 reference shortfalls', () => {
  const facts = { count: 3, locationsEn: [], locationsAr: [], anyPediatric: false, planConfirmed: true };

  it('pediatric shortfall derives from admits-children plus no pediatric device', () => {
    expect(referenceShortfalls(facts, { admitsChildren: true, temporaryAreas: false }).map((s) => s.key)).toEqual(['pediatric']);
  });

  it('no pediatric shortfall where a device is pediatric-capable', () => {
    expect(
      referenceShortfalls({ ...facts, anyPediatric: true }, { admitsChildren: true, temporaryAreas: false }),
    ).toEqual([]);
  });

  it('temporary areas always fall outside the registered footprint', () => {
    expect(referenceShortfalls(facts, { admitsChildren: false, temporaryAreas: true }).map((s) => s.key)).toEqual(['footprint']);
  });
});

describe('the incident narrative name check (non-negotiable 7)', () => {
  it('blocks honorific-plus-name shapes in both languages', () => {
    expect(detectPersonalName('Mr Haddad collapsed near the pool')).toBe(true);
    expect(detectPersonalName('السيد كرم سقط قرب المسبح')).toBe(true);
  });
  it('passes a narrative written about "the patient"', () => {
    expect(detectPersonalName('The patient collapsed; staff started CPR and applied the AED.')).toBe(false);
    expect(detectPersonalName('سقط المريض وبدأ الموظفون الإنعاش.')).toBe(false);
  });
});
