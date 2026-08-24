/**
 * The wiring guard. effectiveCycles had a passing unit test and no production caller
 * for a whole slice -- the suite asserted behaviour the platform never executed, and
 * "green" overstated things. This test re-runs the sweep on every verify:
 *
 *   Every value export of lib/rules must carry at least one non-import reference in
 *   production code beyond its own definition. Own-file use counts (a private helper
 *   reached through a wired function is wired); index.ts re-exports and test files
 *   do not.
 *
 * The allowlist below is EMPTY and stays empty. An export that loses its last caller
 * fails the build as an "unwired rule" -- delete it or wire it, never allowlist it.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const RULES_DIR = join(ROOT, 'lib', 'rules');

const ALLOWLIST: readonly string[] = [];

function ruleExports(): { name: string; file: string }[] {
  const out: { name: string; file: string }[] = [];
  for (const f of readdirSync(RULES_DIR)) {
    if (!f.endsWith('.ts') || f === 'index.ts') continue;
    const src = readFileSync(join(RULES_DIR, f), 'utf8');
    for (const m of src.matchAll(/export (?:async )?(?:function|const|class) (\w+)/g)) {
      out.push({ name: m[1]!, file: f });
    }
  }
  return out;
}

function productionFiles(): string[] {
  const files: string[] = [];
  const skip = new Set(['node_modules', '.next', 'e2e', 'tests', 'test-results', 'playwright-report', '.git', 'var', 'scripts', 'acceptance']);
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue;
      const p = join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts')) files.push(p);
    }
  };
  walk(join(ROOT, 'app'));
  walk(join(ROOT, 'lib'));
  walk(join(ROOT, 'components'));
  return files;
}

describe('every lib/rules export is wired', () => {
  it('no export lacks a production reference (an unwired rule fails the build)', () => {
    const exports = ruleExports();
    const files = productionFiles().map((p) => ({ path: p, src: readFileSync(p, 'utf8') }));
    const unwired: string[] = [];

    for (const { name, file } of exports) {
      if (ALLOWLIST.includes(name)) continue;
      const pattern = new RegExp(`\\b${name}\\b`);
      let used = false;
      for (const { path, src } of files) {
        if (basename(path) === 'index.ts' && path.includes(join('lib', 'rules'))) continue;
        const isOwnFile = path.endsWith(join('lib', 'rules', file));
        for (const line of src.split('\n')) {
          if (/^\s*(import|export)\b/.test(line)) {
            // An export-definition line in the own file is the definition, not a use;
            // import lines anywhere prove nothing by themselves.
            continue;
          }
          if (pattern.test(line)) {
            used = true;
            break;
          }
        }
        if (used) break;
        // Own-file non-import use was covered by the loop above (definition lines are
        // `export function ...` and skipped); a helper called internally matches on
        // its call line.
        void isOwnFile;
      }
      if (!used) unwired.push(`${file}: ${name}`);
    }

    expect(
      unwired,
      `Unwired rule(s) -- exported from lib/rules with no production caller. ` +
        `Wire each into the surface that owes it, or delete it. Never allowlist: ${unwired.join(', ')}`,
    ).toEqual([]);
  });

  it('the allowlist stays empty', () => {
    expect(ALLOWLIST).toEqual([]);
  });
});
