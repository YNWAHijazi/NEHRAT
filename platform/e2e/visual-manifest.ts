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
        mode: 'expectedDivergent',
        reference: { strategy: 'cardByText', text: 'Where this event stands' },
        builtSelector: '[data-region="rail"]',
        note: 'Expected divergent by the partner simplification pass (2026-09-01): the stage meta lines were rewritten to lay language — "One of three outcomes" is now "Waiting for the Ministry", "Owed only after a reportable event or on Ministry request" is now "Not needed for this event", "Pending with the Ministry. Filing waits for it." is now "With the Ministry". Second sweep (2026-09-02, partner ruling): the corner note dropped its "· stage 6 not applicable" tail — the sixth column already carries that label. The rail structure and states are unchanged and asserted in e2e/app/journeys.spec.ts. Was a compare held at 2%; flips back when the prototype adopts the lay strings.',
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
        note: 'Expected divergent, SPEC over pixel parity: the prototype leaves Report a material change ungated and omits the post-event control, while the build renders both disabled with their reasons beside them (SPEC 5b). Measured at 48% against the prototype band before the flip — the difference is those two gated controls, and 48% measures DIVERGENCE, not correspondence anywhere else in the band. The counters derive from the seeded records. UNVERIFIED as to whether the figures correspond to the prototype: this note used to assert they did, and nothing ever checked it.',
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
        // Was a straight compare. Pass B finding B-1 (the nomination loop could not be
        // closed from the UI) was fixed at reviewer order by surfacing the invitation
        // link against each pending nomination -- the reference predates the block.
        // Flips back to compare when the prototype adopts it (Pass C).
        mode: 'expectedDivergent',
        reference: { strategy: 'headingBlock', text: 'Named EMS providers' },
        builtSelector: '[data-region="g2"]',
        note: 'The named-provider rows and their nomination/declaration chips. Held at 2%. Second sweep (2026-09-02, partner ruling): the group note was rewritten plainer ("Each provider you name must answer before you can certify the submission.") and the invitation-link caption dropped its "The token is unguessable" clause.',
      },
      {
        name: 'g3',
        mode: 'expectedDivergent',
        reference: { strategy: 'headingBlock', text: 'Requirements you certify to' },
        builtSelector: '[data-region="g3"]',
        note: 'Was a compare in English. Pass A found six recorded EN/AR divergences flagged in the data and rendered NOWHERE; requirements 7, 13 and 15 now carry a bilingual note stating what the other issue says and that the English is followed — the reference predates the note. Flips back to compare when the prototype adopts it (Pass C). Second sweep (2026-09-02, partner ruling): the collapsed group\'s explainer lost its "Nothing is attached against these and there is nothing here to tick" sentence. The certify-to rows: names, per-level values and computed responsible parties. Arabic row names come from the Arabic issue where the prototype carried translations, so the Arabic run diverges by exactly those strings (decision 3). Held at 2% in English.',
      },
      {
        name: 'g1',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="g1"]',
        note: 'Expected divergent: the build replaces the prototype\'s inert action buttons with working attach forms, and the plan row carries its official Arabic name (SPEC 2b). Second sweep (2026-09-02, partner ruling): the group note lost "It is never entered twice."',
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
        note: 'Expected divergent: inspection rows are Ministry-side data (Slice 6). The build shows the honest empty state; the prototype shows demonstration inspections. Second sweep (2026-09-02, partner ruling): the three-sentence explainer collapsed to one — "The conducting authority schedules these checks, and you will be told the date."',
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
        note: 'Expected divergent: chip states reflect this account\'s real plan progress, not the prototype\'s demonstration mix, and the Arabic wording follows the plan\'s official name (SPEC 7). Second sweep (2026-09-02, partner ruling): the list explainer lost "You can return to them at any point before filing." The build renders sixteen section rows, from PLAN_SECTIONS. UNVERIFIED as to whether those sixteen correspond to the prototype: this note used to assert they matched and nothing checked it — the reference-drift guard pins the ten minimum conditions and the nine domains, and the plan sections are NOT among them.',
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
        note: 'Expected divergent: declaration chips reflect the account\'s real saved form, the Arabic declarations are verbatim from the Arabic issue (decision 2/3), and the blocker list is derived, not demonstration copy. Second sweep (2026-09-02, partner ruling): the "Blocked while N items are outstanding" caption beside the File control was cut — the blocker panel above it is the reason, item by item — and the filed band now links to the acknowledgment instead of describing it.',
      },
      {
        name: 'package-docs',
        mode: 'expectedDivergent',
        reference: { strategy: 'headingBlock', text: 'Submission package' },
        builtSelector: '[data-region="package-docs"]',
        note: "DIVERGENT BY THE DEAD-END DIRECTIVE (2026-08-27): each incomplete row now carries the control that answers it -- Open the plan, Complete it below, Attach on the requirements screen -- where the reference shows a chip with nothing to act on. 'Awaiting you' with no control in reach was a corridor. Row titles and chip states are unchanged and exercised by the filing e2e; UNVERIFIED as to pixels since the flip.",
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
      // The required-note region entry was deleted with its region: the
      // every-field-is-required banner left /venues/new in the partner's second
      // sweep (the one optional field says so on its own label), so there is no
      // longer anything to compare.
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
        note: 'Expected divergent, non-negotiable #8 over pixel parity: the prototype form arrives prefilled with showcase values and the regularly-hosts toggle on (so its eligible panel shows); a new registration starts empty, its two questions UNANSWERED, and shows no verdict until the determining facts are answered -- an unset input is not a determination. At reviewer instruction (Slice 5 review) each question is a separate Yes button and No button, not one control flipping between the answers. The build also adds a nightclub/dance-venue question the prototype lacks (the English-issue club condition cannot derive without it, non-negotiable #0; tagged en-only in the data) and splits the venue name and address/municipality into bilingual input pairs. Second sweep (2026-09-02, partner ruling): the issue tags ("English issue only") left the question labels -- English governs and the ruling is made; the tags remain in the data.',
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
        note: "Expected divergent AT REVIEWER INSTRUCTION (Slice 3 approval): the reference rail reuses the event flow's stage names ('Requirements', 'Submitted') for steps a venue does not have; the build renames the stages to registration / assessment / classification recorded / valid / reassessment due, and shows the record's actual dates where the reference hand-writes disagreeing ones (stage 1: 2026-01-20 vs its own organization record; stage 2: 2026-03-02 vs its own history list's 2026-03-04). Second sweep (2026-09-02, partner ruling): the corner stage-count note ('Stage 4 of 5 · reassessment opens ...') was cut -- the rail shows the current stage and the date sits on stage 5 and under the disabled action. UNVERIFIED as to geometry and chip styling: no reference-side locator, so nothing has compared them.",
      },
      {
        name: 'record-header',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="record-header"]',
        note: 'Expected divergent, partner ruling (second sweep, 2026-09-02): the five header facts became three -- Classification, Valid through, Status. The issue date lives on the rail’s classification stage and the day count is what the valid-through date says; "State" was renamed "Status" console-wide. The reference still shows all five. Was a compare held at 2%; flips back if the prototype adopts the cut.',
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
        mode: 'expectedDivergent',
        reference: { strategy: 'containerOfText', text: 'requirements apply at this level', container: 'display: flex' },
        builtSelector: '[data-region="counters"]',
        note: "DIVERGENT BY THE DEAD-END DIRECTIVE (2026-08-27): the reference's counter reads 'attachments outstanding' on a record with no attach mechanism anywhere -- a counter claiming work that could not be done. The built counter names what it counts and links to the annual assessment, where the documents actually travel. UNVERIFIED as to pixels since the flip.",
      },
      {
        name: 'requirements',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="requirements-fold"]',
        note: "Expected divergent BY REFERENCE FIXTURE ARTIFACT: the prototype's venue requirements rows reuse the event demo's per-row status chips (Complete, Awaiting you) -- state a venue record does not carry; nothing has been attached against a venue. The build renders the Level 2 rows with values and responsible parties, no status chips. Second sweep (2026-09-02, partner ruling): the list is collapsed behind a details fold, so the locator is the fold -- the rows inside are hidden until opened.",
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
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'AED-001', container: 'repeat(auto-fit, minmax(280px, 1fr))' },
        builtSelector: '[data-region="devices"]',
        note: "The device cards. Held at 2%. Known residual inside the budget: AED-003's note derives from the record ('Reported not accessible during operating hours') where the reference hand-writes 'Cabinet reported locked outside class hours'.",
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
        name: 'device-card',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="device-card"]',
        note: "Expected divergent, non-negotiable 8 over pixel parity: the reference card arrives prefilled with AED-002 showcase values in read-only inputs; the build is the working form and opens on a new, empty device record. The five purposes, the coordinator read-only from the one record, and the representative signature are all present. UNVERIFIED as to their layout: no reference-side locator.",
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
    id: 'ems-dashboard',
    referenceFile: 'EMS Agency.dc.html',
    referenceTab: 'Dashboard',
    builtRoute: '/dashboard',
    signInAs: 'test_ems',
    regions: [
      {
        name: 'outstanding',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="outstanding"]',
        note: "Expected divergent, the record over the showcase: the reference rows carry per-event organizer identities (Baalbeck International Festival) the demonstration data does not hold -- every seeded event belongs to the one showcase organizer (ROADMAP's demonstration-account table). UNVERIFIED as to row geometry, chips and the owed/level/by columns: no reference-side locator.",
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
        name: 'ops-detail',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="ops-detail"]',
        note: 'Expected divergent, non-negotiable 8 over pixel parity: the reference form arrives prefilled with showcase values; the detail has not yet been supplied on the seeded nomination, so the form starts empty. The ten labels are the source\'s, not the prototype\'s. UNVERIFIED as to layout: no reference-side locator.',
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
        name: 'responsibility',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'What your agency is accepting', container: 'border-radius: 14px' },
        builtSelector: '[data-region="responsibility"]',
        note: "The responsibility sentence -- Protocol 7's fuller list including patient care. Held at 2%.",
      },
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
        note: 'Expected divergent, the source over the prototype: Telephone carries the en-only tag (the Arabic issue of the compliance form omits it from both certification blocks -- README divergence 2), and Signature is not collected as a text field; signing IS the signature.',
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
        name: 'briefing',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="briefing"]',
        note: "Expected divergent, partner ruling (counterparty pass, 2026-09-02): the Director's event page became the one page -- compact event facts with View more at the top, where the reference opens on the requirement cards. The full requirement rows the matrix names moved under View more (briefing-requirements), still computed, never hand-written. UNVERIFIED as to layout: no reference-side locator for the compact strip.",
      },
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
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Verification informs', container: 'border-radius: 12px' },
        builtSelector: '[data-region="non-determinative"]',
        threshold: 0.03,
        note: 'Verification informs review and never decides it. Held at 3%: the second-sweep full run measured 2.11% with the paragraph verified identical word for word (the diff highlights one line’s rasterization) -- a changed word measures far above 3%, so the vocabulary ratchet still bites.',
      },
    ],
  },
  // The fr-readiness and fr-dataset mappings left with the first-response role
  // (partner ruling, counterparty pass 2026-09-02). The reference pages remain in
  // the pack; nothing on the platform renders them any more.
  // --- Slice 6: the Ministry console ---
  {
    id: 'ministry-dashboard',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Dashboard",
    builtRoute: "/ministry",
    signInAs: 'test_moph',
    regions: [
      {
        name: 'counters',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="counters"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. The counters derive (7 live counters vs the reference's 8 hand-written); each opens the surface it counts.",
      },
      {
        name: 'facility-band',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="facility-band"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. The separate cardiac lane with its provisional-wording note, populated from the seeded facility and arrest reports.",
      },
    ],
  },
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
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'An attestation is not an outcome', container: 'max-width: 70ch' },
        builtSelector: '[data-region="att-intro"]',
        // EN holds at the default 2%. AR measures 4.3% as a uniform baseline offset on
        // every glyph -- the outlined-everywhere diff of a sub-pixel line shift, the
        // same residual class the other held-at-5% Arabic paragraphs carry. A CHANGED
        // WORD in this paragraph measures far above 5%, so the ratchet still bites.
        threshold: 0.05,
        note: 'The not-an-outcome paragraph, verbatim from the reference. A clearance cannot be issued while any attestation is pending; the other two outcomes are available at all times.',
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
        // One COMPLETE Ministry-held row: no controls on either side, so the row is
        // comparable. The pending rows are not compared as pixels -- the build adds a
        // working deficiency input the reference does not carry, and the Order rows
        // carry the lane-fallback ruling where the reference says read-only -- both
        // recorded divergences, exercised behaviourally in e2e/app/ministry.spec.ts.
        name: 'att-row-complete',
        mode: 'compare',
        reference: { strategy: 'containerOfText', text: 'Major-incident and mass-casualty plan reviewed', container: 'border-inline-start: 3px' },
        builtSelector: '[data-att-item="majorIncidentPlan"]',
        // Measured residual 8-10%, three named causes, all deliberate: the reference
        // shows a static Attest button on this COMPLETE row (its buttons are showcase
        // furniture; the build's controls act, so Attest renders only while pending);
        // the deficiency control reads "returns to pending" here because on a complete
        // row that is what it does; and the right-anchored chip doubles under the
        // width pad. Held at 13% so gross breakage still fails; the title and the
        // attested-by line are asserted VERBATIM in e2e/app/ministry.spec.ts, where a
        // changed character fails the build regardless of this hold.
        threshold: 0.13,
        note: 'A complete attestation row: title, state chip, authority and the attested-by line. Geometry held at 13% for the named control divergences; strings e2e-ratcheted.',
      },
      {
        name: 'outcome',
        mode: 'expectedDivergent',
        // WAS [data-region="outcome"], the recording control. EV-0362 carries a
        // determination, and recording is now ONCE: after a determination is recorded
        // the three radios are gone and the screen shows what was determined, by whom
        // and when, with revision as a separate deliberate act. So the region on this
        // fixture is the standing determination, which is what the built screen shows
        // where the prototype shows a control. The divergence is larger than it was
        // and it is the point of the change, not a drift from it.
        builtSelector: '[data-region="standing-determination"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. The three outcomes with 'satisfied' disabled and the blocking inspection NAMED against it, the other two enabled, and the two limit sentences beneath -- the reference's gate, on the record's own blockers.",
      },
      {
        name: 'inspections',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="inspections"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. The inspector's items; findings are not an outcome. THIS NOTE ONCE CLAIMED the reference's attestation panel summarized organizer content already compared on the organizer side -- with no locator, so nothing ever checked it, and it was FALSE: the panel is a blocking gate, six items with an assigned authority, and it concealed a missing feature for a whole slice. The gate is now built (lib/rules/attestations.ts) and carries its own compared regions below. The plan half of the old claim is re-verified in the exceptions audit, not assumed.",
      },
    ],
  },
  {
    id: 'ministry-organizations',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Organizations",
    builtRoute: "/ministry/organizations",
    signInAs: 'test_moph',
    regions: [
      {
        name: 'orgs',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="orgs"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. One pending organization (the seeded pending account) vs the reference's five.",
      },
    ],
  },
  {
    id: 'ministry-determinations',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Determinations and designations",
    builtRoute: "/ministry/determinations",
    signInAs: 'test_moph',
    regions: [
      {
        name: 'outcome-register',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="outcome-register"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. The register derives from the determinations table; the reference hand-writes rows.",
      },
    ],
  },
  {
    id: 'ministry-changes',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Changes and notifications",
    builtRoute: "/ministry/changes",
    signInAs: 'test_moph',
    regions: [
      {
        name: 'changes',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="changes"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. Material changes and declined nominations from the records.",
      },
    ],
  },
  {
    id: 'ministry-incidents',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Incidents and reports",
    builtRoute: "/ministry/incidents",
    signInAs: 'test_moph',
    regions: [
      {
        name: 'cardiac',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="cardiac"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. The two instruments listed side by side, never merged; the cardiac column carries no event vocabulary.",
      },
    ],
  },
  {
    id: 'ministry-enquiries',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Enquiries",
    builtRoute: "/ministry/enquiries",
    signInAs: 'test_moph',
    regions: [
      {
        name: 'enquiries',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="enquiries"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. One open, one answered -- the reference's two threads, seeded on the demonstration events; answering changes no outcome.",
      },
    ],
  },
  {
    id: 'ministry-facilities',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Facility oversight",
    builtRoute: "/ministry/facilities",
    signInAs: 'test_moph',
    regions: [
      {
        name: 'corrective',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="corrective"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. Corrective actions with no computed due date while the timeline value is unset -- the unset state is the answer, and publishing the value flips the copy (e2e-asserted).",
      },
    ],
  },
  {
    id: 'ministry-arrests',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Reported arrest locations",
    builtRoute: "/ministry/facilities/arrests",
    signInAs: 'test_moph',
    regions: [
      {
        name: 'groups',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="groups"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. Incidents grouped by place and category from the seeded facility incidents and out-of-band agency reports; the repeat, not-covered place carries the designate action -- the mechanism by which it becomes covered.",
      },
    ],
  },
  {
    id: 'ministry-order',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Order of Physicians lane",
    builtRoute: "/ministry/order",
    signInAs: 'test_moph',
    regions: [
      {
        name: 'lane-off',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="lane-off"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. The reference shows the lane active with two records; off is the default, and the off state is the whole screen (SPEC).",
      },
    ],
  },
  {
    id: 'ministry-config',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Configuration and versioning",
    builtRoute: "/ministry/admin/configuration",
    signInAs: 'test_moph_admin',
    regions: [
      {
        name: 'config-values',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="config-values"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. The values every screen derives from, read from the instrument data itself; the console reads and versions, it does not edit in place.",
      },
    ],
  },
  {
    id: 'ministry-cardiac',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Cardiac-arrest configuration",
    builtRoute: "/ministry/admin/cardiac",
    signInAs: 'test_moph_admin',
    regions: [
      {
        name: 'powers',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="powers"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. TEN powers per the source where the reference carries the earlier seven-row count; each value has an unset state, set-and-publish, and an effective date, and the Slice 4 provisional cycles ride under power ten.",
      },
      {
        name: 'in-force-note',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="in-force-note"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. The two categories in force without any configured value, stated so they are not read as gaps.",
      },
    ],
  },
  {
    id: 'ministry-users',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Users and roles",
    builtRoute: "/ministry/admin/users",
    signInAs: 'test_moph_admin',
    regions: [
      {
        name: 'users',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="users"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. The Order reviewer listed SUSPENDED while the lane is off, never active.",
      },
      {
        name: 'matrix',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="matrix"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. The permission matrix rendered from the data that enforces it -- absent from the reference, added so the console shows what the server refuses.",
      },
    ],
  },
  {
    id: 'ministry-registry',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "National registry",
    builtRoute: "/ministry/admin/registry",
    signInAs: 'test_moph_admin',
    regions: [
      {
        name: 'screen',
        mode: 'expectedDivergent',
        builtSelector: 'main',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. Registry rows derive from the records; the reference hand-writes them.",
      },
    ],
  },
  {
    id: 'platform-admin',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Master admin",
    builtRoute: "/platform/admin",
    signInAs: 'test_owner',
    regions: [
      {
        name: 'flags',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="flags"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. The capability flags render as governed states, not switches: activation is a governance decision recorded in the data, and the screen says so. The one live control is the Order lane.",
      },
    ],
  },
  {
    id: 'platform-activity',
    referenceFile: 'Ministry Review.dc.html',
    referenceTab: "Platform activity",
    builtRoute: "/platform/activity",
    signInAs: 'test_owner',
    regions: [
      {
        name: 'counts',
        mode: 'expectedDivergent',
        builtSelector: '[data-region="counts"]',
        note: "Expected divergent, the demonstration-account table over the showcase: the Ministry prototype invents a parallel dataset (six queue events, four facilities, five arrest places, its own reviewers) that ROADMAP's demo table does not seed -- 'the queue, one submission mid-review'. Every figure on the built screen derives from the seeded records. UNVERIFIED as to layout: this region has no reference-side locator, so no pixel of it has ever been compared. This note previously asserted that geometry, vocabulary and gating followed the reference -- the identical sentence stood on twenty-one console regions, and when the comparison was finally authored by hand for the review queue the two sides had eight columns against six. Treat the claim as withdrawn until a locator exists. Gating and vocabulary ARE exercised behaviourally by e2e/app/ministry.spec.ts. Counts only: no organizer, account, event or patient named, nothing filterable to one organization -- SPEC 2c's narrow reading, e2e-asserted against name leakage.",
      },
    ],
  },
];
