# Acceptance — how we prove the platform is complete

Run this after Slice 6 is committed and before anyone shows it to the Ministry. It is not a test pass; the tests already prove the code does what the code says. This proves **the platform discharges the regulation**, which no test can tell you.

Three passes, in this order. Each finds a different class of problem and none substitutes for another.

---

## Pass A — Traceability. Does every obligation have a home?

The failure this catches is **omission**. A requirement nobody built has no failing test, no visual diff and no error. It is simply absent, and it stays absent until a Ministry reviewer asks where it is.

Build one table. Every row is an obligation taken from the source documents; every row names the screen that discharges it and the actor who acts.

Source these, in order, and do not summarise from `SPEC.md` — go to the instruments:

| Source | What to enumerate |
|---|---|
| Protocol §3 | The six applicability criteria, and the two not-routinely-subject limbs |
| Protocol §6 | The sixteen items an event health and medical plan must address |
| Protocol §7 | Every role and what each is responsible for |
| Protocol §8 | Lead times, the §8.1 second limb, §8.4 short notice, §8.5 material change |
| Protocol §9 | The nine portal capabilities |
| Protocol §10 | The three outcomes, additional measures, the authorisation limit |
| Protocol §12 | The eleven major-incident items |
| Protocol §13 | The 24-hour notification and the three post-event report triggers |
| Protocol §14 | Data minimisation, aggregate publication |
| Annex A | Part A's fifteen event-information fields, Part B's nine domains, Part D's conditions, Part F certification |
| Annexes B and C | All twenty requirements at each level, Section A's eight declarations, Section B's ten items, both certification blocks |
| Annex D | Every field, the eight significant-event checkboxes, both signature blocks |
| PAD §3, §4, §11 | Facility categories, the nine readiness requirements, the ten configuration powers |
| PAD Annexes A–E | The response plan, the registration dataset, the incident report, first-response readiness, the minimum dataset |
| Product spec | The user classes, the eight-step sequence, the identifier rules, the nomination rules |

Three columns per row: **obligation · screen · actor**. Then a fourth: **state** — one of *discharged*, *partial*, *absent*, *deliberately deferred*.

Anything marked absent or partial is either a bug or a decision. Anything marked deferred needs the reason and the slice.

**This is the deliverable the Ministry will actually ask for.** Not a demo — a table showing their own instrument, clause by clause, and where each clause lives.

---

## Pass B — Journeys. Does it hold together between slices?

The failure this catches is **integration**. Each slice was verified against its own reference. Nothing has verified that a record created in Slice 1 survives Slice 2's submission, appears correctly in Slice 6's queue, and carries the same identifier throughout.

Walk each one end to end, as one continuous session, in **English and then Arabic**. Not screen by screen — start to finish, without resetting.

**1. Organizer, event, Level 3.** Create the account → register the organization → create the event → complete the assessment → watch the level derive → nominate a provider and a Director → gather the requirements → write the plan → file → receive the reference number → report a material change → file the post-event report.

Check at each step: does the identifier stay the same? Does the deadline stay the same date? Does what the previous screen promised match what this screen shows?

**2. Organizer, event, Level 1.** The conditional deadline renders, the Level 3 rows are absent rather than greyed, and the compliance form appears only when requested.

**3. Organizer, venue.** Register → assess → classification recorded → report a change → the reassessment gate opens ahead of the annual window.

**4. Organizer, facility, sports category.** Registration through to a filed incident report, including the name block.

**5. Organizer, facility, school category.** The journey ends at step 2. No Continue control, the missing value named, *Record an interest* offered. **This one matters most** — it is the live state for a whole category and the one most likely to look broken.

**6. Provider, Level 3.** Nomination email → token → accept → declaration → ten items → sign → the organizer's package updates.

**7. Provider, Level 2.** No declaration anywhere, only operational detail.

**8. Provider declining.** The consequence stated before the action, the organizer notified, the material change surfaced on their side.

