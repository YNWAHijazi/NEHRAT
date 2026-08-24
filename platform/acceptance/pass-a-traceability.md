# Pass A — Traceability

Every obligation in the source instruments, the screen that discharges it, the actor who acts,
and one of four states: **discharged** · **partial** · **absent** · **deliberately deferred**.

Sourced from the instruments in `handoff 5/source-documents/en/` (and the Arabic issues where
one exists), never from SPEC.md. Each row's evidence is a file:line in this repository.
Enumeration was performed by six independent audit passes, one per instrument area; every
finding of showstopper class was then re-verified by hand against the code before entering
this table. Three rows were overridden on re-verification and are marked ⟲.

Audited 2026-08-25 against commit `0b1710b`.

## The count

| State | Obligations |
|---|---|
| discharged | 172 |
| partial | 90 |
| absent | 15 |
| deliberately deferred | 13 |

290 obligations traced. (Grouped table rows expand to their counts: "discharged (×16)" is sixteen obligations.)

Every row not marked discharged is classified at the end of this document as either a **bug**
(the build is wrong against a settled rule and the fix needs no ruling) or a **decision**
(nobody has ruled; building either way would guess). Six findings are showstopper class and
are listed first.

## The six showstoppers

1. **Filing is permanently blocked at Levels 1 and 2.** The compliance gate demands seven
   declaration ticks (`lib/submission-facts.ts:46`, `lib/queries.ts:616`) but the form renders
   only six below Level 3 and keys them 0–5, so the seventh key never exists and
   `declarationsComplete` is unreachable. Level 3 was the only level the tests ever filed. *Bug.*
2. **The eleven major-incident items gate nothing.** They render, are level-gated and persist,
   but `planComplete` (`lib/queries.ts:606-614`) counts only the sixteen sections and the
   outcome blockers ignore them, so a Level 2/3 submission files — and can be marked
   satisfied — with all eleven unconfirmed (Protocol §12). *Bug.*
3. **The 24-hour incident notification cannot be given inside 24 hours.** Its only control
   sits on `/events/[id]/post-event`, which redirects away until 00:00 the day after the event
   ends; it captures neither incident type nor time; and no Ministry screen reads
   `serious_incident_notifications` (Protocol §13 ¶1). *Bug.*
4. **A revision outcome cannot be answered.** `submissions` is one row keyed
   `event_id PRIMARY KEY` (`lib/db.ts:226-236`); there is no re-file action and no submission
   version, so "additional information or revision required" has no return path (Protocol §9(v)). *Bug.*
5. **Published cardiac readiness cycles change nothing.** `effectiveCycles`
   (`lib/rules/ministry.ts:142`) has no production caller; `lib/rules/facility.ts:101` binds
   the provisional 90/60-day constants at module load, while the publish action tells
   operators the provisional figure no longer applies (PAD §11.10). The unit test exercised
   the function, not the wiring — a vacuous pass. *Bug.*
6. **Plan versions are destroyed while the screen promises otherwise.** `plans` is upserted in
   place (`lib/db.ts:210-224`, `app/actions.ts:336-357`); only a counter increments. The plan
   screen and a code comment both claim prior versions remain readable. One audit pass
   reported plan versioning as sound — hand-verification proved the opposite, and the row
   below is corrected ⟲ (Protocol §14 ¶1). *Bug.*

---

# National Protocol

## §3 — Applicability and event designation

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| §3.1(a) | NEHRAT required where the event needs authorization from MoIM, a municipality, Mohafez, Qaimaqam or another competent authority and is a sporting/recreational event | `/applicability` — not built | Organizer / public | deliberately deferred | Slice 0 deferral recorded at `app/page.tsx:5`; `e2e/visual-manifest.ts:82-86` (`builtRoute: null`); ROADMAP.md:88,110 |
| §3.1(b) | NEHRAT required at expected maximum simultaneous attendance ≥ 1,000 | `/events/new` | Organizer | partial | Number captured (`AssessmentForm.tsx:261-266`) but consumed only by scoring and the 10,000/20,000 floors; no 1,000-person applicability threshold exists in code or data |
| §3.1(c) | NEHRAT required for organized competition / mass-participation activity outside routine operations, needing dedicated arrangements, or on a temporary/dispersed course, or in the minimum table | `/events/new` | Organizer | partial | Disciplines, course distance, route configuration captured; "outside routine facility operations" and "requires dedicated arrangements" captured nowhere; none of it is an entry gate |
| §3.1(d) | NEHRAT required at a recurring venue, regularly hosting, licensed ≥ 1,000, annual assessment | `/venues/new`; `/events/new` | Venue operator; Organizer | partial | Venue-side gate real (`RegisterVenueForm.tsx:98,152-186`); event side treats the same facts only as a Level 2 floor, never as the applicability question |
| §3.1(e) | NEHRAT required where a previous edition involved cardiac arrest, death, major-incident activation, or medical interruption/termination | `/events/new` | Organizer | partial | Captured verbatim as Domain 9's top option (`domains.json:220-237`) — scoring only; triggers no floor and no entry gate |
| §3.1(f) | NEHRAT required where MOPH designates the event or another authority refers it | — | Ministry reviewer | absent | No event designation or referral action exists; `ministry.json:70-89` lists no such capability; the determinations register holds only post-filing outcomes and cardiac facility designations |
| §3.2(1) | Routine school/university/workplace/… operations not routinely subject unless a §3.1 criterion applies; a special event at such a facility remains subject | `/applicability` — not built | Public / organizer | deliberately deferred | Same Slice 0 deferral; ROADMAP.md:128 assigns the limb to that screen; no built screen carries it |
| §3.2(2) | Ordinary private family/social gatherings not routinely subject unless ≥ 1,000, authorization required, or MOPH identifies a risk | `/applicability` — not built | Public / organizer | deliberately deferred | Same deferral; grep for "routinely" returns no match in `app/`, `lib/` |
| §3.3 | Where applicability is uncertain, MOPH makes the final determination | — | Ministry | absent | No uncertainty route exists on any surface; the enquiry lane (`/ministry/enquiries`) is generic and no copy directs an uncertain organizer to it |

## §6 — Health and medical planning

