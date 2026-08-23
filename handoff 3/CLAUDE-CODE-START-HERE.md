# Claude Code — start here

Read this file, then `SPEC.md`, then `ROADMAP.md`. Do not write code until you have read all three.

---

## What this is

A regulatory platform for the Ministry of Public Health, Republic of Lebanon. Two regulatory instruments on one platform: health and medical preparedness at mass-gathering events, and cardiac-arrest readiness in designated facilities.

**Nobody uses this because they want to.** An organizer arrives because a municipality told them to, or because their event will not be authorised without a Ministry reference number. The product's job is to make an obligation legible and dischargeable, not to be pleasant. No marketing register, no encouragement, no delight.

## The documents, and what each is for

| File | What it carries | How to treat it |
|---|---|---|
| **`SPEC.md`** | The regulatory rules, the glossary, the copy register, the banned terms | **Authoritative.** Where anything disagrees with this, this wins |
| **`ROADMAP.md`** | Every screen, its route, and every place it is reached from | Authoritative on routing and reachability |
| ~~`ROUTES.md`~~ | Removed — written for an earlier build, and its routes contradict `ROADMAP.md` | Deleted |
| ~~`PROMPTS.md`~~ | Removed — the older Lovable-oriented guide | Deleted |
| **`tokens.css`** | Palette, fonts, geometry, RTL rules | Adopt verbatim |
| **`pages/*.dc.html`** | Five reference designs, fully working | **Visual and behavioural reference, not code to port** |
| **`ORGANIZER-ROUTES.md`** | The organizer journey screen by screen | Reference |

## How to read the reference designs

Open a `.dc.html` file in a browser. Every screen works. The dock on the right toggles language, dark mode, palette and text size — **try the Arabic toggle before you build anything.**

Three things about the source:

- `<x-dc>…</x-dc>` is the markup. All styling is inline; there are no CSS classes to chase.
- `<script data-dc-script>class Component…</script>` holds state and data. Every list, label, state machine and bilingual string pair is in here. This is the most useful part of the file.
- `<helmet><style>` at the top holds palette tokens, fonts, RTL rules and breakpoints.

`<sc-if>` and `<sc-for>` are conditionals and loops. `{{ name }}` is a value from `renderVals()`.

**`pages/support.js` is the prototype runtime. Do not port it, do not read it.**

**The tab strip at the top of every page is not product navigation.** It carries `data-prototype-nav` and exists so a reviewer can reach any screen without a session. Building it would give an organizer a list of twenty-one screens instead of a journey. Build the routes in `ROADMAP.md` and the sequence footer at the bottom of each screen.

---

## Before you write anything

Do these three, in order, and stop after each.

### 1. Read and report

Read `SPEC.md` and `ROADMAP.md` in full. Then read the existing code and tell me:

- Where the build diverges from what those documents describe
- Which of the non-negotiables below are currently enforced, which are enforced by convention, and which are not enforced at all
- Anything in the documents you think is wrong or internally inconsistent

Change nothing. Give me the list.

### 2. Write `CLAUDE.md`

A file at the repo root summarising the non-negotiables, so every future session starts knowing them without being told. Keep it short enough to be read every time.

### 3. Make the rules mechanical

Tests that fail on any violation of the non-negotiables, wired into the build. At minimum:

- Level derivation, including the higher-of rule and every minimum condition
- English/Arabic parity — every user-facing string has both, and neither is empty
- The banned-terms sweep, both languages
- No regulatory threshold, phase, timeframe or designation hard-coded in a component
- No mass-gathering status vocabulary on the facility side
- Logical CSS properties only

A build that violates one of these should fail, not be caught in review.

---

## The non-negotiables

These are the product. A build that is beautiful and breaks one of them is worthless.

**0. The reference prototypes contain one bug deliberately, and you must not port it.** In `Organizer Journey.dc.html` the two minimum conditions below carry `derived: false` — they are manual checkboxes in the prototype, because the prototype has no numeric input to derive them from. In the build they must be derived. Check this first; it is the single most likely thing to be faithfully copied and wrong.

