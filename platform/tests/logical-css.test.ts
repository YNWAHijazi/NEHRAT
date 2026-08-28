/**
 * Non-negotiable #4. Logical CSS properties only, so the Arabic layout mirrors rather than
 * merely changing text direction.
 *
 * No library does this for us: both languages live in the DOM and `dir` comes from the
 * cookie. The mirroring is entirely these properties' work, so they are tested.
 */

import { describe, expect, it } from 'vitest';
import { filesUnder, read, relative } from './helpers/files';

const PHYSICAL: { pattern: RegExp; use: string }[] = [
  { pattern: /\bmargin-left\b/, use: 'margin-inline-start' },
  { pattern: /\bmargin-right\b/, use: 'margin-inline-end' },
  { pattern: /\bpadding-left\b/, use: 'padding-inline-start' },
  { pattern: /\bpadding-right\b/, use: 'padding-inline-end' },
  { pattern: /\bborder-left\b/, use: 'border-inline-start' },
  { pattern: /\bborder-right\b/, use: 'border-inline-end' },
  { pattern: /\btext-align:\s*(left|right)\b/, use: 'text-align: start / end' },
  { pattern: /(?<![-\w])left:\s/, use: 'inset-inline-start' },
  { pattern: /(?<![-\w])right:\s/, use: 'inset-inline-end' },
  { pattern: /\bmarginLeft\b/, use: 'marginInlineStart' },
  { pattern: /\bmarginRight\b/, use: 'marginInlineEnd' },
  { pattern: /\bpaddingLeft\b/, use: 'paddingInlineStart' },
  { pattern: /\bpaddingRight\b/, use: 'paddingInlineEnd' },
];

const SOURCE = [
  ...filesUnder('app', ['.tsx', '.ts', '.css']),
  ...filesUnder('components', ['.tsx', '.ts', '.css']),
  // app/globals.css is the only stylesheet; there is no styles/ directory and the
  // guard used to sweep it for nothing. Listed here so a future one is picked up,
  // and marked optional WITH ITS REASON rather than silently returning empty.
  ...filesUnder('styles', ['.css'], { because: 'all CSS lives in app/globals.css today; a styles/ directory would be new' }),
];

describe('logical properties only', () => {
  // WIRED TO REAL DATA. A guard that sweeps an empty corpus finds no offenders and
  // reports green, and the green is indistinguishable from a clean codebase. This is
  // the fourth defect of that family (see tests/absence-is-anchored.test.ts for the
  // list), so every sweep now proves it swept something. filesUnder throws on a
  // missing directory; these floors catch the other half -- a corpus filtered down
  // to nothing by a renamed route or a wrong extension.
  it('sweeps the real source tree', () => {
    expect(SOURCE.length).toBeGreaterThanOrEqual(90);
    expect(SOURCE.some((f) => f.endsWith('.css')), 'no stylesheet in the corpus').toBe(true);
  });


  for (const { pattern, use } of PHYSICAL) {
    it(`no source uses ${pattern.source} -- use ${use}`, () => {
      const offenders = SOURCE.filter((f) => pattern.test(read(f))).map(relative);
      expect(offenders).toEqual([]);
    });
  }
});

describe('directional glyphs', () => {
  it('every inline SVG carrying a direction is marked data-flip', () => {
    // Logical properties cannot flip an SVG path. The reference carries
    // html[lang="ar"] [data-flip]{transform:scaleX(-1)} and every arrow must opt in.
    const offenders: string[] = [];
    for (const file of SOURCE.filter((f) => f.endsWith('.tsx'))) {
      const text = read(file);
      const arrows = text.match(/<svg[^>]*\bclassName="[^"]*\b(arrow|chevron|caret)\b[^"]*"/g) ?? [];
      for (const arrow of arrows) {
        if (!arrow.includes('data-flip')) offenders.push(`${relative(file)} -- ${arrow.slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
