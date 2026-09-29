/**
 * The attachment catalogue and the map that says whether each document is satisfied.
 *
 * WHAT THIS WOULD HAVE CAUGHT. The catalogue is data; documentStateFor is a
 * hand-written object literal beside it. Adding a document to the catalogue makes it
 * appear on the requirements screen, in the filing gate and in the submission package,
 * while the state map returns undefined for it -- and undefined reads as NOT
 * SATISFIED, so the new document blocks filing permanently with no control anywhere
 * that can satisfy it. A hand-maintained list beside a data-driven one is the same
 * defect family as a guard that names its inputs.
 */
import { describe, expect, it } from 'vitest';
import { documentsForLevel, catalogueEntry } from '../lib/rules';
import { DOCUMENT_STATE_KEYS } from '../lib/queries';

describe('every catalogue document has a state', () => {
  it('the catalogue is not empty (this check is wired to real data)', () => {
    expect(documentsForLevel(3).length).toBeGreaterThanOrEqual(8);
  });

  it('documentStateFor answers for every document at every level', () => {
    const missing: string[] = [];
    for (const level of [1, 2, 3] as const) {
      for (const doc of documentsForLevel(level)) {
        if (!DOCUMENT_STATE_KEYS.includes(doc.key)) missing.push(`level ${level}: ${doc.key}`);
      }
    }
    expect(
      missing,
      'These documents are in the catalogue and have no entry in documentStateFor. ' +
        'Each reads as unsatisfied for every organizer, blocks filing, and cannot be ' +
        'satisfied by any control -- because nothing maps a file onto it.',
    ).toEqual([]);
  });

  it('and answers for nothing that is not in the catalogue', () => {
    // Historical keys remain readable after retirement, but never block new filing.
    const orphans = DOCUMENT_STATE_KEYS.filter((k) => catalogueEntry(k) === null);
    expect(orphans).toEqual([]);
  });
});
