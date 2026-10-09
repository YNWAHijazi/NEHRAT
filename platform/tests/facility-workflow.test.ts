/**
 * The facility/site record (owner decision, 9 October 2026; latest revision, sections 1-14):
 * the six-step path while the registration is in preparation, the dashboard from the first
 * submission, the rail and the next step. Pure rules over plain facts.
 */
import { describe, expect, it } from 'vitest';
import {
  facilityConfirmationReady,
  facilityDevicesDone,
  facilityInitialStep,
  facilityNextAction,
  facilityRailStages,
  facilityReadyToSubmit,
  facilityRecordMode,
  facilityRegistrationSteps,
  facilityStatusLabel,
  type FacilityRegistrationFacts,
} from '../lib/rules/facility-workflow';

/** A site as the one-page intake leaves it: profile, map pin, contact and EMS access recorded, nothing else. */
const fresh = (over: Partial<FacilityRegistrationFacts> = {}): FacilityRegistrationFacts => ({
  archived: false, mapConfirmed: true, aedRequirement: 'required', deviceCount: 0, devicesNotReady: 0,
  contactComplete: true, confirmationRecorded: false, confirmationCurrent: false,
  profileComplete: true, emsAccessComplete: true, infrastructureRecorded: false, documentCount: 0, photoCount: 0,
  outsideCategory: false, submissionCount: 0, status: 'inPreparation', everAccepted: false, locked: false, ...over,
});
const ready = (over: Partial<FacilityRegistrationFacts> = {}) => fresh({ deviceCount: 2, confirmationRecorded: true, confirmationCurrent: true, ...over });
const submitted = (over: Partial<FacilityRegistrationFacts> = {}) => ready({ submissionCount: 1, status: 'submitted', locked: true, ...over });
const accepted = (over: Partial<FacilityRegistrationFacts> = {}) => ready({ submissionCount: 1, status: 'readinessCurrent', everAccepted: true, ...over });

describe('the step path while the registration is in preparation', () => {
  it('runs infrastructure, AEDs, plan, readiness confirmation, evidence, then review and submit', () => {
    const steps = facilityRegistrationSteps(fresh());
    expect(steps.map((s) => s.key)).toEqual(['infrastructure', 'aeds', 'plan', 'confirmation', 'evidence', 'review']);
    expect(steps.map((s) => s.anchor)).toEqual(['infrastructure', 'aeds', 'plan', 'confirmation-step', 'evidence', 'final-review']);
    expect(steps[5]!.state).toBe('final');
  });

  it('the infrastructure and the evidence are optional and never pending', () => {
    const steps = facilityRegistrationSteps(fresh());
    for (const key of ['infrastructure', 'evidence']) {
      expect(steps.find((s) => s.key === key)).toMatchObject({ optional: true, state: 'notProvided', stateEn: 'Optional' });
    }
    const filled = facilityRegistrationSteps(fresh({ infrastructureRecorded: true, photoCount: 1 }));
    expect(filled.find((s) => s.key === 'infrastructure')!.state).toBe('complete');
    expect(filled.find((s) => s.key === 'evidence')!.state).toBe('complete');
  });

  it('colours the required steps from the same facts as the review page', () => {
    const steps = facilityRegistrationSteps(fresh());
    expect(steps.find((s) => s.key === 'aeds')).toMatchObject({ state: 'pending', stateEn: 'No AED registered' });
    expect(steps.find((s) => s.key === 'plan')).toMatchObject({ state: 'pending' });
    expect(steps.find((s) => s.key === 'confirmation')).toMatchObject({ state: 'pending' });
    const done = facilityRegistrationSteps(ready());
    expect(done.filter((s) => !s.optional && s.state !== 'final').every((s) => s.state === 'complete')).toBe(true);
    expect(facilityRegistrationSteps(ready({ confirmationCurrent: false })).find((s) => s.key === 'confirmation')).toMatchObject({ state: 'pending', stateEn: 'To be confirmed again' });
  });

  it('an AED that is not operational or not accessible keeps the AED step open', () => {
    const f = fresh({ deviceCount: 2, devicesNotReady: 1 });
    expect(facilityDevicesDone(f)).toBe(false);
    expect(facilityRegistrationSteps(f)[1]).toMatchObject({ state: 'pending', stateEn: 'An AED is not ready' });
  });

  it('where no AED is required, none is owed, but a registered AED must still be ready', () => {
    expect(facilityDevicesDone(fresh({ aedRequirement: 'notRequired' }))).toBe(true);
    expect(facilityDevicesDone(fresh({ aedRequirement: 'review' }))).toBe(true);
    expect(facilityDevicesDone(fresh({ aedRequirement: 'notRequired', deviceCount: 1, devicesNotReady: 1 }))).toBe(false);
  });

  it('opens a new record on its first step, else on the step named, else the first open one', () => {
    expect(facilityInitialStep(fresh(), null)).toBe('infrastructure');
    expect(facilityInitialStep(fresh(), 'aeds')).toBe('aeds');
    expect(facilityInitialStep(fresh({ deviceCount: 1 }), 'nonsense')).toBe('confirmation');
    expect(facilityInitialStep(ready(), undefined)).toBe('review');
  });

  it('the readiness confirmation waits on the map, the contact and the required AEDs', () => {
    expect(facilityConfirmationReady(fresh())).toBe(false);
    expect(facilityConfirmationReady(fresh({ deviceCount: 1 }))).toBe(true);
    expect(facilityConfirmationReady(fresh({ deviceCount: 1, contactComplete: false }))).toBe(false);
  });

  it('the registration can be submitted only when every required line is complete', () => {
    expect(facilityReadyToSubmit(fresh())).toBe(false);
    expect(facilityReadyToSubmit(ready())).toBe(true);
    expect(facilityReadyToSubmit(ready({ emsAccessComplete: false }))).toBe(false);
    expect(facilityReadyToSubmit(ready({ outsideCategory: true }))).toBe(false);
    // The optional parts never block.
    expect(facilityReadyToSubmit(ready({ infrastructureRecorded: false, documentCount: 0, photoCount: 0 }))).toBe(true);
  });
});

