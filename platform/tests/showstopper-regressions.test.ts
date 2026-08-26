/**
 * Regression traps for the Pass A showstoppers. Each of these was a real defect that
 * survived six slices of a green suite; the trap is written against the WIRED rule.
 */

import { describe, expect, it } from 'vitest';
import {
  applicableDeclarations,
  certifyRowGroups,
  declarationsAreComplete,
  nextAction,
  planIsComplete,
  type PlanShape,
  type SubmissionBlocker,
} from '../lib/rules/submission';
import { requirementsForLevel } from '../lib/rules/requirements';
import { seriousIncidentGate } from '../lib/rules/gates';
import { facilityLedger, type LedgerInputs } from '../lib/rules/facility';
import { effectiveCycles } from '../lib/rules/ministry';
import { detectPersonalName } from '../lib/rules/pii';
import { deriveLevel } from '../lib/rules/derive';
import { resolvePublicLookup } from '../lib/rules/public-lookup';

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

  it('attach-mode confirmations do not survive a switch to write mode', () => {
    // Reviewer walk: confirm everything on the attach route, switch to write, and
    // every section showed done with no text. Write mode completes by text alone.
    const coveredOnly = Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [String(i + 1), { covered: true }]),
    );
    expect(
      planIsComplete({ mode: 'write', attachedFile: null, sections: coveredOnly, majorIncident: allMi }, 2),
    ).toBe(false);
    expect(
      planIsComplete({ mode: 'attach', attachedFile: 'plan.pdf', sections: coveredOnly, majorIncident: allMi }, 2),
    ).toBe(true);
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

describe('non-negotiable 7 — the name gate catches the bare capitalized name', () => {
  // Pass B journey 4: this exact narrative passed the gate and was stored. A detector
  // that catches honorifics but not a bare name teaches people it works. Absolute rule.
  it('the canonical narrative is blocked', () => {
    expect(detectPersonalName('Ali Hassan collapsed near the east stand.')).toBe(true);
  });

  it('the precise shapes still catch', () => {
    expect(detectPersonalName('Mr Haddad was treated on site.')).toBe(true);
    expect(detectPersonalName('The patient Sara Khalil was transported.')).toBe(true);
    expect(detectPersonalName('المريض اسمه علي حسن')).toBe(true);
  });

  it('domain vocabulary does not cry wolf', () => {
    expect(detectPersonalName('The Beirut Marathon treatment post handled eleven cases.')).toBe(false);
    expect(detectPersonalName('Municipal Stadium main stand, near Gate Two.')).toBe(false);
    expect(detectPersonalName('The Red Cross attended and transported one case.')).toBe(false);
    expect(detectPersonalName('AED applied at the pool deck; CPR continued to handover.')).toBe(false);
  });

  it('a proper-noun pair flags even at sentence start', () => {
    expect(detectPersonalName('Karim Fares was assisted by staff.')).toBe(true);
  });
});

describe('non-negotiable 0 — the two venue floors have a real unset state', () => {
  // Pass A: the event form seeded both flags `false`, so these two conditions could
  // never report "incomplete naming the field" -- the level derived from a question
  // nobody was asked. The form is now tri-state; these traps hold the rule.
  const answers = Array(9).fill(0) as (0 | 1 | 2)[];
  const base = {
    expectedMaxSimultaneousAttendance: 500,
    eventDisciplines: [] as string[],
    courseDistanceKm: null,
    venueLicensedCapacity: null,
  };

  it('unanswered venue questions return incomplete, naming them — never a level', () => {
    const d = deriveLevel({
      answers,
      inputs: { ...base, venueIsNightclubOrDanceVenue: null, venueRegularlyHostsOrganizedEvents: null },
    });
    expect(d.complete).toBe(false);
    expect(d.finalLevel).toBeNull();
    expect(d.missingInputs).toContain('venueIsNightclubOrDanceVenue');
    expect(d.missingInputs).toContain('venueRegularlyHostsOrganizedEvents');
  });

  it('a definite No settles the condition and derives', () => {
    const d = deriveLevel({
      answers,
      inputs: { ...base, venueIsNightclubOrDanceVenue: false, venueRegularlyHostsOrganizedEvents: false },
    });
    expect(d.complete).toBe(true);
    expect(d.finalLevel).toBe(1);
  });

  it('Yes without the capacity names the capacity as owed', () => {
    const d = deriveLevel({
      answers,
      inputs: { ...base, venueIsNightclubOrDanceVenue: true, venueRegularlyHostsOrganizedEvents: false },
    });
    expect(d.complete).toBe(false);
    expect(d.missingInputs).toContain('venueLicensedCapacity');
  });

  it('Yes with a licensed capacity at or above the threshold raises the floor to Level 2', () => {
    const d = deriveLevel({
      answers,
      inputs: {
        ...base,
        venueLicensedCapacity: 1200,
        venueIsNightclubOrDanceVenue: true,
        venueRegularlyHostsOrganizedEvents: false,
      },
    });
    expect(d.complete).toBe(true);
    expect(d.finalLevel).toBe(2);
    expect(d.governedBy).toBe('minimumCondition');
  });
});

