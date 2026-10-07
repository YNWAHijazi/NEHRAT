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
import { recordNextStep, resolveRequirements, type RecordFacts, type StoredAnswer } from '../lib/rules/record-requirements';
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

  it('Level 2 does not require major-incident items (owner update Sep 26)', () => {
    expect(planIsComplete(plan({}), 2)).toBe(true);
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

  it('Level 1 has no medical-plan requirement', () => {
    expect(planIsComplete(plan({}), 1)).toBe(false);
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

describe('non-negotiable 0 — the venue floor has a real unset state', () => {
  // Pass A: the event form seeded the venue flags `false`, so the venue conditions
  // could never report "incomplete naming the field" -- the level derived from a
  // question nobody was asked. One venue floor remains (club; the recur condition was
  // the Arabic issue's and English governs, partner ruling); the trap still holds:
  // in the rebuilt form the event-type dropdown answers the flag, and an unchosen
  // type leaves it null, which must surface as incomplete, never a level.
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
      inputs: { ...base, venueIsNightclubOrDanceVenue: null, },
    });
    expect(d.complete).toBe(false);
    expect(d.finalLevel).toBeNull();
    expect(d.missingInputs).toContain('venueIsNightclubOrDanceVenue');
  });

  it('a definite No settles the condition and derives', () => {
    const d = deriveLevel({
      answers,
      inputs: { ...base, venueIsNightclubOrDanceVenue: false, },
    });
    expect(d.complete).toBe(true);
    expect(d.finalLevel).toBe(1);
  });

  it('Yes without the capacity names the capacity as owed', () => {
    const d = deriveLevel({
      answers,
      inputs: { ...base, venueIsNightclubOrDanceVenue: true, },
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
      status: 'More information needed',
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

describe('the event record names ONE next action, from the resolver\'s own instances', () => {
  const facts = (level: 1 | 2 | 3, over: Partial<RecordFacts> = {}): RecordFacts => ({
    service: 'event', level, answers: {}, files: {}, organizerContact: { name: 'O', phone: '1' }, assessmentComplete: true,
    ems: [], director: null, planApprovalCurrent: false, declaration: { statementsComplete: false, certificationComplete: false }, requested: [], ...over,
  });
  const step = (f: RecordFacts, over: Partial<Parameters<typeof recordNextStep>[0]> = {}) =>
    recordNextStep({ service: 'event', level: f.level, editable: true, filed: false, returned: false, organizationPending: false, instances: resolveRequirements(f), ...over })!;

  it('no level derived is the assessment', () => {
    expect(recordNextStep({ service: 'event', level: null, editable: true, filed: false, returned: false, organizationPending: false, instances: [] })!.kind).toBe('assessment');
  });

  it("the organizer's own work comes first and names the first pending card", () => {
    const a = step(facts(1));
    expect(a.kind).toBe('requirements');
    expect(a.href).toBe('#req-B4');
    expect(a.tone).toBe('accent');
  });

  it('waiting on somebody else is named as waiting; the declaration follows; then the invitation to file', () => {
    const answered: Record<string, StoredAnswer> = {};
    const l2 = facts(2, { ems: [{ token: 'e', name: 'EMS', status: 'nominated' }] });
    for (const row of resolveRequirements(l2)) {
      if (row.fields.length === 0 || !row.authors.includes('organizer')) continue;
      const values: Record<string, string | boolean | number> = {};
      for (const f of row.fields) if (!f.showWhen) values[f.key] = f.type === 'checkbox' ? true : f.type === 'number' ? 2 : 'x';
      answered[row.key] = { values, savedByRole: 'organizer', savedByName: 'O', savedAt: '', version: 1 };
    }
    const waiting = step({ ...l2, answers: answered, files: { 'P-M': { fileName: 'm.pdf', savedAt: '' } } });
    expect(waiting.kind).toBe('waitingOnOthers');
    const confirmed = { ...l2, answers: { ...answered, B7: { values: { whereWhen: 'x', howToCall: 'x', ifLeaves: 'x' }, savedByRole: 'ems' as const, savedByName: 'E', savedAt: '', version: 1 } }, files: { 'P-M': { fileName: 'm.pdf', savedAt: '' } }, ems: [{ token: 'e', name: 'EMS', status: 'confirmed' as const }] };
    expect(step(confirmed).kind).toBe('declarations');
    const ready = step({ ...confirmed, declaration: { statementsComplete: true, certificationComplete: true } });
    expect(ready.kind).toBe('submit');
    expect(ready.tone).toBe('brand');
    expect(ready.href).toBe('#final-review');
  });

  it('pending registration shows only once the preparation is complete', () => {
    expect(step(facts(1), { organizationPending: true }).kind).toBe('requirements');
  });

  it('nothing leads once the record is with the Ministry', () => {
    expect(recordNextStep({ service: 'event', level: 1, editable: false, filed: true, returned: false, organizationPending: false, instances: [] })).toBeNull();
  });

  it('every state carries both languages and a button', () => {
    for (const f of [facts(1), facts(2), facts(3)]) {
      const a = step(f);
      for (const s of [a.titleEn, a.titleAr, a.bodyEn, a.bodyAr, a.buttonEn, a.buttonAr]) expect(s.trim().length).toBeGreaterThan(0);
    }
  });
});
