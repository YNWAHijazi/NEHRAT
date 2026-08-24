/**
 * The counterparty roles' rules (Slice 5).
 *
 * Under test: the Director's requirement list derives from the matrix and is EMPTY
 * below Level 3; requirement 15 is the only sole row; the declaration gate blocks
 * signing until all ten items are confirmed, naming the count; the minimum dataset
 * carries no patient-identifying field beyond the age group; the Order lane ships off.
 */
import { describe, expect, it } from 'vitest';
import {
  DECLARATION_ITEMS,
  ROLES_CONTENT,
  declarationGate,
  directorRequirements,
  orderLaneActive,
} from '../lib/rules/roles';

describe("the Director's requirements, derived from the matrix", () => {
  it('names five requirements at Level 3', () => {
    expect(directorRequirements(3).map((r) => r.n)).toEqual([8, 12, 15, 16, 19]);
  });

  it('requirement 15 is the only sole row -- no other party is named against it', () => {
    const sole = directorRequirements(3).filter((r) => r.sole);
    expect(sole.map((r) => r.n)).toEqual([15]);
    expect(sole[0]?.others).toEqual([]);
  });

  it('shared rows carry the other parties by name, computed not written', () => {
    const r16 = directorRequirements(3).find((r) => r.n === 16);
    expect(r16?.others.map((o) => o.en)).toContain('Organizer');
  });

  it('is EMPTY below Level 3 -- the role does not exist there', () => {
    expect(directorRequirements(2)).toEqual([]);
    expect(directorRequirements(1)).toEqual([]);
  });
});

describe('the declaration signing gate', () => {
  it('carries ten items from the compliance form itself', () => {
    expect(DECLARATION_ITEMS).toHaveLength(10);
  });

  it('blocks signing while any item is unconfirmed, naming the count', () => {
    const gate = declarationGate([true, true, true, true, true, true, true, true, true, false]);
    expect(gate.canSign).toBe(false);
    expect(gate.reasonKey).toBe('gate.declarationItemsOutstanding');
    expect(gate.params).toEqual({ count: 1, total: 10 });
  });

  it('opens exactly at ten of ten', () => {
    expect(declarationGate(Array.from({ length: 10 }, () => true)).canSign).toBe(true);
    expect(declarationGate([]).canSign).toBe(false);
  });
});

describe('the minimum dataset (data minimisation)', () => {
  const fields = ROLES_CONTENT.firstResponse.datasetSections.flatMap((s) =>
    s.fields.map((f) => ({ section: s.key, ...f })),
  );

  it('is five sections, one report per patient', () => {
    expect(ROLES_CONTENT.firstResponse.datasetSections.map((s) => s.key)).toEqual([
      'incident', 'response', 'defibrillation', 'outcome', 'agency',
    ]);
  });

  it('carries no patient name, sex or presumed-cause field -- the dataset limits itself', () => {
    const keys = fields.map((f) => f.key.toLowerCase());
    expect(keys).not.toContain('patientname');
    expect(keys).not.toContain('sex');
    expect(keys).not.toContain('presumedcause');
    // The only patient datum is the age group, exactly as the dataset specifies.
    const patientFields = fields.filter((f) => f.en.toLowerCase().includes('patient'));
    expect(patientFields.map((f) => f.key)).toEqual(['ageGroup', 'transported']);
  });

  it('distinguishes the onsite device from the unit’s own', () => {
    const defib = ROLES_CONTENT.firstResponse.datasetSections.find((s) => s.key === 'defibrillation');
    const onsite = defib?.fields.filter((f) => f.key.startsWith('onsite')) ?? [];
    const unit = defib?.fields.filter((f) => f.key.startsWith('unit')) ?? [];
    expect(onsite.length).toBe(3);
    expect(unit.length).toBe(2);
  });
});

describe('the first-response readiness lists match the source counts', () => {
  it('equipment 5, competence 7, operational 5, procedure 6', () => {
    expect(ROLES_CONTENT.firstResponse.equipment).toHaveLength(5);
    expect(ROLES_CONTENT.firstResponse.competence).toHaveLength(7);
    expect(ROLES_CONTENT.firstResponse.operational).toHaveLength(5);
    expect(ROLES_CONTENT.firstResponse.procedure).toHaveLength(6);
  });
});

describe('the Order of Physicians lane', () => {
  it('ships off -- activation is a Ministry act recorded as data', () => {
    expect(orderLaneActive()).toBe(false);
  });
});
