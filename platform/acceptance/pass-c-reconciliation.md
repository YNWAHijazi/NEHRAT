# Pass C — Design reconciliation

Every recorded divergence between the prototypes and the build, with a ruling on each:
**fix the prototype** (the exception should die and the pixel compare switch on) or
**accepted build improvement** (the divergence is the intent, and the manifest note is its
permanent record). No prototype was edited — this is the list you asked to see first.

Sources: the visual manifest's masks and notes (the divergence register the build has kept
since Slice 1), the data files' `$comment`/`prototypeAr`/`divergence` flags, the drift
test, the source-documents README, and this session's finds. Compiled at commit `894902b`.

One bookkeeping note first: the build cites **divergence 9** (the Annex B rows 16/17
ordering) against `source-documents/README.md`, but the README on disk still lists eight —
the recorded edit has not landed in the copy in this repository. Worth landing before the
Ministry reads either document.

---

## A. Fix in the prototype — each unlocks comparisons that are exceptions today

Ordered by how much of the manifest each one converts from *expectedDivergent* to *compare*.

| # | Prototype defect | Where | What fixing it unlocks |
|---|---|---|---|
| P1 | The outcome card's limit-sentence Arabic reads **الجاهزية الصحية** where the glossary requires **التأهب** | Ministry Review — Submission review | The `outcome-limits` region drops its EN-only restriction and pixel-compares in both languages. (Yours, as you said — string-pinned by e2e until then.) |
| P2 | **The console showcase invents a parallel dataset** — six queue events, four facilities, five arrest places, its own reviewers — that ROADMAP's demonstration table does not seed | Ministry Review, every screen | The single biggest conversion: **seventeen** mapping entries carry this one note. Redraw the console against the seeded records (the three filed events, one submission mid-review, one pending organization, FC-0014, the arrest pattern) and the console compares become meaningful region-by-region instead of a list of exceptions. |
| P3 | **Cardiac configuration carries the earlier seven rows**; the source has ten powers, each with unset / set-and-publish / effective date | Ministry Review — Cardiac-arrest configuration | The `powers` region flips to compare — the panel you wanted a pixel diff on. Depends on P2's dataset for the row values. |
| P4 | **The prototype's Arabic that decision 3 superseded** — assessment strings, requirement row names, the plan form's eight steps, the incident no-name instruction, the dataset route sentence, the ten declaration items ("EMS provider" for the form's "EMS agency") | Organizer Journey, Facility, EMS, FR files | Re-issue the prototype's Arabic from the Arabic issues and five regions go bilingual-compare: `g3` (EN-only today), `facility-plan/procedure`, `facility-incident/no-name`, `fr-dataset/routes`, `ems-declaration/items`. The `prototypeAr` fields in the build's data record exactly what to replace, row by row — including 16/17, where your pairing was right and only the wording differs slightly from the issue (والإصابات vs وحوادث الإصابات). |
| P5 | **Seven minimum conditions drawn as manual checkboxes** with the prototype's demo scores | Organizer Journey + Venue — classification panels | Redraw as derived, read-only rows with the two issue tags (club: EN-only; recur: AR-only) and the classification panels compare. The drift test already pins the data; only the drawing lags the ruling. |
| P6 | **The venue floor still inherits automatically** in the prototype | Venue file | The reversed decision lands in the drawing; the floor-note region's exception becomes a plain compare. |
| P7 | **No provisional-status note on the facility side** — Current/Lapsing/Lapsed render unmarked | Facility file | The `provisional-note` region compares instead of being build-only. |
| P8 | **Fixture contradictions inside one file**: the facility header reads "Corniche Sports Club" against its own dashboard's "Beirut Sports Complex · FC-0014" (twice — readiness header and plan profile rows); the Director file's report says attendance 4,180 and organizer-signed 2026-08-14 while the Organizer Journey says 11,400 and saved-unsigned; the venue rail's stage dates disagree with the same file's organization record and history list; the event rail's stage 2 date disagrees with its own history list | Facility, Director, Venue, Organizer files | Four regions stop carrying "the reference disagrees with itself" notes; the record-header and rail compares tighten. |
| P9 | **The doubled words**: "completes the the risk assessment assessment" — both languages, an artifact of substituting the instrument name out | Venue registration intro | `applicability-intro` flips to compare. (The build's submit-page copy has the same substitution scar in English — two mid-sentence lowercase "the"s — being fixed on the build side; the prototype's doubling is yours.) |
| P10 | **The organizer-dashboard pending-organization banner and header line** belong to `test_organizer_pending`, not the showcase account (your decision 6) | Organizer Journey — Dashboard | The two `referenceMask` entries — the only masks in the whole manifest — are deleted and the dashboard compares unmasked. |
| P11 | **Annex D predates the source**: five short labels where the annex has seven activity fields and eight significant-event entries | Organizer Journey — post-event | The `counts` region compares. |
| P12 | **The Order lane drawn active** with three showcase verifications | Director file | The off-state is the ruled default; `lane-off` compares. |
| P13 | **Invented fields the policy forbids**: Sex and Presumed-cause on the FR dataset; oxygen/airway rows on the BLS lists; the dramatised paraphrase of the six procedure steps | FR file | Three regions compare against the policy's own items. |
| P14 | **The incident form's pre-source controls**: plain Yes/No pills (source: Yes/No/Unknown), free-text EMS fields (source: enumerated transport options), five check rows with corrective-as-checkbox (source: four rows + free text), and no submitted-by block | Facility file | Four regions compare. |
| P15 | **Section five drawn read-only** — the plan confirmation has no way to be recorded, though the source makes it the act that restarts the annual clock | Facility plan | `plan-confirmation` compares. |
| P16 | **The venue declaration prefilled, with a hand-entered Date** beside the derived effective date | Venue assessment | The flagged-for-review input class resolves; `declaration` compares. |
| P17 | Small copy: the Director governance briefing date written "18 September" (deadlines as dates is the copy rule); the ems-profile note "opens in a later phase" (the first-response service is now its own sign-in) | Director, EMS files | Two known-residual notes retire. |

**Sequencing note:** P2 → P3 → P1 is the high-value chain for the Ministry console; P4 + P5
together re-issue the Arabic and the derived conditions in one pass over the Organizer
Journey and Venue files. P8–P17 are independent one-file fixes.

## B. Accepted build improvements — the divergence is the intent; do not fix the prototype

Each stays recorded in the manifest as the permanent explanation of a deliberate difference.

- **The derivation panel** on the event record (both results and which governed) — your
  instruction; the prototype record carries none.
- **Gated controls with reasons** — material change and post-event on the record (SPEC 5b);
  the prototype leaves one ungated and omits the other.
- **The invitation inside the requirement** (ROADMAP 5c) vs the prototype's already-named rows.
- **Empty starts everywhere** (non-negotiable 8): registration, device, incident, ops-detail
  and compliance forms open blank where the prototype prefilled showcase values.
- **Bilingual input pairs** for names/addresses (your Slice 3 ruling, applied forward).
- **The nightclub question** on venue registration, tagged EN-only — required for the
  English issue's condition to derive at all (non-negotiable 0).
- **The permission matrix** on Users and roles — absent from the reference, added so the
  console shows what the server refuses.
- **The floor note** on the venue record (your handoff 5 approval).
- **Record ID lines**, **working attach forms**, **derived cell values** where the
  prototype hand-wrote them ("Under Ministry review", install dates the record doesn't hold).
- **The scan panel absent** — AI device-identifier capture is a flagged capability, ships
  off (capability is not content).
- **Protocol 7's fuller responsibility list** including patient care (README divergence 7),
  and **Annex C's own header rule for Level 1** (divergence 8).
- **The build's outcome card** no longer diverges at all — its copy and geometry were
  aligned to the prototype this session; the only Ministry-side compare exception left on
  that card is P1's Arabic and P2's dataset.

## C. The five reversals ACCEPTANCE lists, mapped

| ACCEPTANCE item | Status |
|---|---|
| The venue floor no longer inherits; the prototype still shows it | **P6** — prototype fix |
| The seven non-derivable conditions are checkboxes in the prototype | **P5** — prototype fix |
| Facility status vocabulary provisional, unmarked in the prototype | **P7** — prototype fix |
| الجاهزية / التأهب on the event side — the platform band uses the wrong one | **Both sides**: the prototype's masthead (and the build's, copied from it) reads الجاهزية الصحية للفعاليات on every screen — Pass B's most-flagged Arabic finding. The word in the band is the naming decision itself: rule التأهب (or a name that avoids the pair), then fix prototype and build together. |
| The Arabic NEHRAT strings are a translation in the prototype, the issue's wording in the build | **P4** — prototype re-issue |

## D. After the prototype pass

Re-run the extraction (`npm run rules:regenerate` — the drift test's SHA pins will fail on
the edited prototypes and say exactly this), review the diff in `lib/rules/data/` — a
changed domain or condition is a regulatory change, not a refactor — then flip the
converted regions from *expectedDivergent* to *compare* in the manifest and drop the
`langs: ['en']` restriction on `outcome-limits`. When that lands, the comparison is
meaningful again: the remaining divergence list is section B, which is the record of
intent, not of exceptions.

---

## Addendum, 2026-08-26 — the retirement attempt, and what it found

The reviewer asked for these exceptions to be retired against the Pass C prototypes: the console
dataset across all thirteen arrays, the ten cardiac powers, the التأهب limit sentences, the two
dashboard masks, the facility identity, both rails' dates, the doubled words, the Order lane's off
state, the forbidden dataset fields, the tri-state answers, the recordable plan confirmation, the
venue declaration date, and P6/P7 on inspection. The expectation was that the list would "shrink to
almost nothing." It did not, and the reason is worth more than the outcome.

**1. Twenty-one of the exceptions were never comparisons.** `expectedDivergent` regions carry a
`builtSelector` and no `reference` strategy — there was never a reference-side locator to diff
against. Flipping all twenty-one console regions to `compare` produced thirty-four failures, every
one of them `could not locate the region in the reference DOM`. **Not a single pixel was compared.**
Retiring one of these is not a flag flip: it means authoring the reference locator that the
exception let us skip. That is the honest cost, and it was hidden by the exception's own shape.

**2. Where the comparison was authored by hand, the sides are structurally different.** Taking the
largest — the review queue — the prototype table is **eight** columns (Event or venue, Organizer,
Level, Event date, Filing date, Status, Reviewer, Days) against the build's **six** (Submission,
Level, Event date, Filed, State, Reviewer). Organizer and Days are absent; three headings are
renamed. Under the pixel-fidelity rule that is a **build defect**, not a dataset difference — and it
was sitting behind an exception whose note said "geometry, vocabulary and gating follow the
reference". **That same sentence appears verbatim on all twenty-one console exceptions.** One of
the twenty-one is now known to be false; the other twenty are unverified, because verifying one
costs a hand-authored locator. The queue's note has been corrected in the manifest. *This is the
most serious thing in the addendum: an exception that overstates its own narrowness hides whatever
else diverges inside the region it excuses.*

