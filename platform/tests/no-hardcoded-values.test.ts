/**
 * Non-negotiable #3. No regulatory threshold, phase, timeframe or designation hard-coded
 * in a component.
 *
 * Narrowed deliberately: a regulatory figure only violates when it appears in LOGIC -- a
 * comparison or an assignment. `padding: 18px` is a style, not a threshold, and a test
 * that fires on styles gets switched off. So the sweep:
 *
 *   - reads the banned figures FROM the rules data, staying in step with Ministry changes
 *   - matches only comparison and assignment contexts (>= 14, === 30, days: 7, {days=14})
 *   - strips style contexts entirely -- style props, styled-object literals, .css files,
 *     className strings -- before matching
 */

import { describe, expect, it } from 'vitest';
import levelsJson from '../lib/rules/data/levels.json';
import conditionsJson from '../lib/rules/data/minimum-conditions.json';
import { filesUnder, read, relative } from './helpers/files';

/** Every number that appears anywhere in the regulatory data, above the level range. */
function regulatoryFigures(): number[] {
  const found = new Set<number>();
  const walk = (v: unknown): void => {
    if (typeof v === 'number') found.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(levelsJson);
  walk(conditionsJson);
  // 0-3 are levels and domain scores; they appear in ordinary code constantly.
  return [...found].filter((n) => n > 3);
}

/**
 * Removes the contexts where a bare number is a style, not a rule:
 * style={{...}} props, `style:` object values, tailwind-like className strings, and
 * anything inside a template literal (CSS-in-JS).
 */
function stripStyleContexts(source: string): string {
  return source
    .replace(/style=\{\{[^}]*\}\}/gs, 'style={{}}')
    .replace(/\bstyle:\s*\{[^}]*\}/gs, 'style: {}')
    .replace(/className\s*=\s*(["'`])[^"'`]*\1/g, 'className=""')
    .replace(/`[^`]*`/gs, '``');
}

/**
 * True when the figure appears in logic: compared (>= 14, < 30, === 7) or assigned to a
 * bare identifier (days: 7, leadTime = 14, {windowDays: 7}).
 */
function appearsInLogic(source: string, figure: number): boolean {
  const n = String(figure).replace('.', '\\.');
  const grouped = figure.toLocaleString('en-US').replace(/,/g, '[,_]?');
  const num = `(?:${n}|${grouped})`;
  const comparison = new RegExp(`(?:[<>]=?|===?|!==?)\\s*${num}(?![\\d.])`);
  const reverseComparison = new RegExp(`(?<![\\d.])${num}\\s*(?:[<>]=?|===?|!==?)`);
  const assignment = new RegExp(`\\b[A-Za-z_$][\\w$]*\\s*[:=]\\s*${num}(?![\\d.])`);
  return (
    comparison.test(source) || reverseComparison.test(source) || assignment.test(source)
  );
}

const FIGURES = regulatoryFigures();

// Logic lives in .ts and .tsx. Style sheets are excluded wholesale: a number in CSS is
// never a regulatory rule, because rules must come from the module, not the sheet.
const SOURCE = [
  ...filesUnder('app', ['.tsx', '.ts']),
  ...filesUnder('components', ['.tsx', '.ts']),
];

describe('regulatory figures live in data, not in components', () => {
  it('has figures to check for', () => {
    expect(FIGURES.length).toBeGreaterThan(0);
    // The figures that matter most must be among them.
    for (const expected of [7, 14, 30, 10_000, 20_000, 21.1, 1_000, 60]) {
      expect(FIGURES).toContain(expected);
    }
  });

  for (const figure of FIGURES) {
    it(`no component compares against or assigns ${figure}`, () => {
      const offenders = SOURCE.filter((f) =>
        appearsInLogic(stripStyleContexts(read(f)), figure),
      ).map(relative);
      expect(
        offenders,
        `${figure} is a regulatory value used in logic. Ask lib/rules/ instead of hard-coding it.`,
      ).toEqual([]);
    });
  }
});

describe('the narrowing itself', () => {
  it('fires on a comparison', () => {
    expect(appearsInLogic('if (days >= 14) {', 14)).toBe(true);
    expect(appearsInLogic('if (14 > days) {', 14)).toBe(true);
  });

  it('fires on an assignment', () => {
    expect(appearsInLogic('const leadTimeDays = 30;', 30)).toBe(true);
    expect(appearsInLogic('return { windowDays: 7 };', 7)).toBe(true);
  });

  it('fires on a grouped figure', () => {
    expect(appearsInLogic('if (attendance >= 20_000) {', 20_000)).toBe(true);
    expect(appearsInLogic('attendance >= 20000', 20_000)).toBe(true);
  });

  it('does not fire on a style', () => {
    const styled = stripStyleContexts('<div style={{ padding: 14, fontSize: 30 }} />');
    expect(appearsInLogic(styled, 14)).toBe(false);
    expect(appearsInLogic(styled, 30)).toBe(false);
  });

  it('does not fire on a className or a template literal', () => {
    expect(appearsInLogic(stripStyleContexts('className="grid-cols-14 p-30"'), 14)).toBe(false);
    expect(appearsInLogic(stripStyleContexts('const css = `margin: 30px`;'), 30)).toBe(false);
  });

  it('does not fire on a mere occurrence in text', () => {
    expect(appearsInLogic('// the 14-day rule is described in SPEC', 14)).toBe(false);
  });
});

describe('components ask the rules module rather than deciding', () => {
  it('no component reads the rules JSON directly', () => {
    const offenders = SOURCE.filter((f) => /lib\/rules\/data\//.test(read(f))).map(relative);
    expect(
      offenders,
      'Import from lib/rules, which narrows and validates, rather than from the raw JSON.',
    ).toEqual([]);
  });
});
