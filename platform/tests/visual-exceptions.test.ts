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
import { filesUnder, read } from './helpers/files';

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

/**
 * AND THE SELECTOR MUST STILL RESOLVE.
 *
 * The guard above checks what an exception CLAIMS. It cannot see whether the region
 * the exception names still exists. An exception whose `builtSelector` points at a
 * `data-region` that has been renamed or deleted is guarding nothing: the comparison
 * skips a region that is not there, the manifest still lists it, and the suite is
 * green because there is nothing left to disagree with.
 *
 * That is the same family as the four already found (see
 * tests/absence-is-anchored.test.ts for the list): something reports success without
 * doing its job, and the result is indistinguishable from success.
 *
 * Rebuilding the nomination screen in three stages produced exactly this -- the
 * `invite-facts` region became `briefing`, and the stale exception passed every check
 * in this file.
 */
describe('every manifest region names something that exists', () => {
  const SOURCE = filesUnder('app', ['.tsx']).concat(filesUnder('components', ['.tsx']));
  const ALL = SOURCE.map((f) => read(f)).join('\n');

  it('sweeps the rendered source (wired to real data)', () => {
    expect(SOURCE.length).toBeGreaterThanOrEqual(60);
  });

  /**
   * Regions rendered with a COMPUTED name -- `data-region={`bls-${g.key}`}` -- exist at
   * runtime but never appear literally in source. The static prefix is collected so
   * they are not reported as stale.
   *
   * STANDING LIMITATION, recorded here rather than left to be rediscovered: a prefix
   * match confirms the FAMILY is rendered, not the exact member. `bls-equipment` is
   * accepted because something renders `bls-*`; if the keys changed to `bls-kit` this
   * guard would still pass. Closing that needs the runtime, which is the visual
   * comparison's job, not this guard's.
   */
  const computedPrefixes = [...ALL.matchAll(/data-region=\{`([^$`]*)\$\{/g)].map((m) => m[1] ?? '');

  it('knows which regions are computed', () => {
    expect(computedPrefixes.length, 'no computed data-region found -- the matcher is broken').toBeGreaterThan(0);
  });

  it('every data-region selector in the manifest is rendered somewhere', () => {
    const named = VISUAL_MANIFEST.flatMap((file) =>
      (file.regions ?? [])
        .filter((r) => r.builtSelector !== undefined && file.builtRoute !== null)
        .map((r) => ({ file: file.id, region: r.name, selector: r.builtSelector as string })),
    );
    expect(named.length, 'no built selectors in the manifest').toBeGreaterThan(10);

    const offenders = named
      .filter(({ selector }) => {
        // Only data-region selectors are checkable this way; anything else is left
        // to the comparison itself rather than guessed at here.
        const m = /^\[data-region="([^"]+)"\]$/.exec(selector);
        if (!m) return false;
        const name = m[1] as string;
        if (ALL.includes(`data-region="${name}"`)) return false;
        return !computedPrefixes.some((prefix) => prefix !== '' && name.startsWith(prefix));
      })
      .map(({ file, region, selector }) => `${file}.${region} -- ${selector}`);

    expect(
      offenders,
      'These manifest regions name a data-region no screen renders. The region was ' +
        'renamed or removed and the manifest was not; the comparison now skips it and ' +
        'the exception guards nothing. Point it at the real region, or delete the entry.',
    ).toEqual([]);
  });
});