**3. Three of the named retirements are still blocked by the prototypes, with evidence.**

- *The console dataset.* Three of the four queue events now match the seeded records
  (Baalbeck Summer Festival, Beirut Coastal 12K, Tripoli Marathon). The fourth does not: the
  prototype carries **Saida Night Run**, the build seeds **AUB Sports Day / EV-0301**.
- *The ten cardiac powers.* `ministry.json` renders the source's ten (PAD §11). The prototype
  carries eleven — designations split into three, one belonging to §3's facility categories, and
  the arrest-location review dropped. The source outranks the prototype, so the build stands.
- *The facility identity.* The prototype files still disagree with **each other**:
  `Facility Cardiac Readiness.dc.html` says *Corniche Sports Club* (×4), while
  `Ministry Review.dc.html` and `Organizer Journey.dc.html` say *Beirut Sports Complex / FC-0014*.
  The new `Organizer Journey white.dc.html` carries **both**. No build change can reconcile that.

**4. What did retire** (in `5212d2c`): the two dashboard masks, the outcome-limits language
restriction — and the build **adopted** the prototype's Arabic for both limit sentences, the
Protocol having no Arabic issue. The doubled words are fixed in the prototype. P6 and P7 are
retired on inspection: neither was ever in the prototypes.

**Standing count: 68 exceptions against 38 comparisons.** The number to watch is not the exception
count but the *comparison* count, which is what actually holds the build to the drawings.

