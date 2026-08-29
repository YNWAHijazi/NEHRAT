# National Health and Medical Readiness — acceptance report

**Ministry of Public Health, Lebanon · Event Health Readiness platform**
Version 1.0 · 29 August 2026 · describes build `6d81562`.

Every figure below is a statement about that build. Cite the version and the build
together, or the figures mean nothing.

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

**All fifteen Pass B journeys now complete.** The public landing was the last gap and
has been built: an overview, three service detail screens, a branching applicability
check and a lookup screen, all signed out and touching no account.

**Slice 0 is complete**, including the search screen: the overview, three service detail
screens, the branching applicability check, search, the lookup, and a Ministry contact
screen that names who answers rather than offering a form to nowhere.

**Two things remain deliberately unbuilt, and neither is in that path.** Both are now
recorded as decisions in `lib/rules/deferred.ts` and rendered on the administrator's
Configuration tab, so an absent capability cannot be mistaken for a forgotten one:

1. **The assistance layer.** The product specification describes it; the regulation does
   not require it, and nothing in a Ministry review depends on one — every determination
   is reached by a person reading a record. Building it means deciding what an assistant
   may see, which is a data-protection question and deserves its own conversation.
2. **Commercial capability.** It exists behind switches and is off. Nothing commercial
   renders anywhere.

Everything else in this report is detail behind that answer.

---

## 2. The four statements

### Statement 1 — every obligation is discharged, or deferred with a reason

**True.**

Thirty-seven clauses were taken from the two instruments and their annexes and re-audited
against the code as it stands today, not against notes. Each names the screen that
discharges it and the actor who acts there.

**Thirty-five are discharged. Two are partly discharged. None is absent.**

Both partial clauses are the same shape — a power the instrument gives the Ministry rather
than an obligation it places on anyone, with the missing limb being a publishing surface
nobody has specified. Protocol §9 lists nine portal capabilities and eight are built; the
ninth, national surveillance and quality-improvement reporting, has no screen. Protocol
§14 says the Ministry *may* publish aggregated national findings; nothing prevents it and
nothing yet performs it. Neither blocks a filing, a review or a determination.

The counts the instruments fix are pinned by tests, so a screen cannot quietly lose an
item: sixteen plan sections, eleven major-incident items, nine assessment domains, ten
minimum conditions, three outcomes and only three, six attestation items, twenty
requirements at Level 3, six facility categories, the ten configuration powers across
eleven rows.

Protocol 3's applicability is now discharged in three places: the public check at
`/applicability`, which anyone can use without an account; the organizer's own check
inside event creation; and the Ministry's referral lane, which records determinations
with their reasons.

### Statement 2 — every journey completes in both languages

**True. All fifteen complete.**

The distinction that matters: *walking* a journey visits its screens, *completing* it
means the party finishes what the regulation asks and the record on the other side
changes. A screen can render correctly in Arabic and still not be completable in Arabic —
a control pushed off a mirrored layout, a message that never appears, a redirect that
lands elsewhere. No per-string translation check and no per-screen image comparison can
see that. Only a completed journey can.

The spine — creation, assessment, filing, determination, certificate — completes in both
languages. So do the public journey in all three of its branches, the platform owner's,
and the Ministry administrator's. The remaining journeys are completed in English by the
existing tests.

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

The chain completed green. It is 337 unit and structural tests across 30 files, 121
application journeys, and 103 image comparisons across 51 screens in both languages. But a green suite proves nothing if the checks do not check. Five defects of
exactly that kind were found and closed — described in section 6, because they are the
most useful thing in this report for anyone maintaining the platform afterwards.

---

## 3. Pass A — every obligation and where it lives

Thirty-seven clauses, audited against the current code. Two are marked partial above; the rest are discharged.

| Obligation | Screen | Actor |
|---|---|---|
| Protocol 3 — the six applicability criteria | the public applicability check, and event creation | anyone, and the organizer |
| Protocol 3 — the two not-routinely-subject limbs | the public applicability check, event branch | anyone |
| Protocol 3 — referral and designation | Ministry applicability lane | Ministry |
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
| Protocol 14 — data minimisation, public lookup | the lookup screen and endpoint | the public |
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
| 14 | Platform owner | Yes | **Yes, fully** |
| 15 | Public, signed out | **Yes** | **Yes, fully** |

**The Arabic completion that matters most** is journey 2 joined to journey 11: an
organizer creating an event in Arabic, answering the assessment in Arabic, filing in
Arabic, and reading an Arabic determination — with a Ministry reviewer recording it in
between. That is the platform's purpose, and it works in the language most of its users
will use.

**Journey 15 was the honest gap and is now closed.** The public landing was built: an
overview, three service detail screens, a branching applicability check and a lookup
screen. The check never returns a bare yes or no for a facility — it returns the
applicable rule and its basis under a state chip, and where the Ministry has not set a
value it *names the missing value* and says that this is the answer rather than a gap in
one. That is the live state for schools and will be for some time.

The lookup asks for the event's start date as well as the reference, so the register
cannot be read by counting upwards, and it returns four fields and never a fifth.

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

**And a sixth, which only paper could show.** The determination certificate — the
document handed to the authorising authority — would have printed a **blank page**. The
print rule made everything invisible and then named what came back, and the certificate
was not on that list. Nothing on screen showed it: the page rendered correctly and the
button worked. Every printable document is now tested under print media, and a route that
offers a print without something to print fails the build.

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

### The closing example: the guard that passed without checking

Everything above was found by a guard, or by a person clicking. This one was found by the
defect happening *to the guard built to catch it*, and it is the most instructive failure
in the build.

