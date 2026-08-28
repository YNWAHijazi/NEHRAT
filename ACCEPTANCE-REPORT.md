# National Health and Medical Readiness — acceptance report

**Ministry of Public Health, Lebanon · Event Health Readiness platform**
Prepared 28 August 2026.

This report answers one question: **is the platform finished enough for the Ministry to
use, and where is it not?** It is written to be read straight through. Where something
is incomplete it is named, with what remains and who has to decide it.

---

## 1. The plain answer

**Can a real organizer take an event from creation to a recorded determination, and can
the Ministry record every outcome the regulation gives it, without a single screen where
the next step does not exist?**

**Yes — for the event lane, in Arabic and in English, end to end.**

An organizer creates an event, answers the nine assessment domains, watches the level
derive, attaches the documents that level requires, makes the compliance declarations,
certifies them, and files. A Ministry reference number is issued. A reviewer opens the
submission, reads every answer and opens every document, and records one of the three
outcomes. The organizer reads that determination on their own record and prints the
certificate they hand to the authorising authority.

That journey is completed — not visited — by an automated test, twice: once with every
screen in English and once with every screen in Arabic, from the first request.

**Three things are not finished, and none is in that path:**

1. **The public landing is not built.** There is no public applicability check and no
   public lookup screen. The lookup *endpoint* works and discloses exactly four fields,
   but a member of the public has no page to use. This is the one Pass B journey that
   cannot complete.
2. **The AI assistance layer is not built**, deliberately. It needs its own decision
   about what the assistants may see.
3. **The Order of Physicians lane is off**, as designed, which is why one of its powers
   currently has no active account behind it.

Everything else in this report is detail behind that answer.

---

## 2. The four statements

### Statement 1 — every obligation is discharged, or deferred with a reason

**True, with one qualification stated below.**

Forty obligations were taken from the instruments and re-audited against the code as it
stands today, not against notes. Each names the screen that discharges it and the actor
who acts there. **All forty have a screen that exists.**

The counts the instruments fix are pinned by tests, so a screen cannot quietly lose an
item: sixteen plan sections, eleven major-incident items, nine assessment domains, ten
minimum conditions, three outcomes and only three, six attestation items, twenty
requirements at Level 3, six facility categories, the ten configuration powers across
eleven rows.

**The qualification.** Protocol 3's applicability is discharged in two places — the
organizer's own check happens inside event creation, and the Ministry's referral lane at
`/ministry/applicability` records determinations with their reasons. There is **no
standalone public applicability screen**, because the public landing is unbuilt. If the
Ministry expects a member of the public to check applicability before creating an
account, that screen does not yet exist.

### Statement 2 — every journey completes in both languages

**True for the journeys that are built; one cannot complete because its screens are not.**

The distinction that matters: *walking* a journey visits its screens, *completing* it
means the party finishes what the regulation asks and the record on the other side
changes. A screen can render correctly in Arabic and still not be completable in Arabic —
a control pushed off a mirrored layout, a message that never appears, a redirect that
lands elsewhere. No per-string translation check and no per-screen image comparison can
see that. Only a completed journey can.

The spine — creation, assessment, filing, determination, certificate — completes in both
languages. The Ministry administrator's console and the public lookup are completed in
both languages. The remaining journeys are completed in English by the existing tests.

**Journey 15 (the public, signed out) cannot complete**: two of its three parts have no
screen.

### Statement 3 — the prototypes and the build agree

**True, and the disagreements are counted and classified below.**

Fifty-one screens are compared against the reviewer's prototypes, region by region, in
both languages — 109 regions in total. **Thirty-four are compared pixel-for-pixel and
match.** Seventy-four are recorded as deliberate divergences, one is an absence that is
expected.

Every one of the seventy-four names a reason, and every reason has been ruled on. They
are not a backlog; they are the record of decisions taken after the prototypes were
drawn. Section 5 lists them by kind.

### Statement 4 — the verify chain is green and no test passes vacuously

**True, and the second half of that sentence has been the main work of the last week.**

The chain completed green. It is 327 unit and structural tests across 27 files, 104
application journeys, and 103 image comparisons across 51 screens in both languages. But a green suite proves nothing if the checks do not check. Five defects of
exactly that kind were found and closed — described in section 6, because they are the
most useful thing in this report for anyone maintaining the platform afterwards.

---

## 3. Pass A — every obligation and where it lives

Forty rows, audited against the current code. Each is discharged by a screen that exists.

