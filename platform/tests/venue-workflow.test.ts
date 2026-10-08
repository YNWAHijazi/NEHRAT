/**
 * The venue service on the shared requirement catalogue (redesign, 2026-10-07): the same
 * rows and resolver as an event, over one routine operating session. Every assertion
 * names the workbook row or decision it stands on.
 */
import { describe, it, expect } from 'vitest';
import { venuePackageEditable } from '../lib/rules/venue-workflow';
import { authorsFor, fieldsFor, requirementBlockers, resolvePlan, resolveRequirements, type RecordFacts, type StoredAnswer } from '../lib/rules/record-requirements';
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

describe('the hosting venue on the shared catalogue (Hosting Venue Registration, 8 October 2026)', () => {
  it.each([1, 2, 3] as Level[])('at level %s every step starts open and only the operator fills it', (level) => {
    const all = rows(level);
    expect(all.map((r) => r.key)).toEqual(['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7']);
    expect(all.filter((r) => r.state === 'complete')).toEqual([]);
    for (const r of all) expect(authorsFor(r.key, level, 'venue')).toEqual(['organizer']);
  });

  it('the level is the venue baseline: the same steps at every level, no medical plan', () => {
    for (const level of [1, 2, 3] as Level[]) {
      expect(resolvePlan(facts(level), rows(level))).toEqual([]);
      expect(fieldsFor('V3', level, 'venue')!.map((f) => f.key)).toEqual(['routes', 'lifts']);
    }
  });

  it('the event rows are absent from a venue, whatever was stored under them', () => {
    const stale = rows(3, { answers: { B7: answer({ units: 'Two ambulances' }, 'ems') }, ems: [{ token: 'a'.repeat(48), name: 'Agency', status: 'confirmed' }] });
    expect(stale.map((r) => r.key)).not.toContain('B7');
    expect(fieldsFor('B7', 3, 'venue')).toBeNull();
  });

  it('nothing blocks a complete venue', () => {
    const answers: Record<string, StoredAnswer> = {
      V1: answer({ configuration: 'indoor', zones: 'Hall' }), V2: answer({ entry: 'Gate' }), V3: answer({ routes: 'Bay' }),
      V4: answer({ exists: 'no' }), V5: answer({ systems: 'PA' }), V7: answer({ none: true }),
    };
    expect(requirementBlockers(rows(2, { answers, files: { V1: { fileName: 'map.pdf', savedAt: '2026-10-08' } } }))).toEqual([]);
    expect(requirementBlockers(rows(2, { answers })).map((r) => r.key)).toEqual(['V1']);
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
