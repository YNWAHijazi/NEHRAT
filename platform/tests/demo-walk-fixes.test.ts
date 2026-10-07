import { describe, it, expect } from 'vitest';
import { publicStatusArabic, organizerEventState, MINISTRY_CONTENT, resolveRequirements } from '../lib/rules';
const ministryJson = MINISTRY_CONTENT;

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
  it('is absent at Level 1, recommended at 2, required at 3 -- from the catalogue, not a flag', () => {
    const director = (level: 1 | 2 | 3) => resolveRequirements({
      service: 'event', level, answers: {}, files: {}, organizerContact: null, assessmentComplete: true, ems: [], director: null,
      planApprovalCurrent: false, declaration: { statementsComplete: false, certificationComplete: false }, requested: [],
    }).find((r) => r.key === 'B3');
    expect(director(1)).toBeUndefined();
    expect(director(2)?.group).toBe('recommended');
    expect(director(3)?.group).toBe('required');
  });
});

describe('one clock: every timestamp a DEFAULT fills is re-stamped on the Beirut clock', () => {
  it('lists every column whose schema default is UTC datetime(now)', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { vi } = await import('vitest');
    const folder = mkdtempSync(join(tmpdir(), 'one-clock-'));
    vi.stubEnv('DATABASE_PATH', join(folder, 'clock.db'));
    try {
      const { getDb, ONE_CLOCK_COLUMNS } = await import('../lib/db');
      const db = getDb();
      const listed = new Set(ONE_CLOCK_COLUMNS.map(([table, col]) => `${table}.${col}`));
      const missing: string[] = [];
      for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]) {
        for (const c of db.prepare(`PRAGMA table_info(${name})`).all() as { name: string; dflt_value: string | null }[]) {
          if (String(c.dflt_value ?? '').includes("datetime('now')") && !listed.has(`${name}.${c.name}`)) missing.push(`${name}.${c.name}`);
        }
      }
      expect(listed.size).toBeGreaterThan(40);
      expect(missing).toEqual([]);
      db.close();
    } finally {
      vi.unstubAllEnvs();
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