describe('the public register never invents a level', () => {
  // Pass C re-walk (N1): the lookup read `derivedLevelFor(id) ?? 1`, so an event with
  // no derivable level was published to the national register as Level 1.
  it('the four-field result carries a null level rather than the lowest band', () => {
    const record = {
      referenceNumber: 'MOPH-EV-2026-0001',
      eventName: 'Unassessed event',
      level: null,
      status: 'Submission received but incomplete',
      isDemo: false,
      eventStartDate: '2026-09-01',
    };
    const out = resolvePublicLookup(
      { referenceNumber: record.referenceNumber, eventStartDate: '2026-09-01' },
      () => record,
    );
    expect(out.exists).toBe(true);
    expect(out.level).toBeNull();
  });
});

describe('the event record names ONE next action, from the gate\'s own blockers', () => {
  const b = (kind: SubmissionBlocker['kind'], docKey?: string): SubmissionBlocker =>
    docKey
      ? { kind, docKey, itemEn: 'x', itemAr: 'x' }
      : { kind, itemEn: 'x', itemAr: 'x' };

  it('nothing outstanding is the invitation to file', () => {
    const a = nextAction([]);
    expect(a.kind).toBe('ready');
    expect(a.tone).toBe('brand');
    expect(a.href).toBe('submit');
    expect(a.titleEn).toBe('File the submission');
    expect(a.bodyEn).toBe('Everything the level requires is in place.');
  });

  it('an attachable document asks for an attachment; the plan asks to be written', () => {
    expect(nextAction([b('documentMissing', 'siteMap')]).kind).toBe('documents');
    expect(nextAction([b('documentMissing', 'siteMap')]).titleEn).toBe('Attach the outstanding document');
    // The plan and the compliance form are completed ON the platform: telling the
    // organizer to "attach" them would send them to a screen with no such control.
    const planAction = nextAction([b('documentMissing', 'plan')]);
    expect(planAction.kind).toBe('plan');
    expect(planAction.href).toBe('plan');
  });

  it('waiting on somebody else says so, and says nothing is owed meanwhile', () => {
    const a = nextAction([b('providerUnanswered')]);
    expect(a.kind).toBe('waitingOnOthers');
    expect(a.titleEn).toBe('Wait for the named provider to answer');
    expect(a.bodyEn).toContain('Nothing is owed by you meanwhile');
    expect(a.bodyEn).toContain('A nomination is not a confirmation');
  });

  it('the organizer\'s own work outranks waiting on others', () => {
    // A page full of amber must lead with the thing the organizer can actually do.
    expect(nextAction([b('providerUnanswered'), b('documentMissing', 'siteMap')]).kind).toBe('documents');
    expect(nextAction([b('providerUnanswered'), b('directorMissing')]).kind).toBe('director');
  });

  it('a pending organization outranks everything: nothing else unblocks filing', () => {
    const a = nextAction([b('organizationPending'), b('documentMissing', 'siteMap')]);
    expect(a.kind).toBe('organizationPending');
    expect(a.href).toBe('organization');
  });

  it('every state carries both languages and a button', () => {
    for (const blockers of [[], [b('documentMissing', 'siteMap')], [b('documentMissing', 'plan')], [b('providerUnanswered')], [b('directorMissing')], [b('declarationsIncomplete')], [b('organizationPending')]]) {
      const a = nextAction(blockers);
      for (const s of [a.titleEn, a.titleAr, a.bodyEn, a.bodyAr, a.buttonEn, a.buttonAr]) {
        expect(s.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('the certify-to rows group by what the level added', () => {
  it('every row lands in exactly one group, and the counts derive', () => {
    for (const level of [1, 2, 3] as const) {
      const rows = requirementsForLevel(level);
      const g = certifyRowGroups(rows);
      expect(g.everyLevel.length + g.addedOrRaised.length).toBe(rows.length);
      expect(g.everyLevel.some((r) => r.raised)).toBe(false);
      expect(g.addedOrRaised.every((r) => r.raised)).toBe(true);
    }
  });

  it('Level 1 adds nothing -- there is no level below it', () => {
    expect(certifyRowGroups(requirementsForLevel(1)).addedOrRaised).toEqual([]);
  });
});
