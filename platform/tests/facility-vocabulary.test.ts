/**
 * SPEC 6 and ROADMAP 6.3. Mass-gathering status vocabulary never appears on the facility
 * side. The cardiac-arrest instrument prescribes no status labels at all.
 */

import { describe, expect, it } from 'vitest';
import banned from '../lib/rules/data/banned-terms.json';
import { filesUnder, read, relative } from './helpers/files';

const OUTCOMES = [
  ...banned.massGatheringOutcomeVocabulary.en,
  ...banned.massGatheringOutcomeVocabulary.ar,
];

/** Anything under a facility or cardiac route, plus anything named for the instrument. */
function facilitySideFiles(): string[] {
  const all = [
    ...filesUnder('app', ['.tsx', '.ts']),
    ...filesUnder('components', ['.tsx', '.ts']),
    ...filesUnder('lib', ['.ts']),
  ];
  return all.filter((f) => /facilit|cardiac|first-response|aed|defibrillator/i.test(f));
}

describe('the facility side carries no mass-gathering status vocabulary', () => {
  it('knows the three outcome strings', () => {
    expect(OUTCOMES).toHaveLength(6);
  });

  for (const outcome of OUTCOMES) {
    it(`no facility-side file says "${outcome.slice(0, 40)}"`, () => {
      const offenders = facilitySideFiles()
        .filter((f) => read(f).includes(outcome))
        .map(relative);
      expect(
        offenders,
        'The three outcomes belong to the mass-gathering instrument. The cardiac-arrest instrument prescribes no status labels.',
      ).toEqual([]);
    });
  }

  it('no facility-side file renders an event level or a filing deadline', () => {
    const offenders = facilitySideFiles()
      .filter((f) => /\b(eventLevel|filingDeadline|deriveLevel)\b/.test(read(f)))
      .map(relative);
    expect(offenders).toEqual([]);
  });
});