All sixteen plan items carry their own field (write or attach-and-confirm) at `/events/[id]/plan`
(`PlanForm.tsx:460-518`, `plan.json:4-131`) and all sixteen are a hard filing gate
(`lib/queries.ts:606-614` → `lib/rules/submission.ts:89-94` → File disabled with the blocker named).

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| §6 items 1–16 | Event description & schedule · contacts · staffing & deployment · treatment posts · CPR & cardiac response · AED deployment · equipment & supplies · ambulance arrangements · access & extraction · coordination & communications · receiving EDs · major-incident arrangements · contingencies · continuity · patient documentation · post-event reporting | `/events/[id]/plan` | Organizer | discharged (×16) | `plan.json:4-131`; `PlanForm.tsx:460-518`; gate `lib/queries.ts:606-614`; item 6 additionally derives facility-reference shortfalls (`PlanForm.tsx:392-441`) |
| §6 opening | Documented arrangements at Level 1; an EHMP appropriate to Level 2/3 | `/events/[id]/plan`, `/events/[id]/requirements` | Organizer | discharged | Level 1 collapses the sixteen (`PlanForm.tsx:165-184`); plan starts at `minLevel: 2` (`attachments-catalog.json:13-34`) |
| §6 final | Level 3 EHMP identifies the Event Medical Director and defines clinical-governance and medical-command arrangements | `/events/[id]/governance`, `/events/[id]/plan` | Director / Organizer | partial | Director identified and gated (`submission.ts:113-127`); governance text captured (`governance/page.tsx:30,69-102`) but the plan screen never reads it — `plan/page.tsx` does not call `governanceFor`, contradicting the governance screen's own copy — and no blocker requires it before filing |

## §7 — Roles and responsibilities

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| §7(1) | Organizer responsible for overall compliance | `/events/[id]/submit` | Organizer | partial | Blockers named and File disabled (`SubmitForm.tsx:221-267`, `submission.ts:78-141`, re-computed server-side `submission-facts.ts:51-63`); but the certification statement (`compliance-form.json:113`) is never rendered and none of representative/position/telephone blocks filing |
| §7(2) | Every event identifies a responsible organizer contact | `/events/[id]/plan` item 2, `/events/[id]/submit` | Organizer | partial | Gated at Level 2/3; at Level 1 no contact field exists anywhere (no compliance form, collapsed plan, no assessment field) |
| §7(3) | Level 2/3: identify each participating provider and its operational contact | `/events/[id]/requirements`, `/events/[id]/participation` | Organizer / EMS | partial | Token nomination + provider-entered contact work; but nothing requires any provider at Level 2 (`providers.length > 0` checked only inside the L3 `emsDeclarations` state, `lib/queries.ts:628`) and `blockedBy: "unansweredProviders"` (`compliance-form.json:65`) is dead data — verified: no consumer |
| §7(4) | Each provider remains professionally responsible for its personnel, equipment, practice, care and services | `/events/[id]/declaration` | EMS provider | partial | Stated and accepted at Level 3 (`roles.json:154-158`, `declaration/page.tsx:62-70`); the Level 2 participation screen neither states nor captures it |
| §7(5) | Level 3 appoints a licensed physician Event Medical Director | `/events/[id]/requirements` | Organizer / Director | partial | Absent below Level 3, not greyed (`gates.ts:81-84`); missing/unaccepted Director blocks filing (`submission.ts:113-127`); but licensure is asserted, never captured — no licence field required at acceptance; Order lane off and non-determinative by design |
| §7(6) | MOPH reviews submitted documentation and oversees compliance | `/ministry/queue`, `/ministry/submissions/[id]` | Reviewer | discharged | Three outcomes only (`ministry.json:3-28`); satisfied gated with blockers named; measures catalogue-bound; role-gated by the permission matrix |

## §8 — Notification and submission

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| §8.1 first limb | Level 1 files before final event authorization | `/events/[id]` | Organizer | partial | Deadline derived and rendered (`deadlines.ts:147-160`, `page.tsx:307-322`); nothing captures whether/when an authorization is issued, so the limb is never evaluated |
| §8.1 second limb | Where no external authorization is required, ≥ 7 calendar days before | `/events/[id]` | Organizer | partial | 7 days is data (`levels.json:12`), condition rendered in both languages; but the precondition is prose — `filingDeadline(1,…)` computes start−7 unconditionally |
| §8.1 third limb | Annex C and full EHMP not routinely required at Level 1 unless requested | `/events/[id]/plan`, `/ministry/submissions/[id]` | Organizer / Reviewer | partial | Not-routinely-required side correct (`attachments-catalog.json:22-34`); but MOPH cannot request them — the measures selector draws from `documentsForLevel(1)`, which contains neither |
| §8.2 | Level 2 package ≥ 14 days before | `/events/[id]/requirements`, `/events/[id]/submit` | Organizer | discharged | `levels.json:17`; package derived by level; each missing item a named blocker |
| §8.3 | Level 3 package + per-agency declarations ≥ 30 days before | `/events/[id]/requirements`, `/events/[id]/declaration`, `/events/[id]/submit` | Organizer / EMS | discharged | `levels.json:18`; `attachments-catalog.json:42-55`; every named agency must sign (`lib/queries.ts:628`; `submission.ts:104-110`) |
| §8.4 first limb | MOPH may accept an expedited submission | `/events/[id]/submit`, acknowledgment | Organizer / Reviewer | partial | Lateness derived, persisted, shown to the organizer (`submission.ts:137-140`, `actions.ts:410-411`); no Ministry surface reads `expedited`, so the reviewer cannot see or act on it |
| §8.4 second limb | Expedited review waives no minimum requirement | `/events/[id]/submit` | Organizer / Reviewer | discharged | `expedited` computed independently of blockers and removes none; stated in both languages |
| §8.5 first limb | Material change notified without undue delay (thirteen aspects) | `/events/[id]/change` | Organizer | discharged | All thirteen aspects as data (`material-change.json:3-133`); state-gated route; reaches `/ministry/changes` |
| §8.5 second limb | MOPH may require revised documentation | `/events/[id]/change`, `/ministry/submissions/[id]` | Reviewer | partial | Revision outcome and measures exist; but a reported change is inert — nothing invalidates or reopens the filed assessment/plan even when `levelMayChange`, and no revision request binds to a change record |
| §8.5 third limb | Cancellation or postponement notified as soon as practicable | — | Organizer | absent | No route, action, aspect chip or column; grep for cancel/postpone across the tree returns nothing |

