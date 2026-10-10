/**
 * The requirement catalogue and its resolver: source meaning, not screenshots (brief
 * item 24). Every assertion names the workbook row or decision it stands on.
 */

import { describe, expect, it } from 'vitest';
import {
  authorsFor,
  fieldsFor,
  handledBy,
  mayAuthor,
  planTextKeys,
  REQUIREMENT_DECISIONS,
  requirementApplies,
  requirementBlockers,
  requirementSummary,
  resolvePlan,
  resolveRequirements,
  type RecordFacts,
  type RequirementInstance,
  type StoredAnswer,
} from '../lib/rules/record-requirements';
import { requirementsForLevel } from '../lib/rules/requirements';
import type { Level } from '../lib/rules/types';

const answer = (values: Record<string, string | boolean | number>, role: 'organizer' | 'ems' | 'director' = 'organizer'): StoredAnswer =>
  ({ values, savedByRole: role, savedByName: 'Tester', savedAt: '2026-10-07T10:00:00', version: 1 });

function facts(level: Level, over: Partial<RecordFacts> = {}): RecordFacts {
  return {
    service: 'event',
    level,
    answers: {},
    files: {},
    organizerContact: { name: 'Example organizer', phone: '+961 3 000000' },
    assessmentComplete: true,
    ems: [],
    director: null,
    planApprovalCurrent: false,
    declaration: { statementsComplete: false, certificationComplete: false },
    requested: [],
    ...over,
  };
}

const keys = (rows: readonly RequirementInstance[]) => rows.map((r) => r.key);
const byKey = (rows: readonly RequirementInstance[], key: string) => rows.find((r) => r.key === key)!;

/** Every required field of a row filled with a plausible value. */
function fullAnswer(level: Level, key: string, role: 'organizer' | 'ems' | 'director' = 'organizer'): StoredAnswer {
  const fields = fieldsFor(key, level, 'event') ?? [];
  const values: Record<string, string | boolean | number> = {};
  for (const f of fields) {
    if (f.showWhen) continue;
    values[f.key] = f.type === 'checkbox' ? true : f.type === 'number' ? 4 : f.type === 'choice' ? 'yes' : f.type === 'date' ? '2026-11-01' : `${f.key} answer`;
  }
  return answer(values, role);
}

function allOrganizerAnswers(level: Level): Record<string, StoredAnswer> {
  const out: Record<string, StoredAnswer> = {};
  for (const row of resolveRequirements(facts(level))) {
    if (row.fields.length > 0 && row.authors.includes('organizer')) out[row.key] = fullAnswer(level, row.key);
  }
  return out;
}

