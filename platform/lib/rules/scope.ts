/**
 * Demonstration isolation.
 *
 * Non-negotiable #8. Demonstration organizations are real rows carrying `is_demo = true`
 * and they DO exist in production, so the Ministry can walk the platform. What is forced
 * off in a deployed environment is the seeder, not the accounts.
 *
 * Isolation runs in both directions: a demonstration row never appears in a real surface,
 * and a real row never appears in a demonstration session.
 *
 * Every surface that reads records must declare its policy here. A surface added without a
 * policy fails to compile, and the completeness test fails if the union grows without the
 * map growing with it -- so the next surface cannot be added by forgetting.
 */

export type DemonstrationPolicy =
  /** Real rows only. Demonstration rows are invisible here, always. */
  | 'excludeDemonstration'
  /** Demonstration rows only. A real record never appears in a demonstration session. */
  | 'demonstrationOnly'
  /** Follows the session: a demonstration session sees demonstration rows, a real one real rows. */
  | 'matchSession';

/**
 * Every surface that reads records. Extend the union and the map together.
 */
export type SurfaceKey =
  | 'nationalRegistry'
  | 'ministryAggregateCounts'
  | 'reviewerQueue'
  | 'ministryFacilityOversight'
  | 'publicReferenceLookup'
  | 'platformActivityCounts'
  | 'organizerDashboard'
  | 'emsProviderDashboard'
  | 'medicalDirectorDashboard'
  | 'notificationsInbox'
  | 'attachedDocument';

export const SURFACE_DEMONSTRATION_POLICY: Record<SurfaceKey, DemonstrationPolicy> = {
  // SYMMETRIC ISOLATION (Slice 6 ruling): every authenticated surface follows the
  // session -- a real reviewer never sees a demonstration row, and a demonstration
  // reviewer sees ONLY demonstration rows, so the walkable console stays walkable.
  // The earlier draft excluded demonstration rows from the Ministry work surfaces
  // outright; that predates the ruling and left the demonstration console empty.
  nationalRegistry: 'matchSession',
  ministryAggregateCounts: 'matchSession',
  reviewerQueue: 'matchSession',
  ministryFacilityOversight: 'matchSession',
  // The asymmetric surfaces: a demonstration reference must not resolve for the
  // public, and an owner reading national volumes must not be reading fiction
  // (reviewer ruling) -- whoever asks.
  publicReferenceLookup: 'excludeDemonstration',
  platformActivityCounts: 'excludeDemonstration',
  organizerDashboard: 'matchSession',
  emsProviderDashboard: 'matchSession',
  medicalDirectorDashboard: 'matchSession',
  notificationsInbox: 'matchSession',
  // The bytes follow the record. A real reviewer opening a demonstration route map
  // would be reading fiction as evidence; a demonstration reviewer opening a real
  // one would be reading a real organizer's document out of a showcase.
  attachedDocument: 'matchSession',
};

export interface SessionContext {
  readonly isDemonstration: boolean;
}

/**
 * The `is_demo` predicate a surface must apply.
 *
 * Returned as data rather than applied here, so the same decision drives a SQL where-clause,
 * an in-memory filter and a test. `{ isDemo: false }` means: real rows only.
 */
export interface DemonstrationFilter {
  readonly isDemo: boolean;
}

export function demonstrationFilter(
  surface: SurfaceKey,
  session: SessionContext,
): DemonstrationFilter {
  const policy = SURFACE_DEMONSTRATION_POLICY[surface];
  switch (policy) {
    case 'excludeDemonstration':
      return { isDemo: false };
    case 'demonstrationOnly':
      return { isDemo: true };
    case 'matchSession':
      return { isDemo: session.isDemonstration };
    default: {
      const exhaustive: never = policy;
      throw new Error(`Surface has no demonstration policy: ${String(exhaustive)}`);
    }
  }
}

/** Applies the filter to a set of rows. The same predicate the query layer uses. */
export function applyDemonstrationFilter<T extends { isDemo: boolean }>(
  rows: readonly T[],
  filter: DemonstrationFilter,
): readonly T[] {
  return rows.filter((r) => r.isDemo === filter.isDemo);
}