describe('the event journey for a site: the record page until accepted, then the dashboard', () => {
  it('a submitted or returned registration stays on the record page; acceptance makes it the dashboard', () => {
    expect(facilityRecordMode(ready())).toBe('register');
    expect(facilityRecordMode(submitted())).toBe('register');
    expect(facilityRecordMode(submitted({ status: 'informationRequired', locked: false }))).toBe('register');
    expect(facilityRecordMode(accepted())).toBe('manage');
    expect(facilityRecordMode(fresh({ archived: true }))).toBe('manage');
  });

  it('with the Ministry, the record leads with nothing to do; returned, it leads to the review', () => {
    expect(facilityNextAction(submitted())).toBeNull();
    expect(facilityNextAction(submitted({ status: 'informationRequired', locked: false }))).toMatchObject({ kind: 'information', href: '#final-review' });
  });

  it('the header reads the site status', () => {
    expect(facilityStatusLabel(ready())).toEqual({ en: 'In preparation', ar: 'قيد الإعداد' });
    expect(facilityStatusLabel(accepted()).en).toBe('Readiness current');
    expect(facilityStatusLabel(fresh({ archived: true, status: 'noLongerCovered' })).en).toBe('No longer covered');
  });

  it('leads with the Ministry’s request, then a corrective action, then a stale confirmation', () => {
    expect(facilityNextAction(accepted({ status: 'informationRequired' }))).toMatchObject({ kind: 'information', href: '?tab=overview#resubmit' });
    expect(facilityNextAction(accepted({ status: 'correctiveActionRequired' }))).toMatchObject({ kind: 'corrective', href: '?tab=history#requests' });
    expect(facilityNextAction(accepted({ confirmationCurrent: false }))).toMatchObject({ kind: 'confirmation', href: '?tab=readiness#confirmation' });
    expect(facilityNextAction(accepted())).toBeNull();
    expect(facilityNextAction(fresh({ archived: true, status: 'noLongerCovered' }))).toBeNull();
  });
});

describe('the next step and the rail while in preparation', () => {
  it('leads with the first open item, in the step order, and ends on the review', () => {
    expect(facilityNextAction(fresh({ mapConfirmed: false }))!.href).toBe('profile');
    expect(facilityNextAction(fresh({ profileComplete: false }))!.href).toBe('profile');
    expect(facilityNextAction(fresh())).toMatchObject({ kind: 'aeds', href: '#aeds' });
    expect(facilityNextAction(fresh({ deviceCount: 1, devicesNotReady: 1 }))!.titleEn).toBe('Update the AED status');
    expect(facilityNextAction(fresh({ deviceCount: 1, contactComplete: false }))!.href).toBe('profile#contact');
    expect(facilityNextAction(fresh({ deviceCount: 1 }))).toMatchObject({ kind: 'confirmation', href: '#confirmation-step' });
    expect(facilityNextAction(ready())).toMatchObject({ kind: 'submit', href: '#final-review', tone: 'brand' });
  });

  it('draws the event rail for a site: details, requirements, submit, Ministry review, ongoing readiness', () => {
    const { stage, stages } = facilityRailStages(fresh());
    expect(stages.map((s) => s.en)).toEqual(['Site details', 'Requirements', 'Submit', 'Ministry review', 'Ongoing readiness']);
    expect(stage).toBe(2);
    expect(stages[1]).toMatchObject({ k: 'current', metaEn: '3 of 6 complete' });
    const filed = facilityRailStages(submitted());
    expect(filed.stage).toBe(4);
    expect(filed.stages.map((s) => s.k)).toEqual(['done', 'done', 'done', 'current', 'todo']);
    expect(facilityRailStages(submitted({ status: 'informationRequired', locked: false })).stages[1]!.k).toBe('returned');
    const done = facilityRailStages(accepted());
    expect(done.stage).toBe(5);
    expect(done.stages[3]).toMatchObject({ k: 'done', metaEn: 'Readiness current' });
  });

  // The mass-gathering outcome vocabulary is swept from this rules file by tests/facility-vocabulary.test.ts.
  it('every string is in both languages, and none says approved or rejected', () => {
    const facts = [fresh(), fresh({ mapConfirmed: false }), fresh({ deviceCount: 1, devicesNotReady: 1 }), fresh({ deviceCount: 1, contactComplete: false }), fresh({ deviceCount: 1 }), ready(),
      submitted(), submitted({ status: 'informationRequired', locked: false }), accepted({ status: 'correctiveActionRequired' }), accepted({ confirmationCurrent: false }), accepted(), fresh({ archived: true, status: 'noLongerCovered' })];
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
