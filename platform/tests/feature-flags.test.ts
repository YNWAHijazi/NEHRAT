/**
 * SPEC 2c: build the flags, ship them off, render nothing. All three assertions are
 * load-bearing: the flags exist (capability), every one is off (shipped off), and no
 * screen consults them yet (nothing rendered -- there is nothing to gate).
 */

import { describe, expect, it } from 'vitest';
import flagsJson from '../lib/rules/data/feature-flags.json';
import { ALL_FLAGS, featureEnabled } from '../lib/rules/flags';
import { filesUnder, read, relative } from './helpers/files';

describe('commercial and AI capability', () => {
  it('exists as flags', () => {
    for (const expected of [
      'applicationFees',
      'platformTransactionFees',
      'vendorDirectory',
      'sponsoredListings',
      'advertising',
      'aedPurchaseLinks',
    ]) {
      expect(ALL_FLAGS).toContain(expected);
    }
  });

  it('ships with every flag off', () => {
    for (const flag of ALL_FLAGS) {
      expect(featureEnabled(flag), `${flag} must ship off`).toBe(false);
    }
    expect(Object.values(flagsJson.flags).some(Boolean)).toBe(false);
  });

  it('renders nothing: no screen consults a flag while all are off', () => {
    const offenders = [
      ...filesUnder('app', ['.tsx', '.ts']),
      ...filesUnder('components', ['.tsx', '.ts']),
    ]
      .filter((f) => /featureEnabled|feature-flags/.test(read(f)))
      .map(relative);
    expect(
      offenders,
      'A screen consults a feature flag. With every flag off that can only mean commercial UI exists behind it -- which SPEC 2c forbids rendering.',
    ).toEqual([]);
  });
});
