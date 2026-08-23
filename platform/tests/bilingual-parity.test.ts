/**
 * Non-negotiable #4. Every user-facing string has both languages and neither is empty.
 * Arabic is regulatory copy in the same register, not a translation layer -- so a string
 * that is identical in both is almost always an untranslated placeholder.
 */

import { describe, expect, it } from 'vitest';
import en from '../lib/i18n/messages/en.json';
import ar from '../lib/i18n/messages/ar.json';
import conditionsJson from '../lib/rules/data/minimum-conditions.json';
import domainsJson from '../lib/rules/data/domains.json';
import levelsJson from '../lib/rules/data/levels.json';
import { walkStrings } from './helpers/files';

const enStrings = walkStrings(en);
const arStrings = walkStrings(ar);

describe('the message catalogues', () => {
  it('carry identical key sets', () => {
    const enKeys = enStrings.map((s) => s.path).sort();
    const arKeys = arStrings.map((s) => s.path).sort();
    expect(arKeys).toEqual(enKeys);
  });

  it('have no empty string on either side', () => {
    for (const s of [...enStrings, ...arStrings]) {
      expect(s.value.trim(), `${s.path} is empty`).not.toBe('');
    }
  });

  it('carry actual Arabic, not a copied English string', () => {
    const arabic = /[؀-ۿ]/;
    const byPath = new Map(enStrings.map((s) => [s.path, s.value]));
    for (const s of arStrings) {
      expect(arabic.test(s.value), `${s.path} has no Arabic characters`).toBe(true);
      expect(s.value, `${s.path} is identical to the English`).not.toBe(byPath.get(s.path));
    }
  });
});

describe('the regulatory data', () => {
  it('gives every minimum condition both languages', () => {
    for (const c of conditionsJson.conditions) {
      expect(c.en.trim(), `${c.key} English`).not.toBe('');
      expect(c.ar.trim(), `${c.key} Arabic`).not.toBe('');
      expect(c.en, `${c.key} is untranslated`).not.toBe(c.ar);
    }
  });

  it('gives every domain and option both languages', () => {
    for (const d of domainsJson.domains) {
      expect(d.en.trim(), `domain ${d.number} English`).not.toBe('');
      expect(d.ar.trim(), `domain ${d.number} Arabic`).not.toBe('');
      for (const o of d.options) {
        expect(o.en.trim(), `domain ${d.number} option ${o.score} English`).not.toBe('');
        expect(o.ar.trim(), `domain ${d.number} option ${o.score} Arabic`).not.toBe('');
      }
    }
  });

  it('gives the conditional Level 1 filing condition both languages', () => {
    const rule = levelsJson.filingDeadline['1'];
    expect(rule.conditionEn?.trim()).not.toBe('');
    expect(rule.conditionAr?.trim()).not.toBe('');
    expect(rule.conditionEn).not.toBe(rule.conditionAr);
  });
});