---

## Addendum 2, 2026-08-26 — the queue rebuilt, and the guards swept

**The queue is fixed.** Eight columns and the reference's headings — Event or venue,
Organizer, Level, Event date, Filing date, Status, Reviewer, Days — where the build had six,
with Organizer folded into the first cell as a sub-line, Days dropped, and Submission / Filed /
State standing in for the reference's wording. Neither missing column lacked data behind it:
**Days** derives from the filing date to today on the Beirut clock, and **Filing date** now
carries the reference's Met / Filed late chip, derived from the level's lead time rather than
stored.

**The exception can no longer certify itself.** `tests/visual-exceptions.test.ts`: an
`expectedDivergent` region that makes a claim about fidelity — that geometry, layout,
vocabulary or gating follows the reference — must carry a reference-side locator, or say
UNVERIFIED and drop the claim. Turning it on caught **29** regions. Twenty carried the
identical propagated sentence; nine were individually worded. All 29 now say plainly what has
not been checked. Nothing was retired by flipping a flag.

**The demonstration set now matches the reference three rows out of four.** The fourth row is
Saida Night Run, not AUB Sports Day: a Level 2 filing that missed its lead time, carrying
"submission received but incomplete" — the set's only late filing and its only incomplete
determination, which is why the reference has it. Satisfied moved to Tripoli Marathon, where
the reference puts it.