**9. Director.** Nomination → governance → requirement 15 alone → post-event report → two signatures.

**10. First-response unit.** Readiness → dataset → both routes, platform form and attached report.

**11. Ministry reviewer.** Queue → submission → the derivation visible → an outcome recorded → the organizer sees it.

**12. Ministry inspector.** Corrective action recorded, and no outcome available.

**13. Ministry administrator.** Set and publish a cardiac value → the operator's *awaiting* state becomes an obligation with an effective date.

**14. Platform owner.** Activity visible, and a Ministry administrator refused.

**15. Public, signed out.** Applicability in all three branches → reference lookup → four fields and no more.

For each: **what broke, what surprised you, what read wrongly in Arabic.** The third column will be the longest.

---

## Pass C — Design reconciliation. Is the prototype still the truth?

The failure this catches is **drift in the wrong direction**. Roughly forty defects have been found in my prototypes during the build — doubled words, dates that disagree with their own data, status chips on records that cannot hold them, identities that contradict the dashboard, invented fields the policy forbids, paraphrased regulation where the annex has exact wording.

Every one was reported and ruled on. But the prototypes still carry them, which means:

- The visual comparison is pinned to files with known defects, so several regions are permanently marked *expected divergent* when they should simply match.
- Anyone reading the prototypes later — a new developer, the Ministry, you in six months — reads the defects as intent.

So: **the prototypes get one final pass** where each recorded divergence is either fixed in the prototype or accepted as a build improvement, and the manifest shrinks accordingly.

Also settle in this pass the decisions that were reversed after the prototypes were drawn:

- The **venue floor** no longer inherits automatically; the prototype still shows it.
- The seven **non-derivable conditions** are checkboxes in the prototype and derived in the build.
- **Status vocabulary** on the facility side is provisional and must be marked; the prototype has no such note.
- **الجاهزية / التأهب** on the event side — the platform band uses the wrong one.
- The **Arabic NEHRAT strings** are a translation in the prototype and the issue's own wording in the build.

Then re-run the extraction and the drift test. When the prototype and the build agree, the comparison becomes meaningful again rather than a list of exceptions.

---

## What "done" means

Four statements, all true at once:

1. **Every obligation in Pass A is discharged, or deferred with a reason and a date.**
2. **Every journey in Pass B completes in both languages**, and every identifier, date and deadline is consistent across the screens that show it.
3. **The prototypes and the build agree**, and the divergence list holds only deliberate improvements.
4. **The verify chain is green** and no test passes vacuously.

Add one thing that is not a pass but is the real test: **give it to someone who has never seen it, with no explanation, and ask them to file an event.** Watch where they stop. That is the only way to find out whether an obligation is legible, and it cannot be automated.

---

## What is still outside the build

Not defects — decisions nobody has taken yet. Each needs an owner before launch, and none of them is Claude Code's to decide.

- **Where the database lives.** `node:sqlite` is the review store. Postgres, and where it physically sits, wait on a Ministry data-residency answer.
- **Real credentials.** The form and the hashing exist; the policy — SSO, email verification, complexity — does not.
- **Email delivery.** Nomination tokens, notifications and reset links all assume a mail path that has not been chosen.
- **The eight English/Arabic divergences** in `source-documents/README.md`, including the Arabic compliance form omitting the insurance declaration entirely.
- **The Annex A Part D disagreement** — nine conditions in each issue, a different nine. The build carries the union, which is a reconciliation somebody made and the Ministry has not ratified.
- **The facility reference scheme.** No document defines one. Record identifier only.
- **The 90-day and 60-day cycles**, provisional in the data and never in the policy.
- **The platform owner's reach** — "counts only" in my summary, "full tenant visibility" in the product specification. A privacy question, and the surface is already built.
- **The commercial capability flags** the product specification requires and the summaries forbid rendering.

Put these on one page with a name against each. It is a shorter conversation than it looks, and every one of them gets more expensive the later it is asked.
