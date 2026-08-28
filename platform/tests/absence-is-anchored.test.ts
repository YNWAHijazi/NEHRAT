/**
 * The meta-check for the fourth defect of one family: A CHECK THAT PASSES WITHOUT
 * CHECKING.
 *
 * The family so far:
 *   1. lib/rules exports with passing tests and NO production caller. The rule was
 *      verified; nothing used it. (tests/rules-wiring.test.ts)
 *   2. A visual-comparison exception claiming a panel was "a summary of organizer
 *      content" -- a claim with no locator that nothing ever checked, and which was
 *      wrong. It concealed two unbuilt features. (tests/visual-exceptions.test.ts)
 *   3. signInAs returning success without signing in. The test then ran as the
 *      previous role and read a 404 -- the CORRECT refusal for that role -- so the
 *      failure disguised itself as right behaviour. (e2e/helpers/signin.ts)
 *   4. filesUnder returning [] for a missing directory, so a guard swept an empty
 *      corpus and reported green. (tests/helpers/files.ts -- it now throws.)
 *
 * THIS GUARD closes the most common remaining place that disguise is available: an
 * assertion that something is ABSENT. `expect(locator).toHaveCount(0)` is satisfied
 * by the intended absence AND by a 404, a renamed selector, a route never reached,
 * or a sign-in that silently did not take. All of them read as a pass.
 *
 * THE RULE: an absence must be anchored. Somewhere earlier in the same test there
 * must be a POSITIVE assertion -- something that is only true if the test reached
 * the page it meant to reach. e2e/helpers/absence.ts does this in one call and is
 * the preferred form; a positive assertion earlier in the block satisfies it too,
 * which is why panel-scoped absences below an `expect(panel).toContainText(...)`
 * are accepted as written.
 *
 * WHAT THIS CANNOT SEE: whether the anchor is a GOOD anchor. `toContainText('a')`
 * would satisfy it. That is a narrower hole than the one this closes, and unlike
 * the original it is visible in the diff.
 */

import { describe, expect, it } from 'vitest';
import { filesUnder, read, relative } from './helpers/files';

const SPECS = filesUnder('e2e', ['.ts']).filter((f) => f.endsWith('.spec.ts'));

/**
 * An assertion that only holds when the right page actually loaded.
 *
 * expectAbsent counts, and that is not a loophole: it asserts its OWN anchor before
 * it checks anything, so a completed call to it is proof the page was the page.
 */
const POSITIVE =
  /\.(toContainText|toBeVisible|toHaveText|toHaveValue|toBeEnabled|toBeChecked|toHaveAttribute|toHaveURL)\(|expect\(\s*response|status\(\)|expectRefusal\(|expectAbsent\(/;

/** An assertion satisfied by absence -- including absence for the wrong reason. */
const ABSENCE = /\.toHaveCount\(0\)|\.not\.toContainText\(|\.not\.toBeVisible\(/;

/** The helper that anchors an absence in one call; using it is always sufficient. */
const SELF_ANCHORING = /expectAbsent\(/;

/**
 * Split a spec into its test bodies. Brace matching from each `test(` opening, which
 * is exact enough for these files and does not need a parser.
 */
function testBodies(src: string): { line: number; body: string }[] {
  const out: { line: number; body: string }[] = [];
  const re = /\btest\s*\(\s*['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    let depth = 0;
    let i = m.index;
    let started = false;
    for (; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '(') { depth += 1; started = true; }
      else if (ch === ')') {
        depth -= 1;
        if (started && depth === 0) break;
      }
    }
    out.push({
      line: src.slice(0, m.index).split('\n').length,
      body: src.slice(m.index, i),
    });
  }
  return out;
}

describe('an absence assertion cannot pass on the wrong page', () => {
  it('finds the specs (this check is wired to real data)', () => {
    expect(SPECS.length).toBeGreaterThanOrEqual(5);
    const withTests = SPECS.filter((f) => testBodies(read(f)).length > 0);
    expect(withTests.length, 'no test bodies parsed -- the matcher is broken').toBeGreaterThanOrEqual(5);
  });

  it('every absence is preceded by something that proves the page loaded', () => {
    const offenders: string[] = [];
    for (const file of SPECS) {
      for (const { line, body } of testBodies(read(file))) {
        const lines = body.split('\n');
        for (let i = 0; i < lines.length; i += 1) {
          const text = lines[i] ?? '';
          if (!ABSENCE.test(text)) continue;
          if (SELF_ANCHORING.test(text)) continue;
          // Anchored if anything earlier in THIS test proves the page.
          const anchored = lines.slice(0, i).some((earlier) => POSITIVE.test(earlier));
          if (!anchored) {
            offenders.push(`${relative(file)}:${line + i} -- ${text.trim().slice(0, 72)}`);
          }
        }
      }
    }
    expect(
      offenders,
      'These assert that something is absent without first proving the page loaded. ' +
        'Each is satisfied by the intended absence AND by a 404, a renamed selector, ' +
        'or a sign-in that silently did not take -- and all of those read as a pass. ' +
        'Use expectAbsent from e2e/helpers/absence.ts, or assert something positive ' +
        'earlier in the same test.',
    ).toEqual([]);
  });
});
