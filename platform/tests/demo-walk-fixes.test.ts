import { describe, it, expect } from 'vitest';
import { publicStatusArabic, organizerEventState, MINISTRY_CONTENT, resolveRequirements } from '../lib/rules';
const ministryJson = MINISTRY_CONTENT;

describe('the record status is a plain reading of the record (owner direction, 2026-10-07)', () => {
  it('names the filed state as in process, never one of the three outcomes, until a reviewer records one', () => {
    const filed = organizerEventState({ outcome: null, filed: true, assessed: true });
    expect(filed.en).toBe('In process');
    expect(ministryJson.outcomes.map((o) => o.en)).not.toContain(filed.en);
    expect(organizerEventState({ outcome: null, filed: false, assessed: true }).en).toBe('In preparation');
    expect(organizerEventState({ outcome: null, filed: false, assessed: false }).en).toBe('In preparation');
  });
  it('turns each recorded outcome into its plain label while the outcome keeps its own words elsewhere', () => {
    expect(organizerEventState({ outcome: 'satisfied', filed: true, assessed: true }).en).toBe('Certificate ready');
    expect(organizerEventState({ outcome: 'revision', filed: true, assessed: true }).en).toBe('Modifications requested');
    expect(organizerEventState({ outcome: 'incomplete', filed: true, assessed: true }).en).toBe('More information needed');
    expect(ministryJson.outcomes.map((o) => o.en)).toEqual(['Submission received but incomplete', 'Additional information or revision required', 'Health and medical preparedness requirements satisfied']);
  });
  it('gives every status the register can show its Arabic', () => {
    for (const key of ['satisfied', 'revision', 'incomplete'] as const) {
      const s = organizerEventState({ outcome: key, filed: true, assessed: true });
      expect(publicStatusArabic(s.en)).toBe(s.ar);
    }
    const filed = organizerEventState({ outcome: null, filed: true, assessed: true });
    expect(publicStatusArabic(filed.en)).toBe(filed.ar);
    for (const o of ministryJson.outcomes) expect(publicStatusArabic(o.en)).toBe(o.ar);
    expect(publicStatusArabic('Cancelled')).toBe('ملغاة');
  });
});

describe('the Event Medical Director is a Level 3 role (decision D1, partner review 2026-10-07)', () => {
  it('is absent at Levels 1 and 2, required at 3 -- from the catalogue, not a flag', () => {
    const director = (level: 1 | 2 | 3) => resolveRequirements({
      service: 'event', level, answers: {}, files: {}, organizerContact: null, assessmentComplete: true, ems: [], director: null,
      planApprovalCurrent: false, declaration: { statementsComplete: false, certificationComplete: false }, requested: [],
    }).find((r) => r.key === 'B3');
    expect(director(1)).toBeUndefined();
    expect(director(2)).toBeUndefined();
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