describe('the catalogue', () => {
  // The catalogue's EN/AR pairs are swept by the bilingual-parity and banned-terms
  // guards, which read the whole data directory; this file asserts meaning only.
  it('carries the 19 revised matrix rows by their stable n, and old row 13 is not a row', () => {
    // Every matrix row appears at Level 3 (the later-phase ones in the 'later' group).
    const ns = resolveRequirements(facts(3)).map((r) => r.n).filter((n): n is number => n !== null).sort((a, b) => a - b);
    expect(ns).toHaveLength(19);
    expect(ns).not.toContain(13);
    expect(new Set(ns).size).toBe(19);
    const matrix = requirementsForLevel(3).map((r) => r.n).sort((a, b) => a - b);
    expect(ns).toEqual(matrix);
  });

  it('gives every instance, field and plan section both languages at every level', () => {
    const arabic = /[؀-ۿ]/;
    const check = (en: string, ar: string, where: string) => {
      expect(en.trim(), `${where} en`).not.toBe('');
      expect(ar.trim(), `${where} ar`).not.toBe('');
      expect(arabic.test(ar), `${where} ar has no Arabic`).toBe(true);
    };
    for (const level of [1, 2, 3] as const) {
      for (const service of ['event', 'venue'] as const) {
        const rows = resolveRequirements(facts(level, { service }));
        for (const r of rows) {
          check(r.labelEn, r.labelAr, `${r.key}@${level}`);
          // A card whose fields ask the question has no prompt in either language (owner, 8 October 2026); a prompt in one language only is a parity defect.
          if (r.promptEn || r.promptAr) check(r.promptEn, r.promptAr, `${r.key}@${level} prompt`);
          check(r.stateEn, r.stateAr, `${r.key}@${level} state`);
          for (const f of r.fields) check(f.labelEn, f.labelAr, `${r.key}@${level}.${f.key}`);
        }
        for (const s of resolvePlan(facts(level, { service }), rows)) {
          check(s.promptEn, s.promptAr, `${s.key}@${level}`);
          for (const m of s.items) check(m.promptEn, m.promptAr, `${m.key}@${level}`);
        }
      }
    }
  });

  it('records the decisions as confirmed by the owner and the partner (7 October 2026); none is open', () => {
    const d = REQUIREMENT_DECISIONS;
    expect(['D1', 'D2', 'D3', 'D4', 'D5', 'D8', 'D9', 'D10'].map((k) => d[k]!.state)).toEqual(Array(8).fill('confirmed'));
    expect(Object.values(d).some((x) => x.state === 'proposal')).toBe(false);
    // D1 is the partner's correction: the Director is a Level 3 role.
    expect(d['D1']!.en).toContain('Level 3 role');
    // D6 decided by the owner, 10 October 2026: a late serious-incident notice is accepted and marked late.
    expect(d['D6']!.state).toBe('confirmed');
    expect(d['D6']!.en).toContain('late notice is accepted');
    // D7 stays as it works today and is deliberately not in the catalogue.
    expect(d['D7']).toBeUndefined();
  });

  it('counts every required pre-event item -- readiness rows, assessment and declaration -- exactly as the gate blocks (live review, 10 October 2026)', () => {
    const rows = resolveRequirements(facts(1));
    const summary = requirementSummary(rows);
    expect(summary.required.total).toBe(10);
    expect(summary.required.total - summary.required.complete).toBe(requirementBlockers(rows).length);
    expect(summary.required.yours + summary.required.others).toBe(requirementBlockers(rows).length);
    expect(byKey(rows, 'P-A').section).toBe('assessment');
    expect(byKey(rows, 'P-C').section).toBe('declaration');
  });
});