**1. The event level is derived, never chosen.** Nine domains scored 0–2, total 0–18, bands 0–5 / 6–11 / 12–18, plus a set of minimum conditions attached to event types and attendance figures. **The final level is the higher of the score band and the minimum condition.** The UI must report both results and which one governed. If any surface lets a user pick a level, the build is wrong.

Two derivation traps, both of which produce a silently wrong level:

- Domain 1's top option is a single "10,000 persons or more", but the minimum conditions split at 10,000–19,999 → Level 2 and 20,000 or more → Level 3. **Capture expected maximum simultaneous attendance as a number** and resolve the floor from the number, not the domain answer.
- The half-marathon condition (course 21.1 km or more → Level 3) has no derivable source in the rules pack. **Where the event is an organized running event, capture course distance as a required field** and derive the condition from it. An optional checkbox left unticked on a marathon returns Level 2 — the exact failure this platform exists to prevent.

**2. Three outcomes, and they are the only regulatory determinations.**

1. Submission received but incomplete
2. Additional information or revision required
3. Health and medical preparedness requirements satisfied

Internal workflow states — *in queue, in progress, assigned* — render in grey and **are not determinations**. Only a Ministry reviewer records an outcome. An inspector records corrective actions and cannot record any of the three. The Order of Physicians lane is off by default, non-determinative, and never extends into the facility lane.

**3. Nothing regulatory is hard-coded.** Phased schedules, capacity thresholds, facility designations, reporting timeframes and corrective-action timelines are all Ministry-configurable. Never render a threshold as a fixed number in copy.

**The unset state is a first-class answer, not an error or an empty result.** Name the missing value, say that nothing is in force under that rule until the Ministry sets and publishes it, and say operators are notified when it does. For schools this will be the live state for a long time — a school must be able to leave the facility journey understanding it has done everything available to it.

**4. Full English/Arabic parity, and Arabic mirrors the layout.** Every string. `dir="rtl"` and the whole layout mirrors, not just text direction. Logical CSS properties throughout — no `left`, `right`, `margin-left`, `text-align: left`. SVG arrows are the one thing logical properties cannot flip; the reference carries `html[lang="ar"] [data-flip]{transform:scaleX(-1)}` — use it on any directional glyph.

**Arabic is regulatory copy, not a translation layer.** Every gating reason, every status, every notification is written in formal Arabic in the same register as the rest of the platform — not machine-translated at the point of use. When you add a string, add both.

**5. Two identifiers, and they are different things.** A **record identifier** at creation (`EV-0418`, `VN-0032`, `FC-0014`) and a **Ministry reference number** at submission (`MOPH-EV-2026-0362`). The reference number is what an organizer gives the authorising authority. Public lookup returns only that a submission exists, the event name, its level and the current status — **never contact details, documents or assessment answers.**

**5b. The public reference lookup must not be enumerable.** Reference numbers are sequential by design and the lookup is unauthenticated by design. Together those let anyone walk the national register by incrementing a number. Each lookup returns only what is permitted; the aggregate is a different disclosure. Rate limit it, require a second factor the holder knows, or issue a non-sequential public token distinct from the human-readable reference. An endpoint that answers an incrementing sequence is not acceptable. Inside an authenticated session, sequential identifiers are correct.

**6. Nomination, never self-registration.** Invitation links carry an **unguessable token, never a sequential id** — they are opened by an unauthenticated party from an email.
 Participating EMS providers, Event Medical Directors and first-response units are named by the organizer and self-register against an invitation. None can add itself to an event, and none sees an event it was not named in. Declining is a **material change** the organizer must report to the Ministry.

**7. No patient-identifying data anywhere.** The facility incident report blocks submission when a personal name is detected in the narrative.

**8. A new account is empty.** The empty dashboard is the primary state, not a fallback.

Demonstration accounts do exist in production — the Ministry has to be able to walk the platform. **What is forced off in a deployed environment is the seeder, not the accounts.** Demonstration organizations are real rows carrying `is_demo = true`, excluded from the national registry, from every Ministry aggregate count and from every reviewer queue. What must never run in production is the process that invents new fictional records. A demonstration session carries a persistent band.

**9. Organization registration blocks filing, not starting.** An organizer whose organization is not yet recorded can create an event, complete the assessment, gather requirements and draft the plan. Only submission is blocked, with the reason named in both languages and a route to the organization screen.

