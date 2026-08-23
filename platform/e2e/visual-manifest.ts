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

export interface VisualMapping {
  /** Stable id; also names the screenshot artifacts. */
  id: string;
  referenceFile: ReferenceFile;
  /** The pill on the reviewer's index strip. */
  referenceTab: string;
  /** The built route, or null while the screen does not exist yet. */
  builtRoute: string | null;
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
    builtRoute: null,
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
    builtRoute: null,
  },
  {
    id: 'organizer-notifications',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Notifications',
    builtRoute: null,
  },
];
