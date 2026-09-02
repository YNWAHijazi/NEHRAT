/**
 * SPEC 6 and 9. The banned-terms sweep, both languages.
 *
 * "Approved" and "rejected" are not among the three outcomes and must never appear.
 * "Free" is never used for a fee. No annex letter is ever visible to a user. No emoji.
 */

import { describe, expect, it } from 'vitest';
import en from '../lib/i18n/messages/en.json';
import ar from '../lib/i18n/messages/ar.json';
import conditionsJson from '../lib/rules/data/minimum-conditions.json';
import domainsJson from '../lib/rules/data/domains.json';
import banned from '../lib/rules/data/banned-terms.json';
import { walkStrings, filesUnder, read, relative } from './helpers/files';

/**
 * Everything a user can read.
 *
 * This list used to name FOUR files, and the eight it did not name carried the terms.
 * The compliance form said الملحق أ and الملحق ب in Arabic while its English said
 * "risk assessment"; the requirements matrix said خطة EHMP in four places. Both terms
 * were already on the banned list and had been for as long as the list existed -- the
 * sweep simply never looked at the file. A guard with a hand-written list of inputs
 * fails silently the moment someone adds a ninth file, so the list is now the DIRECTORY.
 *
 * Excluded paths are the ones no user reads: `$comment` (notes to ourselves), `why`
 * (the banned list's own rationale, which must name the terms it bans), and `*Source`
 * (the citation recording which instrument a row came from, e.g. arSource).
 */
const dataStrings = filesUnder('lib/rules/data', ['.json'])
  .filter((f) => !f.endsWith('banned-terms.json'))
  .flatMap((f) =>
    walkStrings(JSON.parse(read(f)) as unknown).map((s) => ({ ...s, source: relative(f) })),
  );

const userFacing = [
  ...walkStrings(en).map((s) => ({ ...s, source: 'en.json' })),
  ...walkStrings(ar).map((s) => ({ ...s, source: 'ar.json' })),
  ...walkStrings(conditionsJson.conditions).map((s) => ({ ...s, source: 'minimum-conditions.json' })),
  ...walkStrings(domainsJson.domains).map((s) => ({ ...s, source: 'domains.json' })),
  ...dataStrings,
].filter(
  (s) =>
    !s.path.includes('$comment') &&
    !s.path.includes('why') &&
    !/Source$|Source\./.test(s.path) &&
    !s.path.includes('divergence') &&
    !s.path.includes('arNote') &&
    !s.path.includes('enNote'),
);

describe('banned terms', () => {
  for (const term of banned.terms) {
    it(`never says "${term.en}" -- ${term.why}`, () => {
      const needle = new RegExp(`\\b${term.en}\\b`, 'i');
      // A handful of instrument phrases use "approved" in its ordinary sense (an
      // approved capacity, approved equipment). Each is listed in banned-terms.json
      // with the sense it carries; the word is blanked before the test so a NEW
      // occurrence still fails.
      const scrub = (v: string): string =>
        banned.allowedPhrases.reduce(
          (acc, a) => acc.replace(new RegExp(a.phrase, 'gi'), ''),
          v,
        );
      const hits = userFacing.filter((s) => needle.test(scrub(s.value)));
      expect(hits.map((h) => `${h.source}:${h.path}`)).toEqual([]);
    });

    it(`never says "${term.ar}"`, () => {
      const hits = userFacing.filter((s) => s.value.includes(term.ar));
      expect(hits.map((h) => `${h.source}:${h.path}`)).toEqual([]);
    });
  }

  for (const rule of banned.bannedRegex) {
    it(`matches nothing for /${rule.pattern}/${rule.flags} -- ${rule.why}`, () => {
      const re = new RegExp(rule.pattern, rule.flags);
      const hits = userFacing.filter((s) => re.test(s.value));
      expect(hits.map((h) => `${h.source}:${h.path}`)).toEqual([]);
    });
  }

  it('carries no emoji', () => {
    const emoji = new RegExp(`[${banned.emojiRanges.join('')}]`, 'u');
    const hits = userFacing.filter((s) => emoji.test(s.value));
    expect(hits.map((h) => `${h.source}:${h.path}`)).toEqual([]);
  });

  it('uses no exclamation mark', () => {
    const hits = userFacing.filter((s) => s.value.includes('!'));
    expect(hits.map((h) => `${h.source}:${h.path}`)).toEqual([]);
  });
});

describe('the sweep covers rendered source too', () => {
  // WIRED TO REAL DATA. A guard that sweeps an empty corpus finds no offenders and
  // reports green, and the green is indistinguishable from a clean codebase. This is
  // the fourth defect of that family (see tests/absence-is-anchored.test.ts for the
  // list), so every sweep now proves it swept something. filesUnder throws on a
  // missing directory; these floors catch the other half -- a corpus filtered down
  // to nothing by a renamed route or a wrong extension.
  const rendered = filesUnder('app', ['.tsx']).concat(filesUnder('components', ['.tsx']));

  it('sweeps every rendered file, and there are many', () => {
    expect(rendered.length).toBeGreaterThanOrEqual(60);
    expect(dataStrings.length, 'no strings pulled from lib/rules/data').toBeGreaterThanOrEqual(500);
    expect(userFacing.length, 'the user-facing corpus is empty').toBeGreaterThanOrEqual(500);
    expect(banned.terms.length, 'no banned terms loaded').toBeGreaterThanOrEqual(5);
  });

  it('finds no banned English term in a component', () => {
    // The same allowlist the data sweep honours: each listed phrase carries its
    // reason in banned-terms.json, and blanking it first means a NEW occurrence
    // of the bare term still fails.
    const scrub = (v: string): string =>
      banned.allowedPhrases.reduce((acc, a) => acc.replace(new RegExp(a.phrase, 'gi'), ''), v);
    const offenders: string[] = [];
    for (const file of rendered) {
      const text = scrub(read(file));
      for (const term of banned.terms) {
        if (new RegExp(`["'\`][^"'\`]*\\b${term.en}\\b[^"'\`]*["'\`]`, 'i').test(text)) {
          offenders.push(`${relative(file)} -- ${term.en}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
