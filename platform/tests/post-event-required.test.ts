/**
 * Protocol 13 p2's three limbs, evaluated (register closure, 2026-09-03). The
 * copy on the report screen has named all three since Slice 2; only Level 3
 * was ever evaluated, so a Level 1 or 2 event with a notified reportable event
 * -- or a Ministry request -- showed "Not needed for this event". One rule,
 * consumed by the stage rail, the report screen and the console.
 */

import { describe, expect, it } from 'vitest';
import { hasReportableEvent, postEventReportRequired } from '../lib/rules/gates';

describe('who owes a post-event report', () => {
  it('Level 3 always (2a), and the limb says so', () => {
    const r = postEventReportRequired({ finalLevel: 3, seriousIncidentNotified: false, ministryRequested: false });
    expect(r).toMatchObject({ required: true, limb: 'level3' });
  });

  it('a notified reportable event requires it at Level 1 and 2 (2b)', () => {
    for (const level of [1, 2] as const) {
      const r = postEventReportRequired({ finalLevel: level, seriousIncidentNotified: true, ministryRequested: false });
      expect(r).toMatchObject({ required: true, limb: 'reportable' });
      expect(r.en).toContain('reportable event');
    }
  });

  it('a Ministry request requires it regardless of level — even before a level derives (2c)', () => {
    for (const level of [1, 2, null] as const) {
      const r = postEventReportRequired({ finalLevel: level, seriousIncidentNotified: false, ministryRequested: true });
      expect(r).toMatchObject({ required: true, limb: 'request' });
    }
  });

  it('without recorded incidents, states the condition rather than ruling out reporting', () => {
    const r = postEventReportRequired({ finalLevel: 2, seriousIncidentNotified: false, ministryRequested: false });
    expect(r).toMatchObject({ required: false, limb: null });
    expect(r.en).toContain('if a reportable incident occurred');
  });

  it('the limbs name themselves in the instrument’s order: level, then reportable, then request', () => {
    expect(postEventReportRequired({ finalLevel: 3, seriousIncidentNotified: true, ministryRequested: true }).limb).toBe('level3');
    expect(postEventReportRequired({ finalLevel: 2, seriousIncidentNotified: true, ministryRequested: true }).limb).toBe('reportable');
  });
});


  it('hospital transport and unplanned resources trigger reporting at Levels 1 and 2', () => {
    for (const key of ['patientsTransported', 'cardiacArrests', 'deaths', 'unplannedResources']) {
      expect(hasReportableEvent({[key]: '1'}, {})).toBe(true);
      expect(hasReportableEvent({[key]: '0'}, {})).toBe(false);
    }
    for (const key of ['hospitalTransport', 'cardiacArrest', 'death', 'majorIncident', 'interrupted', 'terminated', 'unplannedRequest']) expect(hasReportableEvent({}, {[key]: true})).toBe(true);
    expect(hasReportableEvent({patientsTreated:'2'}, {none:true})).toBe(false);
    for (const level of [1,2] as const) expect(postEventReportRequired({finalLevel:level,seriousIncidentNotified:false,reportableEventRecorded:true,ministryRequested:false})).toMatchObject({required:true,limb:'reportable'});
  });
