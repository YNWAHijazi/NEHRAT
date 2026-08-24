/**
 * The Ministry console's rules (Slice 6).
 *
 * Under test: the permission matrix -- including the rows the Ministry will
 * argue about (an administrator cannot record an outcome; an inspector records
 * corrective actions and none of the three; the platform owner performs no
 * regulatory action); the outcome gate that disables ONLY 'satisfied' while
 * blockers are outstanding; and the provisional cycles yielding to published
 * configuration.
 */
import { describe, expect, it } from 'vitest';
import {
  MINISTRY_CONTENT,
  can,
  effectiveCycles,
  outcomeAvailability,
  permissionMatrix,
} from '../lib/rules/ministry';

describe('the permission matrix', () => {
  it('only a reviewer records an outcome -- the row the Ministry will argue about', () => {
    expect(can('reviewer', 'recordOutcome')).toBe(true);
    expect(can('ministry_admin', 'recordOutcome')).toBe(false);
    expect(can('inspector', 'recordOutcome')).toBe(false);
    expect(can('platform_owner', 'recordOutcome')).toBe(false);
    expect(can('order', 'recordOutcome')).toBe(false);
  });

  it('an inspector records corrective actions and schedules inspections, nothing more', () => {
    expect(can('inspector', 'recordCorrective')).toBe(true);
    expect(can('inspector', 'scheduleInspection')).toBe(true);
    expect(can('inspector', 'requireMeasures')).toBe(false);
    expect(can('inspector', 'recordOrganization')).toBe(false);
    expect(can('inspector', 'configureCardiac')).toBe(false);
  });

  it('an administrator configures and never determines', () => {
    expect(can('ministry_admin', 'configureCardiac')).toBe(true);
    expect(can('ministry_admin', 'configureMassGathering')).toBe(true);
    expect(can('ministry_admin', 'manageUsers')).toBe(true);
    expect(can('ministry_admin', 'requireMeasures')).toBe(false);
    expect(can('ministry_admin', 'recordCorrective')).toBe(false);
  });

  it('a Ministry administrator cannot reach the platform-owner surfaces', () => {
    expect(can('ministry_admin', 'viewPlatformActivity')).toBe(false);
    expect(can('ministry_admin', 'manageFlags')).toBe(false);
  });

  it('the platform owner performs no regulatory action at all', () => {
    const ownerActions = permissionMatrix()
      .filter((row) => row.roles['platform_owner'])
      .map((row) => row.action.key);
    expect(ownerActions).toEqual(['viewPlatformActivity', 'manageFlags']);
  });

  it('the public roles hold no ministry action', () => {
    for (const role of ['organizer', 'ems', 'director', 'response']) {
      for (const row of permissionMatrix()) {
        expect(row.roles[role], `${role} must not hold ${row.action.key}`).toBe(false);
      }
    }
  });

  it('the order role holds only verification, and nothing in the facility lane', () => {
    expect(can('order', 'orderVerify')).toBe(true);
    expect(can('order', 'viewFacilityLane')).toBe(false);
    expect(can('order', 'viewSubmission')).toBe(false);
  });
});

describe('the outcome gate', () => {
  it('carries exactly the three outcomes, in the official wording', () => {
    const keys = MINISTRY_CONTENT.outcomes.map((o) => o.key);
    expect(keys).toEqual(['incomplete', 'revision', 'satisfied']);
    expect(MINISTRY_CONTENT.outcomes[2]?.ar).toBe('تم استيفاء متطلبات التأهب الصحي والطبي');
  });

  it("disables ONLY 'satisfied' while blockers are outstanding, each named", () => {
    const blockers = [{ en: 'Blocking inspection without recorded findings — deployment', ar: 'تفتيش حاجب' }];
    const outcomes = outcomeAvailability(blockers);
    expect(outcomes.find((o) => o.key === 'satisfied')?.available).toBe(false);
    expect(outcomes.find((o) => o.key === 'satisfied')?.blockers).toHaveLength(1);
    // The other two stay available: a gate on one determination is not a gate
    // on determining.
    expect(outcomes.find((o) => o.key === 'incomplete')?.available).toBe(true);
    expect(outcomes.find((o) => o.key === 'revision')?.available).toBe(true);
  });

  it('opens all three when nothing blocks', () => {
    expect(outcomeAvailability([]).every((o) => o.available)).toBe(true);
  });
});

describe('the configuration values', () => {
  it('carries the ten powers, per the source', () => {
    expect(MINISTRY_CONTENT.cardiacPowers).toHaveLength(10);
    expect(MINISTRY_CONTENT.cardiacPowers.map((p) => p.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('provisional cycles yield to published configuration', () => {
    const provisional = effectiveCycles({});
    expect(provisional.provisional).toBe(true);
    const published = effectiveCycles({ checkCycleDays: 120, lapseWindowDays: 45 });
    expect(published).toMatchObject({ checkCycleDays: 120, lapseWindowDays: 45, provisional: false });
    const half = effectiveCycles({ checkCycleDays: 120 });
    expect(half.provisional).toBe(true);
    expect(half.checkCycleDays).toBe(120);
  });
});
