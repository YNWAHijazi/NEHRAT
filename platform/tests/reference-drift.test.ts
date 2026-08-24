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

const REGENERATE = 'npm run rules:regenerate';

describe('the snapshot matches the Arabic issue of Annex A', () => {
  const arabicPath = join(PLATFORM_ROOT, '..', snapshot.arabicSourceFile);

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
  const referencePath = join(PLATFORM_ROOT, '..', snapshot.sourceFile);

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

describe('the ten minimum conditions match the reference', () => {
  const fromReference = snapshot.minimumConditions;
  const fromBuild = conditionsJson.conditions;

  it('there are ten on both sides', () => {
    expect(fromReference).toHaveLength(10);
    expect(fromBuild).toHaveLength(10);
  });

  it('the key sets are identical', () => {
    expect(fromBuild.map((c) => c.key).sort()).toEqual(
      fromReference.map((c) => c.key).sort(),
    );
  });

  it('every condition carries the reference level and both reference strings', () => {
    for (const ref of fromReference) {
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
        fromReference.some((r) => r.key === built.key),
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

  it('every domain name and option string matches, in both languages', () => {
    for (const ref of snapshot.domains) {
      const built = domainsJson.domains.find((d) => d.number === ref.number);
      expect(built, `domain ${ref.number} missing`).toBeDefined();
      expect(built!.en).toBe(ref.en);
      expect(built!.ar).toBe(ref.ar);
      for (const refOpt of ref.options) {
        const builtOpt = built!.options.find((o) => o.score === refOpt.score);
        expect(builtOpt, `domain ${ref.number} option ${refOpt.score}`).toBeDefined();
        expect(builtOpt!.en).toBe(refOpt.en);
        expect(builtOpt!.ar).toBe(refOpt.ar);
      }
    }
  });
});

/**
 * Non-negotiable #0, asserted as a standing fact rather than a comment.
 *
 * Seven conditions were manual checkboxes in the prototype. Every one of them must be
 * derived in the build. If a future edit reintroduces a manual condition, this fails.
 */
describe('no condition is left manual in the build', () => {
  it('records which conditions the prototype left manual', () => {
    const manual = snapshot.minimumConditions
      .filter((c) => c.prototypeDerivedFrom === false)
      .map((c) => c.key);
    expect(manual).toEqual(['att3', 'club', 'run21', 'tri', 'open', 'combat', 'motor']);
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
