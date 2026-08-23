# National Health and Medical Readiness — Ministry of Public Health, Lebanon

A regulatory platform. Nobody uses it by choice: an organizer arrives because a municipality
told them to, or because their event will not be authorised without a Ministry reference number.
Make the obligation legible and dischargeable. No marketing register, no encouragement, no delight.

## Authority

`handoff 3/SPEC.md` wins over everything. `handoff 3/ROADMAP.md` is authoritative on routing.
`ROUTES.md` and `PROMPTS.md` described an earlier build and have been removed — if a copy
resurfaces, ignore it.

The nine assessment domains and ten minimum conditions exist **only** in
`handoff 3/pages/Organizer Journey.dc.html` (`domainDefs`, `minDefs`). No markdown file
enumerates them. That HTML is load-bearing, not decoration.

## Architecture

- **`lib/rules/` is plain TypeScript.** No React, no `next/*`, no server-only imports. Pure
  functions over plain data. Callable from a screen, a route handler and a `.test.ts` alike.
  It owns level derivation, the higher-of rule, deadline dates, the four state chips,
  conditional visibility and the organization-pending rule. **No screen implements its own gating.**
- **Arabic layout is our work, not the library's.** next-intl does strings, ICU and formatting.
  It does not set `dir` and does not mirror layout. We do both.
- **Server-side field limits are enforced on the server.** Not a wide query filtered at render.

## The non-negotiables

**0. Do not port the prototype's deliberate bug.** In `Organizer Journey.dc.html`, `att3`
(20,000+) and `run21` (course ≥ 21.1 km) carry `derived: false` — manual checkboxes, because the
prototype has no numeric input. In the build they are **derived**: capture expected maximum
simultaneous attendance as a number, and course distance as a required field on organized running
events. An unticked box on a marathon returns Level 2. That is the failure this platform exists to prevent.

**1. The level is derived, never chosen.** Nine domains × 0–2 = 0–18. Bands 0–5 / 6–11 / 12–18.
Ten minimum conditions. **Final level is the higher of the two**, and the UI reports both results
and which governed. No dropdown, no edit, anywhere.

**2. Three outcomes, and only a Ministry reviewer records them.**
Submission received but incomplete · Additional information or revision required · Health and
medical preparedness requirements satisfied. **Never "approved". Never "rejected".** Internal
states (in queue, in progress, assigned) render grey and are *not* determinations. An inspector
records corrective actions and can record none of the three. The Order of Physicians lane is off
by default, non-determinative, never reaches the facility side.

**3. Nothing regulatory is hard-coded.** Thresholds, phases, timeframes, designations are all
Ministry-configurable. Never render a threshold as a fixed number in copy. **The unset state is a
first-class answer** — name the missing value, say nothing is in force until the Ministry publishes
it, say operators are notified when it does.

**4. Full EN/AR parity, and Arabic mirrors the layout.** Every string, both languages, neither
empty. Logical CSS properties only — no `left`, `right`, `margin-left`, `text-align: left`.
`html[lang="ar"] [data-flip]{transform:scaleX(-1)}` on every directional glyph. Arabic is
regulatory copy in the same register, not a translation layer.

**5. Two identifiers.** Record id at creation (`EV-0418`, `VN-0032`, `FC-0014`); Ministry
reference number at submission (`MOPH-EV-2026-0362`). Public lookup returns **four fields**:
existence, event name, level, current status. Never contact details, documents or answers.

**5b. The public lookup must not be enumerable.** Sequential references + unauthenticated lookup
= anyone can walk the national register. Rate limit, second factor, or a non-sequential public
token. An endpoint that answers an incrementing sequence is not acceptable. Inside an
authenticated session sequential ids are correct.

**6. Nomination, never self-registration.** EMS providers, Event Medical Directors and
first-response units are named by the organizer and self-register against an invitation.
Invitation links carry an **unguessable token, never a sequential id**. None sees an event it was
not named in. Declining is a material change the organizer must report.

**7. No patient-identifying data.** The facility incident report blocks submission when a personal
name is detected in the narrative.

**8. A new account is empty.** Empty dashboard is the primary state. Demonstration rows are real
rows carrying `is_demo = true` and **do exist in production** so the Ministry can walk the
platform. What is forced off in deployed environments is **the seeder**, not the accounts. Demo
rows are excluded from the national registry, every Ministry aggregate and every reviewer queue.

**9. Organization registration blocks filing, not starting.** Create, assess, gather and draft
while pending. Only Submit is blocked, with the reason in both languages and a route to the
organization screen.

**10. Two gating behaviours; conflating them is a real error.**
*Disabled with a reason* for what will become available (time gate, state gate) — say why and when.
*Absent entirely* for what never applies (level, category, instrument gate).
A Level 2 organizer must not see a greyed Event Medical Director row. **Not built yet is neither.**

**10b. Level 1 has a filing deadline, and it is conditional.** Filed before final authorization is
issued, and where no external authorization is required, ≥ 7 calendar days before. Level 2 is 14,
Level 3 is 30. Do not confuse the Level 1 lead time with the post-event report window — also 7
days, but *after* the event.

**11. Date gates compute in Asia/Beirut.** Not the browser zone, not UTC. The post-event report
opens 00:00 Asia/Beirut the day after the event **ends**, not starts.

**12. `Fee: None.`** Never "free". No vendor directories, purchase links, fees or commercial content.

## Copy

Plain, declarative, sentence case. No marketing register, encouragement, exclamation or emoji.
Deadlines as dates. **Never name an annex** — say *risk assessment*, *compliance and submission
form*, *readiness declaration*, *post-event medical report*, *event health and medical plan*.
**NEHRAT** only where it names the instrument (a version row, a config reference); banned where it
substitutes for what the user is doing. Quoted regulation is verbatim — do not improve it.
Mass-gathering status vocabulary never appears on the facility side.
The glossary in `SPEC.md` §7 is the canonical Arabic — use it rather than inventing terms.

## Build order

Slice 0 public landing · **Slice 1 shell + derivation engine + thin event slice** · Slice 2 rest of
event service · Slice 3 venue · Slice 4 facility · Slice 5 other roles · Slice 6 Ministry console.

The tab strip in the reference files is `data-prototype-nav`, a reviewer's index. **Do not build
it.** Build the routes in `ROADMAP.md` and the sequence footer at the foot of every screen.
`pages/support.js` is the prototype runtime — do not port it, do not read it.

## Reporting

After each slice: what you built and what you deliberately did not; anything in the documents that
turned out wrong or ambiguous rather than guessed at; **the full table of gating reasons and status
strings — the string, its trigger, the screen, in both languages**; and that the tests still pass.
Do not say the work is finished. Say what is in it and what you are unsure about.
