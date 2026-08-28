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
import { requirementsForParty } from '../lib/rules/requirements';
import { nomineeMayReadDocument } from '../lib/rules/nomination-access';

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

describe('the nomination offers all three responses to both kinds', () => {
  it('a Director can ask a question before answering, as an EMS provider can', () => {
    // The screen used to filter the request-for-information option out for the
    // Director, leaving a physician deciding on personal responsibility with two
    // choices: accept blind, or decline. Declining is a material change the organizer
    // must report; asking a question is not, and making the lighter option
    // unavailable pushed the heavier one. (Reviewer, 2026-08-28.)
    const keys = ROLES_CONTENT.ems.nominationResponses.map((r) => r.key);
    expect(keys).toEqual(['accept', 'decline', 'modification']);
  });

  it('the third response keeps the nomination open rather than answering it', () => {
    const ask = ROLES_CONTENT.ems.nominationResponses.find((r) => r.key === 'modification');
    expect(ask, 'the request-for-information response exists').toBeDefined();
    // Its own description must not read as a decision: the nomination stays open and
    // nothing is recorded against the party.
    expect(`${ask?.descEn}`).toMatch(/remains open|stays open|still/i);
  });
});

describe('a nominated party sees their own requirements, derived not described', () => {
  it('the Level 3 Director carries five rows, and requirement 15 is theirs alone', () => {
    // The prose said "four are shared with the organizer and the providers, one is
    // yours alone" and happened to be right. This makes it true BY DERIVATION: if the
    // Ministry re-issues the matrix, the screen follows instead of the sentence
    // quietly going stale.
    const rows = requirementsForParty(3, 'D');
    expect(rows.map((r) => r.n)).toEqual([8, 12, 15, 16, 19]);
    expect(rows.filter((r) => r.sole).map((r) => r.n)).toEqual([15]);
  });

  it('no Director row exists below Level 3 -- absent, not empty', () => {
    // Non-negotiable 10: what never applies is absent entirely.
    expect(requirementsForParty(1, 'D')).toEqual([]);
    expect(requirementsForParty(2, 'D')).toEqual([]);
  });

  it('the EMS provider carries the readiness declaration at Level 3 and not below', () => {
    expect(requirementsForParty(3, 'E').some((r) => r.n === 20)).toBe(true);
    expect(requirementsForParty(2, 'E').some((r) => r.n === 20)).toBe(false);
  });
});

describe('what a nomination token may read', () => {
  it('is an allow-list, so a new catalogue document is not disclosed by default', () => {
    // The failure mode of "everything except" is silent over-disclosure: a document
    // added to the catalogue tomorrow would go to every nominated party until somebody
    // noticed. Here it is invisible until somebody decides it concerns them.
    for (const kind of ['ems', 'director'] as const) {
      expect(nomineeMayReadDocument(kind, 'siteMap')).toBe(true);
      expect(nomineeMayReadDocument(kind, 'deploymentMap')).toBe(true);
      for (const forbidden of ['complianceForm', 'insuranceCertificate', 'riskAssessment', 'plan-document', 'anythingNew']) {
        expect(nomineeMayReadDocument(kind, forbidden), `${kind} must not read ${forbidden}`).toBe(false);
      }
    }
  });
});
