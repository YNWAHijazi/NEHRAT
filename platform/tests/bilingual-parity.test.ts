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
import { walkStrings, filesUnder, read, relative } from './helpers/files';

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

/**
 * The same blind spot the banned-terms sweep had, closed the same way.
 *
 * The checks above name five files. Twelve live in `lib/rules/data`, and the seven they
 * never named carry most of the platform's regulatory copy -- the compliance form, the
 * requirements matrix, the roles content, the plan, the facility and venue services, the
 * post-event report. A guard that names its inputs by hand has a blind spot BY
 * CONSTRUCTION, and it grows every time someone adds a file. So this one reads the
 * directory and pairs by key shape: `en` with `ar`, and `<name>En` with `<name>Ar`.
 *
 * Keys nobody reads are excluded and named here rather than pattern-matched loosely:
 * `$`-prefixed notes to ourselves, `why` (the banned list's own rationale), `*Note`
 * (arNote/enNote, decisions recorded beside the data) and `*Source` (the citation saying
 * which instrument a row came from).
 */
describe('every data file, not a hand-written list of five', () => {
  const files = filesUnder('lib/rules/data', ['.json']);

  it('reads every file in the directory', () => {
    expect(files.length).toBeGreaterThanOrEqual(12);
  });

  const skip = (k: string): boolean =>
    k.startsWith('$') || k === 'why' || /Note$/.test(k) || /Source$/.test(k);

  /**
   * Exactly four exclusions, each named with its reason. A short list of specific paths
   * is auditable; a loosened pattern is not, and a loosened pattern is how the guard
   * this one replaces went blind in the first place.
   *
   * `noteEn` DOES appear as a real bilingual pair elsewhere (domains, facility,
   * ministry, the attachments catalogue), so it cannot be skipped by shape.
   */
  const EXCLUDED: { match: RegExp; why: string }[] = [
    {
      match: /^lib\/rules\/data\/banned-terms\.json:/,
      why: 'The list of forbidden words is not user-facing copy. Some entries are acronyms (EHMP) that are the same in both languages by nature.',
    },
    {
      match: /^lib\/rules\/data\/minimum-conditions\.json:\.requiredInputs\.[A-Za-z]+\.noteEn$/,
      why: 'Three notes to ourselves recording why an input is captured structurally. Not rendered; nothing reads requiredInputs[].noteEn.',
    },
    {
      match: /^lib\/rules\/data\/plan\.json:\.sections\[\d+\]\.summaryEn$/,
      why: 'Sixteen one-line section summaries, English only. THE PROTOTYPE CARRIES THEM ENGLISH-ONLY TOO -- its plan-section arrays are [titleEn, titleAr, bodyEn, bodyAr, summaryEn], with no Arabic fifth element. Nothing in the build renders them, so they are dead data rather than a parity violation on screen; they are on the Pass C list because the prototype needs the Arabic before either side can render them.',
    },
  ];
  const excluded = (id: string): boolean => EXCLUDED.some((e) => e.match.test(id));

  /** Every (path, englishKey, arabicKey) triple found anywhere in the data. */
  const pairs: { file: string; path: string; en: unknown; ar: unknown; key: string }[] = [];
  for (const file of files) {
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${path}[${i}]`));
        return;
      }
      if (node === null || typeof node !== 'object') return;
      const obj = node as Record<string, unknown>;
      for (const k of Object.keys(obj)) {
        if (skip(k)) continue;
        const arKey = k === 'en' ? 'ar' : /En$/.test(k) ? `${k.slice(0, -2)}Ar` : null;
        if (arKey !== null && (k in obj || arKey in obj)) {
          pairs.push({ file: relative(file), path, en: obj[k], ar: obj[arKey], key: k });
        }
      }
      for (const [k, v] of Object.entries(obj)) walk(v, `${path}.${k}`);
    };
    walk(JSON.parse(read(file)), '');
  }

  it('finds pairs to check', () => {
    expect(pairs.length).toBeGreaterThan(200);
  });

  it('never carries an English string without its Arabic', () => {
    const missing = pairs
      .filter((p) => typeof p.en === 'string' && p.en.trim() !== '')
      .filter((p) => typeof p.ar !== 'string' || (p.ar as string).trim() === '')
      .map((p) => `${p.file}:${p.path}.${p.key}`)
      .filter((id) => !excluded(id));
    expect(missing).toEqual([]);
  });

  it('never carries the English string copied into the Arabic', () => {
    const arabic = /[؀-ۿ]/;
    const copied = pairs
      .filter((p) => typeof p.en === 'string' && typeof p.ar === 'string')
      .filter((p) => (p.en as string).trim() !== '' && (p.ar as string).trim() !== '')
      // A bare number, a code or a date is legitimately the same in both.
      .filter((p) => !/^[\d\s./:-]+$/.test(p.en as string))
      // SO IS A MINISTRY REFERENCE NUMBER. It has one form in both issues by
      // construction -- MOPH-EV-2026-0418 is not translated, and rendering it
      // differently on the Arabic side would break the thing it identifies. Matched by
      // the reference shape rather than allowlisted by path, so it covers the next one
      // too and nothing else.
      .filter((p) => !/^MOPH-[A-Z]{2}-\d{4}-\d{4}$/.test((p.en as string).trim()))
      .filter((p) => p.en === p.ar || !arabic.test(p.ar as string))
      .map((p) => `${p.file}:${p.path}.${p.key}`)
      .filter((id) => !excluded(id));
    expect(copied).toEqual([]);
  });
});
