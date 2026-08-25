/**
 * Non-negotiable #8, under the Slice 6 SYMMETRIC ruling:
 *
 *   - a REAL session never sees a demonstration row, on any surface;
 *   - a DEMONSTRATION session sees ONLY demonstration rows, so the Ministry can walk
 *     the whole console against the seeded records;
 *   - the public reference lookup is the one asymmetric surface: a demonstration
 *     reference must not resolve for anyone.
 *
 * Plus a completeness guard, so the NEXT surface cannot be added by forgetting.
 * These functions are WIRED: lib/queries.ts derives its is_demo bind value from
 * demonstrationFilter, and the public-lookup resolution refuses through it.
 */

import { describe, expect, it } from 'vitest';
import {
  SURFACE_DEMONSTRATION_POLICY,
  demonstrationFilter,
  applyDemonstrationFilter,
  type SurfaceKey,
} from '../lib/rules/scope';

// Derived from the policy map, so the list cannot drift from what is enforced.
const DEMONSTRATION_NEVER_REACHES = (Object.entries(SURFACE_DEMONSTRATION_POLICY) as [SurfaceKey, string][])
  .filter(([, policy]) => policy === 'excludeDemonstration')
  .map(([surface]) => surface);

const realRow = { id: 'EV-0418', isDemo: false };
const demoRow = { id: 'EV-9001', isDemo: true };
const rows = [realRow, demoRow];

const realSession = { isDemonstration: false };
const demoSession = { isDemonstration: true };

describe('a real session never sees a demonstration row', () => {
  for (const surface of ['nationalRegistry', 'ministryAggregateCounts', 'reviewerQueue', 'organizerDashboard'] as SurfaceKey[]) {
    it(surface, () => {
      const filter = demonstrationFilter(surface, realSession);
      expect(filter).toEqual({ isDemo: false });
      expect(applyDemonstrationFilter(rows, filter)).toEqual([realRow]);
    });
  }
});

describe('a demonstration session sees only demonstration rows — the console stays walkable', () => {
  for (const surface of ['nationalRegistry', 'ministryAggregateCounts', 'reviewerQueue', 'ministryFacilityOversight'] as SurfaceKey[]) {
    it(surface, () => {
      const filter = demonstrationFilter(surface, demoSession);
      expect(filter).toEqual({ isDemo: true });
      expect(applyDemonstrationFilter(rows, filter)).toEqual([demoRow]);
    });
  }
});

describe('the asymmetric surfaces', () => {
  it('a demonstration reference never resolves, whoever asks', () => {
    expect(demonstrationFilter('publicReferenceLookup', realSession)).toEqual({ isDemo: false });
    expect(demonstrationFilter('publicReferenceLookup', demoSession)).toEqual({ isDemo: false });
  });

  it('the never-reaches list is exactly the two ruled surfaces', () => {
    expect(DEMONSTRATION_NEVER_REACHES.sort()).toEqual(['platformActivityCounts', 'publicReferenceLookup']);
    for (const surface of DEMONSTRATION_NEVER_REACHES) {
      expect(SURFACE_DEMONSTRATION_POLICY[surface]).toBe('excludeDemonstration');
    }
  });
});

describe('completeness', () => {
  it('every declared surface has a policy and none is left to default', () => {
    const declared = Object.keys(SURFACE_DEMONSTRATION_POLICY) as SurfaceKey[];
    expect(declared.length).toBeGreaterThan(0);
    for (const surface of declared) {
      expect(SURFACE_DEMONSTRATION_POLICY[surface], `${surface} has no policy`).toBeTruthy();
      expect(() => demonstrationFilter(surface, realSession)).not.toThrow();
    }
  });
});