describe('Level 1: the organizer-only path (brief item 8)', () => {
  const rows = resolveRequirements(facts(1));

  it('shows the eight readiness and admin rows as required, the AED as recommended, and nothing medical-account-gated', () => {
    const required = rows.filter((r) => r.group === 'required');
    expect(keys(required)).toEqual(['B1', 'B4', 'B7', 'B9', 'B10', 'B11', 'B14', 'B16', 'P-A', 'P-C']);
    expect(keys(rows.filter((r) => r.group === 'recommended'))).toEqual(['B8']);
    // Absent entirely at Level 1: Director, BLS team, treatment point, hospital, command, insurance, plan, declaration, maps.
    for (const absent of ['B3', 'B5', 'B6', 'B12', 'B15', 'B17', 'B2', 'B20', 'P-M', 'P-D']) expect(keys(rows)).not.toContain(absent);
    // Later phases are listed for clarity, never pending.
    expect(keys(rows.filter((r) => r.group === 'later'))).toEqual(['B18', 'B19', 'P-I']);
    for (const later of rows.filter((r) => r.group === 'later')) { expect(later.state).toBe('later'); expect(later.blocks).toBe(false); }
  });

  it('is fileable with organizer answers alone: no invitation, no plan, no map, no clinical receipt', () => {
    const done = facts(1, { answers: allOrganizerAnswers(1), declaration: { statementsComplete: false, certificationComplete: true } });
    const resolved = resolveRequirements(done);
    expect(requirementBlockers(resolved)).toEqual([]);
    // The compliance statements are not demanded at Level 1 (workbook P-C: only if requested); the certification is.
    expect(byKey(resolved, 'P-C').state).toBe('complete');
    const summary = requirementSummary(resolved);
    expect(summary.required.complete).toBe(summary.required.total);
  });

  it('keeps No distinct from Complete on the AED row (brief item 14); a Yes completes it, the location optional (partner audit, 8 October 2026)', () => {
    expect(byKey(rows, 'B8').state).toBe('notAdded');
    expect(byKey(rows, 'B8').fields.map((f) => f.key)).toEqual(['aed', 'location']);
    const no = resolveRequirements(facts(1, { answers: { B8: answer({ aed: 'no' }) } }));
    expect(byKey(no, 'B8').state).toBe('notProvided');
    expect(byKey(no, 'B8').blocks).toBe(false);
    const yes = resolveRequirements(facts(1, { answers: { B8: answer({ aed: 'yes' }) } }));
    expect(byKey(yes, 'B8').state).toBe('complete');
    expect(byKey(yes, 'B8').missing).toEqual([]);
  });

  it('names the missing field, never a generic "something missing" (brief item 16)', () => {
    const partial = resolveRequirements(facts(1, { answers: { B11: answer({ clearRoute: 'no' }) } }));
    expect(byKey(partial, 'B11').missing).toEqual(['alternative']);
    expect(byKey(partial, 'B11').state).toBe('pending');
    const access = resolveRequirements(facts(1, { answers: { B10: answer({ access: 'no' }) } }));
    expect(byKey(access, 'B10').missing).toEqual(['alternative']);
    expect(byKey(resolveRequirements(facts(1, { answers: { B10: answer({ access: 'yes' }) } })), 'B10').state).toBe('complete');
  });

  it('Level 1 is confirmations and short fields: no names, counts, shifts or inventories (partner audit, 8 October 2026)', () => {
    expect(byKey(rows, 'B4').fields.map((f) => f.key)).toEqual(['available']);
    expect(byKey(rows, 'B9').fields.map((f) => f.key)).toEqual(['ready']);
    expect(byKey(rows, 'B14').fields.map((f) => f.key)).toEqual(['method']);
    expect(byKey(rows, 'B16').fields.map((f) => f.key)).toEqual(['how']);
    expect(byKey(rows, 'B11').fields.map((f) => f.key)).toEqual(['clearRoute', 'route', 'alternative']);
    expect(byKey(rows, 'B11').fields.find((f) => f.key === 'route')!.optional).toBe(true);
  });

  it('local EMS access is one short answer, with no invitation', () => {
    const b7 = byKey(rows, 'B7');
    expect(b7.labelEn).toBe('Local EMS access');
    expect(b7.fields.map((f) => f.key)).toEqual(['how']);
    expect(b7.authors).toEqual(['organizer']);
    expect(b7.sourceEn).toBe('Local EMS contact confirmed');
  });

  it('the organizer contact is prefilled from the account and saved once; without a phone it is pending', () => {
    expect(byKey(rows, 'B1').state).toBe('complete');
    expect(byKey(rows, 'B1').values).toEqual({ name: 'Example organizer', phone: '+961 3 000000' });
    expect(handledBy(byKey(rows, 'B1')).en).toBe('Organizer');
    const noPhone = byKey(resolveRequirements(facts(1, { organizerContact: { name: 'Example organizer', phone: '' } })), 'B1');
    expect(noPhone.state).toBe('pending');
    expect(noPhone.missing).toEqual(['phone']);
    const saved = byKey(resolveRequirements(facts(1, { organizerContact: null, answers: { B1: answer({ name: 'Someone else', phone: '+961 70 000000' }) } })), 'B1');
    expect(saved.state).toBe('complete');
  });

  it('a requirement that took effect after a filing is waived for that filing, never a block (effective-date rule)', () => {
    const l3 = facts(3, { waived: ['B17'] });
    const rows3 = resolveRequirements(l3);
    expect(byKey(rows3, 'B17').state).toBe('pending');
    expect(byKey(rows3, 'B17').blocks).toBe(false);
    expect(byKey(rows3, 'B17').detailEn).toContain('took effect after');
    expect(requirementBlockers(rows3).map((b) => b.key)).not.toContain('B17');
  });
});

