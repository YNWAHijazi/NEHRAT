/**
 * The attestation gate. This feature spent a slice as a docstring: outcomeAvailability
 * promised "any blocking attestation" among the satisfied blockers while no data, no
 * table and no computation existed, and a visual-comparison exception claimed the
 * reference's panel was a summary. These tests hold the delivered behaviour.
 */

import { describe, expect, it } from 'vitest';
import {
  ATTESTATIONS_CONTENT,
  attestationBlockers,
  attestationEmptyBody,
  attestationRows,
  attestationSummary,
  attestationsApplyAt,
  outcomeAvailability,
  type AttestationRecord,
} from '../lib/rules';

const complete = (itemKey: string, who: string, when: string): AttestationRecord => ({
  itemKey, state: 'complete', attestedBy: who, attestedAt: when,
  reasonEn: null, reasonAr: null, reasonBy: null, reasonAt: null,
});
const pendingWithReason = (itemKey: string, reason: string): AttestationRecord => ({
  itemKey, state: 'pending', attestedBy: null, attestedAt: null,
  reasonEn: reason, reasonAr: reason, reasonBy: 'L. Nassar', reasonAt: '2026-08-11',
});

describe('applicability', () => {
  it('applies at the levels the data names and no others', () => {
    const levels = ATTESTATIONS_CONTENT.appliesAtLevels as number[];
    expect(levels).toEqual([3]);
    expect(attestationsApplyAt(3)).toBe(true);
    expect(attestationsApplyAt(1)).toBe(false);
    expect(attestationsApplyAt(2)).toBe(false);
    expect(attestationRows(2, [])).toEqual([]);
  });

  it('the empty state names the submission level, both languages', () => {
    const body = attestationEmptyBody(2);
    expect(body.en).toContain('Level 2');
    expect(body.ar).toContain('المستوى 2');
    expect(body.en).not.toContain('{level}');
    expect(body.ar).not.toContain('{level}');
  });
});

describe('derivation', () => {
  it('an untouched Level 3 submission is pending on every item, and every item blocks', () => {
    const rows = attestationRows(3, []);
    expect(rows).toHaveLength(ATTESTATIONS_CONTENT.items.length);
    expect(rows.every((r) => r.state === 'pending')).toBe(true);
    expect(attestationBlockers(rows)).toHaveLength(rows.length);
  });

  it("the reference's showcase state summarizes verbatim", () => {
    // Three complete, three pending -- the seeded EV-0362 mirror.
    const rows = attestationRows(3, [
      complete('directorCredential', 'Dr Y. Salameh', '2026-08-12'),
      pendingWithReason('clinicalContent', 'skill mix not stated'),
      complete('insuranceEvidenced', 'L. Nassar', '2026-08-11'),
      pendingWithReason('emsDeclarations', 'two of three outstanding'),
      complete('majorIncidentPlan', 'L. Nassar', '2026-08-11'),
      pendingWithReason('deploymentMap', 'map not attached'),
    ]);
    const s = attestationSummary(rows);
    expect(s.en).toBe('3 of 6 pending · 2 held by the Ministry, 1 by the Order of Physicians');
    expect(s.ar).toBe('3 من 6 قيد الانتظار · 2 لدى الوزارة و1 لدى نقابة الأطباء');
  });

  it('all complete reads the clearance line and blocks nothing', () => {
    const rows = attestationRows(
      3,
      (ATTESTATIONS_CONTENT.items as { key: string }[]).map((i) => complete(i.key, 'L. Nassar', '2026-08-12')),
    );
    expect(attestationSummary(rows).en).toBe(ATTESTATIONS_CONTENT.panel.allCompleteEn);
    expect(attestationBlockers(rows)).toEqual([]);
  });

  it('completion is correctable: the recorder holds the pen in either state, attesting only while pending', () => {
    const rows = attestationRows(3, [complete('insuranceEvidenced', 'L. Nassar', '2026-08-11')]);
    const done = rows.find((r) => r.key === 'insuranceEvidenced');
    // Nobody may ATTEST a complete item -- there is nothing to attest.
    expect(done?.recordableBy).toBeNull();
    // But the recorder may still record a deficiency against it, returning it to
    // pending. Without this, an attestation recorded in error would stand forever.
    expect(done?.recorder).toBe('reviewer');
  });

  it('a deficiency is not a third state: the item stays pending and keeps blocking', () => {
    const rows = attestationRows(3, [pendingWithReason('deploymentMap', 'map not attached')]);
    const row = rows.find((r) => r.key === 'deploymentMap');
    expect(row?.state).toBe('pending');
    expect(row?.reasonEn).toBe('map not attached');
    expect(attestationBlockers(rows).some((b) => b.en.includes('deployment map'))).toBe(true);
  });
});

describe('the lane fallback (open decision 19)', () => {
  it('lane off: the Ministry records Order items, and the row says so', () => {
    const rows = attestationRows(3, [], false);
    const order = rows.filter((r) => r.authority === 'order');
    expect(order.length).toBeGreaterThan(0);
    for (const r of order) {
      expect(r.recordableBy).toBe('reviewer');
      expect(r.laneFallback).toBe(true);
    }
  });

  it('lane on: Order items are held by the Order, read-only to the Ministry', () => {
    const rows = attestationRows(3, [], true);
    for (const r of rows.filter((x) => x.authority === 'order')) {
      expect(r.recordableBy).toBe('order');
      expect(r.laneFallback).toBe(false);
    }
    // Ministry items are unaffected by the lane either way.
    for (const r of rows.filter((x) => x.authority === 'moph')) {
      expect(r.recordableBy).toBe('reviewer');
    }
  });

  it('a completed Order record persists regardless of the lane', () => {
    for (const lane of [true, false]) {
      const rows = attestationRows(3, [complete('directorCredential', 'Dr Y. Salameh', '2026-08-12')], lane);
      const row = rows.find((r) => r.key === 'directorCredential');
      expect(row?.state).toBe('complete');
      expect(row?.recordableBy).toBeNull();
      expect(row?.laneFallback).toBe(false);
    }
  });

  it('pending Order items block whether or not the lane is on -- the fallback changes who records, never the gate', () => {
    for (const lane of [true, false]) {
      const blockers = attestationBlockers(attestationRows(3, [], lane));
      expect(blockers.some((b) => b.en.includes('physician credential'))).toBe(true);
    }
  });
});

describe('integration with the outcome gate', () => {
  it('a pending attestation disables only the satisfied outcome, with the item named', () => {
    const blockers = attestationBlockers(attestationRows(3, []));
    const availability = outcomeAvailability(blockers);
    const satisfied = availability.find((o) => o.key === 'satisfied');
    expect(satisfied?.available).toBe(false);
    expect(satisfied?.blockers.length).toBe(blockers.length);
    for (const o of availability.filter((x) => x.key !== 'satisfied')) {
      expect(o.available).toBe(true);
    }
  });
});
