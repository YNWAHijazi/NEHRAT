import { describe, it, expect } from 'vitest';
import { publicStatusArabic, medicalDirectorApplies, organizerEventState, MINISTRY_CONTENT } from '../lib/rules';
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
  it('is absent at Level 1 and with no level, optional at 2, required at 3', () => {
    expect(medicalDirectorApplies(null)).toBe(false);
    expect(medicalDirectorApplies(1)).toBe(false);
    expect(medicalDirectorApplies(2)).toBe(true);
    expect(medicalDirectorApplies(3)).toBe(true);
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