## §9 — Official submission mechanism and portal

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| §9 ¶1 | One official electronic submission mechanism | `/events/[id]/submit` | Organizer | discharged | Single `fileSubmissionAction` (`actions.ts:392`); gate recomputed server-side |
| §9 ¶2 | Received only on electronic acknowledgment and reference number | `/events/[id]/acknowledgment` | Organizer | discharged | Reference minted at filing (`actions.ts:404-411`); the sentence and the number on the acknowledgment |
| §9 ¶3 | Interim email/filing channel until the portal is operational | — | Organizer | absent | No fallback channel or notice exists; the provision is spent once the portal runs but nothing records that |
| §9 (i) | Applicability screening and event notification | `/events/new` | Organizer | discharged | Screening feeds `deriveLevel` (`AssessmentForm.tsx:124`); the public pre-account branch is the deferred Slice 0 screen (§3 rows) |
| §9 (ii) | Electronic completion and scoring of NEHRAT | `/events/new` | Organizer | discharged | Per-domain scores, band strip, total; derivation in `lib/rules/derive.ts` |
| §9 (iii) | Upload of Annex C, EHMPs, maps, supporting documents | `/events/[id]/requirements` | Organizer | partial | A declared file *name* only is stored (`actions.ts:281-296`, "storage is deployment"); no binary is ever received |
| §9 (iv) | Participating EMS agency declarations | `/events/[id]/declaration` | EMS agency | discharged | Ten items, signing gate, read by the filing gate |
| §9 (v) | Requests for corrections and submission of revisions | `/ministry/submissions/[id]` → `/events/[id]` | Reviewer / Organizer | partial | Request half works (revision outcome + notification); the revision half is absent — one submission row per event, no re-file action (showstopper 4) |
| §9 (vi) | Recording of review status and compliance references | `/ministry/queue`, `/ministry/submissions/[id]`, registry | Reviewer / Admin | discharged | Review states, determination history, references |
| §9 (vii) | Material-change, postponement and cancellation notices | `/events/[id]/change` | Organizer | partial | Material change discharged; postponement and cancellation absent (§8.5 third limb) |
| §9 (viii) | Annex D reporting | `/events/[id]/post-event` | Organizer (+ Director L3) | discharged | Full field set from `post-event-report.json`; gate opens 00:00 Asia/Beirut the day after the event ends |
| §9 (ix) | National surveillance, audit and quality-improvement reporting | `/ministry/incidents`, `/ministry` | Reviewer / Admin | partial | Reports listed and counted; no surveillance output, no audit-trail table, no QI artefact, no export; the only "audit trail" mention is a false comment at `actions.ts:335` |

## §10 — MOPH review

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| §10 ¶1(a–c) | The three outcomes, verbatim | `/ministry/submissions/[id]` | Reviewer | discharged | `ministry.json:4-18`; satisfied gated with every blocker named (`ministry.ts:94-102`), re-enforced server-side (`ministry-actions.ts:87-89`); the organizer reads the same determination (`lib/queries.ts:102-125`, e2e-pinned) |
| §10 ¶2 | Additional measures where necessary | `/ministry/submissions/[id]` | Reviewer | discharged | Catalogue-bound, blocking by default, notifies the organizer; explicitly not a fourth outcome |
| §10 ¶3 | The status replaces no other permit | review + acknowledgment | Reviewer / Organizer | discharged | Both limit sentences verbatim on both sides; EN pixel-compared, AR string-pinned |

## §12 — Major-incident and mass-casualty preparedness

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| §12 ¶1 | L2/L3 documented major-incident and mass-casualty plan | `/events/[id]/plan` | Organizer | partial | Section 12 gated as one of the sixteen; the eleven-item block renders at L2/L3 but gates nothing (showstopper 2) |
| §12 items (1)–(11) | Activation authority · coordination/integration · communications · one triage method · casualty collection · ambulance loading · resource escalation · receiving-hospital notification · continuity · suspension/evacuation authority · identification/tracking | `/events/[id]/plan` | Organizer | partial (×11) | All eleven present, correctly worded, level-gated, persisted (`plan.json:135-188`, `PlanForm.tsx:524-553`, `actions.ts:342-350`); none enforced by `planComplete` or the outcome blockers |
| §12 ¶3 | L3: the Director's role in medical command defined | `/events/[id]/governance` | Director | discharged | Item 2 carries the clause verbatim; the Director writes command text (`governance/page.tsx:54-100`) |
| §12 final | L3: each EMS agency confirms its role through the compliance form | `/events/[id]/declaration` | EMS agency | discharged | Item 10 with the organizer's plan linked; signing gates filing |

## §13 — Incident notification and post-event reporting

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| §13 ¶1 | Cardiac arrest, death, major incident, medical interruption → notify ≤ 24 hours | `/events/[id]/post-event` | Organizer | partial | Control exists but is unreachable until the report window opens, captures neither type nor time, and no Ministry screen reads it (showstopper 3) |
| §13 ¶2(a) | Annex D within 7 days after every Level 3 event | `/events/[id]/post-event`, `/events/[id]/report` | Organizer + Director | discharged | Opens 00:00 Asia/Beirut the day after the event ends, due +7 (`deadlines.ts:173-184`); two signatures at Level 3 |
| §13 ¶2(b) | Annex D after a reportable event at Level 1/2 | `/events/[id]/post-event` | Organizer | partial | Trigger configured (`levels.json:26`) and named in copy but read nowhere; the gate keys on the date alone at every level |
| §13 ¶2(c) | Annex D when requested by MOPH | — | Reviewer → Organizer | absent | Two screens promise the trigger; the console has no request control |
| §13 ¶3 | Post-event data for surveillance, QI, future NEHRAT scoring | `/ministry/incidents` | Reviewer | partial | Listed with a significant-event flag; feeds nothing — `deriveLevel` reads only the current answers |

