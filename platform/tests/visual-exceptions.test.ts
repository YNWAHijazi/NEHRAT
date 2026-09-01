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

/**
 * Phrases that assert CORRESPONDENCE WITH THE REFERENCE rather than explain a
 * divergence.
 *
 * The first version of this list was five hand-written patterns and it caught one
 * exception out of seventy-four. Six more were making the same kind of claim in words
 * it did not know: "the sixteen rows match", "the counters match the reference
 * figures", "three of the four seeded rows now match the reference row for row",
 * "English matches", "was matching at 2%". Every one asserts that the built region
 * corresponds to the prototype, on a region nothing has ever compared.
 *
 * A hand-written vocabulary is the same defect as a hand-written file list -- a blind
 * spot by construction that grows every time somebody writes a new sentence. It cannot
 * be eliminated here (this is prose, not structure), so it is widened to the shapes
 * actually in use and the limitation is stated: a claim phrased in words not below
 * still passes.
 */
const FIDELITY_CLAIMS = [
  /follow(s|ed)? the reference/i,
  /match(es|ed|ing)?\b[^.]{0,40}\breference/i,
  /reference[^.]{0,40}\bmatch(es|ed|ing)?\b/i,
  /identical to the reference/i,
  /same (?:layout|geometry|structure|wording) as the reference/i,
  /\bmatch(es|ed|ing)? (?:at|to) \d/i,
  /\brow for row\b/i,
  /^[^.]*\b(?:English|Arabic|the \w+ rows?|the counters?)\b[^.]{0,30}\bmatch(es)?\b/im,
];

/**
 * A SENTENCE that disclaims rather than asserts.
 *
 * The detector runs sentence by sentence, not over the whole note, and this is why:
 * a note is a paragraph, and a paragraph that disclaims in one sentence can assert in
 * another. Judging the note as a whole lets a real claim hide behind a disclaimer
 * somewhere else in it -- which is precisely the loophole UNVERIFIED had. Judging by
 * sentence also stops a note that HONESTLY DESCRIBES a claim it is withdrawing --
 * "this used to assert they matched, and nothing checked it" -- from being read as
 * making one.
 *
 * The rule in one line: a sentence may assert correspondence, or disown it. Not both.
 */
const DISCLAIMS =
  /\bUNVERIFIED\b|used to (?:assert|say|claim)|previously asserted|nothing (?:ever )?check|not compared|no reference-side locator|as history|does not maintain|nothing maintains/i;

/**
 * A note that RETRACTS an old claim is not making one.
 *
 * Twenty exceptions carry "This note previously asserted that geometry, vocabulary and
 * gating followed the reference -- the identical sentence appeared on twenty-one..."
 * That is the honest record of the earlier round, and a detector that flagged it would
 * punish the correction rather than the fault.
 */
const RETRACTION = /previously asserted|no longer claims|that claim was (?:false|wrong)/i;

/** The words that mark a region as openly not compared. */
const UNVERIFIED = /\bUNVERIFIED\b/;

