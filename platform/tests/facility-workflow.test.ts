/**
 * The PAD facility record in the event and venue format (owner, 9 October 2026): the
 * step path while the registration is open, the management page once registered, the
 * rail and the next step. Pure rules over plain facts.
 */
import { describe, expect, it } from 'vitest';
import {
  facilityChecksComplete,
  facilityDevicesDone,
  facilityInitialStep,
  facilityNextAction,
  facilityRailStages,
  facilityRecordMode,
  facilityRegistrationChecks,
  facilityRegistrationSteps,
  facilityRemainingBeforeConfirmation,
  facilityStatusLabel,
  type FacilityRegistrationFacts,
} from '../lib/rules/facility-workflow';

/** A facility as the one-page intake leaves it: profile, map pin and contact recorded, nothing else. */
const fresh = (over: Partial<FacilityRegistrationFacts> = {}): FacilityRegistrationFacts => ({
  archived: false, mapConfirmed: true, aedRequirement: 'required', deviceCount: 0, devicesNotReady: 0,
  contactComplete: true, confirmationRecorded: false, confirmationCurrent: false, ...over,
});
const registered = (over: Partial<FacilityRegistrationFacts> = {}) =>
  fresh({ deviceCount: 2, confirmationRecorded: true, confirmationCurrent: true, ...over });

describe('the step path while the registration is open', () => {
  it('runs AEDs, responsible contact, response plan, then review and register', () => {
    const steps = facilityRegistrationSteps(fresh());
    expect(steps.map((s) => s.key)).toEqual(['aeds', 'contact', 'plan', 'review']);
    expect(steps.map((s) => s.anchor)).toEqual(['aeds', 'contact', 'plan', 'final-review']);
    expect(steps[3]!.state).toBe('final');
  });

  it('colours each step from the same items as the certificate', () => {
    const steps = facilityRegistrationSteps(fresh());
    expect(steps.find((s) => s.key === 'aeds')).toMatchObject({ state: 'pending', stateEn: 'No AED registered' });
    expect(steps.find((s) => s.key === 'contact')).toMatchObject({ state: 'complete', stateEn: 'Complete' });
    expect(steps.find((s) => s.key === 'plan')).toMatchObject({ state: 'pending' });
    const ready = facilityRegistrationSteps(fresh({ deviceCount: 1 }));
    expect(ready.find((s) => s.key === 'aeds')!.state).toBe('complete');
  });

  it('an AED that is not operational or not accessible keeps the AED step open', () => {
    const f = fresh({ deviceCount: 2, devicesNotReady: 1 });
    expect(facilityDevicesDone(f)).toBe(false);
    expect(facilityRegistrationSteps(f)[0]).toMatchObject({ state: 'pending', stateEn: 'An AED is not ready' });
  });

  it('where the category does not require an AED, or awaits a Ministry review, none is owed', () => {
    expect(facilityDevicesDone(fresh({ aedRequirement: 'notRequired' }))).toBe(true);
    expect(facilityDevicesDone(fresh({ aedRequirement: 'review' }))).toBe(true);
    // ...but a registered AED must still be ready.
    expect(facilityDevicesDone(fresh({ aedRequirement: 'notRequired', deviceCount: 1, devicesNotReady: 1 }))).toBe(false);
  });

  it('opens on the step a redirect named, else the first open step, else the review', () => {
    expect(facilityInitialStep(fresh(), 'contact')).toBe('contact');
    expect(facilityInitialStep(fresh(), 'nonsense')).toBe('aeds');
    expect(facilityInitialStep(fresh({ deviceCount: 1, contactComplete: false }), null)).toBe('contact');
    expect(facilityInitialStep(fresh({ deviceCount: 1, confirmationCurrent: true }), undefined)).toBe('review');
  });

  it('the review lists what remains before the confirmation, never the confirmation itself', () => {
    expect(facilityRemainingBeforeConfirmation(fresh({ mapConfirmed: false })).map((c) => c.key)).toEqual(['details', 'devices']);
    expect(facilityRemainingBeforeConfirmation(fresh({ deviceCount: 1 }))).toEqual([]);
  });
});

