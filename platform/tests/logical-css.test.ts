/**
 * Non-negotiable #4. Logical CSS properties only, so the Arabic layout mirrors rather than
 * merely changing text direction.
 *
 * next-intl does not do this for us -- it handles strings, ICU and formatting, and neither
 * sets `dir` nor mirrors layout. Both are ours, so both are tested.
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
  ...filesUnder('styles', ['.css']),
];

describe('logical properties only', () => {
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
