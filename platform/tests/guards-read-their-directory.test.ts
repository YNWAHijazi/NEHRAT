/**
 * The meta-check: a guard that names its inputs by hand has a blind spot BY
 * CONSTRUCTION, and the blind spot grows every time someone adds a file.
 *
 * This has now happened three times, each time in a guard that was passing:
 *
 *   - banned-terms swept four of twelve data files. The eight it never opened could
 *     have carried any forbidden term.
 *   - bilingual-parity named five of twelve. Parity is non-negotiable 4, so this was
 *     the worst of the three: seven files' worth of Arabic was never checked at all.
 *   - no-hardcoded-values swept `app` and `components` only, and `lib/password.ts` was
 *     importing the policy JSON straight off disk -- the exact bypass that guard exists
 *     to catch, sitting in a directory the guard never looked at.
 *
 * In every case the suite was green and the guard was reporting success. So the rule is
 * now enforced rather than remembered: a guard that reads source files must obtain them
 * by reading a directory, not by listing them.
 *
 * WHAT THIS CANNOT SEE. It reasons about the shape of the test source, not about what
 * the test does at runtime. A guard could still read its directory and then filter the
 * results down to nothing. That is a narrower hole than the one this closes, and it is
 * at least visible in the diff.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TESTS_DIR = join(process.cwd(), 'tests');

/** Every guard in the suite -- read from the directory, naturally. */
const guards = readdirSync(TESTS_DIR)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => ({ name: f, src: readFileSync(join(TESTS_DIR, f), 'utf8') }));

/**
 * A guard "reads source files" if it pulls file contents in at all -- whether by
 * walking a directory (`filesUnder`, `readdirSync`) or by importing specific ones.
 */
const readsFiles = (src: string): boolean =>
  /\bfilesUnder\s*\(|\breaddirSync\s*\(|\breadFileSync\s*\(/.test(src) ||
  /^import\s+\w+\s+from\s+'\.\.\/lib\/.*\.json'/m.test(src);

/** Does it obtain its inputs by reading a directory? */
const readsDirectory = (src: string): boolean =>
  /\bfilesUnder\s*\(/.test(src) || /\breaddirSync\s*\(/.test(src);

/**
 * Guards allowed to name specific files, each for a stated reason. This list is the
 * pressure valve, and it is meant to stay short: an entry here is a promise that the
 * named file is the ONLY possible input, not that sweeping would be inconvenient.
 */
const NAMED_INPUTS_ALLOWED: Record<string, string> = {
  'reference-drift.test.ts':
    'Pins a specific snapshot against the specific prototype files it was extracted from. Naming them IS the check -- a drift guard that swept a directory would not know which file each pin belongs to.',
  'guards-read-their-directory.test.ts':
    'This file. It reads the tests directory to find the guards, and names only itself and the drift pin in the allowlist below.',
  'bootstrap-demonstration.test.ts':
    'Holds one command and the two files its safety depends on -- the seeder it must agree with, and the passwordless sign-in action that must read is_demo off the record. Four named files, not a class of files: sweeping a directory would find files that have nothing to do with the contract and miss none that do.',
};

describe('a guard reads its directory rather than naming its inputs', () => {
  it('finds the guards (this check is wired to real data)', () => {
    expect(guards.length).toBeGreaterThanOrEqual(15);
  });

  it('every guard that reads source files sweeps a directory for them', () => {
    const offenders = guards
      .filter((g) => !(g.name in NAMED_INPUTS_ALLOWED))
      .filter((g) => readsFiles(g.src))
      .filter((g) => !readsDirectory(g.src))
      .map((g) => g.name);
    expect(
      offenders,
      'These guards read source files but obtain them from a hand-written list. A guard ' +
        'that names its inputs has a blind spot by construction, and it grows silently as ' +
        'files are added -- this has already produced three real misses. Sweep the ' +
        'directory (tests/helpers/files.ts has filesUnder), or add an entry to ' +
        'NAMED_INPUTS_ALLOWED stating why the named file is the only possible input.',
    ).toEqual([]);
  });

  it('the allowlist stays justified and short', () => {
    // Every entry must exist and carry a real reason -- not an empty string added to
    // silence the check.
    for (const [name, why] of Object.entries(NAMED_INPUTS_ALLOWED)) {
      expect(guards.some((g) => g.name === name), `${name} is in the allowlist but does not exist`).toBe(true);
      expect(why.length, `${name} has no stated reason`).toBeGreaterThan(40);
    }
    expect(
      Object.keys(NAMED_INPUTS_ALLOWED).length,
      'The allowlist is growing. Each entry is a guard with a hand-written blind spot.',
    ).toBeLessThanOrEqual(3);
  });
});
