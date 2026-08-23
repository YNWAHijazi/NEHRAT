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

/** Everything a user can read: the catalogues and the regulatory text. */
const userFacing = [
  ...walkStrings(en).map((s) => ({ ...s, source: 'en.json' })),
  ...walkStrings(ar).map((s) => ({ ...s, source: 'ar.json' })),
  ...walkStrings(conditionsJson.conditions).map((s) => ({ ...s, source: 'minimum-conditions.json' })),
  ...walkStrings(domainsJson.domains).map((s) => ({ ...s, source: 'domains.json' })),
].filter((s) => !s.path.includes('$comment') && !s.path.includes('why'));

describe('banned terms', () => {
  for (const term of banned.terms) {
    it(`never says "${term.en}" -- ${term.why}`, () => {
      const needle = new RegExp(`\\b${term.en}\\b`, 'i');
      const hits = userFacing.filter((s) => needle.test(s.value));
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
  it('finds no banned English term in a component', () => {
    const offenders: string[] = [];
    for (const file of filesUnder('app', ['.tsx']).concat(filesUnder('components', ['.tsx']))) {
      const text = read(file);
      for (const term of banned.terms) {
        if (new RegExp(`["'\`][^"'\`]*\\b${term.en}\\b[^"'\`]*["'\`]`, 'i').test(text)) {
          offenders.push(`${relative(file)} -- ${term.en}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
