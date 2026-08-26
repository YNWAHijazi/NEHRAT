/**
 * An exception must not be able to certify itself.
 *
 * `expectedDivergent` says: this region is not pixel-compared, by decision. That is a
 * legitimate thing to say. What made it dangerous is that such a region needs no
 * `reference` locator -- so an exception could carry a sentence asserting how faithful
 * the rest of the region is, and NOTHING would ever check it.
 *
 * Twenty-one console exceptions carried the identical sentence "geometry, vocabulary and
 * gating follow the reference". One author wrote it once and it propagated. When the
 * comparison was finally authored by hand for the review queue, the two sides turned out
 * to have eight columns against six. The claim was false, and had been for as long as it
 * had been written.
 *
 * So: an exception may say WHY it is excepted, but the moment it makes a claim about
 * fidelity -- that the geometry, the layout, the vocabulary or the gating follows the
 * reference -- it must carry a reference-side locator, so the claim is at least
 * checkable by a human and one flag away from being checked by the machine. An exception
 * with no locator must say plainly that it is unverified.
 */

import { describe, expect, it } from 'vitest';
import { VISUAL_MANIFEST } from '../e2e/visual-manifest';

/** Phrases that assert fidelity rather than explain a divergence. */
const FIDELITY_CLAIMS = [
  /geometry[^.]*follow(s)? the reference/i,
  /follow(s)? the reference/i,
  /matches the reference/i,
  /identical to the reference/i,
  /same (?:layout|geometry|structure) as the reference/i,
];

/** The words that mark a claim as openly unverified. */
const UNVERIFIED = /\bUNVERIFIED\b/;

describe('visual exceptions cannot self-certify', () => {
  const exceptions = VISUAL_MANIFEST.flatMap((file) =>
    (file.regions ?? [])
      .filter((r) => r.mode === 'expectedDivergent')
      .map((r) => ({ file: file.id, region: r })),
  );

  it('there are exceptions to check (the guard is wired to real data)', () => {
    expect(exceptions.length).toBeGreaterThan(0);
  });

  it('an exception claiming fidelity carries a reference-side locator, or says it is unverified', () => {
    const offenders = exceptions
      .filter(({ region }) => {
        const note = region.note ?? '';
        const claims = FIDELITY_CLAIMS.some((re) => re.test(note));
        if (!claims) return false;
        if (UNVERIFIED.test(note)) return false;
        return region.reference === undefined;
      })
      .map(({ file, region }) => `${file}.${region.name}`);
    expect(
      offenders,
      'These exceptions assert that the built region follows the reference, but carry no ' +
        'reference-side locator, so nothing has ever compared them. Author the locator, or ' +
        'say UNVERIFIED in the note and drop the claim.',
    ).toEqual([]);
  });

  it('every exception says something about why', () => {
    const silent = exceptions
      .filter(({ region }) => (region.note ?? '').trim().length < 20)
      .map(({ file, region }) => `${file}.${region.name}`);
    expect(silent, 'An exception with no reason is indistinguishable from an oversight.').toEqual([]);
  });
});
