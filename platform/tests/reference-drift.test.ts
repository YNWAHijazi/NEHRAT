/**
 * Reference drift.
 *
 * The nine domains and ten minimum conditions exist only in the design prototype. If the
 * reference changes and the build does not, or the build is hand-edited away from the
 * reference, that must be CAUGHT here rather than discovered later in a wrong level.
 *
 * Two guards:
 *   1. The build's data matches the extracted snapshot, key for key and string for string.
 *   2. The snapshot matches the reference file it was extracted from, by SHA-256. If the
 *      prototype is edited, this fails and tells you to re-run the extractor.
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import snapshot from '../lib/reference/reference-snapshot.json';
import domainsJson from '../lib/rules/data/domains.json';
import conditionsJson from '../lib/rules/data/minimum-conditions.json';
import { PLATFORM_ROOT } from './helpers/files';
import { HANDOFF_PACK } from '../lib/handoff-pack';

/**
 * The pack IN FORCE, not the one the snapshot was taken from. Reading the recorded
 * path let a wholesale pack replacement pass unnoticed: the guard checked a file
 * nobody was building against any more.
 */
const inPack = (recorded: string): string =>
  join(PLATFORM_ROOT, '..', HANDOFF_PACK, recorded.split('/').slice(1).join('/'));

const REGENERATE = 'npm run rules:regenerate';

/**
 * THE PARTNER RULING (2026-09-01): ENGLISH GOVERNS. The prototype and snapshot carry
 * the UNION of the English and Arabic issues; the build now carries the English issue's
 * content, and this map is the exact, exhaustive difference. Drift is still caught
 * everywhere else: the build must equal the snapshot TRANSFORMED BY THESE RULINGS,
 * string for string — a ruled row asserts its ruled value verbatim, never merely
 * "different from the snapshot".
 */
const RULINGS = {
  // The one row the two issues disagree on: English Part D has the nightclub/dance
  // venue row (club); the Arabic issue generalizes the same row to any recurring venue
  // (recur). English governs, so recur is removed and nine conditions stand.
  removedConditions: ['recur'],
  // Arabic strings become translations of the English content where the Arabic issue
  // added or narrowed. Asserted verbatim so a later hand-edit still fails here.
  arOverrides: {
    'domain2.option0': 'مؤتمر أو اجتماع أو معرض أو مراسم أو فعالية أخرى لا تتضمن نشاطاً بدنياً منظماً',
    'domain6.option2': 'يكون موقع الفعالية وموعدها مشمولين بتحذير رسمي بشأن خطر متعلق بالطقس أو البيئة',
  } as Record<string, string>,
  // The domain 4 duration note was rewritten to lay language (partner review). Ruled
  // values, both languages, asserted verbatim below.
  noteOverrides: {
    'domain4.noteEn': 'From opening until the last scheduled departure.',
    'domain4.noteAr': 'من الافتتاح حتى آخر مغادرة مقررة.',
  } as Record<string, string>,
};

describe('the snapshot matches the Arabic issue of Annex A', () => {
  const arabicPath = inPack(snapshot.arabicSourceFile);

  it('can find the Arabic NEHRAT', () => {
    expect(existsSync(arabicPath), `Arabic issue not found at ${snapshot.arabicSourceFile}`).toBe(true);
  });

  it('is current -- the Arabic issue has not changed since extraction', () => {
    const actual = createHash('sha256').update(readFileSync(arabicPath)).digest('hex');
    expect(
      actual,
      `The Arabic NEHRAT has changed since the snapshot was taken. Run \`${REGENERATE}\` -- ` +
        `Arabic assessment strings come from the Arabic issue, not the prototype (handoff 5, decision 3).`,
    ).toBe(snapshot.arabicSourceSha256);
  });

  it('every condition is tagged with the issue that carries it', () => {
    const tags = Object.fromEntries(snapshot.minimumConditions.map((c) => [c.key, c.issue]));
    // The union of ten: nine in each issue, disagreeing on one row each way.
    expect(tags['club']).toBe('en-only');
    expect(tags['recur']).toBe('ar-only');
    expect(Object.values(tags).filter((v) => v === 'both')).toHaveLength(8);
  });
});

describe('the snapshot matches the reference prototype', () => {
  const referencePath = inPack(snapshot.sourceFile);

  it('can find the reference file', () => {
    expect(
      existsSync(referencePath),
      `Reference not found at ${snapshot.sourceFile}. If it moved, update scripts/extract-reference.py.`,
    ).toBe(true);
  });

  it('is current -- the reference has not changed since it was extracted', () => {
    const actual = createHash('sha256').update(readFileSync(referencePath)).digest('hex');
    expect(
      actual,
      `The reference prototype has changed since the snapshot was taken. Run \`${REGENERATE}\`, ` +
        `then review the diff in lib/rules/data/ before committing -- a changed domain or ` +
        `condition is a regulatory change, not a refactor.`,
    ).toBe(snapshot.sourceSha256);
  });
});