## §14 — Records, data and confidentiality

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| §14 ¶1 | Organizers and providers maintain required records | assessments, plans | Organizer | partial ⟲ | Assessments genuinely versioned (`queries.ts:163-167`); the plan is upserted in place and prior versions destroyed while the screen claims otherwise (showstopper 6). One audit pass reported this sound; hand-verification overrides it |
| §14 ¶2 | Annex D aggregate only; no unnecessary PII | `/events/[id]/post-event` | Organizer | discharged | Seven aggregate counts; narrative name-screened client- and server-side (`pii.ts:11-25`); same rule on the facility incident report |
| §14 ¶2 | Server-side field limits | `/api/public/reference-lookup` | Public | discharged | Four fields by explicit construction; enumeration refused; 429 answers in the NOT_FOUND shape |
| §14 ¶3 | MOPH may publish aggregated national findings | — | Ministry / public | absent | No publication surface; `/platform/activity` is authenticated, owner-only, counts-only by its own scope note |

---

# Annex A — NEHRAT

## Part A — the fifteen event-information fields

Fourteen of fifteen discharged on `/events/new` (`AssessmentForm.tsx:184-272`, persisted
`actions.ts:206-229`): name, type, venue/route, municipality, dates, opening/closing times,
participants, spectators, staff, maximum simultaneous attendance, previous edition,
recurring venue, licensed capacity.

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| A.2 | Organizer identity | `/events/new` | Organizer | partial | No field; bound to the signed-in account (`actions.ts:206`) — an assessment filed by a delegate carries the account's organization, not a declared organizer |
| A.1, A.3–A.15 | The other fourteen fields | `/events/new` | Organizer | discharged (×14) | `AssessmentForm.tsx:184-272`; `actions.ts:206-229` |

## Part B — the nine domains

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| B.1–B.9 | Nine domains scored 0–2: attendance · activity · crowd configuration · duration · venue configuration · environmental exposure · access & extraction · transport time · previous history | `/events/new` | Organizer | discharged (×9) | `domains.json:26-241`; `AssessmentForm.tsx:344-386`; sum `derive.ts:108` |
| B banding | 0–18 banded 0–5 / 6–11 / 12–18; incomplete answers return "incomplete" naming the domain, never a level | `/events/new`, `/events/[id]` | Organizer | discharged | `derive.ts:28-36,95-113`; `levels.json` |
| B drift | Build domain data must match the prototype's `domainDefs` | tests | engineering | discharged | `tests/reference-drift.test.ts:106-127` with SHA guards |

## Part D — the minimum conditions

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| D.att2, D.att3 | 10,000+ → floor L2; 20,000+ → floor L3 | `/events/new` | Organizer | discharged | `minimum-conditions.json:33-69`; trap tests in `tests/derivation.test.ts:185-210` |
| D.club (EN issue) | Nightclub/dance venue licensed ≥ 1,000 → floor L2 | `/events/new`, `/venues/[id]/assessment` | Organizer | partial | Venue route sound; the event form seeds the flag `false` (`AssessmentForm.tsx:107,117`) so the unset state can never fire — verified: `useState(false)` checkbox, silently defaulting, violating non-negotiable 0 for this condition |
| D.recur (AR issue) | Recurring venue licensed ≥ 1,000 → floor L2 | `/events/new`, `/venues/[id]/assessment` | Organizer | partial | Same defect (`AssessmentForm.tsx:108,118`) |
| D.run | Any organized running event → floor L2 | `/events/new` | Organizer | discharged | Derived from the structured disciplines list, not domain 2's bundled option |
| D.run21 | Course ≥ 21.1 km → floor L3 | `/events/new` | Organizer | discharged | Conditional required field; unset returns incomplete naming `courseDistanceKm` (`derive.ts:115-129`) |
| D.tri, D.open, D.combat, D.motor | Triathlon · open-water · combat sports · motor racing → floor L3 | `/events/new` | Organizer | discharged (×4) | `minimum-conditions.json:152-226` |
| D union | EN issue carries nine incl. `club`; AR issue carries nine incl. `recur`; the build ships the union of ten | `/events/new` | Ministry | deliberately deferred | Self-declared unratified reconciliation (`minimum-conditions.json:2`); surfaced as "English issue only"/"Arabic issue only" chips; locked by the drift test |
| D venue annual | Recurring venues reassess annually; new assessment on material change | `/venues/[id]/assessment` | Organizer | discharged | Venue lane; AR-only effective/expiry note carried |
| D no-checkbox | Every floor derived, none manually chosen | `/events/new` | engineering | discharged | `tests/reference-drift.test.ts:135-157`; read-only condition rendering |
| D higher-of | Final level = higher of band and floor, both reported with which governed | `/events/new`, `/events/[id]` | Organizer | discharged | `derive.ts:131-144`; `tests/derivation.test.ts:78-140` |

## Part F — the organizer declaration

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| F statement | "I certify that the information provided in this assessment is complete and accurate." | — | Organizer | absent | The NEHRAT certification wording exists nowhere in the build; only the Annex C and Annex D statements exist in data (and those render nowhere either — see below) |
| F organizer / representative / position | Named declarant | `/events/[id]/submit` (Annex C block only) | Organizer | partial | Captured only on the Annex C certification, which certifies the submission package, not the assessment |
| F signature / date | Signature and date on the assessment | — | Organizer | absent | The assessment saves via an unsigned button; no signing date recorded |
| F total score | Total ___ / 18 restated in the declaration | `/events/[id]` | Organizer | partial | Displayed as a record fact, never inside a certified block |
| F applicable minimum level | None / L2 / L3 restated | `/events/new` | Organizer | partial | Live panel only; the saved record shows triggered conditions, not the None/L2/L3 value |
| F final level | Level 1/2/3 | `/events/[id]`, `/events/[id]/submit` | Organizer | discharged | Record header and submission header |

---

# Annexes B and C

## Annex B — the twenty requirements