/** Note text split into sentences. Em dashes join clauses, so they do not split. */
function sentences(note: string): string[] {
  return note
    .split(/(?<=[.;])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

describe('visual exceptions cannot self-certify', () => {
  const exceptions = VISUAL_MANIFEST.flatMap((file) =>
    (file.regions ?? [])
      .filter((r) => r.mode === 'expectedDivergent')
      .map((r) => ({ file: file.id, region: r })),
  );

  it('there are exceptions to check (the guard is wired to real data)', () => {
    expect(exceptions.length).toBeGreaterThan(0);
  });

  it('an exception claiming correspondence carries a reference-side locator -- UNVERIFIED does not excuse the claim', () => {
    // THE LOOPHOLE THIS CLOSES. UNVERIFIED used to excuse a fidelity claim outright,
    // so a note could assert correspondence and disclaim it in the same breath --
    // "the sixteen rows match ... UNVERIFIED as to layout" -- and the assertion stood
    // unchecked with a disclaimer beside it. UNVERIFIED says a region is NOT COMPARED.
    // It cannot also say it matches. Verified-that-it-renders is not
    // verified-that-it-matches, and only the second needs a locator.
    const offenders = exceptions
      .filter(({ region }) => {
        if (region.reference !== undefined) return false;
        return sentences(region.note ?? '').some(
          (line) => !DISCLAIMS.test(line) && FIDELITY_CLAIMS.some((re) => re.test(line)),
        );
      })
      .map(({ file, region }) => `${file}.${region.name}`);
    expect(
      offenders,
      'These exceptions assert that the built region corresponds to the reference, but ' +
        'carry no reference-side locator, so nothing has ever compared them. Author the ' +
        'locator so the claim is checkable, or DROP THE CLAIM -- saying UNVERIFIED beside ' +
        'an assertion of correspondence does not make the assertion true, it just puts a ' +
        'disclaimer next to it.',
    ).toEqual([]);
  });

  it('the retraction escape is used by real retractions, not as a bypass', () => {
    // RETRACTION suppresses the claim check, so it is worth knowing it is not being
    // used to smuggle live claims past. A retracting note must ALSO not be asserting
    // something new: it may say what it used to claim, never what it now claims.
    const retracting = exceptions.filter(({ region }) => RETRACTION.test(region.note ?? ''));
    expect(retracting.length, 'no retractions found -- the pattern may be stale').toBeGreaterThan(0);
    const offenders = retracting
      .filter(({ region }) => {
        const note = region.note ?? '';
        // Everything after the retraction sentence is present-tense text.
        if (region.reference !== undefined) return false;
        const after = note.split(/previously asserted[^.]*\./i).slice(1).join(' ');
        return sentences(after).some(
          (line) => !DISCLAIMS.test(line) && FIDELITY_CLAIMS.some((re) => re.test(line)),
        );
      })
      .map(({ file, region }) => `${file}.${region.name}`);
    expect(
      offenders,
      'These retract an old fidelity claim and then make a new one in the same note.',
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
   * Attributes rendered with a COMPUTED value exist at runtime but never appear
   * literally in source -- `data-region={`bls-${g.key}`}`, `data-att-item={t.key}`.
   * Two shapes, and both must be recognised or the guard reports live regions as
   * stale, which is how a guard gets weakened by whoever is annoyed by it next.
   *
   * STANDING LIMITATION, recorded here rather than left to be rediscovered:
   *
   *   - a TEMPLATE PREFIX confirms the family renders, not the member. `bls-equipment`
   *     passes because something renders `bls-*`; renaming the keys to `bls-kit` would
   *     not be caught.
   *   - a BARE EXPRESSION (`={t.key}`) confirms only that the attribute is computed
   *     somewhere. Any value at all passes.
   *
   * Both are weaker than a literal match, so the count of weakly-verified regions is
   * asserted below: it is currently small, and a guard whose coverage quietly becomes
   * mostly-weak is back to reporting success without checking. Closing this needs the
   * runtime, which is the visual comparison's job, not this guard's.
   */
  const computedPrefixes = [...ALL.matchAll(/data-region=\{`([^$`]*)\$\{/g)].map((m) => m[1] ?? '');
  /** Attributes rendered with any computed value: `data-att-item={t.key}`. */
  const computedAttributes = new Set(
    [...ALL.matchAll(/\b(data-[a-z-]+)=\{(?!`)/g)].map((m) => m[1] as string),
  );

  /**
   * The one selector this guard cannot resolve from source, NAMED rather than silently
   * skipped. `main` is a tag, not an attribute: it exists on every page by
   * construction, so resolving it would prove nothing -- which is itself worth
   * knowing, because a whole-screen selector is the least specific thing an exception
   * can name. If this list grows, the guard is shrinking.
   */
  const EXPECTED_UNCHECKABLE = [
    // The partner simplification pass made the whole dashboard expected-divergent
    // (banner, footer and narration removed by ruling); its region is `main`, the
    // one page-level element, and flips back to data-region compares when the
    // prototype adopts the ruling.
    'organizer-dashboard.whole -- main',
    'ministry-registry.screen -- main',
  ];

  it('knows which regions are computed', () => {
    expect(computedPrefixes.length, 'no computed data-region found -- the matcher is broken').toBeGreaterThan(0);
    expect(computedAttributes.size, 'no computed data attribute found -- the matcher is broken').toBeGreaterThan(0);
  });

  it('most regions resolve LITERALLY -- weak verification stays the exception', () => {
    // A prefix or computed-attribute match proves less than a literal one. If the
    // proportion resolving only weakly grew, this guard would be mostly agreeing with
    // itself, which is the failure it exists to prevent.
    const withSelector = VISUAL_MANIFEST.flatMap((file) =>
      (file.regions ?? [])
        .filter((r) => r.builtSelector !== undefined && file.builtRoute !== null)
        .map((r) => r.builtSelector as string),
    );
    const literal = withSelector.filter((sel) => {
      const m = /^\[([a-z-]+)="([^"]*)"\]$/.exec(sel);
      return m !== null && ALL.includes(`${m[1] as string}="${m[2] as string}"`);
    });
    expect(withSelector.length).toBeGreaterThanOrEqual(70);
    expect(
      literal.length,
      `only ${literal.length} of ${withSelector.length} manifest selectors resolve literally`,
    ).toBeGreaterThanOrEqual(withSelector.length - EXPECTED_UNCHECKABLE.length - 3);
  });

  it('every data-region selector in the manifest is rendered somewhere', () => {
    const named = VISUAL_MANIFEST.flatMap((file) =>
      (file.regions ?? [])
        .filter((r) => r.builtSelector !== undefined && file.builtRoute !== null)
        .map((r) => ({ file: file.id, region: r.name, selector: r.builtSelector as string })),
    );

    // EVERY selector shape, not just data-region. The first version checked
    // `[data-region="x"]` only and silently skipped two entries -- [data-wallcard]
    // and `main` -- which is this whole family in miniature: a check reporting success
    // on the subset it happens to understand.
    const unchecked = named.filter(({ selector }) => !/^\[[a-z-]+(?:="[^"]*")?\]$/.test(selector));
    expect(
      unchecked.map((u) => `${u.file}.${u.region} -- ${u.selector}`),
      'These use a selector shape this guard cannot resolve from source. Use an ' +
        'attribute selector, or extend the guard -- do not leave it silently skipping them.',
    ).toEqual(EXPECTED_UNCHECKABLE);
    expect(named.length, 'no built selectors in the manifest').toBeGreaterThan(10);

    const offenders = named
      .filter(({ selector }) => {
        // Only data-region selectors are checkable this way; anything else is left
        // to the comparison itself rather than guessed at here.
        // An attribute selector WITH a value: that attribute must be rendered with it.
        const valued = /^\[([a-z-]+)="([^"]*)"\]$/.exec(selector);
        if (valued) {
          const attr = valued[1] as string;
          const value = valued[2] as string;
          if (ALL.includes(`${attr}="${value}"`)) return false;
          if (attr === 'data-region') {
            return !computedPrefixes.some((prefix) => prefix !== '' && value.startsWith(prefix));
          }
          return !computedAttributes.has(attr);
        }
        // A BARE attribute selector: the attribute must be rendered at all.
        const bare = /^\[([a-z-]+)\]$/.exec(selector);
        if (bare) return !ALL.includes(bare[1] as string);
        return false;
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
