/**
 * The visual-comparison manifest: which reference screen corresponds to which built route.
 *
 * One entry per screen. `builtRoute: null` means the screen is not built yet -- the
 * comparison reports it as pending rather than failing, and flips on by filling in the
 * route. WHEN A SLICE LANDS, FILLING IN ITS ROUTES HERE IS PART OF THE SLICE, so add the
 * entry in the same change that adds the screen.
 *
 * Slice 1 entries are listed already so building a screen without wiring its comparison
 * shows up as a still-null route in review, not as silence.
 */

import type { ReferenceFile } from './helpers/reference';

/**
 * A named sub-screen comparison. Modes:
 *  - compare: pixel-diff the region on both sides at its own threshold (default 2%)
 *  - expectedDivergent: the region exists only on the built side BY REVIEWER DECISION;
 *    assert it renders and report it, no pixel comparison
 *  - absentExpected: the region exists only in the reference because its data belongs
 *    to a later slice; assert the built page does NOT fake it
 */
export interface VisualRegion {
  name: string;
  mode: 'compare' | 'expectedDivergent' | 'absentExpected';
  /** compare: how to find the region in the reference DOM. */
  reference?:
    | { strategy: 'cardByText'; text: string }
    | { strategy: 'headerRow' }
    | { strategy: 'headingSection'; text: string };
  /** compare / expectedDivergent: the built side's selector. */
  builtSelector?: string;
  /** absentExpected: text that identifies the region and must not appear on the built page. */
  markerText?: string;
  threshold?: number;
  note: string;
}

export interface VisualMapping {
  /** Stable id; also names the screenshot artifacts. */
  id: string;
  referenceFile: ReferenceFile;
  /** The pill on the reviewer's index strip. */
  referenceTab: string;
  /** The built route, or null while the screen does not exist yet. */
  builtRoute: string | null;
  /** Demo login whose session the built screen needs, if any. */
  signInAs?: string;
  /**
   * CSS hiding parts of the REFERENCE before capture -- only for prototype content the
   * handoff author has disavowed (each entry says why). CSS rather than node removal
   * because the prototype runtime re-renders and would restore a removed node.
   */
  referenceMask?: { css: string; why: string }[];
  /** When present, the comparison is per-region and no full-page ratio is asserted. */
  regions?: VisualRegion[];
  /**
   * Pixel-difference ratio (0..1) above which the comparison fails.
   * The default in the spec applies when absent.
   */
  threshold?: number;
}

export const VISUAL_MANIFEST: readonly VisualMapping[] = [
  // --- Slice 0: the public landing ---
  {
    id: 'public-overview',
    referenceFile: 'Event Health Readiness.dc.html',
    referenceTab: 'Overview',
    builtRoute: null,
  },
  {
    id: 'public-applicability',
    referenceFile: 'Event Health Readiness.dc.html',
    referenceTab: 'Determination of applicability',
    builtRoute: null,
  },

  // --- Slice 1: the shell and the thin event slice ---
  {
    id: 'organizer-signin',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Sign in and organization',
    builtRoute: null,
  },
  {
    id: 'organizer-dashboard',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Dashboard',
    builtRoute: '/dashboard',
    signInAs: 'test_organizer',
    referenceMask: [
      {
        // The organization-registration banner card (accent border, accent-soft fill).
        css: 'div[style*="var(--accent-soft)"][style*="border-radius: 14px"], div[style*="var(--accent-soft)"][style*="border-radius:14px"]',
        why: 'Prototype error, acknowledged (handoff 4, decision 6): the showcase account is recorded and holds filed submissions; the pending state lives on test_organizer_pending. The banner belongs to that account, not this one.',
      },
      {
        // The header's "Organization pending Ministry approval" line.
        css: 'header div[style*="var(--accent-ink)"]',
        why: 'Same decision: the showcase organization is recorded; the pending header line moved to test_organizer_pending.',
      },
    ],
  },
  {
    id: 'organizer-assessment',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Applicability and assessment',
    builtRoute: null,
  },
  {
    id: 'organizer-event-record',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Event record',
    builtRoute: '/events/EV-0418',
    signInAs: 'test_organizer',
    // Itemised by region (handoff 4, decision 4): a blanket ratchet catches nothing.
    regions: [
      {
        name: 'rail',
        mode: 'compare',
        reference: { strategy: 'cardByText', text: 'Where this event stands' },
        builtSelector: '[data-region="rail"]',
        note: 'The six-stage rail. Held at 2%. Known residuals inside the budget: stage 3 meta reads "In progress" (reference: "2 outstanding" -- counters are Slice 2 data) and stage 2 shows the actual version-2 date where the reference hand-wrote a different one than its own history list.',
      },
      {
        name: 'record-header',
        mode: 'compare',
        reference: { strategy: 'headerRow' },
        builtSelector: '[data-region="record-header"]',
        note: 'Identity block and the level/deadline figures. Held at 2%.',
      },
      {
        name: 'history',
        mode: 'compare',
        reference: { strategy: 'headingSection', text: 'Submission history' },
        builtSelector: '[data-region="history"]',
        note: 'Submission history rows. Held at 2%.',
      },
      {
        name: 'derivation-panel',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="derivation"]',
        note: 'Expected divergent at reviewer instruction: the record reports both results and which governed. The reference record carries no such panel.',
      },
      {
        name: 'counters-band',
        mode: 'absentExpected',
        markerText: 'named agencies yet to answer',
        note: 'Absent because its data (named agencies, outstanding documents) is Slice 2. Not faked. Becomes a compare region when Slice 2 lands.',
      },
    ],
  },
  {
    id: 'organizer-notifications',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Notifications',
    builtRoute: null,
  },
];