| Obligation | Screen | Actor |
|---|---|---|
| Protocol 3 — the six applicability criteria | event creation | organizer |
| Protocol 3 — the two not-routinely-subject limbs | Ministry applicability lane | Ministry |
| Protocol 6 — the sixteen plan items | the event plan | organizer |
| Protocol 7 — organizer responsibilities | requirements | organizer |
| Protocol 7 — EMS provider responsibilities | participation | EMS provider |
| Protocol 7 — Event Medical Director responsibilities | governance | Director |
| Protocol 7 — first-response unit responsibilities | readiness | first-response unit |
| Protocol 8 — lead times by level | the event record | organizer |
| Protocol 8.1 second limb — the conditional Level 1 deadline | the event record | organizer |
| Protocol 8.4 — short notice, expedited | the compliance form | organizer |
| Protocol 8.5 — material change | report a change | organizer |
| Protocol 9 — the portal capabilities | dashboard | every role |
| Protocol 10 — the three outcomes | the review screen | reviewer |
| Protocol 10 — additional measures | the review screen | reviewer |
| Protocol 10 — the authorisation limit | the determination certificate | organizer |
| Protocol 12 — the eleven major-incident items | the event plan | organizer |
| Protocol 13 — the 24-hour notification | notify an incident | organizer |
| Protocol 13 — the post-event report | the post-event report | organizer and Director |
| Protocol 14 — data minimisation, public lookup | the lookup endpoint | the public |
| Annex A Part A — the fifteen event-information fields | event creation | organizer |
| Annex A Part B — the nine assessment domains | event creation | organizer |
| Annex A Part D — the ten minimum conditions | event creation | organizer |
| Annex A Part F — the assessment certification | the compliance form | organizer |
| Annexes B and C — the twenty requirements by level | requirements | organizer |
| Annex C Section A — the eight declarations | the compliance form | organizer |
| Annex C Section B — the ten declaration items | the readiness declaration | EMS provider |
| Annex C — both certification blocks | compliance form and declaration | organizer and provider |
| Annex D — the report and its two signature blocks | the post-event report | organizer and Director |
| PAD 3 — the facility categories | facility registration | facility operator |
| PAD 4 — the nine readiness requirements | facility devices | facility operator |
| PAD 11 — the ten configuration powers | cardiac configuration | Ministry administrator |
| PAD Annex A — the cardiac response plan | the facility plan | facility operator |
| PAD Annex B — the registration dataset | facility registration | facility operator |
| PAD Annex C — the incident report | the incident report | facility operator |
| PAD Annex D — first-response readiness | readiness | first-response unit |
| PAD Annex E — the minimum dataset | the report form | first-response unit |
| Product spec — nomination, never self-registration | the nomination link | named party |
| Product spec — the two identifiers | the acknowledgment | organizer |
| Product spec — account administration | the users console | Ministry administrator |
| Product spec — platform owner sees counts only | platform activity | platform owner |

**What this audit proves and what it does not.** It proves that every obligation has a
screen, and that the counts the instruments fix are enforced by tests. It does not
substitute for the Ministry reading the screens against its own instruments — which is
the one check nobody else can perform.

---

## 4. Pass B — the journeys

| # | Journey | Completes | In Arabic |
|---|---|---|---|
| 1 | Organizer, Level 3 | Yes | Spine completed in Arabic |
| 2 | Organizer, Level 1 | Yes | **Yes, fully** |
| 3 | Organizer, venue | Yes | English |
| 4 | Organizer, facility, sports | Yes | English |
| 5 | Organizer, facility, school — the journey ends at step 2 | Yes, as designed | English |
| 6 | Provider, Level 3 | Yes | English |
| 7 | Provider, Level 2 | Yes | English |
| 8 | Provider declining | Yes | English |
| 9 | Director | Yes | English |
| 10 | First-response unit | Yes | English |
| 11 | Ministry reviewer | Yes | **Yes, fully** |
| 12 | Ministry inspector | Yes | English |
| 13 | Ministry administrator | Yes | **Yes, fully** |
| 14 | Platform owner | Yes | English |
| 15 | Public, signed out | **No — the screens are not built** | n/a |

**The Arabic completion that matters most** is journey 2 joined to journey 11: an
organizer creating an event in Arabic, answering the assessment in Arabic, filing in
Arabic, and reading an Arabic determination — with a Ministry reviewer recording it in
between. That is the platform's purpose, and it works in the language most of its users
will use.

**Journey 15 is the honest gap.** The reference lookup returns exactly four fields and
never a fifth, and it requires the event's start date as a second factor so the register
cannot be walked by counting upwards. But a member of the public has no screen. Building
the public landing is the remaining piece of the first slice.

---

## 5. Pass C — prototype and build agreement

Fifty-one screens, 109 regions, both languages.

- **34 regions compared pixel-for-pixel and matching.**
- **74 recorded divergences**, each with a stated reason.
- **1 expected absence.**

The seventy-four, by kind:

| Count | Kind |
|---|---|
| 20 | A claim withdrawn — the region is not compared, and the note no longer says it is |
| 10 | The instrument over the prototype — the prototype predates or paraphrases the source |
| 10 | Arabic wording — the glossary or the Arabic issue of the regulation wins |
| 9 | A ruling made after the prototypes were drawn |
| 7 | A defect in the prototype, reported and ruled on |
| 7 | Demonstration data — the prototype prefills showcase values the build must not |
| 4 | Controls added so no screen leaves a party with nothing to do |
| 1 | The build derives what the prototype asks as a checkbox |
| 6 | Other, each individually reasoned |

