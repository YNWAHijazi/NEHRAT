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
  orderLaneActive,
} from '../lib/rules/roles';
import { requirementsForParty } from '../lib/rules/requirements';
import { NOMINEE_PLAN_SECTIONS, nomineeMayReadDocument, nomineeMayReadSection } from '../lib/rules/nomination-access';
import { PLAN_SECTIONS } from '../lib/rules/content';

describe("the Director's requirements, derived from the matrix", () => {
  // Pinned through requirementsForParty — the one derivation every counterparty
  // surface reads since the directorRequirements wrapper was deleted with the
  // requirement cards it fed (partner ruling, counterparty pass 2026-09-02).
  it('names five requirements at Level 3', () => {
    expect(requirementsForParty(3, 'D').map((r) => r.n)).toEqual([8, 12, 15, 16, 19]);
  });

  it('requirement 15 is the only sole row -- no other party is named against it', () => {
    const sole = requirementsForParty(3, 'D').filter((r) => r.sole);
    expect(sole.map((r) => r.n)).toEqual([15]);
    expect(sole[0]?.partyKeys).toEqual(['D']);
  });

  it('shared rows carry the other parties, computed not written', () => {
    const r16 = requirementsForParty(3, 'D').find((r) => r.n === 16);
    expect(r16?.partyKeys).toContain('O');
  });

  it('is EMPTY below Level 3 -- the role does not exist there', () => {
    expect(requirementsForParty(2, 'D')).toEqual([]);
    expect(requirementsForParty(1, 'D')).toEqual([]);
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

// The first-response role left the platform (partner ruling, counterparty pass
// 2026-09-02): its dataset and readiness content went with it, and the agency
// cardiac-arrest report lane survives Ministry-side only. The data-minimisation
// property those tests held now lives in the PAD source alone.


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

describe('the plan slice a named party may read', () => {
  it('is four sections: access and extraction, communications, hospitals, major incident', () => {
    // Reviewer instruction, 2026-08-28. These four and no others: a provider deciding
    // whether it can meet the major-incident arrangements needs the arrangements, not
    // a note that they exist -- and the plan also carries the organizer's staffing,
    // equipment, contingencies and contacts, which are not the provider's to read.
    expect([...NOMINEE_PLAN_SECTIONS]).toEqual([9, 10, 11, 12]);
  });

  it('names the sections the instrument numbers, not a set of our own', () => {
    const byNumber = new Map(PLAN_SECTIONS.map((s) => [s.n, s.en]));
    expect(byNumber.get(9)).toMatch(/access and extraction/i);
    expect(byNumber.get(10)).toMatch(/communications/i);
    expect(byNumber.get(11)).toMatch(/receiving emergency departments/i);
    expect(byNumber.get(12)).toMatch(/major-incident/i);
  });

  it('excludes every other section of the sixteen', () => {
    // Widening this is a disclosure decision, and it should fail a test when somebody
    // makes it by accident.
    for (const sec of PLAN_SECTIONS) {
      expect(nomineeMayReadSection(sec.n), `section ${sec.n}`).toBe([9, 10, 11, 12].includes(sec.n));
    }
    expect(nomineeMayReadSection(1)).toBe(false);
    expect(nomineeMayReadSection(16)).toBe(false);
  });
});