`tests/rules-wiring.test.ts` exists for exactly one purpose: to fail when a rule in
`lib/rules` has no production caller. It was the first member of this family ever found,
and it has caught several since.

A new export named `DEFERRED` was added — the record of what is deliberately not built.
Nothing called it. **The guard passed.**

It passed because it matches on plain text, and an unrelated file, `lib/rules/uploads.ts`,
carried the sentence *"THE DEFERRED DECISION IS TAKEN"* in a docstring. A comment in a
file with no connection to the rule satisfied the check that the rule was wired.

Three things make this worth recording rather than fixing quietly:

1. **The looseness was already written down.** The guard's own header said: *"It also
   matches on plain text, so a rule named in a comment counts as a use. Comments naming a
   rule you have just deleted will keep it looking wired."* It was recorded as a known
   limitation, in the guard's own words, and read by nobody as a live risk — because until
   an export name collided with English prose, it wasn't one.

2. **A documented limitation is not a mitigated one.** Writing a hole down does not close
   it. It converts the hole into something a reader is expected to remember, and the
   reader was me, and I did not.

3. **The failure was silent and correct-looking.** A passing wiring test is what a correctly
   wired rule looks like. There was no output to read, no state to inspect, nothing that
   distinguished this from success — which is the definition of the family and the reason
   it keeps recurring in different clothes.

Comment lines are skipped now: a rule named only in prose is documented, not wired. The
tightened guard flagged `DEFERRED` on the first run, which is how it came to be rendered
on the administrator's Configuration tab instead of sitting in a file nothing read.

What remains loose is recorded in the guard, again — a trailing comment on a line of real
code still counts, and an aliased import is still invisible. Both are narrower than what
they replace. **Both should be read as risks rather than as notes.**

### And the same failure again, in a different guard

The wiring guard is the sharper story. This one is the more useful, because the two
together say something neither says alone.

`scripts/disk-check.mjs` exists for exactly one purpose: to stop a run starting on a disk
too small to finish it. When the disk fills mid-run, Playwright reports `ENOSPC` as failed
assertions — which read exactly like visual regressions and navigation flakes, on screens
nobody has touched. The guard exists so nobody spends an afternoon debugging a full disk.

A run started with roughly 3 GB free. **The guard ran, measured, and passed.** The disk
filled anyway, and the run produced **forty-four failures across nine unrelated specs** —
precisely the misdiagnosis the guard was written to prevent.

Its logic was correct. Its threshold was measuring the wrong quantity.

The floor had been set from the size of the artifacts a run leaves behind: the build
directory, the images, the traces — about 350 MB. But watching free space *across* a run
shows an app-only pass consuming **2.9 GB**, and clearing every artifact afterwards
recovers only that same 350 MB. The other 2.5 GB is `next dev` rewriting chunks for twenty
minutes and rebuilding wholesale after each memory-watchdog restart: transient, reclaimed
by the operating system, and completely invisible to anyone measuring what is left at the
end.

**The guard was measuring the residue and calling it the appetite.**

Two things came out of correcting it. The floor is now per-run, because the reference
project writes three images per region per language and the app project writes traces only
on failure — one number refused app-only runs that would have finished comfortably, and a
guard that refuses work it did not need to refuse is a guard somebody eventually lowers.
And which project is running is read from `process.argv`, because `FullConfig.projects`
lists every *configured* project regardless of `--project`. That was found by probing after
the first attempt refused an app-only run, not by reading the type.

### What the two of them say together

The wiring guard was **defeated by an input it should have ignored** — a sentence in a
docstring in an unrelated file. The disk guard was **measuring a quantity unrelated to what
it claimed to measure** — the residue of a run instead of its appetite.

Neither was missing. Neither was wrong in its logic. Both ran, both passed, and both were
answering a different question from the one they were written for. That is the whole family
in two sentences.

The corrected disk guard then made the point a third time, on this report's own final
verification run. The run began with 5.8 GB free — comfortably over the measured floor — and
the guard passed. Two hours later the app project had spent it: free space fell to 1.4 GB,
`next dev` restarted twice under its memory watchdog, and every test in the back half of the
sequence slowed from seconds to minutes. Seven ended in navigation timeouts. Re-run alone
with headroom, the same forty-eight tests passed in under three minutes. Not one of those
seven failures used the word *disk*: they arrive as timeouts, and a timeout is read as a
defect in whatever screen happened to be under the cursor.

**And that third one generalises past disk.** Every precondition check has the same shape: it
establishes a fact at time zero, and everything after it assumes the fact still holds. Free
space, a free port, available memory, a seeded database, a pinned clock, a reachable service,
an unexpired credential — each is checked once at the door and then relied on for the whole
run, and each can stop being true while the run is still using it. When one does, the failure
surfaces wherever the work happened to be, wearing that screen's name. The next check to fail
this way will not be about disk, and it will not announce itself either. So a check worth
having says not only *is this true now* but *for how long, and what does it look like when it
stops* — and the run either re-checks it or reports it by name when it goes.

> **Ask of every check: what would have to be true for this to pass while the thing it
> protects is broken?** If that question has an easy answer, the check is not yet a check.
> And ask it a second time in the future tense: *what would have to become true, after this
> passes, for the run to proceed on a fact that is no longer so?*

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
| ~~Grandfathering~~ | **Decided, 29 August 2026.** A newly required document applies from its effective date forward. A submission already filed and determined stands. One filed and not yet determined is asked for the document through the ordinary revision route, never blocked silently. The effective date is a configured value, not the date the software shipped. |

---

## 8. What was verified, and how

| | |
|---|---|
| Unit and structural tests | 337, across 30 files |
| Application journeys | 121 |
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