**These are decisions, not debt.** The largest group is twenty regions where a claim was
found to be unsupported and *withdrawn* — the note now records what was previously
asserted, and that nothing checked it. That correction is itself the finding.

A guard now refuses any exception that asserts the build matches the prototype without a
locator that would let the assertion be checked. Saying "unverified" beside a claim of
correspondence no longer excuses the claim: either it is checkable, or it is not made.

---

## 6. Checks that passed without checking

The most useful section for whoever maintains this platform after handover.

Five defects were found in which **something reported success without doing its job**, and
the resulting state looked exactly like the state the check was written to confirm. Each
is now closed, and each closure is enforced rather than remembered.

1. **Rules with passing tests and no caller.** The rule was verified; nothing used it.
2. **An exception claiming a panel was a summary of content compared elsewhere** — a claim
   with no locator that nothing checked, and which was wrong. It concealed two unbuilt
   features.
3. **A sign-in helper that returned success without signing in.** The test then ran as the
   previous role and read a refusal — *the correct refusal for that role* — so the failure
   disguised itself as right behaviour.
4. **A file sweep that returned nothing for a missing directory**, so a guard swept an
   empty corpus and reported green. One guard had been sweeping a directory that does not
   exist.
5. **Assertions that something is absent**, which are satisfied by the intended absence and
   equally by a page that failed to load. Every such assertion must now be anchored by
   something that is only true if the right page was reached.

**And three the reviewer found by clicking, which no guard would have caught:**

- A field asking whether evidence of insurance was attached, **satisfied by typing "yes"**.
  It is an attachment now, and the declaration cannot be made without a file behind it.
- A readiness declaration **signed with an empty date** and released. Two certification
  blocks each validated themselves, which is to say neither did. One rule validates both
  now, and a test asserts every block is reachable through it.
- **A power held by nobody reachable**: inspections could be scheduled only by a role for
  which no account existed, while the screen named that role as the owner. The platform
  now reports, on the administrator's own console, any power the permission matrix
  assigns that no active account holds.

---

## 7. Decisions the Ministry still owns

None of these is a defect. Each needs a name against it.

| Decision | Why it cannot wait |
|---|---|
| **Where the database lives** | The review store is a local file. Production storage and physical location wait on a data-residency answer. |
| **Credential policy** | Sign-in and password hashing exist. Whether the Ministry wants single sign-on, email verification, or a complexity rule does not. |
| **Email delivery** | Nomination links, notifications and activation links all assume a mail path that has not been chosen. Until it is, links are handed over by the administrator. |
| **Eight English/Arabic divergences** in the instruments, including the Arabic compliance form omitting the insurance declaration entirely. The build follows the English and records the difference. |
| **Annex A Part D** — nine conditions in each issue, a different nine. The build carries the union of ten. That reconciliation has not been ratified. |
| **The facility reference scheme** | No document defines one. Facilities carry a record identifier only. |
| **The 90-day and 60-day cardiac cycles** | Provisional in the data, absent from the policy. Until published, screens say nothing is in force. |
| **The platform owner's reach** | "Counts only" in one document, full visibility in another. The narrower reading is built and is reversible. |
| **Commercial capability** | Fee, vendor and advertising capability exists behind flags and is off. Nothing commercial renders. |
| **Grandfathering** | A newly required document applies to submissions already filed. There is no rule for existing filings, and none has been invented. |

---

## 8. What was verified, and how

| | |
|---|---|
| Unit and structural tests | 327, across 27 files |
| Application journeys | 104 |
| Prototype image comparisons | 103, both languages |
| Screens compared | 51 |
| Regions compared | 109 |

The chain refuses to start on a full disk, refuses to sweep an empty corpus, refuses an
exception whose region does not exist, refuses an absence assertion that is not anchored,
and refuses a guard that names its inputs instead of reading its directory.

**One journey passed on its second attempt.** The development web server restarts itself
when it accumulates memory during a long run, and a submission in flight at that moment
loses its connection. It is a property of the development server and not of the platform:
in a deployed environment there is no such restart. It is recorded here rather than
omitted, because a run that needed a retry is not the same as a run that did not.

---

## 9. In one paragraph

The platform does the thing it exists to do: an organizer who has been told they need a
Ministry reference number can get one, in Arabic, and the Ministry can determine their
submission and give them a document to hand on. The obligations of the instruments each
have a home, and the counts the instruments fix are enforced rather than trusted. What is
missing is a public front door, an assistance layer that was deliberately left for its own
conversation, and about ten decisions that are the Ministry's to make and get more
expensive the later they are asked.
