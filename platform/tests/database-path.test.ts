/**
 * Where the register lives, and the two ways that question was answered wrongly.
 *
 * 1. THE SILENT FALLBACK. On the first deployed run DATABASE_PATH was unset. The app
 *    fell back to its development default -- a file on the container's own disk, which
 *    the next deploy destroys -- while an empty volume sat mounted at /data. A
 *    provisioning command wrote eleven accounts there and printed success. The fix
 *    first landed in that command, which left the cause untouched: anything else
 *    calling getDb() got the same behaviour. The refusal belongs where the path is
 *    computed, and this holds it there.
 *
 * 2. `??` INSTEAD OF `||`. Nullish coalescing catches undefined, not an empty string,
 *    and a variable added through a hosting dashboard with the value field left blank
 *    IS an empty string. DATABASE_PATH="" would have produced an empty path and
 *    NEXT_DIST_DIR="" an empty build directory -- both reachable by tabbing past a
 *    field. The same shape as every other member of the family: a check answering a
 *    narrower question than the one it appears to answer.
 *
 * The refusal is inside getDb(), NOT at module scope, and that is load-bearing:
 * `next build` runs with NODE_ENV=production and pages import this module while
 * prerendering, so a top-level throw fails the BUILD on a machine where DATABASE_PATH
 * is legitimately unset. There is a test for that below, because the obvious
 * implementation of this refusal breaks the build and would be found in CI, not here.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { filesUnder, read, relative } from './helpers/files';

const ROOT = join(__dirname, '..');
const DB_SRC = readFileSync(join(ROOT, 'lib/db.ts'), 'utf8');
const NEXT_CONFIG = readFileSync(join(ROOT, 'next.config.ts'), 'utf8');

const ORIGINAL = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...ORIGINAL };
  vi.resetModules();
});

/** Loads a fresh copy of lib/db so the module-level cache does not leak between cases. */
async function freshGetDb(): Promise<() => unknown> {
  vi.resetModules();
  const mod = await import('../lib/db');
  return mod.getDb as unknown as () => unknown;
}

describe('the database path', () => {
  it('refuses the development fallback in production when DATABASE_PATH is unset', async () => {
    delete process.env['DATABASE_PATH'];
    vi.stubEnv('NODE_ENV', 'production');
    const getDb = await freshGetDb();
    expect(() => getDb()).toThrow(/DATABASE_PATH is unset/);
  });

  it('treats an EMPTY DATABASE_PATH as unset, not as a path', async () => {
    // The `??` bug: an empty string is not nullish, so it would have sailed through
    // as the path. Reachable by adding the variable and leaving the value blank.
    process.env['DATABASE_PATH'] = '';
    vi.stubEnv('NODE_ENV', 'production');
    const getDb = await freshGetDb();
    expect(() => getDb()).toThrow(/DATABASE_PATH is unset/);
  });

  it('treats a whitespace-only DATABASE_PATH as unset', async () => {
    process.env['DATABASE_PATH'] = '   ';
    vi.stubEnv('NODE_ENV', 'production');
    const getDb = await freshGetDb();
    expect(() => getDb()).toThrow(/DATABASE_PATH is unset/);
  });

  it('opens the database when the path is actually given', async () => {
    // The positive half. Without it the three refusals above are satisfied by a
    // getDb() that throws unconditionally, which would pass every one of them.
    process.env['DATABASE_PATH'] = join(tmpdir(), `nehrat-path-${process.pid}.db`);
    vi.stubEnv('NODE_ENV', 'production');
    const getDb = await freshGetDb();
    expect(() => getDb()).not.toThrow();
  });

  it('allows the development fallback outside production', async () => {
    delete process.env['DATABASE_PATH'];
    vi.stubEnv('NODE_ENV', 'development');
    const getDb = await freshGetDb();
    expect(() => getDb()).not.toThrow();
  });

  it('computes the path on use, not at module load', () => {
    // If this refusal moves to module scope, `next build` fails: it runs with
    // NODE_ENV=production and pages import lib/db while prerendering, on a machine
    // where DATABASE_PATH is legitimately unset because nothing is serving yet.
    // "Module scope" means: before any function body opens. An indented throw inside
    // `if (...) { }` at top level is still module scope, so indentation cannot be the
    // test -- the first function declaration is.
    const firstFunction = DB_SRC.search(/^(export )?function /m);
    expect(firstFunction, 'no function declarations in lib/db.ts?').toBeGreaterThan(0);
    expect(
      DB_SRC.slice(0, firstFunction),
      'the refusal must not throw at module scope — it would fail next build, which ' +
        'runs with NODE_ENV=production while DATABASE_PATH is legitimately unset',
    ).not.toContain('throw new Error');

    // And it IS inside databasePath(), which getDb calls on first use.
    const fn = DB_SRC.slice(DB_SRC.indexOf('function databasePath()'));
    expect(fn.slice(0, fn.indexOf('\n}'))).toContain('DATABASE_PATH is unset');
  });
});

describe('environment variables read with the right operator', () => {
  it('NO file reads an environment variable with ??', () => {
    // SWEPT, NOT NAMED. This started as two named files -- lib/db.ts and
    // next.config.ts -- and the guard that checks guards refused it: naming inputs
    // creates a blind spot that grows silently as files are added, and the allowlist
    // is capped so exemptions cannot be bought indefinitely. It was right. "An
    // environment variable read with ??" is a CLASS of files, not two of them.
    //
    // The defect: `??` catches undefined but not an empty string, and a variable added
    // through a hosting dashboard with the value field left blank IS an empty string.
    // It then sails through as if it were a real value.
    const sources = [
      ...filesUnder('lib', ['.ts']),
      ...filesUnder('app', ['.ts', '.tsx']),
      ...filesUnder('scripts', ['.ts', '.mjs']),
      join(ROOT, 'next.config.ts'),
    ];
    expect(sources.length, 'the sweep found no files').toBeGreaterThan(50);

    const offenders: string[] = [];
    for (const file of sources) {
      for (const line of read(file).split('\n')) {
        if (/process\.env\[[^\]]+\]\s*\?\?/.test(line)) offenders.push(`${relative(file)}: ${line.trim()}`);
      }
    }
    expect(
      offenders,
      'These read an environment variable with ??, which passes an empty string ' +
        'through as if it were a value. Use || so a blank dashboard field falls back.',
    ).toEqual([]);
  });

  it('and the ones that matter use || (this check is wired to real data)', () => {
    // The positive half: the sweep above is satisfied by a codebase that reads no
    // environment variables at all.
    expect(NEXT_CONFIG).toMatch(/process\.env\['NEXT_DIST_DIR'\]\s*\|\|/);
    expect(DB_SRC).toMatch(/process\.env\['DATABASE_PATH'\]\?\.trim\(\)/);
  });

  it('the build emits a standalone bundle, and keeps its own dist directory', () => {
    // Standalone is what lets the container run the literal build output rather than
    // rebuilding. distDir must survive it: it is why the e2e harness can run while
    // the app is open in a browser without the two builds deleting each other's chunks.
    expect(NEXT_CONFIG).toMatch(/output:\s*'standalone'/);
    expect(NEXT_CONFIG).toMatch(/distDir:/);
  });
});
