/**
 * Non-negotiable #8, as three assertions rather than one.
 *
 * A demonstration organization's rows never appear:
 *   1. in the national registry
 *   2. in a Ministry aggregate count
 *   3. in a reviewer queue
 *
 * Plus a completeness guard, so the NEXT Ministry surface cannot be added by forgetting.
 */

import { describe, expect, it } from 'vitest';
import {
  SURFACE_DEMONSTRATION_POLICY,
  MINISTRY_WORK_SURFACES,
  demonstrationFilter,
  applyDemonstrationFilter,
  type SurfaceKey,
} from '../lib/rules/scope';

const realRow = { id: 'EV-0418', isDemo: false };
const demoRow = { id: 'EV-9001', isDemo: true };
const rows = [realRow, demoRow];

const realSession = { isDemonstration: false };
const demoSession = { isDemonstration: true };

describe('a demonstration row never reaches a Ministry work surface', () => {
  it('1. not the national registry', () => {
    const filter = demonstrationFilter('nationalRegistry', realSession);
    expect(filter).toEqual({ isDemo: false });
    expect(applyDemonstrationFilter(rows, filter)).toEqual([realRow]);
  });

  it('2. not a Ministry aggregate count', () => {
    const filter = demonstrationFilter('ministryAggregateCounts', realSession);
    expect(filter).toEqual({ isDemo: false });
    expect(applyDemonstrationFilter(rows, filter)).toHaveLength(1);
    expect(applyDemonstrationFilter(rows, filter)[0]!.isDemo).toBe(false);
  });

  it('3. not a reviewer queue', () => {
    const filter = demonstrationFilter('reviewerQueue', realSession);
    expect(filter).toEqual({ isDemo: false });
    expect(applyDemonstrationFilter(rows, filter)).toEqual([realRow]);
  });

  it('and not even when the reviewer is themselves in a demonstration session', () => {
    // The exclusion is a property of the surface, not of the session. A demonstration
    // Ministry login must still not see demonstration submissions in its work queue.
    for (const surface of MINISTRY_WORK_SURFACES) {
      expect(demonstrationFilter(surface, demoSession), surface).toEqual({ isDemo: false });
    }
  });
});

describe('isolation runs in both directions', () => {
  it('a real record never appears in a demonstration session', () => {
    const filter = demonstrationFilter('organizerDashboard', demoSession);
    expect(filter).toEqual({ isDemo: true });
    expect(applyDemonstrationFilter(rows, filter)).toEqual([demoRow]);
  });

  it('a demonstration record never appears in a real session', () => {
    const filter = demonstrationFilter('organizerDashboard', realSession);
    expect(filter).toEqual({ isDemo: false });
    expect(applyDemonstrationFilter(rows, filter)).toEqual([realRow]);
  });
});

describe('completeness', () => {
  it('every declared surface has a policy', () => {
    for (const [surface, policy] of Object.entries(SURFACE_DEMONSTRATION_POLICY)) {
      expect(policy, `${surface} has no policy`).toBeTruthy();
    }
  });

  it('the three named Ministry work surfaces all exclude demonstration rows', () => {
    for (const surface of MINISTRY_WORK_SURFACES) {
      expect(SURFACE_DEMONSTRATION_POLICY[surface], surface).toBe('excludeDemonstration');
    }
  });

  it('no surface is left to default -- a new one must declare', () => {
    const declared = Object.keys(SURFACE_DEMONSTRATION_POLICY) as SurfaceKey[];
    expect(declared.length).toBeGreaterThanOrEqual(MINISTRY_WORK_SURFACES.length);
    for (const surface of declared) {
      expect(() => demonstrationFilter(surface, realSession)).not.toThrow();
    }
  });

  it('the public lookup excludes demonstration rows too', () => {
    // A demonstration reference number must not resolve for an authorising authority.
    expect(demonstrationFilter('publicReferenceLookup', realSession)).toEqual({ isDemo: false });
    expect(demonstrationFilter('publicReferenceLookup', demoSession)).toEqual({ isDemo: false });
  });
});