describe('registered, the same address is the management page', () => {
  it('the first readiness confirmation completes the registration', () => {
    expect(facilityRecordMode(fresh({ deviceCount: 1 }))).toBe('register');
    expect(facilityRecordMode(registered())).toBe('manage');
    expect(facilityChecksComplete(registered())).toBe(true);
  });

  it('a stale confirmation withholds the certificate but does not re-open the registration', () => {
    const relocated = registered({ confirmationCurrent: false });
    expect(facilityRecordMode(relocated)).toBe('manage');
    expect(facilityChecksComplete(relocated)).toBe(false);
    expect(facilityStatusLabel(relocated).en).toBe('Registered · action needed');
    expect(facilityNextAction(relocated)).toMatchObject({ kind: 'confirmation', href: '#plan', titleEn: 'Confirm the updated response plan' });
  });

  it('an archived record is read on the management page and owes nothing', () => {
    const archived = fresh({ archived: true });
    expect(facilityRecordMode(archived)).toBe('manage');
    expect(facilityNextAction(archived)).toBeNull();
    expect(facilityStatusLabel(archived).en).toBe('No longer covered');
  });

  it('nothing owed, no next step', () => {
    expect(facilityNextAction(registered())).toBeNull();
    expect(facilityStatusLabel(registered())).toEqual({ en: 'Registered', ar: 'مُسجَّلة' });
  });
});

describe('the next step and the rail', () => {
  it('leads with the first open item, in the step order', () => {
    expect(facilityNextAction(fresh({ mapConfirmed: false }))!.href).toBe('profile');
    expect(facilityNextAction(fresh())).toMatchObject({ kind: 'aeds', href: '#aeds', titleEn: 'Register the facility’s AEDs' });
    expect(facilityNextAction(fresh({ deviceCount: 1, devicesNotReady: 1 }))!.titleEn).toBe('Update the AED status');
    expect(facilityNextAction(fresh({ deviceCount: 1, contactComplete: false }))!.href).toBe('#contact');
    expect(facilityNextAction(fresh({ deviceCount: 1 }))).toMatchObject({ kind: 'confirmation', tone: 'brand' });
  });

  it('draws five stages and stands on the first open one', () => {
    const { stage, stages } = facilityRailStages(fresh());
    expect(stages.map((s) => s.en)).toEqual(['Facility profile', 'AEDs', 'Responsible contact', 'Response plan', 'Registration certificate']);
    expect(stage).toBe(2);
    expect(stages.map((s) => s.k)).toEqual(['done', 'current', 'done', 'todo', 'todo']);
    const done = facilityRailStages(registered());
    expect(done.stage).toBe(5);
    expect(done.stages.every((s) => s.k === 'done')).toBe(true);
    expect(done.stages[4]!.metaEn).toBe('Issued');
  });

  it('the certificate items keep their keys and labels', () => {
    expect(facilityRegistrationChecks(fresh()).map((c) => c.key)).toEqual(['details', 'devices', 'persons', 'confirmation']);
  });

  // The mass-gathering outcome vocabulary is swept from this rules file by tests/facility-vocabulary.test.ts.
  it('every string is in both languages, and none says approved or rejected', () => {
    const facts = [fresh(), fresh({ mapConfirmed: false }), fresh({ deviceCount: 1, devicesNotReady: 1 }), fresh({ deviceCount: 1, contactComplete: false }), fresh({ deviceCount: 1 }), registered(), registered({ confirmationCurrent: false }), fresh({ archived: true })];
    const strings: string[] = [];
    for (const f of facts) {
      const next = facilityNextAction(f);
      if (next) strings.push(next.titleEn, next.titleAr, next.bodyEn, next.bodyAr, next.buttonEn, next.buttonAr);
      for (const s of facilityRegistrationSteps(f)) { strings.push(s.en, s.ar); if (s.state !== 'final') strings.push(s.stateEn, s.stateAr); }
      for (const s of facilityRailStages(f).stages) strings.push(s.en, s.ar);
      const label = facilityStatusLabel(f); strings.push(label.en, label.ar);
    }
    for (const s of strings) {
      expect(s.trim()).not.toBe('');
      expect(s.toLowerCase()).not.toMatch(/\bapproved\b|\brejected\b/);
    }
  });
});