describe('the minimum conditions match the reference under the ruling', () => {
  const fromReference = snapshot.minimumConditions;
  const fromBuild = conditionsJson.conditions;
  const ruledReference = fromReference.filter((c) => !RULINGS.removedConditions.includes(c.key));

  it('the snapshot still carries the union of ten; the build carries the nine ruled rows', () => {
    // The snapshot pins the PROTOTYPE, which records the union. The build is the
    // English issue's nine (partner ruling). Both counts are exact — a tenth row
    // reappearing in the build, or an eleventh in the prototype, fails here.
    expect(fromReference).toHaveLength(10);
    expect(fromBuild).toHaveLength(9);
  });

  it('the removed row is exactly the ruling, and it is genuinely gone', () => {
    // Anchored absence: recur exists in the snapshot (the positive half) and not in
    // the build. If the extractor ever drops it from the snapshot too, the positive
    // half fails and the ruling map needs revisiting rather than silently passing.
    for (const key of RULINGS.removedConditions) {
      expect(fromReference.some((c) => c.key === key), `${key} missing from snapshot`).toBe(true);
      expect(fromBuild.some((c) => c.key === key), `${key} should be removed (English governs)`).toBe(false);
    }
  });

  it('the key sets are identical after the ruling', () => {
    expect(fromBuild.map((c) => c.key).sort()).toEqual(
      ruledReference.map((c) => c.key).sort(),
    );
  });

  it('every condition carries the reference level and both reference strings', () => {
    for (const ref of ruledReference) {
      const built = fromBuild.find((c) => c.key === ref.key);
      expect(built, `condition ${ref.key} missing from the build`).toBeDefined();
      expect(built!.level, `${ref.key} level`).toBe(ref.level);
      expect(built!.en, `${ref.key} English`).toBe(ref.en);
      expect(built!.ar, `${ref.key} Arabic`).toBe(ref.ar);
    }
  });

  it('every condition the build derives is one the reference defines', () => {
    for (const built of fromBuild) {
      expect(
        ruledReference.some((r) => r.key === built.key),
        `${built.key} exists in the build but not in the reference`,
      ).toBe(true);
    }
  });
});

describe('the nine domains match the reference', () => {
  it('nine domains, three options each, on both sides', () => {
    expect(snapshot.domains).toHaveLength(9);
    expect(domainsJson.domains).toHaveLength(9);
    for (const d of domainsJson.domains) expect(d.options).toHaveLength(3);
  });

  it('every domain name and option string matches, in both languages, under the ruling', () => {
    for (const ref of snapshot.domains) {
      const built = domainsJson.domains.find((d) => d.number === ref.number);
      expect(built, `domain ${ref.number} missing`).toBeDefined();
      expect(built!.en).toBe(ref.en);
      expect(built!.ar).toBe(ref.ar);
      for (const refOpt of ref.options) {
        const builtOpt = built!.options.find((o) => o.score === refOpt.score);
        expect(builtOpt, `domain ${ref.number} option ${refOpt.score}`).toBeDefined();
        expect(builtOpt!.en).toBe(refOpt.en);
        // A ruled Arabic string asserts its RULED value verbatim — the Arabic issue's
        // additions were removed by decision, and a hand-edit away from the ruled value
        // still fails here. Every other string matches the snapshot exactly.
        const ruled = RULINGS.arOverrides[`domain${ref.number}.option${refOpt.score}`];
        expect(builtOpt!.ar).toBe(ruled ?? refOpt.ar);
      }
    }
  });

  it('the ruled strings and the lay duration note hold their ruled values', () => {
    const d4 = domainsJson.domains.find((d) => d.number === 4)!;
    expect(d4.noteEn).toBe(RULINGS.noteOverrides['domain4.noteEn']);
    expect(d4.noteAr).toBe(RULINGS.noteOverrides['domain4.noteAr']);
    // And the divergence-note rows are gone with the divergences they recorded.
    expect(domainsJson.arabicOnlyNotes).toEqual([]);
  });
});

/**
 * Non-negotiable #0, asserted as a standing fact rather than a comment.
 *
 * Seven conditions were manual checkboxes in the prototype and every one had to be
 * derived in the build. The reviewer's Pass C prototypes now derive all ten from
 * structured inputs, so the standing fact is stronger: NEITHER side leaves a condition
 * manual. If a future edit reintroduces one on either side, this fails.
 */
describe('no condition is left manual, on either side', () => {
  it('the prototype leaves none manual', () => {
    const manual = snapshot.minimumConditions
      .filter((c) => (c.prototypeDerivedFrom as string | false) === false)
      .map((c) => c.key);
    expect(
      manual,
      'A condition went back to a manual checkbox in the prototype. Every minimum ' +
        'condition derives from captured inputs on both sides (non-negotiable 0).',
    ).toEqual([]);
  });

  it('every condition in the build derives from captured inputs', () => {
    for (const c of conditionsJson.conditions) {
      const clauses = [
        ...(c.derivation.all ?? []),
        ...((c.derivation as { any?: unknown[] }).any ?? []),
      ];
      expect(clauses.length, `${c.key} has no derivation clauses`).toBeGreaterThan(0);
      for (const clause of clauses as { input: string }[]) {
        expect(
          Object.keys(conditionsJson.requiredInputs),
          `${c.key} derives from an input that is not declared`,
        ).toContain(clause.input);
      }
    }
  });
});