Two things the seed could not reconcile, both reported rather than invented:

- **The reference's Saida row is internally inconsistent.** It shows the filing date as
  2026-08-15 *and* marks it "Filed late". Level 2 requires filing fourteen calendar days
  before, and 2026-08-29 less 14 days is exactly 2026-08-15 — that filing MEETS the deadline.
  Seeding 08-15 would derive "Met" beside two flags saying the opposite, so the seed carries
  08-16 and the chip derives honestly. *Move the prototype's date by one day and this note goes.*
- **The two prototype files disagree about Beirut Coastal 12K.** `Ministry Review` has it FILED
  and in progress with a reviewer; `Organizer Journey` has it at stage 3, requirements and
  attachments, with no reference number. The organizer file governs the organizer's own record,
  so EV-0418 stays unfiled — and the demonstration set therefore has **no filed-and-unreviewed
  submission**, so the console cannot demonstrate a grey internal state in the queue at all.
  That is worth a ruling: the Ministry walking the platform should be able to see one.

**The §11 powers, ruled against the source.** PAD §11 lists exactly ten, and the build renders
exactly those ten, one for one. Mapping the prototype's eleven onto them gives three findings:

1. **"Readiness check and lapse cycles" is not a §11 power.** Neither the power nor the 90/60
   figures appear anywhere in the policy — searching the source for "90", "60", "check cycle"
   and "lapse" returns nothing. The cadence is a platform construct for the device ledger. It
   is real and configurable and the ledger needs it; it is not one of the ten. Merge it under
   §11.5, *establish electronic registration and reporting procedures*, which is the power a
   check cadence would be established under — or keep it as a configurable value shown outside
   the powers table and labelled as such.
2. **§11.10 is missing from the prototype** — *request readiness confirmation and require
   corrective action where deficiencies are identified*. The build renders it; the eleven do not
   include it.
3. **§11.3 is split into two prototype rows** — remote/difficult-access and individual
   facilities — where the source is one power with two limbs. Defensible as a UI split; noted so
   the count reconciles.

### The guard sweep

Checked every guard for the hand-named-inputs pattern. Three more had it:

- ✔ **bilingual-parity** named five files out of twelve — the same blind spot as banned-terms,
  and a worse one, since parity is non-negotiable 4. It now reads the directory and pairs by key
  shape (`en`↔`ar`, `<name>En`↔`<name>Ar`). It found the plan's sixteen English-only section
  summaries — **and the prototype carries them English-only too**, its section arrays being
  `[titleEn, titleAr, bodyEn, bodyAr, summaryEn]` with no Arabic fifth element. Nothing renders
  them in the build, so they are dead data rather than a live parity break; they are on this list
  because the prototype needs the Arabic before either side can render them.
- ✔ **no-hardcoded-values** swept app and components only. Extended to `lib` (exempting
  `lib/rules/`, which IS the source). It caught two real bypasses: `lib/queries.ts` hard-coded
  the post-event stage number 6 instead of `POST_EVENT_STAGE`, and `lib/password.ts` imported
  `auth-policy.json` straight from disk — precisely the bypass its "ask the rules module" check
  exists to catch, in a directory that check never looked at. The policy is now `AUTH_POLICY`,
  exported and read through the module. The same widening also exposed a flaw in the check
  itself: it matched the path anywhere in the file, so a docstring *naming* the path counted as a
  violation. It matches the import now.
- ✔ **rules-wiring** already read the directory, but an aliased import (`AUTH_POLICY as
  authPolicy`) hid a real use from it, since it discounts import lines. The alias is gone. Worth
  knowing: this guard cannot see a rule used only under an alias.
- **feature-flags** names app and components. Left as is, deliberately: its question is "does a
  SCREEN consult a flag", and `lib` holds no screens. Recorded so the decision is visible rather
  than an oversight.

### On the pack

The prototypes on disk are still the 2026-08-25 23:02 set. The white variant still carries both
facility identities, and `Facility Cardiac Readiness.dc.html` is still present with four
"Corniche Sports Club" strings. The two retirements described as unblocked cannot be verified
until the new pack lands; `lib/handoff-pack.ts` is the one line that points at it.