Level gating is the module's core behaviour: a requirement inapplicable at the level is absent,
not greyed (`lib/rules/requirements.ts:35`; `requirements/page.tsx:86`).

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| B.1–B.6, B.8–B.12, B.14, B.19, B.20 | Fourteen of twenty requirements at their levels | `/events/[id]/requirements` (+ role surfaces) | per row | discharged (×14) | `requirements-matrix.json`; declaration, post-event and Director surfaces as evidenced per row above |
| B.7 | Ambulance arrangements — recorded EN/AR divergence (AR adds transport) | `/events/[id]/requirements` | Organizer / EMS | partial | `divergence` computed onto the row (`requirements.ts:52`) but no screen renders it |
| B.13 | EMS provider notified — AR adds coordination ("والتنسيق معها") | `/events/[id]/requirements` | Organizer / EMS | partial | Same unrendered-divergence defect |
| B.15 | Event medical command — Director alone; AR "وظيفة محددة" divergence | `/events/[id]` Director view, `/events/[id]/governance` | Director | partial | Sole-party enforcement works (`roles.ts:56`); divergence unrendered; `commandFunctionRow()` (`requirements.ts:59`) is dead code |
| B.16 | Major-incident preparedness — all levels, escalating | `/events/[id]/requirements` | Organizer | partial | **The EN and AR issues order rows 16/17 differently and the build paired Arabic by index**: EN major-incident carries the AR insurance label, so an Arabic L1/L2 organizer sees insurance titled with a "—" value instead of the escalation procedure. Verified against both source issues |
| B.17 | Insurance coverage — L3 only | `/events/[id]/requirements`, `/events/[id]/submit` | Organizer | partial | The mirror of the same mispairing; Arabic users never see the insurance obligation named |
| B.18 | Patient-care documentation — held by the medical provider | `/events/[id]/requirements` | Medical provider | partial | Party `M` has no surface anywhere in the build; renders only as a line the organizer certifies |

## Annex C — Section A (the eight declarations)

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| C header | Eight identity fields above the declarations | `/events/[id]/submit` | Organizer | partial | Six of eight hand-written (`submit/page.tsx:38-45`); Venue/Route and EHMP version omitted; the typed `COMPLIANCE_HEADER` export is never imported |
| C.A gate | All applicable items ticked before filing | `/events/[id]/submit` | Organizer | partial | **Showstopper 1**: gate demands 7 ticks below Level 3; the form renders 6 |
| C.A.1–3, C.A.7, C.A.8 | Assessment · requirements · plan · escalation · documents declarations | `/events/[id]/submit` | Organizer | discharged (×5) | `compliance-form.json:46-110`; each backed by a real mechanism |
| C.A.4 | L2/L3 providers and contacts identified | `/events/[id]/submit` | Organizer | partial | `blockedBy: "unansweredProviders"` is dead data — the tick is free while nominations are unanswered (verified: no consumer) |
| C.A.5 | L3 Director appointed | `/events/[id]/submit` | Organizer | discharged | `minLevel: 3`; backed by the Director gate |
| C.A.6 | L3 insurance secured — insurer, policy, period, evidence | `/events/[id]/submit` | Organizer | partial | Four free-text boxes; "evidence attached" is a typed string; no insurance document in the attachments catalogue; nothing validated before filing |
| C.A.6-AR | The Arabic issue omits the insurance declaration | `/events/[id]/submit` | Organizer | partial | `arabicIsTranslation`/`divergence` flags recorded in data, never rendered — the sibling declaration screen has the badge pattern to copy |
| C org certification | The certification statement, representative, position, telephone, signature, date | `/events/[id]/submit` | Organizer | partial | Statement never rendered; representative/position/telephone captured but none blocks filing; no signature/date control; telephone's EN-only status untagged |

## Annex C — Section B (the ten-item EMS declaration) and its certification

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| C.B gate + items 1–9 | Level 3 only; each agency separately; all ten before signing | `/events/[id]/declaration` | EMS agency | discharged (×10) | `roles.ts:85-96`; `compliance-form.json:138-173`; item 7 names the Director |
| C.B.10 | Role in the major-incident plan reviewed and confirmed | `/events/[id]/declaration` | EMS agency | partial | The stronger Arabic ("وأكدت جاهزيتها لتنفيذه") rendered against the weaker English with no divergence flag |
| C EMS certification | Agency, representative, telephone, position, signature, date | `/events/[id]/declaration` | EMS agency | discharged | `roles.json:159-188`; signature recorded as `signedAt` |

---

# Annex D — post-event medical report

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| 7-day window | Within seven calendar days, opening the day after the event ends, Asia/Beirut | `/events/[id]/post-event` | Organizer | discharged | `gates.ts:58-69`; `deadlines.ts:173-184` |
| Identity: event name | | `/events/[id]/post-event` | Organizer | discharged | Rendered in the page prose |
| Identity: event dates | | `/events/[id]/post-event` | Organizer | partial | End date only; a multi-day event's start date never appears |
| Identity: venue/route | | — | Organizer | absent | Not on the surface; the event row carries only `venueFacilityId` |
| Identity: organizer | | — | Organizer | absent | Organization reaches the page chrome only |
| Identity: final level ☐1 ☐2 ☐3 | | — | Organizer | absent | Derived for gating, never displayed |
| Seven activity counts | Attendance · assessed/treated · transported · arrests · deaths · unplanned resources · coverage hours | `/events/[id]/post-event` | Organizer | discharged (×7) | `post-event-report.json:3-38` |
| Eight significant-event checkboxes | Incl. "None", mutually exclusive | `/events/[id]/post-event` | Organizer | discharged (×8) | `post-event-report.json:41-80`; exclusivity in `PostEventForm.tsx:115-120` |
| Lessons block | "No significant issues" + narrative, name-screened | `/events/[id]/post-event` | Organizer | discharged | Server-side PII gate (`actions.ts:444-449`) |
| Declaration statement | "I certify that the information provided is complete and accurate." | — | Organizer / Director | absent | In data (`post-event-report.json:89`), rendered nowhere — both parties sign with no certifying text present |
| Signature 1 — organizer + date | | `/events/[id]/post-event` | Organizer | discharged | `PostEventForm.tsx:175-188`; `actions.ts:470` |
| Signature 2 — Director (L3) + date | | `/events/[id]/report` | Director | partial | `actions.ts:469` reads `demo_level` alone (verified) — a real event derived to Level 3 completes on one signature |

