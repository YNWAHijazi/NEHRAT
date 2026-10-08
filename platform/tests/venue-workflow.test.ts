/**
 * The venue service on the shared requirement catalogue (redesign, 2026-10-07): the same
 * rows and resolver as an event, over one routine operating session. Every assertion
 * names the workbook row or decision it stands on.
 */
import { describe, it, expect } from 'vitest';
import { venuePackageEditable } from '../lib/rules/venue-workflow';
import { authorsFor, fieldsFor, planTextKeys, requirementBlockers, resolvePlan, resolveRequirements, type RecordFacts, type StoredAnswer } from '../lib/rules/record-requirements';
import type { Level } from '../lib/rules';

const answer = (values: Record<string, string | boolean | number>, role: 'organizer' | 'ems' | 'director' = 'organizer'): StoredAnswer =>
  ({ values, savedByRole: role, savedByName: 'Tester', savedAt: '2026-10-07T10:00:00', version: 1 });
function facts(level: Level, over: Partial<RecordFacts> = {}): RecordFacts {
  return {
    service: 'venue', level, answers: {}, files: {},
    organizerContact: { name: 'Operator', phone: '+9613111111' },
    assessmentComplete: true, ems: [], director: null, planApprovalCurrent: false,
    // A venue has no organizer declaration row; the operator confirms on the submit form.
    declaration: { statementsComplete: true, certificationComplete: true },
    requested: [], ...over,
  };
}
const rows = (level: Level, over?: Partial<RecordFacts>) => resolveRequirements(facts(level, over));
const byKey = (level: Level, key: string, over?: Partial<RecordFacts>) => rows(level, over).find((r) => r.key === key);
const token = (c: string) => c.repeat(48);

/** Every field of a venue row filled with a plausible value. */
function full(level: Level, key: string, role: 'organizer' | 'ems' | 'director' = 'organizer'): StoredAnswer {
  const values: Record<string, string | boolean | number> = {};
  for (const f of fieldsFor(key, level, 'venue') ?? []) {
    if (f.showWhen) continue;
    values[f.key] = f.type === 'checkbox' ? true : f.type === 'number' ? 4 : f.type === 'choice' ? 'yes' : f.type === 'date' ? '2026-11-01' : `${f.key} answer`;
  }
  return answer(values, role);
}

/** A Level 3 venue with everything in place except what the test changes. */
function level3(over: Partial<RecordFacts> = {}): RecordFacts {
  const answers: Record<string, StoredAnswer> = {};
  for (const r of rows(3)) if (r.fields.length > 0) answers[r.key] = full(3, r.key, r.authors.includes('organizer') ? 'organizer' : 'ems');
  for (const k of planTextKeys()) answers[k] = answer({ text: `${k} text` }, 'ems');
  return facts(3, {
    answers,
    files: { 'P-M': { fileName: 'map.pdf', savedAt: '2026-10-07' }, 'P-D': { fileName: 'deployment.pdf', savedAt: '2026-10-07' }, 'B17': { fileName: 'policy.pdf', savedAt: '2026-10-07' } },
    ems: [{ token: token('a'), name: 'Agency A', status: 'confirmed', declarationSigned: true }],
    director: { token: token('b'), name: 'Dr B', status: 'confirmed' },
    planApprovalCurrent: true,
    ...over,
  });
}

