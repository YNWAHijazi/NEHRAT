import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { filesUnder } from './helpers/files';
import {
  venueSubmissionChecks, venueNextAction, venueRailStages, venueStatusForDecision, venuePackageEditable,
  arabicCount, VENUE_STATUS, type VenuePackageFacts,
} from '../lib/rules/venue-workflow';
import ministryJson from '../lib/rules/data/ministry.json';

/** A Level 2 draft with everything in place: every test changes one thing. */
function ready(over: Partial<VenuePackageFacts> = {}): VenuePackageFacts {
  return {
    editable: true, status: 'draft', detailsDone: true, assessmentDone: true, level: 2, assessmentVersion: 1,
    pendingInvitations: [],
    requirements: [
      { key: 'B1', en: 'Organizer contact', ar: 'جهة اتصال لدى المنظم', optional: false, done: true, clinical: false },
      { key: 'B5', en: 'BLS response team(s)', ar: 'فرق BLS', optional: false, done: true, clinical: true },
      { key: 'B6', en: 'Treatment post', ar: 'نقطة علاج', optional: true, done: false, clinical: true },
    ],
    fee: null, submittedAt: null, validUntil: null,
    ...over,
  };
}

describe('venue submission checks -- one list for the screen and the action', () => {
  it('can submit when every required check is done, whatever the optional rows say', () => {
    const c = venueSubmissionChecks(ready());
    expect(c.canSubmit).toBe(true);
    expect(c.remaining).toBe(0);
    expect(c.optional.map((o) => o.key)).toEqual(['B6']);
  });
  it.each([
    ['details not done', { detailsDone: false }],
    ['assessment not done', { assessmentDone: false }],
    ['a pending invitation', { pendingInvitations: [{ name: 'Agency', token: 'x'.repeat(48) }] }],
    ['a required row not done', { requirements: [{ key: 'B1', en: 'a', ar: 'ا', optional: false, done: false, clinical: false }] }],
    ['an unpaid fee', { fee: { amount: '50', currency: 'USD', paid: false } }],
    ['a locked package', { editable: false }],
  ] as const)('blocks on %s', (_name, over) => {
    expect(venueSubmissionChecks(ready(over as Partial<VenuePackageFacts>)).canSubmit).toBe(false);
  });
  it('counts only rows and replies as the requirements stage, not details or the fee', () => {
    const c = venueSubmissionChecks(ready({ detailsDone: false, fee: { amount: '50', currency: 'USD', paid: false }, pendingInvitations: [{ name: 'A', token: 't' }] }));
    expect(c.remaining).toBe(3);
    expect(c.requirementsRemaining).toBe(1);
  });
});

describe('venue next step', () => {
  it('leads with details, then the assessment, then the organizer\'s own rows', () => {
    expect(venueNextAction(ready({ detailsDone: false }))?.kind).toBe('details');
    expect(venueNextAction(ready({ assessmentDone: false }))?.kind).toBe('assessment');
    expect(venueNextAction(ready({ requirements: [{ key: 'B1', en: 'a', ar: 'ا', optional: false, done: false, clinical: false }] }))?.kind).toBe('requirements');
  });
  it('waits on the team when the only open rows complete from an invitation reply', () => {
    const facts = ready({
      level: 3,
      pendingInvitations: [{ name: 'Dr A', token: 't' }],
      requirements: [{ key: 'B3', en: 'Event Medical Director', ar: 'المدير الطبي', optional: false, done: false, clinical: false, awaitingInvitation: true }],
    });
    expect(venueNextAction(facts)).toMatchObject({ kind: 'waitingOnOthers', href: '#req-B7' });
  });
  it('asks for the medical team first when medical items wait and nobody is invited', () => {
    const facts = ready({ requirements: [
      { key: 'B1', en: 'a', ar: 'ا', optional: false, done: false, clinical: false },
      { key: 'B5', en: 'BLS', ar: 'BLS', optional: false, done: false, clinical: true },
    ] });
    expect(venueNextAction(facts)).toMatchObject({ kind: 'team', href: '#req-B7' });
    expect(venueNextAction({ ...facts, medicalTeamLinked: true })).toMatchObject({ kind: 'requirements', titleEn: 'Complete your 1 requirement' });
  });
  it('waits on the medical team for clinical rows, and says ready only when everything is in place', () => {
    expect(venueNextAction(ready({ medicalTeamLinked: true, requirements: [{ key: 'B5', en: 'BLS', ar: 'BLS', optional: false, done: false, clinical: true }] }))?.kind).toBe('waitingOnOthers');
    expect(venueNextAction(ready())).toMatchObject({ kind: 'submit', tone: 'brand' });
    expect(venueNextAction(ready({ fee: { amount: '50', currency: 'USD', paid: false } }))?.kind).toBe('awaitingPayment');
  });
  it('has no step once the package is with the Ministry or accepted', () => {
    expect(venueNextAction(ready({ status: 'submitted', editable: false }))).toBeNull();
    expect(venueNextAction(ready({ status: 'accepted', editable: false }))).toBeNull();
  });
});

describe('venue progress rail', () => {
  const cases: [string, Partial<VenuePackageFacts>, number][] = [
    ['a fresh draft', { detailsDone: false, assessmentDone: false, requirements: [] }, 1],
    ['a draft with rows open', { requirements: [{ key: 'B1', en: 'a', ar: 'ا', optional: false, done: false, clinical: false }] }, 3],
    ['a draft ready to submit', {}, 4],
    ['a submitted package', { status: 'submitted', editable: false, submittedAt: '2026-10-01 10:00:00' }, 5],
    ['an accepted package', { status: 'accepted', editable: false, submittedAt: '2026-10-01 10:00:00', validUntil: '2027-10-01' }, 5],
    ['a returned package with rows open', { status: 'incomplete', requirements: [{ key: 'B1', en: 'a', ar: 'ا', optional: false, done: false, clinical: false }] }, 3],
  ];
  it.each(cases)('%s', (_name, over, stage) => {
    const r = venueRailStages(ready(over));
    expect(r.stages).toHaveLength(5);
    expect(r.stage).toBe(stage);
    expect(r.stage).toBeLessThanOrEqual(r.stages.length);
  });
  it('marks the requirements stage "Returned here" and names the recorded outcome', () => {
    const r = venueRailStages(ready({ status: 'incomplete', requirements: [{ key: 'B1', en: 'a', ar: 'ا', optional: false, done: false, clinical: false }] }));
    expect(r.stages[2]?.k).toBe('returned');
    expect(r.stages[4]?.metaEn).toBe(VENUE_STATUS.incomplete.en);
  });
});

describe('venue outcomes', () => {
  it('stores each Ministry decision as its own status -- "incomplete" is not "revision"', () => {
    expect(venueStatusForDecision('satisfied')).toBe('accepted');
    expect(venueStatusForDecision('revision')).toBe('revision');
    expect(venueStatusForDecision('incomplete')).toBe('incomplete');
    expect(venuePackageEditable('incomplete', false)).toBe(true);
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