describe('Level 2: the complete operational checklist (brief item 9, D1, D2, D3)', () => {
  const rows = resolveRequirements(facts(2));

  it('requires the eleven readiness and admin rows plus the map and declaration; treatment point and plan are recommended', () => {
    expect(keys(rows.filter((r) => r.group === 'required'))).toEqual(['B1', 'B4', 'B5', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B14', 'B16', 'P-M', 'B18', 'P-A', 'P-C']);
    expect(keys(rows.filter((r) => r.group === 'recommended'))).toEqual(['B6', 'B2']);
    // Patient-care documentation at Level 2 is one confirmation by the organizer or the provider
    // (partner audit, 8 October 2026). The live review of 10 October proposed dropping it as a
    // blocker; the owner ruled that the partner's decision stands.
    expect(byKey(rows, 'B18').fields.map((f) => f.key)).toEqual(['confirmed']);
    expect(byKey(rows, 'B18').authors).toEqual(['organizer', 'ems']);
  });

  it('D1: no Director below Level 3 -- the row is absent, nobody may invite one, and no Level 2 row names a Director author', () => {
    expect(rows.find((r) => r.key === 'B3')).toBeUndefined();
    expect(requirementApplies('B3', 2, 'event')).toBe(false);
    expect(requirementApplies('B3', 2, 'venue')).toBe(false);
    expect(requirementApplies('B3', 3, 'event')).toBe(true);
    expect(rows.every((r) => !r.authors.includes('director'))).toBe(true);
    expect(authorsFor('P13', 2, 'event')).toEqual(['ems']);
    expect(authorsFor('P13', 3, 'event')).toEqual(['ems', 'director']);
    expect(authorsFor('P13', 1, 'event')).toEqual([]);
    // A confirmed Director on a Level 2 record (legacy data) changes nothing: the row stays absent.
    const legacy = resolveRequirements(facts(2, { director: { token: 't', name: 'Dr A', status: 'confirmed' } }));
    expect(legacy.find((r) => r.key === 'B3')).toBeUndefined();
  });

  it('the site or route map is required where applicable: a file, or a recorded "does not apply" with its reason, discharges it', () => {
    const map = byKey(rows, 'P-M');
    expect(map.obligation).toBe('requiredWhereApplicable');
    expect(map.obligationEn).toBe('Required where applicable');
    expect(map.group).toBe('required');
    expect(map.state).toBe('pending');
    expect(map.blocks).toBe(true);
    expect(map.missing).toEqual(['applicable']);
    const uploaded = byKey(resolveRequirements(facts(2, { files: { 'P-M': { fileName: 'route.pdf', savedAt: '2026-10-07' } } })), 'P-M');
    expect(uploaded.state).toBe('complete');
    expect(uploaded.detailEn).toBeNull();
    const yesNoFile = byKey(resolveRequirements(facts(2, { answers: { 'P-M': answer({ applicable: 'yes' }) } })), 'P-M');
    expect(yesNoFile.state).toBe('pending');
    expect(yesNoFile.blocks).toBe(true);
    const noWithoutReason = byKey(resolveRequirements(facts(2, { answers: { 'P-M': answer({ applicable: 'no' }) } })), 'P-M');
    expect(noWithoutReason.state).toBe('pending');
    expect(noWithoutReason.missing).toEqual(['reason']);
    const notApplicable = byKey(resolveRequirements(facts(2, { answers: { 'P-M': answer({ applicable: 'no', reason: 'A single hall with one entrance; no route.' }) } })), 'P-M');
    expect(notApplicable.state).toBe('complete');
    expect(notApplicable.blocks).toBe(false);
    expect(notApplicable.detailEn).toContain('not applicable');
    // Level 3 keeps the plain requirement: a file, nothing else.
    expect(byKey(resolveRequirements(facts(3)), 'P-M').obligation).toBe('required');
    expect(fieldsFor('P-M', 3, 'event')).toEqual([]);
  });

  it('D2: the plan is optional unless the Ministry requests it; a request makes it required', () => {
    expect(byKey(rows, 'B2').group).toBe('recommended');
    expect(byKey(rows, 'B2').blocks).toBe(false);
    const requested = resolveRequirements(facts(2, { requested: ['B2'] }));
    expect(byKey(requested, 'B2').group).toBe('required');
    expect(byKey(requested, 'B2').requested).toBe(true);
    expect(byKey(requested, 'B2').blocks).toBe(true);
    expect(byKey(requested, 'B2').detailEn).toContain('Requested by the Ministry');
  });

  it('D3: escalation at Level 2 is a short coordinated procedure, not the eleven major-incident items', () => {
    const b16 = byKey(rows, 'B16');
    expect(b16.fields.map((f) => f.key)).toEqual(['how', 'told']);
    // The note explains the procedure; the internal decision ID is not shown (live review, 10 October 2026).
    expect(b16.infoEn).toContain('coordinated escalation procedure');
    expect(b16.infoEn).not.toMatch(/\bD\d+\b/);
    expect(resolvePlan(facts(2), rows).find((s) => s.key === 'P12')!.items).toEqual([]);
  });

  it('EMS arrangements need an accepted invitation AND the shared answer; acceptance alone is not an arrangement (brief item 13)', () => {
    expect(byKey(rows, 'B7').state).toBe('pending');
    expect(byKey(rows, 'B7').detailEn).toBe('No EMS agency has been invited');
    const nominated = resolveRequirements(facts(2, { ems: [{ token: 'e', name: 'Civil Defence', status: 'nominated' }] }));
    expect(byKey(nominated, 'B7').state).toBe('waiting');
    const accepted = resolveRequirements(facts(2, { ems: [{ token: 'e', name: 'Civil Defence', status: 'confirmed' }] }));
    expect(byKey(accepted, 'B7').state).toBe('pending');
    expect(byKey(accepted, 'B7').missing).toEqual(['whereWhen', 'howToCall']);
    const done = resolveRequirements(facts(2, { ems: [{ token: 'e', name: 'Civil Defence', status: 'confirmed' }], answers: { B7: fullAnswer(2, 'B7', 'ems') } }));
    expect(byKey(done, 'B7').state).toBe('complete');
    expect(byKey(done, 'B7').answeredBy?.role).toBe('ems');
  });

  it('first aid at Level 2 reuses the BLS provider\'s answer where it supplies it; otherwise one confirmation (partner audit, 8 October 2026)', () => {
    expect(byKey(rows, 'B4').state).toBe('pending');
    expect(byKey(rows, 'B4').blocks).toBe(true);
    expect(byKey(rows, 'B4').fields.map((f) => f.key)).toEqual(['separate']);
    expect(byKey(rows, 'B5').labelEn).toBe('BLS medical response team(s)');
    expect(byKey(rows, 'B5').fields.map((f) => f.key)).toEqual(['bls', 'firstAid']);
    const ems = [{ token: 'e', name: 'Civil Defence', status: 'confirmed' as const }];
    const fromTeam = resolveRequirements(facts(2, { ems, answers: { B5: answer({ bls: true, firstAid: 'yes' }, 'ems') } }));
    expect(byKey(fromTeam, 'B4').state).toBe('complete');
    expect(byKey(fromTeam, 'B4').detailEn).toContain('BLS medical response team');
    const notFromTeam = resolveRequirements(facts(2, { ems, answers: { B5: answer({ bls: true, firstAid: 'no' }, 'ems') } }));
    expect(byKey(notFromTeam, 'B4').state).toBe('pending');
    expect(byKey(notFromTeam, 'B4').missing).toEqual(['separate']);
    const separate = resolveRequirements(facts(2, { ems, answers: { B5: answer({ bls: true, firstAid: 'no' }, 'ems'), B4: answer({ separate: true }) } }));
    expect(byKey(separate, 'B4').state).toBe('complete');
    // The provider's acceptance is the EMS row's business (B7): the BLS row is the two confirmations.
    expect(byKey(rows, 'B5').detailEn).toBeNull();
  });

  it('shared rows take the first authorized completion from either side (brief item 11)', () => {
    for (const key of ['B4', 'B5', 'B8', 'B9', 'B11', 'B12', 'B14', 'B16', 'B18']) {
      expect(authorsFor(key, 2, 'event'), key).toEqual(['organizer', 'ems']);
    }
    expect(authorsFor('B10', 2, 'event')).toEqual(['organizer']);
    expect(authorsFor('B7', 2, 'event')).toEqual(['organizer', 'ems']);
    expect(authorsFor('B2', 2, 'event')).toEqual(['ems']);
    expect(mayAuthor(byKey(rows, 'B2'), 'organizer')).toBe(false);
  });

  it('a completed optional plan is complete without Director approval (brief item 10, Level 2)', () => {
    const answers: Record<string, StoredAnswer> = { ...allOrganizerAnswers(2), B5: fullAnswer(2, 'B5', 'ems'), B6: fullAnswer(2, 'B6'), B7: fullAnswer(2, 'B7', 'ems') };
    for (const key of planTextKeys()) if (key.startsWith('P')) answers[key] = answer({ text: 'Written' }, 'ems');
    const done = resolveRequirements(facts(2, { answers, ems: [{ token: 'e', name: 'A', status: 'confirmed' }], planApprovalCurrent: false }));
    expect(byKey(done, 'B2').state).toBe('complete');
    const plan = resolvePlan(facts(2, { answers, ems: [{ token: 'e', name: 'A', status: 'confirmed' }] }), done);
    expect(plan).toHaveLength(16);
    expect(plan.every((s) => s.complete)).toBe(true);
  });
});

describe('Level 3: the shared approved plan (brief item 10, D4)', () => {
  const confirmedEms = [{ token: 'e', name: 'Civil Defence', status: 'confirmed' as const, declarationSigned: false }];
  const director = { token: 'd', name: 'Dr B', status: 'confirmed' as const };

  function completeAnswers(): Record<string, StoredAnswer> {
    const answers: Record<string, StoredAnswer> = {};
    for (const row of resolveRequirements(facts(3, { ems: confirmedEms, director }))) {
      if (row.fields.length > 0) answers[row.key] = fullAnswer(3, row.key, row.authors[0] ?? 'organizer');
    }
    for (const key of planTextKeys()) answers[key] = answer({ text: 'Written' }, 'director');
    return answers;
  }

  it('requires the Director, the plan with approval, insurance, the deployment map and each agency declaration', () => {
    const rows = resolveRequirements(facts(3));
    const required = keys(rows.filter((r) => r.group === 'required'));
    for (const k of ['B3', 'B2', 'B15', 'B17', 'B20', 'P-D', 'P-M', 'B18']) expect(required).toContain(k);
    expect(rows.filter((r) => r.group === 'recommended')).toEqual([]);
    expect(byKey(rows, 'B2').approver).toBe('director');
    expect(byKey(rows, 'B20').obligation).toBe('perAgency');
  });

  it('plan-defined rows are required in the plan and feed its sections without retyping', () => {
    const rows = resolveRequirements(facts(3));
    for (const k of ['B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B14', 'B16']) {
      expect(byKey(rows, k).obligation, k).toBe('inPlan');
      expect(byKey(rows, k).linkedPlan.length, k).toBeGreaterThan(0);
    }
    const plan = resolvePlan(facts(3), rows);
    expect(plan.find((s) => s.key === 'P08')!.linked.map((i) => i.key)).toEqual(['B7']);
    expect(plan.find((s) => s.key === 'P09')!.linked.map((i) => i.key)).toEqual(['B10', 'B11']);
    expect(plan.find((s) => s.key === 'P10')!.linked.map((i) => i.key)).toEqual(['B14', 'B15']);
    expect(plan.find((s) => s.key === 'P12')!.items).toHaveLength(11);
  });

  it('D4: a prepared plan without the Director approval is waiting; a current approval completes it; a change reopens it', () => {
    const answers = completeAnswers();
    const prepared = resolveRequirements(facts(3, { answers, ems: confirmedEms, director, planApprovalCurrent: false }));
    expect(byKey(prepared, 'B2').state).toBe('waiting');
    expect(byKey(prepared, 'B2').detailEn).toContain("Medical Director's approval");
    expect(byKey(prepared, 'B2').blocks).toBe(true);
    const approved = resolveRequirements(facts(3, { answers, ems: confirmedEms, director, planApprovalCurrent: true }));
    expect(byKey(approved, 'B2').state).toBe('complete');
  });

  it('the escalation row is the eleven major-incident items; a linked item reads the communication answer', () => {
    const rows = resolveRequirements(facts(3));
    expect(byKey(rows, 'B16').fields).toEqual([]);
    expect(byKey(rows, 'B16').state).toBe('pending');
    const answers = completeAnswers();
    const done = resolveRequirements(facts(3, { answers, ems: confirmedEms, director }));
    expect(byKey(done, 'B16').state).toBe('complete');
    const m03 = resolvePlan(facts(3, { answers, ems: confirmedEms, director }), done).find((s) => s.key === 'P12')!.items.find((i) => i.key === 'M03')!;
    expect(m03.linked.map((i) => i.key)).toEqual(['B14']);
    expect(m03.complete).toBe(true);
  });

  it('each agency signs its own declaration; one party cannot sign for another (brief item 12)', () => {
    const two = [
      { token: 'a', name: 'Agency A', status: 'confirmed' as const, declarationSigned: true },
      { token: 'b', name: 'Agency B', status: 'confirmed' as const, declarationSigned: false },
    ];
    const rows = resolveRequirements(facts(3, { ems: two }));
    expect(byKey(rows, 'B20').state).toBe('waiting');
    expect(byKey(rows, 'B20').detailEn).toBe('Agency A — signed · Agency B — not yet signed');
    expect(byKey(rows, 'B20').authors).toEqual(['ems']);
    expect(authorsFor('B20', 3, 'event')).toEqual(['ems']);
    const both = resolveRequirements(facts(3, { ems: two.map((p) => ({ ...p, declarationSigned: true })) }));
    expect(byKey(both, 'B20').state).toBe('complete');
  });

  it('a fully answered, approved, signed Level 3 record has no blockers', () => {
    const answers = completeAnswers();
    const rows = resolveRequirements(facts(3, {
      answers, director, planApprovalCurrent: true,
      ems: [{ ...confirmedEms[0]!, declarationSigned: true }],
      files: { B17: { fileName: 'policy.pdf', savedAt: '' }, 'P-M': { fileName: 'map.pdf', savedAt: '' }, 'P-D': { fileName: 'deploy.pdf', savedAt: '' } },
      declaration: { statementsComplete: true, certificationComplete: true },
    }));
    expect(requirementBlockers(rows).map((b) => b.key)).toEqual([]);
  });

  it('insurance needs the fields and the evidence; patient records are the provider procedure, not records', () => {
    const noFile = resolveRequirements(facts(3, { answers: { B17: fullAnswer(3, 'B17') } }));
    expect(byKey(noFile, 'B17').state).toBe('pending');
    const withFile = resolveRequirements(facts(3, { answers: { B17: fullAnswer(3, 'B17') }, files: { B17: { fileName: 'policy.pdf', savedAt: '' } } }));
    expect(byKey(withFile, 'B17').state).toBe('complete');
    // Patient-care documentation at Level 3 follows guidance 5.13: the record, its minimum content, refusals, access and aggregate totals.
    expect(byKey(withFile, 'B18').fields.map((f) => f.key)).toEqual(['record', 'minimum', 'refusal', 'access', 'aggregate']);
    expect(byKey(withFile, 'B18').authors).toEqual(['ems', 'director']);
    expect(byKey(withFile, 'B18').infoEn).toContain('no patient-identifying data');
  });
});

describe('later phases never create pre-event blockers (brief item 15, D10)', () => {
  for (const level of [1, 2, 3] as const) {
    it(`Level ${level}`, () => {
      const rows = resolveRequirements(facts(level));
      const later = rows.filter((r) => r.group === 'later');
      expect(later.every((r) => !r.blocks && r.state === 'later')).toBe(true);
      expect(keys(later)).toContain('B19');
      expect(keys(later)).toContain('P-I');
      // Level 1: a later-phase statement. Levels 2 and 3 confirm it before filing (partner audit, 8 October 2026).
      if (level === 1) expect(keys(later)).toContain('B18');
      else expect(byKey(rows, 'B18').group).toBe('required');
    });
  }
});

describe('a hosting venue: the reusable baseline, not an event registration (8 October 2026)', () => {
  const venueAnswer = (key: string, values: Record<string, string | boolean>) => answer(values, 'organizer');
  it.each([1, 2, 3] as Level[])('at level %s the venue carries the same organizer-only rows and no event row', (level) => {
    const rows = resolveRequirements(facts(level, { service: 'venue' }));
    expect(keys(rows.filter((r) => r.group === 'required'))).toEqual(['V1', 'V2', 'V3', 'V4', 'V5', 'V7']);
    expect(keys(rows.filter((r) => r.group === 'recommended'))).toEqual(['V6']);
    expect(rows.every((r) => r.authors.length === 1 && r.authors[0] === 'organizer')).toBe(true);
    // No Director, EMS agency, BLS team, medical plan, insurance, readiness declaration or post-event report.
    for (const absent of ['B3', 'B5', 'B7', 'B2', 'B17', 'B20', 'B19', 'P-D', 'P-C']) expect(keys(rows)).not.toContain(absent);
    expect(rows.some((r) => r.group === 'later')).toBe(false);
  });

  it('an event never carries a venue row', () => {
    for (const level of [1, 2, 3] as const) expect(keys(resolveRequirements(facts(level))).some((k) => k.startsWith('V'))).toBe(false);
  });

  it('the layout row needs the map file as well as its answers; the first-aid room asks where only when there is one', () => {
    const answered = { V1: venueAnswer('V1', { configuration: 'indoor', zones: 'Main hall' }), V4: venueAnswer('V4', { exists: 'no' }) };
    const rows = resolveRequirements(facts(2, { service: 'venue', answers: answered }));
    expect(byKey(rows, 'V1').state).toBe('pending');
    expect(byKey(rows, 'V4').state).toBe('complete');
    const withMap = resolveRequirements(facts(2, { service: 'venue', answers: answered, files: { V1: { fileName: 'map.pdf', savedAt: '2026-10-08' } } }));
    expect(byKey(withMap, 'V1').state).toBe('complete');
    const roomYes = resolveRequirements(facts(2, { service: 'venue', answers: { V4: venueAnswer('V4', { exists: 'yes' }) } }));
    expect(byKey(roomYes, 'V4').state).toBe('pending');
  });

  it('AEDs come from the PAD facility on the same site; with none, the operator records that there is none', () => {
    const open = byKey(resolveRequirements(facts(1, { service: 'venue' })), 'V7');
    expect(open.state).toBe('pending');
    const linked = byKey(resolveRequirements(facts(1, { service: 'venue', padFacility: { id: 'FC-0014', nameEn: 'Beirut Sports Complex', nameAr: 'مجمّع بيروت الرياضي', devices: 3 } })), 'V7');
    expect(linked.state).toBe('complete');
    expect(linked.detailEn).toBe('Linked to the facility registration Beirut Sports Complex (FC-0014) · 3 registered AEDs');
    const none = byKey(resolveRequirements(facts(1, { service: 'venue', answers: { V7: venueAnswer('V7', { none: true }) } })), 'V7');
    expect(none.state).toBe('complete');
    expect(none.detailEn).toBe('Recorded: no facility registration for this place');
  });

  it('a complete venue has no blockers', () => {
    const answers = {
      V1: venueAnswer('V1', { configuration: 'both', zones: 'Hall and forecourt' }),
      V2: venueAnswer('V2', { entry: 'East gate' }),
      V3: venueAnswer('V3', { routes: 'Through the loading bay' }),
      V4: venueAnswer('V4', { exists: 'yes', location: 'Ground floor' }),
      V5: venueAnswer('V5', { systems: 'Public address' }),
      V7: venueAnswer('V7', { none: true }),
    };
    const rows = resolveRequirements(facts(3, { service: 'venue', answers, files: { V1: { fileName: 'map.pdf', savedAt: '2026-10-08' } } }));
    expect(requirementBlockers(rows)).toEqual([]);
  });
});

describe('the catalogue decides obligation, not the wording (brief item 6)', () => {
  it('fieldsFor refuses keys that do not apply at the level, so a client cannot post them', () => {
    expect(fieldsFor('B17', 1, 'event')).toBeNull();
    expect(fieldsFor('B3', 1, 'event')).toBeNull();
    expect(fieldsFor('P-C', 2, 'venue')).toBeNull();
    expect(fieldsFor('B10', 2, 'venue')).toBeNull();
    expect(fieldsFor('V2', 2, 'event')).toBeNull();
    expect(fieldsFor('V2', 2, 'venue')!.map((f) => f.key)).toEqual(['entry', 'staging']);
    expect(fieldsFor('B5', 2, 'event')!.map((f) => f.key)).toEqual(['bls', 'firstAid']);
    expect(fieldsFor('M04', 3, 'event')!.map((f) => f.key)).toEqual(['text']);
    expect(fieldsFor('nope', 2, 'event')).toBeNull();
  });
});

describe('plan section progress (live review, 10 October 2026)', () => {
  const p02 = (f: RecordFacts) => resolvePlan(f, resolveRequirements(f)).find((s) => s.key === 'P02')!;

  it('Level 3 contacts are partly complete with only the organizer, and name what is missing', () => {
    const s = p02(facts(3));
    expect(s.complete).toBe(false);
    expect(s.progress).toBe('partial');
    expect(s.lacking.map((x) => x.en)).toEqual(['an EMS agency that has accepted its invitation', 'a Medical Director who has accepted the invitation']);
  });

  it('an invitation not yet accepted does not complete the contacts', () => {
    expect(p02(facts(3, { ems: [{ token: 'e', name: 'A', status: 'nominated' }] })).progress).toBe('partial');
  });

  it('organizer, accepted agency and accepted Director complete the Level 3 contacts; Level 2 needs no Director', () => {
    const ems = [{ token: 'e', name: 'A', status: 'confirmed' as const }];
    expect(p02(facts(3, { ems, director: { token: 'd', name: 'D', status: 'confirmed' } })).progress).toBe('complete');
    expect(p02(facts(2, { ems })).progress).toBe('complete');
  });

  it('a section nobody has touched is pending, not partial', () => {
    const plan = resolvePlan(facts(3), resolveRequirements(facts(3)));
    expect(plan.find((s) => s.key === 'P12')!.progress).toBe('pending');
  });
});
