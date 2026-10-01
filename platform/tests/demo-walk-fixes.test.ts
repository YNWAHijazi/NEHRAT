import { describe, it, expect } from 'vitest';
import { publicStatusArabic, medicalDirectorApplies, organizerEventState } from '../lib/rules';
import ministryJson from '../lib/rules/data/ministry.json';

describe('the public register reports a filed, undecided record as filed', () => {
  it('names the filed state, never one of the three outcomes, until a reviewer records one', () => {
    const filed = organizerEventState({ outcome: null, filed: true, assessed: true });
    expect(ministryJson.outcomes.map((o) => o.en)).not.toContain(filed.en);
    expect(organizerEventState({ outcome: 'incomplete', filed: true, assessed: true }).en).toBe(ministryJson.outcomes.find((o) => o.key === 'incomplete')!.en);
  });
  it('gives every status the register can show its Arabic', () => {
    const filed = organizerEventState({ outcome: null, filed: true, assessed: true });
    expect(publicStatusArabic(filed.en)).toBe(filed.ar);
    for (const o of ministryJson.outcomes) expect(publicStatusArabic(o.en)).toBe(o.ar);
    expect(publicStatusArabic('Cancelled')).toBe('ملغاة');
  });
});

describe('the Event Medical Director applies from Level 2', () => {
  it('is absent at Level 1 and with no level, optional at 2, required at 3', () => {
    expect(medicalDirectorApplies(null)).toBe(false);
    expect(medicalDirectorApplies(1)).toBe(false);
    expect(medicalDirectorApplies(2)).toBe(true);
    expect(medicalDirectorApplies(3)).toBe(true);
  });
});