---

# PAD policy (cardiac-arrest readiness)

## §3 — covered facility categories

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| §3 cat 1 | Sports facilities — AED required now; dual-instrument note where also a recurring venue | `/facilities/new` | Operator | discharged | `facility.json:5-17,92-95` |
| §3 cat 2 | Educational campuses — on the phased schedule; journey ends at step 2, missing value named, Record an interest | `/facilities/new` | Operator | deliberately deferred | The live state for the category; `facility.json:19-31`; `actions.ts:672` |
| §3 cat 3 | Airports/ports/terminals by category; malls above a Ministry threshold | `/facilities/new` | Operator | partial | Chip correct; **no capacity field exists on the facility profile**, so a published threshold could never be evaluated |
| §3 cat 4, 6 | Remote/difficult-access; other designated | `/facilities/new` | Operator | deliberately deferred | `awaitingMinistryValue` with the missing value named |
| §3 cat 5 | Facility with a confirmed arrest — subject to review; designation is the mechanism | `/facilities/new`; `/ministry/facilities/arrests` | Operator; Reviewer | discharged | `determinedByReview`; designation action + register |
| §3 rule | Categories/thresholds/phases configurable, not hard-coded | `/ministry/admin/cardiac` | Admin | partial | Values publish but `FACILITY_CATEGORIES` is static JSON — a published phase leaves education `awaitingMinistryValue` while operators are notified it activated |

## §4 — the nine facility readiness requirements

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| §4.1, §4.2, §4.6, §4.7, §4.8, §4.9 | Coordinator · response plan · EMS activation/access/handover · annual drill · incident report · deficiency correction | facility service | Coordinator | discharged (×6) | Per-row evidence in the audit; ledger-driven cycles; wallcard; corrective loop through the Ministry lane |
| §4.3 | CPR/AED-trained personnel during operating hours | `/facilities/[id]/plan` | Coordinator | partial | Self-attested checkbox; no personnel record, training evidence or validity date |
| §4.4 | Accessible AED where required | `/facilities/[id]/devices` | Operator | partial | Yes/No captured; the policy's accessibility rule (locked access, unavailable personnel, avoidable barrier) stated nowhere |
| §4.5 | Signage, operational status, manufacturer maintenance | `/facilities/[id]/devices` | Operator | partial | The four readiness checks asked only on the annual purpose, never at initial registration; no manufacturer-maintenance field |

## §11 — the ten configuration powers

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| §11 mechanism | Unset / set-and-publish / effective date on every value | `/ministry/admin/cardiac` | Admin | discharged | `ministry.ts:129-135`; publish requires value + effective date |
| §11.6 | Corrective-action timelines | cardiac config → `/ministry/facilities` | Admin | discharged | Published value consumed; due dates flip from not-computed (e2e-walked) |
| §11.8 | Review reported arrest locations | `/ministry/facilities/arrests` | Reviewer | discharged | Grouped by place and category; repeat pattern surfaces the designation control |
| §11.1 | Phased schedules | `/ministry/admin/cardiac` | Admin | partial | Publishes and notifies recorded interests; never read back — education stays `awaitingMinistryValue` |
| §11.2 | Capacity thresholds | `/ministry/admin/cardiac` | Admin | partial | Publishes; no consumer (and no facility capacity field to evaluate against) |
| §11.3 | Designate remote/individual facilities | `/ministry/facilities/arrests` | Reviewer | partial | Only entry point is the arrest list — a remote facility with no arrest cannot be designated; the power card lists no recorded designations |
| §11.4 | Category-specific additional requirements | `/ministry/admin/cardiac` | Admin | partial | Publishes; no facility screen renders them |
| §11.5 | Electronic registration/reporting procedures | `/ministry/admin/cardiac` | Admin | partial | Reduced to a timeframe value; the dataset screen renders the unset note unconditionally, so publishing changes nothing there |
| §11.7 | AED and arrest registries | `/ministry/admin/registry` | Admin | partial | Registry lists facilities, no device rows; geolocation/notification flags deliberately off |
| §11.9 | Issue/update forms and guidance | `/ministry/admin/configuration` | Admin | partial | Carries only the mass-gathering NEHRAT version; no cardiac form versioning |
| §11.10 | Readiness cycles + confirmation requests | `/ministry/admin/cardiac` | Admin | partial | **Showstopper 5**: `effectiveCycles` unwired; the ledger binds provisional constants; corrective half works |

## PAD Annexes A–E

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| A §5.1–§5.4 | Facility info · persons · AED summary · eight-step sequence | `/facilities/[id]/plan` | Coordinator | discharged | Incl. printable wallcard; AED block derived read-only from the registry |
| A §5.1 phone/email | Facility telephone and email on the plan | `/facilities/[id]/plan` | Coordinator | partial | Captured at registration, omitted from the plan's facility block |
| A §5.5 | Six confirmations + drill date + coordinator confirmation | `/facilities/[id]/plan` | Coordinator | partial | Confirmations and drill date discharged; no signature control and no date field (DB stamp only) |
| B §6.0–§6.2 | One record per AED; identification, location, accessibility, pediatric, readiness dates, purposes, status changes | `/facilities/[id]/devices` | Operator | discharged | Per-row evidence in the audit |
| B §6.1 readiness checks | Operational/pads/battery/signage at registration | `/facilities/[id]/devices` | Operator | partial | Asked only on the annual purpose |
| B §6.1 facility section / confirmation | Facility details on the record; signature + date | `/facilities/[id]/devices` | Operator | partial | Name + id only; statement without signature control or date |
| B §6.2 missing routes | Status change on AED use; on Ministry readiness request | `/facilities/[id]/devices` | Operator | absent | Neither purpose exists |
| B §6.3 | Geolocation, automated notifications | flags | Ministry / owner | deliberately deferred | `feature-flags.json:14-15`, off with rationale |
| C §7.0–§7.5 | Incident report: no-name rule, incident facts, response, EMS, follow-up, submission | `/facilities/[id]/incidents/new` | Coordinator | discharged | Server-side name gate; full field set |
| C §7.1 facility refs | Category and address on the report | `/facilities/[id]/incidents/new` | Coordinator | partial | Name and record id only |
| C §7.5 signature/date | | `/facilities/[id]/incidents/new` | Coordinator | partial | `dateEn` defined, never rendered; no signature control |
| D §8.1–§8.5 | First-response readiness: equipment, competence, operations, procedure, handover, reporting, own-report acceptance, gated declaration, distinct actor | `/first-response/*` | First-response unit | discharged (×9) | Checklist gated on the outstanding count; dataset form; both report routes |
| E §9.0–§9.5 | Minimum dataset: no name; case/facility; response times; AED chain; outcome; agency; configurable timeframe | `/first-response/reports/new` | First-response unit | discharged (×7) | Full dataset as data; onsite vs unit AED rows distinguished |
| Cross-cut: provisional cycles marked | The 90/60-day figures marked provisional wherever used | facility screens | Operator | partial | Marked on the readiness ledger; **not** on the device registry, which shows the same Current/Lapsing/Lapsed chips without the note `facility.json:2` mandates |
| Cross-cut: vocabulary wall | Mass-gathering status vocabulary never on the facility side | tests | engineering | discharged | `tests/facility-vocabulary.test.ts` against `banned-terms.json` |