describe('the venue service on the shared catalogue', () => {
  it.each([1, 2, 3] as Level[])('at level %s the event-only rows are absent and every pre-event row starts open', (level) => {
    const keys = rows(level).map((r) => r.key);
    expect(keys.length).toBeGreaterThan(0);
    // The post-event report, the organizer declaration and the serious-incident notice are the event's.
    expect(keys).not.toContain('B19');
    expect(keys).not.toContain('P-C');
    expect(keys).not.toContain('P-I');
    // Nothing is complete without an answer -- except the two facts the venue already holds.
    const open = rows(level).filter((r) => r.group !== 'later' && r.state === 'complete').map((r) => r.key).sort();
    expect(open).toEqual(['B1', 'P-A']);
  });

  it('speaks of the venue: the responsible person, the permanent site map, each operating session', () => {
    expect(byKey(1, 'B1')!.promptEn).toBe('The responsible person from your venue details.');
    expect(byKey(1, 'B1')!.values).toEqual({ name: 'Operator', phone: '+9613111111' });
    expect(byKey(1, 'B1', { organizerContact: null })!.state).toBe('pending');
    expect(byKey(2, 'P-M')!.labelEn).toBe('Site map');
    expect(byKey(1, 'B4')!.fields.find((f) => f.key === 'available')!.labelEn).toBe('Trained first-aid personnel will be available during each operating session.');
  });

  it('records the Level 1 local EMS access as one short answer by the operator alone, no invitation', () => {
    const contact = byKey(1, 'B7')!;
    expect(contact.labelEn).toBe('Local EMS access');
    expect(contact.fields.map((f) => f.key)).toEqual(['how']);
    expect(authorsFor('B7', 1, 'venue')).toEqual(['organizer']);
    expect(contact.state).toBe('pending');
    expect(byKey(1, 'B7', { answers: { B7: answer({ how: '' }) } })!.missing).toEqual(['how']);
    expect(byKey(1, 'B7', { answers: { B7: full(1, 'B7') } })!.state).toBe('complete');
  });

  it('needs an accepted EMS invitation plus the shared answer from Level 2 (B7)', () => {
    expect(byKey(2, 'B7')!.state).toBe('pending');
    expect(byKey(2, 'B7', { ems: [{ token: token('a'), name: 'Agency', status: 'nominated' }] })!.state).toBe('waiting');
    expect(byKey(2, 'B7', { ems: [{ token: token('a'), name: 'Agency', status: 'confirmed' }] })!.state).toBe('pending');
    expect(byKey(2, 'B7', { ems: [{ token: token('a'), name: 'Agency', status: 'confirmed' }], answers: { B7: full(2, 'B7', 'ems') } })!.state).toBe('complete');
    expect(authorsFor('B7', 2, 'venue')).toEqual(['organizer', 'ems']);
  });

  it('makes the Medical Director a Level 3 role: absent at Levels 1 and 2, required at Level 3 (D1)', () => {
    expect(byKey(1, 'B3')).toBeUndefined();
    expect(byKey(2, 'B3')).toBeUndefined();
    expect(byKey(3, 'B3')).toMatchObject({ group: 'required', state: 'pending', blocks: true });
    expect(byKey(3, 'B3', { director: { token: token('b'), name: 'Dr B', status: 'nominated' } })!.state).toBe('waiting');
    expect(byKey(3, 'B3', { director: { token: token('b'), name: 'Dr B', status: 'confirmed' } })!.state).toBe('complete');
  });

  it('keeps the Level 2 plan optional and makes the Level 3 plan wait on the Director\'s approval (D2, D4)', () => {
    expect(byKey(1, 'B2')).toBeUndefined();
    expect(resolvePlan(facts(1), rows(1))).toEqual([]);
    expect(byKey(2, 'B2')).toMatchObject({ group: 'recommended', state: 'notAdded', blocks: false });
    expect(resolvePlan(facts(2), rows(2))).toHaveLength(16);
    expect(byKey(3, 'B2')).toMatchObject({ group: 'required', state: 'pending', approver: 'director' });
    expect(authorsFor('B2', 3, 'venue')).toEqual(['ems', 'director']);
    const prepared = level3({ planApprovalCurrent: false });
    expect(resolvePlan(prepared, resolveRequirements(prepared)).every((s) => s.complete)).toBe(true);
    expect(resolveRequirements(prepared).find((r) => r.key === 'B2')!.state).toBe('waiting');
    expect(resolveRequirements(level3()).find((r) => r.key === 'B2')!.state).toBe('complete');
  });

  it('has each participating agency sign its own declaration at Level 3, and nothing blocks a complete package', () => {
    expect(byKey(2, 'B20')).toBeUndefined();
    const two = level3({ ems: [{ token: token('a'), name: 'Agency A', status: 'confirmed', declarationSigned: true }, { token: token('c'), name: 'Agency C', status: 'confirmed' }] });
    const b20 = resolveRequirements(two).find((r) => r.key === 'B20')!;
    expect(b20.state).toBe('waiting');
    expect(b20.detailEn).toContain('Agency C');
    expect(authorsFor('B20', 3, 'venue')).toEqual(['ems']);
    expect(requirementBlockers(resolveRequirements(level3())).map((r) => r.key)).toEqual([]);
  });

  it('locks filed, accepted and archived packages', () => {
    expect(venuePackageEditable('draft', false)).toBe(true);
    expect(venuePackageEditable('revision', false)).toBe(true);
    expect(venuePackageEditable('incomplete', false)).toBe(true);
    expect(venuePackageEditable('submitted', false)).toBe(false);
    expect(venuePackageEditable('accepted', false)).toBe(false);
    expect(venuePackageEditable('draft', true)).toBe(false);
  });
});