**10. Two gating behaviours, and conflating them is a real error.**

- **Disabled with a reason** for anything that *will* become available — a time gate, a state gate. Say why and when.
- **Absent entirely** for anything that never applies — a level gate, a category gate, an instrument gate.

A Level 2 organizer must not see a greyed Event Medical Director row. Showing one implies there could be. And *not built yet* is neither of these — never give build progress the same treatment as a regulatory gate.

**10b. Level 1 has a filing deadline, and it is conditional.** §8.1 requires the assessment to be filed before final event authorization is issued, and **where no external authorization is required, at least 7 calendar days before the event.** The word *notification* describes the nature of the filing, not an exemption from it. The rules pack carries `lead_time_days: 7` for Level 1. Level 2 is 14, Level 3 is 30.

Do not confuse this with the post-event report window, which is also 7 calendar days but runs **after** the event. Both figures are 7 and they are different obligations.

**11. Date gates are computed in Asia/Beirut.** Not the browser's zone, not UTC. The post-event report opens at 00:00 Asia/Beirut on the day after the event **ends** — not the start date.

**12. `Fee: None.`** Never "free". No vendor directories, purchase links, application fees or commercial content anywhere — excluded by policy, not by preference.

---

## Copy rules

- Plain, declarative, sentence case. No marketing register, no encouragement, no exclamation, no emoji.
- **Deadlines as dates**, not "soon" or "3 days left" alone.
- **Never name an annex.** Say *risk assessment*, *compliance and submission form*, *readiness declaration*, *post-event medical report*, *event health and medical plan*. Never "Annex A", "Annex C", "EHMP".
- **NEHRAT** is permitted only where it names the regulatory instrument — a version row, a configuration reference, a document link. Banned where it substitutes for what the user is doing. "NEHRAT tool version" is correct; "Complete the NEHRAT" is not.
- Where a string is quoted from the regulation, keep it verbatim. Do not improve it.

The glossary in `SPEC.md` is the full list, including the canonical Arabic for every actor and document name. Use it rather than inventing terms.

---

## Build order

Do not build all three services at once. Forty screens arriving in one delivery cannot be reviewed, and a mistake in the first journey gets replicated into the other two before anyone sees it.

**Slice 0 — the public landing page.** Overview, the three service detail screens, the branching applicability check, search and reference lookup. Signed out, no database, and it is the only part of the platform most visitors ever see. Build it first or last, but do not forget it — the earlier build order omitted it entirely.

**Slice 1 — the shell and the derivation engine.** Header, empty dashboard, Start a service, organization record, notifications inbox, and one central gating and derivation module that every screen asks rather than deciding for itself. Then a thin vertical slice of the event service — create event, assessment, event record — so the derivation can be reviewed before anything is built on it. **Stop there.**

**Slice 2 — the rest of the event service.** Requirements and attachments, invitations, the plan, submission, acknowledgment, material change, post-event report.

**Slice 3 — the venue service.** Registration, annual assessment, venue record, change.

**Slice 4 — the facility service.** Profile, category determination, coordinator, device registry, response plan, readiness, incident report. Note that the category step is a determination and for some categories it ends the journey.

**Slice 5 — the other roles.** EMS provider, first-response unit, Event Medical Director.

**Slice 6 — the Ministry console.** Reviewer surfaces, then administration, then platform owner.

The gating module is built once, in slice 1, and owns level derivation, the higher-of rule, deadline dates, the four state chips, conditional visibility, and the organization-pending rule. **No screen implements its own gating.** If two screens disagree about whether something is available, the module is the only place to fix it.

---

## What I want back after each slice

- What you built, and what you deliberately did not
- Anything in the documents that turned out to be wrong or ambiguous, rather than guessing
- **The full list of gating reasons and status strings, as a table: the string, its trigger, and the screen it appears on, in both languages.** Not a bare list — half the register problems only show up when you can see that a sentence written for a deadline notice is being reused on a permission block.
- Confirmation that the tests from step 3 still pass

Do not tell me the work is finished. Tell me what is in it and what you are unsure about.