---

# Product specification

## User classes

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| Reviewer / inspector class | Review, corrections, decisions, inspections, corrective actions | Ministry console | Reviewer / Inspector | discharged | Permission matrix as data; every action server-enforced |
| Organizer class | Create/manage submissions, respond to requests | event service | Organizer | discharged | Ownership-scoped queries throughout |
| Event Medical Director class | L3 functions only; no L1/L2 medical titles | Director surfaces | Director | discharged | `roles.ts:44-46`; `tests/roles.test.ts:34-38` |
| Platform owner class | Spec says platform-wide tenant visibility | `/platform/activity` | Owner | partial | Built to the narrow counts-only reading (SPEC §2c) — a recorded open decision, reversible |
| Owner console | Licensing, white-label, integrations, tenant provisioning | `/platform/admin` | Owner | deliberately deferred | Commercial-adjacent surfaces behind the governed flags; flags render as states, not switches, per the Slice 6 ruling |
| MOPH administrator class | Configure tenant, users, forms, rules, deadlines | admin screens | Admin | partial | Cardiac powers writable; the mass-gathering configuration screen is read-only display — no form, no action |
| Organization administrator class | Manage organization profile and authorized users | — | — | partial | No such role; `organizer` owns everything; no user management for an organization |
| Site manager / cardiac coordinator class | Facility readiness surfaces | facility service | Organizer | partial | Surfaces exist; no distinct role — permissions do not separate it |
| EMS representative class | Profile, participation, declarations, BLS/EMS reports | provider surfaces | EMS | partial | Reporting lives on the separate first-response account, which the `ems` role cannot reach |
| External reviewer (Order) class | Controlled L3 review access | — | Order | deliberately deferred | Slice 6 ruling: lane off, account suspended-not-active, one matrix action; no console built |
| Technical operator class | Auditable technical access, no regulatory authority | — | — | deliberately deferred | Deployment-level access, outside the app session model |
| Multi-role holding | A user may hold more than one role | — | all | partial | `role` is a single scalar (`lib/auth.ts:21`); the matrix itself is data and configurable |

## The eight-step sequence

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| Steps 2–4, 6, 8 | NEHRAT scoring · classification recorded · Annex B generation · Ministry review · post-event | as evidenced above | — | discharged | Tool version stamped per assessment (`actions.ts:231`); level derived never chosen |
| Step 1 | Applicability determination as its own step | `/events/new` | Organizer | partial | Folded into the assessment; no out-of-scope determination on the event side (the venue lane has one); the public branch is the deferred Slice 0 screen |
| Step 5 | Submission package with uploads | `/events/[id]/*` | Organizer | partial ⟲ | Package, gates and versioned *assessments* discharged; the plan is upserted in place (showstopper 6) and uploads store a name only (§9 (iii)) |
| Step 7 | Changes, cancellation, postponement | `/events/[id]/change` | Organizer | partial | Material change discharged; cancellation/postponement absent |
| Sequence surfaced | The flow visible end to end | `/events/[id]` | Organizer | partial | Six-stage rail; applicability and the change step are not stages |

## Identifiers

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| Record ids at creation | EV- / VN- / FC- | creation screens | Organizer | discharged | `nextRecordId` (`actions.ts:196,526,648`) |
| Ministry reference at submission | MOPH-EV-YYYY-NNNN, only at filing; acknowledgment carries it | `/events/[id]/submit` | Organizer | discharged | `actions.ts:403-412`; "Issued on submission" placeholder before |
| Venue reference | MOPH-VN- at first classification, idempotent | `/venues/[id]/assessment` | Organizer | discharged | `actions.ts:595-606` |
| Facility reference | A Ministry reference for covered facilities | — | — | deliberately deferred | No document defines a facility reference scheme (recorded in ACCEPTANCE "outside the build"); record id only |
| Reference year | Year component of the reference | filing actions | — | partial | `new Date().getFullYear()` — server-local, not the Beirut clock every deadline uses; wrong year possible at year boundary |
| Public lookup four fields | Existence, name, level, status — nothing else | `/api/public/reference-lookup` | Public | discharged | Explicit construction; status now derives from the recorded outcome, same as the organizer's screens |
| Non-enumerable lookup | Second factor + rate limit | `/api/public/reference-lookup` | Public | partial | Date second factor + per-process in-memory rate limit; recorded open decision — does not survive restart or scale-out |
| Public lookup screen | A surface the public can use | — | Public | deliberately deferred | Slice 0; only the JSON route exists |

## Nominations

