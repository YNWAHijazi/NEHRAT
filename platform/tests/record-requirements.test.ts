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
          check(r.promptEn, r.promptAr, `${r.key}@${level} prompt`);
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

  it('records the owner decisions: D1, D2, D4 confirmed; D3, D5, D8, D9, D10 proposals', () => {
    const d = REQUIREMENT_DECISIONS;
    expect(['D1', 'D2', 'D4'].map((k) => d[k]!.state)).toEqual(['confirmed', 'confirmed', 'confirmed']);
    expect(['D3', 'D5', 'D8', 'D9', 'D10'].map((k) => d[k]!.state)).toEqual(['proposal', 'proposal', 'proposal', 'proposal', 'proposal']);
    // D6 and D7 stay as they work today and are deliberately not in the catalogue.
    expect(d['D6']).toBeUndefined();
    expect(d['D7']).toBeUndefined();
  });

  it('counts the readiness rows in the summary; the assessment and declaration have their own blocks', () => {
    const rows = resolveRequirements(facts(1));
    expect(requirementSummary(rows).required.total).toBe(8);
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

  it('keeps No and Not planned distinct from Complete on the AED row (brief item 14)', () => {
    expect(byKey(rows, 'B8').state).toBe('notAdded');
    const no = resolveRequirements(facts(1, { answers: { B8: answer({ aed: 'notPlanned' }) } }));
    expect(byKey(no, 'B8').state).toBe('notProvided');
    expect(byKey(no, 'B8').blocks).toBe(false);
    const yesWithoutPlace = resolveRequirements(facts(1, { answers: { B8: answer({ aed: 'yes' }) } }));
    expect(byKey(yesWithoutPlace, 'B8').state).toBe('pending');
    expect(byKey(yesWithoutPlace, 'B8').missing).toEqual(['location', 'access']);
    const yes = resolveRequirements(facts(1, { answers: { B8: answer({ aed: 'yes', location: 'By the stage', access: 'Ask the steward' }) } }));
    expect(byKey(yes, 'B8').state).toBe('complete');
  });

  it('names the missing field, never a generic "something missing" (brief item 16)', () => {
    const partial = resolveRequirements(facts(1, { answers: { B4: answer({ who: 'Red Cross volunteers', where: 'Gate 2' }) } }));
    expect(byKey(partial, 'B4').missing).toEqual(['contact', 'arranged']);
    expect(byKey(partial, 'B4').state).toBe('pending');
  });

  it('local EMS contact is confirmations plus a number, with no invitation', () => {
    const b7 = byKey(rows, 'B7');
    expect(b7.labelEn).toBe('Local EMS contact');
    expect(b7.fields.map((f) => f.key)).toEqual(['contacted', 'shared', 'knowHow', 'phone']);
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

  it('requires the eleven readiness and admin rows plus the map and declaration; treatment point, Director and plan are recommended', () => {
    expect(keys(rows.filter((r) => r.group === 'required'))).toEqual(['B1', 'B4', 'B5', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B14', 'B16', 'P-A', 'P-M', 'P-C']);
    expect(keys(rows.filter((r) => r.group === 'recommended'))).toEqual(['B3', 'B6', 'B2']);
  });

  it('D1: an uninvited Director does not block; a nominated one is waiting; a confirmed one completes', () => {
    expect(byKey(rows, 'B3').state).toBe('notAdded');
    expect(byKey(rows, 'B3').blocks).toBe(false);
    const nominated = resolveRequirements(facts(2, { director: { token: 't', name: 'Dr A', status: 'nominated' } }));
    expect(byKey(nominated, 'B3').state).toBe('waiting');
    const confirmed = resolveRequirements(facts(2, { director: { token: 't', name: 'Dr A', status: 'confirmed' } }));
    expect(byKey(confirmed, 'B3').state).toBe('complete');
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
    expect(b16.fields.map((f) => f.key)).toEqual(['when', 'who', 'told', 'pause']);
    expect(b16.infoEn).toContain('D3');
    expect(resolvePlan(facts(2), rows).find((s) => s.key === 'P12')!.items).toEqual([]);
  });

  it('EMS arrangements need an accepted invitation AND the shared answer; acceptance alone is not an arrangement (brief item 13)', () => {
    expect(byKey(rows, 'B7').state).toBe('pending');
    expect(byKey(rows, 'B7').detailEn).toBe('No EMS agency has been invited');
    const nominated = resolveRequirements(facts(2, { ems: [{ token: 'e', name: 'Civil Defence', status: 'nominated' }] }));
    expect(byKey(nominated, 'B7').state).toBe('waiting');
    const accepted = resolveRequirements(facts(2, { ems: [{ token: 'e', name: 'Civil Defence', status: 'confirmed' }] }));
    expect(byKey(accepted, 'B7').state).toBe('pending');
    expect(byKey(accepted, 'B7').missing).toEqual(['whereWhen', 'howToCall', 'ifLeaves']);
    const done = resolveRequirements(facts(2, { ems: [{ token: 'e', name: 'Civil Defence', status: 'confirmed' }], answers: { B7: fullAnswer(2, 'B7', 'ems') } }));
    expect(byKey(done, 'B7').state).toBe('complete');
    expect(byKey(done, 'B7').answeredBy?.role).toBe('ems');
  });

  it('first aid at Level 2 reads the response team roster and never counts twice as a blocker', () => {
    expect(byKey(rows, 'B4').state).toBe('pending');
    expect(byKey(rows, 'B4').blocks).toBe(false);
    expect(byKey(rows, 'B5').blocks).toBe(true);
    const roster = resolveRequirements(facts(2, { answers: { B5: fullAnswer(2, 'B5') } }));
    expect(byKey(roster, 'B4').state).toBe('complete');
  });

  it('shared rows take the first authorized completion from either side (brief item 11)', () => {
    for (const key of ['B5', 'B8', 'B9', 'B11', 'B12', 'B14', 'B16']) {
      expect(authorsFor(key, 2, 'event'), key).toEqual(['organizer', 'ems', 'director']);
    }
    expect(authorsFor('B10', 2, 'event')).toEqual(['organizer']);
    expect(authorsFor('B7', 2, 'event')).toEqual(['organizer', 'ems']);
    expect(authorsFor('B2', 2, 'event')).toEqual(['ems', 'director']);
    expect(mayAuthor(byKey(rows, 'B2'), 'organizer')).toBe(false);
  });

  it('a completed optional plan is complete without Director approval (brief item 10, Level 2)', () => {
    const answers: Record<string, StoredAnswer> = { ...allOrganizerAnswers(2), B6: fullAnswer(2, 'B6'), B7: fullAnswer(2, 'B7', 'ems') };
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
    for (const k of ['B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B14', 'B16', 'B18']) {
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
    expect(byKey(withFile, 'B18').fields.map((f) => f.key)).toEqual(['provider', 'method']);
    expect(byKey(withFile, 'B18').fields[1]!.labelEn).toContain('Do not enter patient details');
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
      if (level < 3) expect(keys(later)).toContain('B18');
      else expect(byKey(rows, 'B18').group).toBe('required');
    });
  }
});

describe('venues on the same catalogue (brief items 20-21)', () => {
  it('a Level 1 venue is organizer-only, with no after-event rows and no invented annual report (D8)', () => {
    const rows = resolveRequirements(facts(1, { service: 'venue' }));
    expect(keys(rows.filter((r) => r.group === 'required'))).toEqual(['B1', 'B4', 'B7', 'B9', 'B10', 'B11', 'B14', 'B16', 'P-A']);
    expect(keys(rows)).not.toContain('B19');
    expect(keys(rows)).not.toContain('P-I');
    expect(keys(rows)).not.toContain('P-C');
    expect(rows.every((r) => r.group !== 'later' || r.key === 'B18')).toBe(true);
    const done = resolveRequirements(facts(1, { service: 'venue', answers: Object.fromEntries(rows.filter((r) => r.fields.length).map((r) => [r.key, fullAnswer(1, r.key)])) }));
    expect(requirementBlockers(done)).toEqual([]);
  });

  it('venue wording replaces the event wording where the brief maps it', () => {
    const rows = resolveRequirements(facts(3, { service: 'venue' }));
    expect(byKey(rows, 'P-M').labelEn).toBe('Site map');
    expect(byKey(rows, 'P-D').labelEn).toBe('Routine deployment layout');
    const first = byKey(resolveRequirements(facts(1, { service: 'venue' })), 'B4');
    expect(first.fields.find((f) => f.key === 'arranged')!.labelEn).toContain('operating session');
    expect(byKey(resolveRequirements(facts(1)), 'B4').fields.find((f) => f.key === 'arranged')!.labelEn).toContain('throughout the event');
  });
});

describe('the catalogue decides obligation, not the wording (brief item 6)', () => {
  it('fieldsFor refuses keys that do not apply at the level, so a client cannot post them', () => {
    expect(fieldsFor('B17', 1, 'event')).toBeNull();
    expect(fieldsFor('B3', 1, 'event')).toBeNull();
    expect(fieldsFor('P-C', 2, 'venue')).toBeNull();
    expect(fieldsFor('B5', 2, 'event')!.map((f) => f.key)).toEqual(['team', 'responders', 'coverage']);
    expect(fieldsFor('M04', 3, 'event')!.map((f) => f.key)).toEqual(['text']);
    expect(fieldsFor('nope', 2, 'event')).toBeNull();
  });
});
