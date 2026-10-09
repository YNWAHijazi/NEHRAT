import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { filesUnder } from './helpers/files';
import {
  venueSubmissionChecks, venueRailStages, venueStatusForDecision, venuePackageEditable,
  arabicCount, VENUE_STATUS, type VenuePackageFacts,
} from '../lib/rules/venue-workflow';
import ministryJson from '../lib/rules/data/ministry.json';

/** A Level 2 draft with everything in place: every test changes one thing. */
function ready(over: Partial<VenuePackageFacts> = {}): VenuePackageFacts {
  return {
    editable: true, status: 'draft', detailsDone: true, assessmentDone: true, level: 2, assessmentVersion: 1,
    requirements: [
      { key: 'V1', en: 'Layout and zones', ar: 'المخطط العام والمناطق', optional: false, done: true },
      { key: 'V2', en: 'Emergency vehicle access', ar: 'وصول مركبات الطوارئ', optional: false, done: true },
      { key: 'V6', en: 'Other venue characteristics', ar: 'خصائص أخرى للموقع', optional: true, done: false },
      { key: 'V7', en: 'AEDs and cardiac-arrest readiness', ar: 'أجهزة إزالة الرجفان والجاهزية لتوقف القلب', optional: false, done: true },
    ],
    fee: null, submittedAt: null, validUntil: null,
    ...over,
  };
}
const open = (key: string) => ({ key, en: key, ar: key, optional: false, done: false });

describe('venue submission checks -- one list for the screen and the action', () => {
  it('can submit when every required check is done, whatever the optional rows say', () => {
    const c = venueSubmissionChecks(ready());
    expect(c.canSubmit).toBe(true);
    expect(c.remaining).toBe(0);
    expect(c.optional.map((o) => o.key)).toEqual(['V6']);
  });
  it.each([
    ['details not done', { detailsDone: false }],
    ['assessment not done', { assessmentDone: false }],
    ['a required row not done', { requirements: [open('V2')] }],
    ['an unpaid fee', { fee: { amount: '50', currency: 'USD', paid: false } }],
    ['a locked package', { editable: false }],
  ] as const)('blocks on %s', (_name, over) => {
    expect(venueSubmissionChecks(ready(over as Partial<VenuePackageFacts>)).canSubmit).toBe(false);
  });
  it('counts only the venue steps as the requirements stage, not the profile or the fee', () => {
    const c = venueSubmissionChecks(ready({ detailsDone: false, fee: { amount: '50', currency: 'USD', paid: false }, requirements: [open('V3')] }));
    expect(c.remaining).toBe(3);
    expect(c.requirementsRemaining).toBe(1);
  });
});

describe('venue progress rail: profile, assessment, infrastructure, AEDs, review, certificate', () => {
  const cases: [string, Partial<VenuePackageFacts>, number][] = [
    ['a fresh draft', { detailsDone: false, assessmentDone: false, requirements: [] }, 1],
    ['a draft with infrastructure open', { requirements: [open('V2'), { ...open('V7'), done: true }] }, 3],
    ['a draft with only the AEDs open', { requirements: [{ ...open('V2'), done: true }, open('V7')] }, 4],
    ['a draft ready to submit', {}, 5],
    ['a submitted package', { status: 'submitted', editable: false, submittedAt: '2026-10-01 10:00:00' }, 6],
    ['an accepted package', { status: 'accepted', editable: false, submittedAt: '2026-10-01 10:00:00', validUntil: '2027-10-01' }, 6],
    ['a returned package with steps open', { status: 'incomplete', requirements: [open('V2'), { ...open('V7'), done: true }] }, 3],
  ];
  it.each(cases)('%s', (_name, over, stage) => {
    const r = venueRailStages(ready(over));
    expect(r.stages.map((x) => x.en)).toEqual(['Venue profile', 'Annual assessment', 'Infrastructure and access', 'AEDs', 'Review and submit', 'Annual certificate']);
    expect(r.stage).toBe(stage);
  });
  it('marks the infrastructure stage "Returned here" and names the recorded outcome', () => {
    const r = venueRailStages(ready({ status: 'incomplete', requirements: [open('V2'), { ...open('V7'), done: true }] }));
    expect(r.stages[2]?.k).toBe('returned');
    expect(r.stages[5]?.metaEn).toBe(VENUE_STATUS.incomplete.en);
  });
  it('an accepted venue reads its certificate date on the last stage', () => {
    const r = venueRailStages(ready({ status: 'accepted', editable: false, submittedAt: '2026-10-01 10:00:00', validUntil: '2027-10-01' }));
    expect(r.stages[5]).toMatchObject({ k: 'done', metaEn: 'Valid until 2027-10-01' });
  });
});

describe('venue outcomes', () => {
  it('stores each Ministry decision as its own status -- "incomplete" is not "revision"', () => {
    expect(venueStatusForDecision('satisfied')).toBe('accepted');
    expect(venueStatusForDecision('revision')).toBe('revision');
    expect(venueStatusForDecision('incomplete')).toBe('incomplete');
    // The venue service is retired (owner, 9 October 2026): no package takes an edit, whatever its status.
    expect(venuePackageEditable('incomplete', false)).toBe(false);
    expect(venuePackageEditable('incomplete', true)).toBe(false);
  });
  it('tells the operator the three outcomes in the compliance form\'s own words', () => {
    const words = Object.fromEntries(ministryJson.outcomes.map((o) => [o.key, o]));
    expect(VENUE_STATUS.accepted).toEqual({ en: words['satisfied']!.en, ar: words['satisfied']!.ar });
    expect(VENUE_STATUS.revision).toEqual({ en: words['revision']!.en, ar: words['revision']!.ar });
    expect(VENUE_STATUS.incomplete).toEqual({ en: words['incomplete']!.en, ar: words['incomplete']!.ar });
  });
});

describe('Arabic counts', () => {
  it('uses the singular, the dual, the plural and the accusative singular', () => {
    const f = { one: 'متطلباً واحداً', two: 'متطلبَين', few: 'متطلبات', many: 'متطلباً' };
    expect(arabicCount(1, f)).toBe('متطلباً واحداً');
    expect(arabicCount(2, f)).toBe('متطلبَين');
    expect(arabicCount(7, f)).toBe('7 متطلبات');
    expect(arabicCount(12, f)).toBe('12 متطلباً');
  });
});

describe('invitation tokens stay out of what a partner receives', () => {
  it('never keys a shared component or a partner page by an invitation token', () => {
    // A server component's keys travel to the browser in the page payload; a token is a credential.
    // Shared components can render for any party, and venue-team is the partner's own route.
    const files = [...filesUnder('components', ['.tsx']), ...filesUnder('app/venue-team', ['.tsx'])];
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((f) => /key=\{[^}]*(\btoken\b|invitation_token)[^}]*\}/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