| Clause | Obligation | Screen | Actor | State | Evidence |
|---|---|---|---|---|---|
| EMS + Director nomination | Named by the organizer from the requirement that needs them; unguessable token; self-registration; scoped visibility; decline warned then reported; states nominated/confirmed/declined; modification-request not a state; L3 declaration gated server-side; profile reused | nomination flow | Organizer / EMS / Director | discharged (×9) | `randomBytes(24)` tokens; `notFound()` for unnamed events; decline routes the organizer to `/events/[id]/change` |
| First-response nomination | Rule 6 names first-response units among the nominated roles | — | Organizer | absent | `invitations.kind IN ('ems','director')` (`lib/db.ts:139`); the unit exists only as a standalone cardiac-instrument account — a design tension between rule 6 and the PAD's facility-side actor that needs a ruling |
| Decline closure | Declined nomination closed/superseded and linked to the material change | `/events/[id]/requirements` | Organizer | partial | Replacement can be named; the declined row stays open and nothing links decline to the change record — the audit trail shows two unconnected events |

---

# Classification — every non-discharged row is one of these

## Bugs (the rule is settled; the build is wrong; no ruling needed)

Showstoppers 1–6 above, plus:

- **B.16/B.17 Arabic mispairing** — the EN and AR issues order the two rows differently; the build paired by index. Fix: pair by content; record the ordering divergence in the source-documents README.
- **D.club / D.recur silently default** — tri-state the two venue flags on the event form so unset returns incomplete naming the field (non-negotiable 0).
- **Six recorded EN/AR divergences never rendered** — B.7, B.13, B.15, C.A.6-AR, C.B.10, certification telephone. The badge pattern exists on the declaration screen; the data carries the flags; no screen shows them.
- **Certification statements unrendered** — Annex C organizer statement and Annex D statement exist in data and render nowhere; Annex A Part F does not exist at all. People sign without the certifying words on screen.
- **Director post-event signature reads `demo_level`** — a derived Level 3 event completes on one signature (`actions.ts:469`).
- **Reference year from the server clock** — use the Beirut clock like every other date computation.
- **`unansweredProviders` dead data** — wire the declared blocker or remove it; today the declaration ticks freely.
- **Expedited flag invisible to the reviewer** — derived and stored but no console surface reads it.
- **Governance text never reaches the plan** — the plan screen doesn't call `governanceFor`, contradicting the governance screen's own copy.
- **§11 powers 1, 2, 4, 5, 9 publish into a void** — same class as showstopper 5: published values with no consumer while the console reports them in force.
- **Provisional-cycle note missing on the device registry** — `facility.json:2` mandates it wherever the chips render.
- **Annex D identity fields** — dates (start), venue/route, organizer, final level missing from the report surface.
- **Device readiness checks only on the annual purpose** — initial registration never asks them.
- **Annex B §6.2 missing status-change routes** — after AED use; on Ministry readiness request.
- **Incident report facility references** — category and address omitted (§7.1).
- **L1 measures selector cannot request Annex C/EHMP** — populate from the requestable catalogue, not `documentsForLevel(1)` (§8.1 third limb).
- **Compliance header incomplete** — two of eight fields omitted; the typed export exists unused.
- **Malls capacity field missing** — the profile captures nothing a published threshold could evaluate.
- **§13 ¶2(b) reportable-event trigger read nowhere** — configured, named in copy, never evaluated.
- **§13 ¶2(c) no Ministry request control** — two screens promise a trigger the console cannot fire.

## Decisions (building either way would guess; each needs an owner)

1. **The Slice 0 surfaces** — `/applicability` (with the §3 criteria and both not-routinely-subject limbs), the public landing, the public lookup screen. Scheduled work, never built; most §3.1 entry-gate rows collapse into it. *Owner: build order.*
2. **Applicability entry gates on the event side** — should §3.1(b)–(e) act as gates inside `/events/new`, or is the assessment itself the answer? The 1,000 threshold and "dedicated arrangements" limb exist nowhere. *Ministry.*
3. **Event designation/referral (§3.1(f)) and the §3.3 uncertainty determination** — new console capability. *Ministry.*
4. **Cancellation and postponement** — required by Protocol §8.5/§9(vii) and the product spec; entirely unbuilt; needs a lane (change aspect vs its own notice, and what happens to the reference). *Ministry + build.*
5. **Signature policy** — five surfaces capture certifications without a signature control (Annex A F, C organizer, D report, PAD plan §5.5, device confirmation, incident §7.5). What constitutes a signature in-platform (typed name? credentialed act? the filing act itself?) is one decision that resolves them all. *Ministry.*
6. **Material change consequences** — should a change that `levelMayChange` reopen the assessment or void the filing? Today it is inert by design caution. *Ministry.*
7. **Role model** — organization administrator, distinct site coordinator, multi-role holding, EMS-vs-first-response reporting split, and whether first-response units join the nomination flow (rule 6) or stay the PAD's standalone actor. *Ministry + product.*
8. **Director licensure capture** — licence number at acceptance vs the off-by-default Order lane vs assertion. *Ministry.*
9. **Document storage** — binary upload is a deployment decision recorded in code; name-only until then. *Platform.*
10. **Level 1 organizer contact** — the Protocol wants a responsible contact on every event; Level 1 has no form that could carry one. Smallest fix is a field on the assessment; whether it belongs there is Annex A's shape. *Ministry.*
11. **§8.1 authorization facts** — capturing whether/when final authorization was issued would let both §8.1 limbs actually evaluate; also §4's integration expectation. *Ministry.*
12. **Aggregate publication (§14 ¶3) and surveillance/audit/QI (§9 (ix), §13 ¶3)** — reporting outputs, de-identification, and whether NEHRAT scoring feeds back. Analytics phase, sequenced with the AI layer. *Ministry.*
13. **Interim filing channel (§9 ¶3)** — likely moot once the portal is the mechanism; record that formally. *Ministry.*
14. **Insurance evidence** — as an attachment type with validation vs free text; note the Arabic issue omits the declaration entirely (recorded divergence). *Ministry.*
15. **§4.3/§4.4 capture depth** — personnel/training records and the accessibility rule text vs self-attestation. *Ministry.*
16. **Platform owner reach and the owner console** — counts-only stands until ruled; the fourteen owner-console capabilities wait on the commercial flags. *Ministry + product.*
17. **Rate-limiter mechanism** — already a recorded open decision; per-process today.
18. **B.18 medical-provider surface** — party `M` has no login class; whether patient-care documentation needs its own surface or stays an organizer certification. *Ministry.*
