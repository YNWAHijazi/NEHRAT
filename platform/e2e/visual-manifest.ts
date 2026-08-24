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
    | { strategy: 'headingSection'; text: string }
    /** Deepest element carrying `text`, climbed to the nearest ancestor whose style
     *  attribute contains `container`. The general form of cardByText. */
    | { strategy: 'containerOfText'; text: string; container: string }
    /** Heading (h2) starting with `text`, plus every following sibling until the next
     *  h1/h2 -- a whole numbered group. */
    | { strategy: 'headingBlock'; text: string };
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
        name: 'counters',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="counters"]',
        note: 'Expected divergent, SPEC over pixel parity: the counters themselves are live and match the reference figures, but the prototype leaves Report a material change ungated and omits the post-event control, while the build renders both disabled with their reasons beside them (SPEC 5b). Measured at 48% against the prototype band before the flip — the difference is those two gated controls.',
      },
    ],
  },
  {
    id: 'organizer-requirements',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Requirements and attachments',
    builtRoute: '/events/EV-0418/requirements',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'counters',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'documents left to attach', container: 'display: flex' },
        builtSelector: '[data-region="counters"]',
        note: 'The two actionable counters. Held at 2%.',
      },
      {
        name: 'g2',
        mode: 'compare',
        reference: { strategy: 'headingBlock', text: 'Named EMS providers' },
        builtSelector: '[data-region="g2"]',
        note: 'The named-provider rows and their nomination/declaration chips. Held at 2%.',
      },
      {
        name: 'g3',
        mode: 'compare',
        reference: { strategy: 'headingBlock', text: 'Requirements you certify to' },
        builtSelector: '[data-region="g3"]',
        note: 'The certify-to rows: names, per-level values and computed responsible parties. Arabic row names come from the Arabic issue where the prototype carried translations, so the Arabic run diverges by exactly those strings (decision 3). Held at 2% in English.',
      },
      {
        name: 'g1',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="g1"]',
        note: 'Expected divergent: the build replaces the prototype\'s inert action buttons with working attach forms, and the plan row carries its official Arabic name (SPEC 2b).',
      },
      {
        name: 'invite',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="invite"]',
        note: 'Expected divergent: ROADMAP 5c requires the invitation inside the requirement; the prototype shows only already-named rows.',
      },
      {
        name: 'inspections',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="inspections"]',
        note: 'Expected divergent: inspection rows are Ministry-side data (Slice 6). The build shows the honest empty state; the prototype shows demonstration inspections.',
      },
    ],
  },
  {
    id: 'organizer-plan',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Health and medical plan',
    builtRoute: '/events/EV-0418/plan',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'workflow',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Planning workflow', container: 'border-radius: 14px' },
        builtSelector: '[data-region="workflow"]',
        note: 'The Guidance\'s eight-step workflow card. Held at 2%.',
      },
      {
        name: 'depth-table',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Planning depth by event level', container: 'border-radius: 14px' },
        builtSelector: '[data-region="depth"]',
        note: 'The depth-by-level table, prototype wording verbatim with the level column highlighted as the prototype does. Held at 2%. (An earlier 6% allowance hid a real defect: the extractor degraded a unicode escape into literal text and the longer string wrapped an extra line.)',
      },
      {
        name: 'sections',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="sections"]',
        note: 'Expected divergent: the sixteen rows match, but chip states reflect this account\'s real plan progress, not the prototype\'s demonstration mix, and the Arabic wording follows the plan\'s official name.',
      },
    ],
  },
  {
    id: 'organizer-submit',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Submission package',
    builtRoute: '/events/EV-0418/submit',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'form-card',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="form-card"]',
        note: 'Expected divergent: declaration chips reflect the account\'s real saved form, the Arabic declarations are verbatim from the Arabic issue (decision 2/3), and the blocker list is derived, not demonstration copy.',
      },
      {
        name: 'package-docs',
        mode: 'compare',
        reference: { strategy: 'headingBlock', text: 'Submission package' },
        builtSelector: '[data-region="package-docs"]',
        note: 'The package document rows and their states. Held at 2%.',
      },
    ],
  },
  {
    id: 'organizer-acknowledgment',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Acknowledgment',
    builtRoute: '/events/EV-0362/acknowledgment',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'limits',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'This acknowledges receipt', container: 'padding-block-start: 30px' },
        builtSelector: '[data-region="limits"]',
        note: 'The two jurisdiction limits, verbatim regulation. Held at 2%.',
      },
      {
        name: 'wallcard',
        mode: 'expectedDivergent',
        builtSelector: '[data-wallcard]',
        note: 'Expected divergent: the built acknowledgment shows EV-0362\'s real filing (reference number, facts, received documents); the prototype shows the EV-0418 preview fixture.',
      },
    ],
  },
  {
    id: 'organizer-change',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Material change',
    builtRoute: '/events/EV-0362/change',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'aspects-card',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'What changed', container: 'border-radius: 14px' },
        builtSelector: '[data-region="aspects-card"]',
        note: 'The enumerated aspect chips, the description and the effective date. Held at 2%.',
      },
    ],
  },
  {
    id: 'organizer-post-event',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Post-event report',
    builtRoute: '/events/EV-0244/post-event',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'obligations',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Separate obligation', container: 'display: grid' },
        builtSelector: '[data-region="obligations"]',
        note: 'The 24-hour notification and the 7-day report, side by side and never merged. Held at 2%.',
      },
      {
        name: 'counts',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="counts"]',
        note: 'Expected divergent BY THE SOURCES: the prototype predates Annex D and carries five short labels; the build carries the annex\'s seven fields and eight significant-event entries verbatim (source outranks prototype).',
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
