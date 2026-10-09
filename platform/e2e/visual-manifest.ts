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
 *
 * THE WITHDRAWN-CLAIM EXCEPTIONS LEFT THE LEDGER (partner instruction, 2026-09-03).
 * Twenty-four expectedDivergent regions carried a note admitting no reference-side
 * locator existed and the fidelity claim was withdrawn -- an exception with a
 * withdrawn claim is worse than no entry, because it still counts as coverage in
 * the total. Each was investigated against the prototype DOM: every one turned on
 * a recorded prototype defect (the console's invented parallel dataset, the
 * seven-row cardiac configuration, the Order lane drawn active) or a partner-ruled
 * restructure the reference predates (the counterparty one-page ruling, the
 * capability shape, the inspector merge), so a pixel compare would measure
 * divergence that is DECIDED, not drift. All twenty-four were deleted rather than
 * authored; sixteen console mappings emptied by that left with them. What remains
 * below is only what is actually compared or actually asserted. Behavioural
 * coverage of the deleted screens lives in e2e/app/*.spec.ts, which is where it
 * always really was.
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
  /** Restrict the region to these languages; absent = both. Only for a documented
   *  reference defect in the other language (the note must say which and why). */
  langs?: ('en' | 'ar')[];
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
  /**
   * CSS hiding parts of the BUILT page before capture -- only for RULED
   * additions the reference predates (each entry names the ruling), so a
   * compare stays tight instead of swallowing the ruling inside a fat
   * threshold. The mirror of referenceMask.
   */
  builtMask?: { css: string; why: string }[];
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
    builtRoute: '/',
    regions: [
      {
        name: 'services',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="services"]',
        note: 'Expected divergent by the narration rulings: the reference Services section opens with an intro paragraph ("One platform carries two regulatory instruments...") that the build cut with the rest of the section narration (partner simplification passes), and the reference crop includes it while the built region is the cards alone. Measured 35% EN / 43% AR on first wiring (2026-09-03), the paragraph and its reflow. Flips back to a compare when the prototype adopts the ruling. The cards themselves are exercised by e2e/app/public-landing.spec.ts, which walks all three into their service details.',
      },
      {
        name: 'public-tools',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="public-tools"]',
        note: 'A compare was authored here first (partner instruction, 2026-09-03) and measured UNSTABLE: identical code returned 2%, then failing, then passing across three consecutive runs -- the prototype landing tab draws an animated canvas masthead and its heading resolution moves between captures, so a pixel compare on this tab cannot mean anything until the capture is stabilized. No correspondence is claimed; the region is asserted to render. Measured 2% EN on one run and 92% AR on another, which is the instability, not the region.',
      },
      {
        name: 'hero',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="hero"]',
        note: 'A compare was authored here first (partner instruction, 2026-09-03) and measured UNSTABLE: identical code returned 2%, then failing, then passing across three consecutive runs -- the prototype landing tab draws an animated canvas masthead and its heading resolution moves between captures, so a pixel compare on this tab cannot mean anything until the capture is stabilized. No correspondence is claimed; the region is asserted to render.',
      },
    ],
  },
  {
    id: 'public-applicability',
    referenceFile: 'Event Health Readiness.dc.html',
    referenceTab: 'Determination of applicability',
    builtRoute: '/applicability',
    regions: [{ name: 'subject-choice', mode: 'expectedDivergent', builtSelector: '[data-region="subject-choice"]', note: 'Owner request September 26: concise service labels, five event criteria, exemptions first and a simple required/not-required result. owner-workflow-20260926.spec.ts walks each branch and its next step.' }],
  },

  // --- Slice 1: the shell and the thin event slice ---
  {
    id: 'organizer-signin',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Sign in and organization',
    builtRoute: '/signin',
    regions: [
      {
        name: 'credential-card',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="credential-card"]',
        note: 'The credential card, asserted to render. A compare was authored here first (partner instruction, 2026-09-03) and measured UNSTABLE: identical code returned 2%, then failing, then passing across three consecutive runs -- the prototype landing tab draws an animated canvas masthead and its heading resolution moves between captures, so a pixel compare on this tab cannot mean anything until the capture is stabilized. No correspondence is claimed; the region is asserted to render. The full page measured 15% besides, because the reference tab also carries the organization half, which the build serves at /organization. Sign-in behaviour for every role is exercised by e2e/helpers/signin.ts on every app test.',
      },
    ],
  },
  {
    id: 'organizer-dashboard',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Dashboard',
    builtRoute: '/dashboard',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'whole',
        mode: 'expectedDivergent',
        builtSelector: 'main',
        note: 'Expected divergent by the partner simplification pass (2026-09-01): the dashboard is the rows — the "Awaiting your response" banner, the "Open a record, or start something new" footer and the three section narration lines were removed deliberately. Status lives on each row. Second sweep (2026-09-02, partner ruling): the three empty-state service cards each lost their model-teaching second sentence, and the populated Facilities heading now uses المنشآت, consistent with the rest of the organizer surface. The reference predates the ruling; the prototype is expected to follow it, and this flips back to a compare when it does. This entry was a full-page compare held at 5%.',
      },
    ],
  },
  {
    id: 'organizer-assessment',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Applicability and assessment',
    builtRoute: '/events/new',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'whole',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="assessment"]',
        note: 'Expected divergent by ruling: the form was rebuilt as ONE applicability-and-assessment form for simplicity (partner review — the docstring in app/events/new/AssessmentForm.tsx records it), where the reference tab lays the two out separately with its own staging. Measured 40% on first wiring (2026-09-03); the divergence is the ruled rebuild. Behaviour is walked end to end by e2e/app/journeys.spec.ts, which creates, assesses and derives on this form in both languages.',
      },
    ],
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
        mode: 'expectedDivergent',
        reference: { strategy: 'cardByText', text: 'Where this event stands' },
        builtSelector: '[data-region="rail"]',
        note: 'Expected divergent by the organizer simplification request (2026-09-11): the September 26 owner update keeps the full six-stage timeline visible and replaces organization approval with event details. Stage states and regulatory content are preserved. Interaction is covered in organizer-simplicity.spec.ts.',
      },
      {
        name: 'record-header',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="record-header"]',
        note: 'User simplification request, 2026-09-18: a single level readout now holds its explanation behind an information button; overdue days use a positive number and a clear label. Mobile layout and expansion are tested in compact-interface.spec.ts. The earlier reference has no help control.',
      },
      {
        name: 'history',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="history"]',
        note: 'User simplification request, 2026-09-18: submission history expands on demand. compact-interface.spec.ts checks the disclosure and its rows; the earlier reference keeps them permanently open.',
      },
      {
        name: 'derivation-panel',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="derivation"]',
        note: 'Expected divergent at reviewer instruction: the record reports both results and which governed. The reference record carries no such panel.',
      },
      {
        name: 'requirement-summaries',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="requirement-list-all"]',
        note: 'Expected divergent by owner instruction (single record page, 2026-10-07): the Requirements and attachments tab, the Medical Director and EMS tabs and the Submit tab dissolved into one requirement-led record page. The two collapsible summaries (Required, Recommended) replace the prototype\'s counters band; each row names the item, its state and who handles it and opens the matching card. Interaction is covered in e2e/app/record-page.spec.ts.',
      },
      {
        name: 'record-requirements',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="record-requirements"]',
        note: 'Expected divergent by owner instruction (2026-10-07): the full-width Required and Recommended groups of collapsible requirement cards, each with structured answers from the catalogue (lib/rules/data/requirement-catalogue.json) instead of the prototype\'s read-only certify-to list and attachment cards. The questions and completion tests are proposals awaiting partner sign-off (decision D9).',
      },
      {
        name: 'plan-sections',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="plan-sections"]',
        note: 'Expected divergent by owner instruction (2026-10-07): the standalone plan page dissolved into the medical plan row of the record page. Its sixteen sections render from the same requirement instances -- derived, linked to the rows they read, or carrying their own text -- with the eleven major-incident items under section 12 at Level 3 and the Director\'s approval bound to the current version (D4). The reference tab\'s guidance blocks live behind the footer\'s Need help link.',
      },
      {
        name: 'final-review',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="final-review"]',
        note: 'Expected divergent by owner instruction (2026-10-07): the review, the applicable organizer declaration and Submit sit at the foot of the record page, with the remaining items as jump links. The prototype\'s separate Submission package tab is not built.',
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
        mode: 'expectedDivergent',
        builtSelector: '[data-region="obligations"]',
        note: 'Expected divergent by the owner\'s language simplification (2026-09-27, commit 3d7bbb9): the two cards keep their shape -- the 24-hour notification and the 7-day report, side by side and never merged -- but both bodies were reworded in plain language, and the report card names this event\'s own requirement. Was compared at 2%; the wording, not drift, now measures 3.3%.',
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
    builtRoute: '/notifications',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'whole',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="notifications"]',
        note: 'Expected divergent: the built list derives from the seeded notification rows while the reference hand-writes its showcase list, and the reference carries controls the build deliberately lacks today (mark-all-read is a recorded open item on the remaining-work register). Measured 43% on first wiring (2026-09-03). Read/unread behaviour is exercised in e2e/app/accounts.spec.ts.',
      },
    ],
  },

  // --- Slice 3: the venue service (retired 9 October 2026: hosting venue registration is replaced by
  // Facility/Site registration; /venues/new and /venues/[id]/change redirect, so their entries left) ---
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
        mode: 'expectedDivergent',
        builtSelector: '[data-region="session-callout"]',
        note: 'User simplification request, 2026-09-18: session guidance sits behind an information button beside the assessment title. The attendance field still explicitly names a routine operating session; compact-interface.spec.ts covers help access.',
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
        name: 'record-header',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="record-header"]',
        note: 'Expected divergent, partner ruling (second sweep, 2026-09-02): the five header facts became three -- Classification, Valid through, Status. The issue date lives on the rail’s classification stage and the day count is what the valid-through date says; "State" was renamed "Status" console-wide. The reference still shows all five. Was a compare held at 2%; flips back if the prototype adopts the cut.',
      },
      {
        name: 'history',
        mode: 'expectedDivergent',
        reference: { strategy: 'headingSection', text: 'Assessment history' },
        builtSelector: '[data-region="history"]',
        note: 'User request, 2026-09-30: previous issued certificates remain accessible; draft assessments no longer pretend to be issued certificates.',
      },
      {
        name: 'requirements',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="rail"]',
        note: "Owner brief, 2026-10-07: the requirement rows are full-width cards on this single record page, below the rail, with saved answers controlling completion; the rail is the always-open progress bar. Earlier (2026-09-30) the rows had their own tab. Previous layout: the prototype's venue requirements rows reuse the event demo's per-row status chips (Complete, Awaiting you) -- state a venue record does not carry; nothing has been attached against a venue. The build renders the Level 2 rows with values and responsible parties, no status chips. Second sweep (2026-09-02, partner ruling): the list is collapsed behind a details fold, so the locator is the fold -- the rows inside are hidden until opened.",
      },
    ],
  },
  {
    id: 'facility-registration',
    referenceFile: 'Organizer Journey.dc.html',
    referenceTab: 'Register a facility',
    builtRoute: '/facilities/new',
    signInAs: 'test_organizer',
    regions: [
      {
        name: 'crew-callout',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="crew-callout"]',
        note: 'Expected divergent by ruling (partner, 2026-09-05): the yellow block keeps its heading and its two fields, and its explanatory paragraph and the access-point hint were removed -- the fields say what they need. Measured 39% against the reference, all of it that prose. Flips back to a compare when the prototype adopts the ruling.',
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
        builtSelector: '[data-region="category-options"]',
        note: "Expected divergent BY OWNER REQUEST (9 October 2026): the facility registers on ONE page like the hosting venue -- profile, map pin, category and responsible contact with one Continue -- where the reference walks a six-step rail. The step rail is gone; the category options sit on the same page. Interaction states -- the category determination, the end-of-journey panel for an awaiting category (no Continue renders) -- are exercised by e2e/app/facility.spec.ts rather than pixel-compared: the states exist only after clicks on both sides.",
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
        mode: 'expectedDivergent',
        reference: { strategy: 'containerOfText', text: 'Standing readiness', container: 'border-radius: 16px' },
        builtSelector: '[data-region="standing"]',
        note: 'Expected divergent by the partner ruling (second sweep, 2026-09-02): the "Standing readiness" kicker is renamed "Status" -- the same rename the ruling applied to Standing everywhere. The derived line beneath it is unchanged and pinned by e2e/app/facility.spec.ts. Was a compare held at 2%; flips back when the prototype adopts the rename.',
      },
      {
        name: 'ledger',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Electrode pad expiry', container: 'grid-template-columns: 1.4fr 1fr 1fr 0.9fr 0.8fr' },
        builtSelector: '[data-region="ledger"]',
        note: "The six obligations. Held at 2%. Known residuals inside the budget: the reference hand-writes pad/battery 'last affirmed' dates as install dates (2024-10-02, 2025-03-18) the record does not hold; the build shows when the device record was last affirmed. Stops-counting dates and statuses match the reference exactly.",
      },
      {
        name: 'devices',
        mode: 'expectedDivergent',
        reference: { strategy: 'containerOfText', text: 'AED-001', container: 'repeat(auto-fit, minmax(280px, 1fr))' },
        builtSelector: '[data-region="registry-table"]',
        note: "Expected divergent BY OWNER REQUEST (9 October 2026): the readiness screen and the device registry are one management page with sections, so the device cards that linked to the registry are the registry itself, in the AEDs section. Was a compare held at 2% (residual: AED-003's note derives from the record where the reference hand-writes 'Cabinet reported locked outside class hours'). UNVERIFIED as to pixels since the merge.",
      },
      {
        name: 'ministry-request',
        mode: 'expectedDivergent',
        reference: { strategy: 'containerOfText', text: 'Requested by the Ministry', container: 'border-radius: 14px' },
        builtSelector: '[data-region="ministry-request"]',
        note: "DIVERGENT BY THE DEAD-END DIRECTIVE (2026-08-27): the request now carries its status chip, its due date or the named reason none is computed, the Ministry's close note where closed, and a link to the control that answers it. The reference shows body text and a link to /notifications, where nothing could be done. UNVERIFIED as to pixels since the flip.",
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
        note: "Expected divergent BY DECISION 3 (the Arabic issue wins): the eight steps' Arabic is verbatim from the Arabic issue of the plan form, superseding the prototype's compressed Arabic. The divergence is confined to the Arabic: nothing was changed on the English side, which is a statement about what the build did and not about whether it corresponds to the prototype. The build renders the facility EMS number as 01 372 802. UNVERIFIED as to geometry, numbering, the emergency-number strip AND that number: nothing compares any of them, and a note asserting the number matched was a claim about something never checked.",
      },
      {
        name: 'derived',
        mode: 'expectedDivergent',
        reference: { strategy: 'containerOfText', text: 'Defibrillator information', container: 'border-radius: 16px' },
        builtSelector: '[data-region="derived"]',
        note: "Expected divergent by the partner ruling (second sweep, 2026-09-02): the cannot-drift-apart paragraph left the section -- the 'Derived from the registry' chip and the link to the device registry carry its substance. The rows still derive from the device records. Known residuals from the compare era: the accessible row derives '2 of 3' where the reference appends '— one under review', and pediatric capability derives 'On 1 of 3' where the reference hand-writes 'Yes'. Was a compare held at 2%; flips back when the prototype drops the paragraph.",
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
        note: "Owner request, 9 October 2026: no section tabs -- the plan is a section of the facility record and the confirmation sits under it again (the Submit tab of 2026-09-30 is gone; while the registration is open the confirmation is split between the plan step and the review step that completes the registration). The plan form's section five is a recordable confirmation -- checkboxes, the drill date, and the representative's signature -- which restarts the annual clock. The reference renders the same items as read-only showcase rows with no way to record them.",
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
        name: 'narrative', mode: 'absentExpected', markerText: 'What happened',
        note: 'Updated PAD Annex D supplied on 2026-09-26 removes the general narrative. The form asks only for a problem and corrective action, with personal-name checks retained.',
      },
      {
        name: 'post-incident',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="post-incident"]',
        note: "Updated PAD Annex D supplied on 2026-09-26 requires two post-incident answers (AED restored and problem identified) and corrective-action text. No extra verification rows are required.",
      },
      {
        name: 'submitted-by',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="submitted-by"]',
        note: "Updated PAD Annex D supplied on 2026-09-26 records the authenticated facility account and date automatically for electronic submissions. No duplicate name, phone or email fields.",
      },
    ],
  },
  // --- Slice 5: the counterparty roles ---
  {
    id: 'ems-invitation',
    referenceFile: 'EMS Agency.dc.html',
    referenceTab: 'Invitation and account',
    builtRoute: '/invitations/demo-coastal-medical-0418',
    regions: [
      {
        name: 'respond',
        mode: 'expectedDivergent',
        reference: { strategy: 'containerOfText', text: 'Respond to the nomination', container: 'border-radius: 16px' },
        builtSelector: '[data-region="respond"]',
        note: "Expected divergent on TWO counts now. (1) The third response is renamed: the prototype says 'Request modification', and the reviewer specified this response as 'request further information' (2026-08-28). Both readings are one act -- an open question to the organizer that answers nothing and keeps the nomination open -- so the build carries one option covering both rather than splitting one mechanism in two. The description also now STATES that the nomination stays open, which was true all along and lived only in a $comment. (2) THE PROTOTYPE PROMISES SOMETHING THAT DOES NOT EXIST. Its Accept description reads 'and the declaration opens' at every level. This fixture is EV-0418, a LEVEL 2 event, and there is no declaration below Level 3 -- the route redirects to /participation and the requirements screen shows no declaration row. The build says instead that the organization becomes a named provider and records operational detail, with no declaration at this level. FOR THE REVIEWER: making the prototype's Accept line level-aware retires this exception. Everything else in the region -- the three responses, the reason rule, the not-a-commitment line -- was matching at 2% and is unchanged.",
      },
      {
        name: 'briefing',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="briefing"]',
        note: "Expected divergent BY REVIEWER INSTRUCTION (2026-08-28), and this one is a deliberate departure rather than a seed accident. The prototype's five-fact strip -- who invited you, the event, its level, its date, the name you were nominated under -- was ruled insufficient to decide on: the reviewer specified stage one must carry dates AND times, venue or route, municipality, what the level demands of THIS party, the organizer's filing deadline, who else is named including the Director (declaration item 7 turns on that identity), and the documents concerning their role. The prototype shows none of that, so no pixel comparison of this region is possible or wanted. It replaces the former invite-facts exception, whose builtSelector this rewrite orphaned -- a stale exception guards nothing, which is why this file now has a selector-resolves check. UNVERIFIED as to layout: there is no reference-side region to compare against, and by construction there cannot be one until the prototype is re-issued.",
      },
    ],
  },
  {
    id: 'ems-profile',
    referenceFile: 'EMS Agency.dc.html',
    referenceTab: 'Agency profile',
    builtRoute: '/profile',
    signInAs: 'test_ems',
    regions: [
      {
        name: 'profile-form',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Agency name', container: 'border-radius: 16px' },
        builtSelector: '[data-region="profile-form"]',
        note: 'The nine profile fields with the seeded showcase values. Held at 2%.',
      },
      {
        name: 'shared-note',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="shared-note"]',
        note: "Expected divergent, the build over the prototype: the prototype's note says the first-response digital service 'opens in a later phase'; the role has since LEFT the platform entirely (partner ruling, counterparty pass 2026-09-02) and the note now says the agencies' obligations are met through their own arrangements, not here.",
      },
    ],
  },
  {
    id: 'ems-participation',
    referenceFile: 'EMS Agency.dc.html',
    referenceTab: 'Event participation — Level 2',
    builtRoute: '/events/EV-0418/participation',
    signInAs: 'test_ems',
    regions: [
      {
        name: 'l2-intro',
        mode: 'expectedDivergent',
        reference: { strategy: 'containerOfText', text: 'This information goes to the organizer', container: 'border-radius: 14px' },
        builtSelector: '[data-region="l2-intro"]',
        note: "Expected divergent, THE GLOSSARY OVER THE PROTOTYPE'S ARABIC, English unchanged. The prototype's Arabic names the plan الخطة الصحية والطبية للفعالية; the canonical form is خطة التأهب الصحي والطبي للفعالية (SPEC 7, and CLAUDE.md states it outright). The looser form had drifted into four places in the build and is now guarded by a banned-terms pattern. The prototype's Arabic is provisional until re-issued, so the glossary wins. English matches. FOR THE REVIEWER: this is a one-phrase change in the prototype.",
      },
      {
        name: 'ems-record',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="ems-record"]',
        note: 'Expected divergent by owner instruction (single record page, 2026-10-07): the agency no longer fills a separate ten-field operational-detail form; it records its arrangements on the SAME requirement rows the organizer reads (EMS and ambulance arrangements, the response team, the hospital, communications, escalation), one answer per row, first authorized completion counting once. The prototype predates the record page. UNVERIFIED as to layout: no reference-side locator.',
      },
    ],
  },
  {
    id: 'ems-declaration',
    referenceFile: 'EMS Agency.dc.html',
    referenceTab: 'EMS Readiness Declaration — Level 3',
    builtRoute: '/events/EV-0362/declaration',
    signInAs: 'test_ems',
    regions: [
      {
        name: 'items',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="items"]',
        note: "Expected divergent BY DECISION 1 (the compliance form's own data wins): the ten items render from the form's section B verbatim, superseding the prototype's paraphrase (e.g. 'EMS agency' where the prototype wrote 'EMS provider'; item 10 carries the Arabic issue's stronger wording). The seeded declaration is signed, so the rows are confirmed and read-only.",
      },
      {
        name: 'certification',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="certification"]',
        note: 'Expected divergent, the source over the prototype: the certification is the fields only (fields-only ruling, 2026-09-04). The en-only provenance tag on Telephone left for the Ministry\'s file page with every other divergence; Signature is not collected as a text field, signing IS the signature.',
      },
    ],
  },
  {
    id: 'ems-docs',
    referenceFile: 'EMS Agency.dc.html',
    referenceTab: 'Shared documents',
    builtRoute: '/events/EV-0362/documents',
    signInAs: 'test_ems',
    regions: [
      {
        name: 'doc-list',
        mode: 'expectedDivergent',
        reference: { strategy: 'containerOfText', text: 'Event health and medical plan — version 3', container: 'flex-direction: column' },
        builtSelector: '[data-region="doc-list"]',
        note: "DIVERGENT BY THE DEAD-END DIRECTIVE (2026-08-27): rows in 'Awaiting you' and 'Missing' states now carry a working add-the-file control; the reference defines CTAs in its state map and never renders one. UNVERIFIED as to pixels since the flip.",
      },
    ],
  },
  {
    id: 'director-event',
    referenceFile: 'Medical Director.dc.html',
    referenceTab: 'What you are responsible for',
    builtRoute: '/events/EV-0362',
    signInAs: 'test_director',
    regions: [
      {
        name: 'gov-sections',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="gov-sections"]',
        note: "Was the compare on /events/[id]/governance (held at 2%); the route dissolved into the one page (partner ruling, counterparty pass, 2026-09-02) and the three sections now render beside the event facts, a different geometry from the reference's standalone screen. Flips back to a compare if the prototype adopts the one-page shape.",
      },
      {
        name: 'report-row',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="report-row"]',
        note: "Partner ruling (counterparty pass, 2026-09-02): the requirement cards that looked like buttons are gone; the report reaches the Director through this one stated row. The reference carries no such row.",
      },
    ],
  },
  {
    id: 'director-report',
    referenceFile: 'Medical Director.dc.html',
    referenceTab: 'Post-event medical report',
    builtRoute: '/events/EV-0244/report',
    signInAs: 'test_director',
    regions: [
      {
        name: 'figures',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="figures"]',
        note: "Expected divergent BY THE PROTOTYPES' OWN DISAGREEMENT: the Director file and the Organizer Journey carry different figures for the same Tripoli Marathon report (4,180 attendance there, 11,400 here). One record serves both sides, and the organizer's entered figures are that record.",
      },
      {
        name: 'signatures',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="signatures"]',
        note: "Expected divergent, same disagreement: the Director file says the organizer signed on 2026-08-14; the Organizer Journey seeds the report saved but unsigned. Both signature states derive from the one record, so the organizer's row shows not-yet-signed. Two signatures, the report complete with neither alone, as both files agree.",
      },
    ],
  },
  {
    id: 'director-credentials',
    referenceFile: 'Medical Director.dc.html',
    referenceTab: 'Credential verification',
    builtRoute: '/credentials',
    signInAs: 'test_director',
    regions: [
      {
        name: 'lane-off',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="lane-off"]',
        note: 'Expected divergent, SPEC over pixel parity: the Order of Physicians lane is configurable, non-determinative and OFF BY DEFAULT; the reference shows the lane active with three showcase verifications. With the lane off, the off state is the first-class answer and no verification rows render.',
      },
      {
        name: 'non-determinative',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="non-determinative"]',
        note: 'Expected divergent by the owner\'s language simplification (2026-09-27, commit 3d7bbb9): the paragraph now reads "The Ministry makes the final decision, even if the licence check is still pending." -- the same rule (verification informs, never decides) in one plain sentence. Was compared at 3% against the reference\'s two-sentence wording.',
      },
    ],
  },
  // The fr-readiness and fr-dataset mappings left with the first-response role
  // (partner ruling, counterparty pass 2026-09-02). The reference pages remain in
  // the pack; nothing on the platform renders them any more.
  // --- Slice 6: the Ministry console ---
  {
    id: 'ministry-queue',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Review queue",
    builtRoute: "/ministry/queue",
    signInAs: 'test_moph',
    regions: [
      {
        name: 'queue',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="queue"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. THE COLUMN DEFECT IS FIXED: the table now carries the reference's eight columns and its headings -- Event or venue, Organizer, Level, Event date, Filing date, Status, Reviewer, Days -- where it had six, with Organizer folded into the first cell, Days dropped and three headings renamed. Days derives from filing date to today on the Beirut clock; the Met / Filed late chip derives from the level's lead time. The four seeded rows carry those eight columns. This note used to say three of them corresponded to the reference row for row; that was established by reading the two files side by side once, and nothing maintains it, so it is recorded as history rather than as a standing claim. The fourth row diverges for a reason that will not resolve itself: the reference's in-progress row is Beirut Coastal 12K, and the two prototype files disagree about that event -- the Ministry file has it filed and in progress, the Organizer Journey has it at stage 3 with no reference number -- so the demonstration set has no filed-and-unreviewed submission. UNVERIFIED as to pixel layout until a reference-side locator is authored. Gating and vocabulary are exercised by e2e/app/ministry.spec.ts.",
      },
    ],
  },
  {
    id: 'ministry-review',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Submission review",
    builtRoute: "/ministry/submissions/EV-0362",
    signInAs: 'test_moph',
    regions: [
      {
        // The vocabulary ratchet the reviewer asked for: the two limit sentences are
        // dataset-independent on both sides, so this region is a true pixel compare.
        // The card's remainder (gate box, note field) is dataset-driven and stays
        // expectedDivergent until the prototype's console dataset is reconciled (Pass C).
        name: 'outcome-limits',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'The Ministry reviews health and medical preparedness only', container: 'font-size: 12px' },
        builtSelector: '[data-region="limits"]',
        threshold: 0.04,
        note: 'The two limit sentences beneath the outcome control, compared pixel-for-pixel in BOTH languages: the vocabulary must not drift. Held at 4%: a 1-2px second-paragraph offset is the measured residual, while a single changed word measures 10%+ -- the ratchet still bites. The EN-only restriction retired in Pass C: the prototype now reads التأهب الصحي والطبي, as the glossary requires.',
      },
      {
        // The attestation gate's charter paragraph: dataset-independent copy on both
        // sides, a true pixel compare. This panel existed in the reference for a whole
        // slice while an unlocated exception called it a summary.
        name: 'att-intro',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="att-intro"]',
        note: 'User simplification request, 2026-09-18: explanatory attestation text is optional information. Blocking conditions and all three regulatory outcomes stay visible and unchanged. compact-interface.spec.ts checks collapsed help across the reviewer journey.',
      },
      {
        // The one-line summary over the seeded showcase state -- 3 of 6 pending,
        // grouped by ASSIGNED authority. Counts derive from the rows.
        name: 'att-summary',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: '3 of 6 pending', container: 'border-radius: 8px' },
        builtSelector: '[data-region="att-summary"]',
        // The glyphs match; the measured 7-9% is a width pad at the strip's END -- the
        // two layouts give the strip different widths, and the pad counts as diff. Held
        // at 12% for geometry only, and THE CONTENT IS NOT RATCHETED HERE: a changed
        // digit in this one-line strip would measure under this hold, so the exact
        // string is asserted verbatim in e2e/app/ministry.spec.ts instead, where a
        // single changed character fails the build.
        threshold: 0.12,
        note: "The summary strip: '3 of 6 pending · 2 held by the Ministry, 1 by the Order of Physicians', derived not stored. Geometry held loosely here; the string itself is e2e-ratcheted.",
      },
      {
        name: 'att-row-complete',
        mode: 'expectedDivergent',
        builtSelector: '[data-att-item="majorIncidentPlan"]',
        note: 'Owner request September 26: review wording replaces attestation jargon, including Reviewed by and Reopen for correction. The reference still uses Attested by. ministry.spec.ts checks the exact new labels, required reviews and outcome gate, including reopening a completed review.',
      },
    ],
  },
];
