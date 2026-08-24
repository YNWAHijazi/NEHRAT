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

  // --- Slice 3: the venue service ---
  {
    id: 'venue-registration',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Register a venue',
    builtRoute: '/venues/new',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'required-note',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Every field is required', container: 'border-radius: 10px' },
        builtSelector: '[data-region="required-note"]',
        note: 'The required-fields note. Held at 2%.',
      },
      {
        name: 'exempt-footnote',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'A specific event held at this venue', container: 'border-radius: 12px' },
        builtSelector: '[data-region="exempt-footnote"]',
        note: 'Registering a venue does not exempt events held there. Held at 2%.',
      },
      {
        name: 'applicability-intro',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="applicability-intro"]',
        note: "Expected divergent BY THE REFERENCE'S OWN DEFECT: the prototype intro reads 'completes the the risk assessment assessment' (both languages carry the doubling) -- an artifact of substituting the instrument's name out of the sentence. The build renders the sentence once (venue.json applicabilityIntro).",
      },
      {
        name: 'registration-form',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="registration-form"]',
        note: 'Expected divergent, non-negotiable #8 over pixel parity: the prototype form arrives prefilled with showcase values and the regularly-hosts toggle on (so its eligible panel shows); a new registration starts empty and shows the outside-the-process note. The build also adds a nightclub/dance-venue question the prototype lacks (the English-issue club condition cannot derive without it, non-negotiable #0; tagged en-only in the data at reviewer instruction) and, at reviewer instruction, splits the venue name and address/municipality into bilingual input pairs where the prototype has single values.',
      },
    ],
  },
  {
    id: 'venue-assessment',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Annual venue assessment',
    // VN-0028: inside the reassessment window at the review clock, so the gate is open.
    // The reference renders Forum de Beyrouth; VN-0032's gate is correctly closed at the
    // review clock, and a bounced route cannot be captured.
    builtRoute: '/venues/VN-0028/assessment',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'session-callout',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Assess one routine operating session', container: 'border-radius: 14px' },
        builtSelector: '[data-region="session-callout"]',
        note: 'Assess one routine operating session; the Domain 4 and Domain 9 readings. Held at 2%.',
      },
      {
        name: 'validity-panel',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'A new assessment is required before that date', container: 'border-radius: 16px' },
        builtSelector: '[data-region="validity"]',
        note: 'Effective from / valid through and the five reassessment triggers. Both sides compute from the review clock, so the dates agree. Held at 2%.',
      },
      {
        name: 'classification-panel',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="classification"]',
        note: "Expected divergent, non-negotiable #0 over pixel parity: the prototype's minimum conditions are seven manual checkboxes with 'Locked -- set by' notes on the three it can derive; the build derives all ten from the registration and the attendance figure, renders them read-only, and tags the two rows the issues disagree on (club: English issue only; recur: Arabic issue only). Scores also differ: the built side shows VN-0028's recorded answers, the prototype its own demo state.",
      },
      {
        name: 'declaration',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="declaration"]',
        note: "Expected divergent: the prototype prefills the declaration and carries a third field, Date, hand-entered beside the derived effective date. The build starts empty and records the declaration timestamp itself -- a hand-entered date that can contradict the derived one is the class of input the derivation rules exclude. Flagged for review rather than copied.",
      },
    ],
  },
  {
    id: 'venue-record',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Venue record',
    builtRoute: '/venues/VN-0032',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'rail',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="rail"]',
        note: "Expected divergent AT REVIEWER INSTRUCTION (Slice 3 approval): the reference rail reuses the event flow's stage names ('Requirements', 'Submitted') for steps a venue does not have; the build renames the stages to registration / assessment / classification recorded / valid / reassessment due, and shows the record's actual dates where the reference hand-writes disagreeing ones (stage 1: 2026-01-20 vs its own organization record; stage 2: 2026-03-02 vs its own history list's 2026-03-04). Geometry, chip styling and the note line still follow the reference.",
      },
      {
        name: 'record-header',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Ministry reference number', container: 'justify-content: space-between' },
        builtSelector: '[data-region="record-header"]',
        note: 'Identity block, classification, validity figures and the state chip. Held at 2%.',
      },
      {
        name: 'history',
        mode: 'compare',
        reference: { strategy: 'headingSection', text: 'Assessment history' },
        builtSelector: '[data-region="history"]',
        note: 'Assessment history rows. Held at 2%.',
      },
      {
        name: 'counters',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'requirements apply at this level', container: 'display: flex' },
        builtSelector: '[data-region="counters"]',
        note: 'The two counter cards. Held at 2%. The attachments figure derives from the requirements matrix on the built side; the reference reuses its event fixture for the same number.',
      },
      {
        name: 'requirements',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="requirements"]',
        note: "Expected divergent BY REFERENCE FIXTURE ARTIFACT: the prototype's venue requirements rows reuse the event demo's per-row status chips (Complete, Awaiting you) -- state a venue record does not carry; nothing has been attached against a venue. The build renders the Level 2 rows with values and responsible parties, no status chips.",
      },
      {
        name: 'floor-note',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="floor-note"]',
        note: 'Expected divergent AT REVIEWER INSTRUCTION (Slice 3 brief): the classification sets a floor for events at the venue and certifies none of them, said where an organizer could mistake one for the other. The reference carries no such note.',
      },
    ],
  },
  {
    id: 'venue-change',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Report a venue change',
    builtRoute: '/venues/VN-0032/change',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'change-form',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'What changed', container: 'border-radius: 14px' },
        builtSelector: '[data-region="change-form"]',
        note: "The five aspect chips, description and effective date. Held at 2%. Known residuals inside the budget: the reference prefills the date (2026-09-01) and sets a placeholder on the description; a new report starts empty, as the event-side change form does.",
      },
      {
        name: 'revision-footnote',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'The Ministry may require a revised', container: 'border-radius: 12px' },
        builtSelector: '[data-region="revision-footnote"]',
        note: 'The Ministry may require revised documents. Held at 2%.',
      },
    ],
  },
  // --- Slice 4: the facility service ---
  {
    id: 'facility-registration',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Register a facility',
    builtRoute: '/facilities/new',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'crew-callout',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'What a responding crew needs', container: 'border-radius: 16px' },
        builtSelector: '[data-region="crew-callout"]',
        note: 'The access point and the number the facility actually dials. Held at 2%.',
      },
      {
        name: 'profile-form',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="profile-form"]',
        note: 'Expected divergent AT REVIEWER INSTRUCTION (Slice 3 ruling applied forward): the facility name and municipality are bilingual input pairs where the reference has single values. Both sides otherwise start empty.',
      },
      {
        name: 'journey-ends',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="step-rail"]',
        note: "Interaction states -- the category determination, the end-of-journey panel for an awaiting category (no Continue renders), the venue cross-reference -- are exercised by e2e/app/facility.spec.ts rather than pixel-compared: the reference opens on step 1 and the states exist only after clicks on both sides.",
      },
    ],
  },
  {
    id: 'facility-readiness',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Facility readiness',
    builtRoute: '/facilities/FC-0014',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'record-header',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="record-header"]',
        note: "Expected divergent BY THE REFERENCE'S OWN DEFECT: its header reads 'Corniche Sports Club · Gyms, fitness centres and sports clubs', disagreeing with its own dashboard facility row (Beirut Sports Complex, FC-0014). The build shows the record's actual identity, and adds the Record ID line the reference omits.",
      },
      {
        name: 'standing',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Standing readiness', container: 'border-radius: 16px' },
        builtSelector: '[data-region="standing"]',
        note: 'The standing line, derived from the ledger. Held at 2%.',
      },
      {
        name: 'ledger',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Electrode pad expiry', container: 'grid-template-columns: 1.4fr 1fr 1fr 0.9fr 0.8fr' },
        builtSelector: '[data-region="ledger"]',
        note: "The six obligations. Held at 2%. Known residuals inside the budget: the reference hand-writes pad/battery 'last affirmed' dates as install dates (2024-10-02, 2025-03-18) the record does not hold; the build shows when the device record was last affirmed. Stops-counting dates and statuses match the reference exactly.",
      },
      {
        name: 'provisional-note',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="provisional"]',
        note: 'Expected divergent, SPEC over pixel parity: the instrument prescribes no status vocabulary, and SPEC requires provisional status wording to be marked as such wherever it appears. The reference carries no such note.',
      },
      {
        name: 'devices',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'AED-001', container: 'repeat(auto-fit, minmax(280px, 1fr))' },
        builtSelector: '[data-region="devices"]',
        note: "The device cards. Held at 2%. Known residual inside the budget: AED-003's note derives from the record ('Reported not accessible during operating hours') where the reference hand-writes 'Cabinet reported locked outside class hours'.",
      },
      {
        name: 'ministry-request',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Requested by the Ministry', container: 'border-radius: 14px' },
        builtSelector: '[data-region="ministry-request"]',
        note: 'The corrective-action request, recorded by the Ministry and displayed here. Held at 2%.',
      },
    ],
  },
  {
    id: 'facility-devices',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Defibrillator registry',
    builtRoute: '/facilities/FC-0014/devices',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'registry-table',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'AED-001', container: 'grid-template-columns: 1fr 1fr 1fr 1fr' },
        builtSelector: '[data-region="registry-table"]',
        note: "The device table. Held at 2%. Known residual inside the budget: AED-003's Accessible and Readiness cells derive from the record where the reference hand-writes 'Under Ministry review'.",
      },
      {
        name: 'device-card',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="device-card"]',
        note: "Expected divergent, non-negotiable 8 over pixel parity: the reference card arrives prefilled with AED-002 showcase values in read-only inputs; the build is the working form and opens on a new, empty device record. The five purposes, the coordinator read-only from the one record, and the representative signature follow the reference.",
      },
      {
        name: 'scan-panel',
        mode: 'absentExpected',
        markerText: 'Scan the device',
        note: 'The reference carries a barcode/QR scan panel. The policy spec lists AI device-identifier capture among capabilities requiring separate approval; it lives behind the aiAedIdentifierCapture flag, ships off, and nothing renders (rule 12: capability is not content). The identification field itself is a plain input.',
      },
    ],
  },
  {
    id: 'facility-plan',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Facility response plan',
    builtRoute: '/facilities/FC-0014/plan',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'procedure',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="procedure"]',
        note: "Expected divergent BY DECISION 3 (the Arabic issue wins): the eight steps' Arabic is verbatim from the Arabic issue of the plan form, superseding the prototype's compressed Arabic; the English side follows the reference. Geometry, numbering and the emergency-number strip follow the reference; the facility EMS number matches (01 372 802).",
      },
      {
        name: 'derived',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Defibrillator information', container: 'border-radius: 16px' },
        builtSelector: '[data-region="derived"]',
        note: "The derived device section. Held at 2%. Known residuals inside the budget: the accessible row derives '2 of 3' where the reference appends '— one under review', and pediatric capability derives 'On 1 of 3' where the reference hand-writes 'Yes'.",
      },
      {
        name: 'plan-profile',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="plan-profile"]',
        note: "Expected divergent BY THE REFERENCE'S OWN DEFECT: its plan rows carry the Corniche Sports Club showcase identity, disagreeing with its own dashboard facility row. The build reads the facility record (Beirut Sports Complex), which is the point of the derived plan.",
      },
      {
        name: 'plan-confirmation',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="plan-confirmation"]',
        note: "Expected divergent, the source over the prototype: the plan form's section five is a recordable confirmation -- checkboxes, the drill date, and the coordinator's signature -- which restarts the annual clock. The reference renders the same items as read-only showcase rows with no way to record them.",
      },
    ],
  },
  {
    id: 'facility-incident',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Facility incident report',
    builtRoute: '/facilities/FC-0014/incidents/new',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'no-name',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="no-name"]',
        note: "Expected divergent BY DECISION 3 (the Arabic issue wins): the instruction's Arabic is verbatim from the incident report form (يجب عدم تضمين اسم المريض...), superseding the prototype's paraphrase. English side measured under 2% before the flip; Arabic measured 2.49%, all of it that sentence.",
      },
      {
        name: 'incident-info',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="incident-info"]',
        note: 'Expected divergent, non-negotiable 8 over pixel parity: the reference prefills showcase values (2026-08-11, 18:40, Pool deck); a new report starts empty.',
      },
      {
        name: 'immediate-response',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="immediate-response"]',
        note: "Expected divergent, the source over the prototype: the incident report form's immediate-response answers are Yes/No/Unknown (and Not applicable where it says so), and its row wording is fuller than the prototype's. The prototype rendered plain Yes/No pills.",
      },
      {
        name: 'ems-attendance',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="ems-attendance"]',
        note: "Expected divergent, the source over the prototype: the source adds the EMS-attended tri-state and enumerates 'patient transported by' (EMS ambulance / private vehicle / other / not transported / unknown) where the prototype had free-text inputs.",
      },
      {
        name: 'narrative',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'What happened', container: 'border-radius: 14px' },
        builtSelector: '[data-region="narrative"]',
        note: 'The narrative with live name detection. Both sides start empty with the flag hidden. Held at 2%.',
      },
      {
        name: 'post-incident',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="post-incident"]',
        note: "Expected divergent, the source over the prototype: four verification rows (two carrying Not applicable) plus corrective actions as FREE TEXT, per the incident report form. The prototype rendered five Yes/No rows and folded corrective actions into a checkbox.",
      },
      {
        name: 'submitted-by',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="submitted-by"]',
        note: "Expected divergent, the source over the prototype: the form's submission block -- coordinator name or position, telephone, email, date submitted -- which the prototype omits.",
      },
    ],
  },
];
