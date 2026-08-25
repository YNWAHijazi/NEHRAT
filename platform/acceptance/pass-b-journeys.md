# Pass B — Journeys

Fifteen journeys, each walked start to finish in one session, in English and then in Arabic,
against fresh databases under the pinned review clock (2026-08-13). Five walkers, isolated
servers, no source file modified. Walked at commit `c2dc701` — after the six showstopper
fixes, so what follows is what a Ministry reviewer would hit **today**.

Per journey: what broke · what surprised · what read wrongly in Arabic. The Arabic column
is the longest, as predicted. Findings that recur across journeys are pulled to the front
and classified; the per-journey record follows.

---

## The findings that matter most, ranked

### Showstopper class — a journey dead-ends or a non-negotiable is breached

**B-1. The nomination loop cannot be closed from the UI.** (J1, J6 — found independently
twice.) After the organizer invites a provider or nominates a Director, the invitation
link/token is surfaced **nowhere** — not on the requirements screen, not in a notification,
not on the record. The token exists in the database (unguessable, correctly generated) and
`/invitations/[token]` works, but with no email delivery in this build the organizer has no
way to hand the link over. Journeys 6–8 were only walkable by reading tokens out of SQLite.
*Bug: render the invitation link on the requirements screen against each pending nomination
(the organizer hands it over out-of-band until email delivery exists).*

**B-2. A declined provider blocks filing forever.** (J8.) `documentStateFor`'s
`emsDeclarations` fact counts **every** named provider (`providers.every(p => p.declaration
=== 'signed')`, lib/queries.ts:698) — a declined provider can never sign, and no
withdraw/remove/supersede control exists, so the Level 3 package becomes permanently
unfileable. This contradicts `lib/rules/submission.ts`, which deliberately gates on
*confirmed* providers only — a screen-side re-derivation disagreeing with the rules module,
the exact class the architecture forbids. Compounding it: the decline notification orders
the organizer to report a material change, but pre-filing the change route bounces to the
record (nothing on file to change) — an instruction that cannot be discharged, with only
the record's gate line as explanation. *Bug, two parts: the fact must follow the rules
module's confirmed-only gate, and a declined nomination needs closure (supersede/withdraw).*

**B-3. "Ali Hassan collapsed" passes the personal-name gate.** (J4.) The exact narrative
from the acceptance brief is accepted by both the client and the server check and stored.
`lib/rules/pii.ts` catches honorific+name, "patient Name Name", "named X" and the Arabic
equivalents — but not a bare capitalized two-word name. Non-negotiable 7 is breached in its
most ordinary shape. (When the gate does fire, copy and bilingual behaviour are right.)
*Bug: extend the detector; the failing narrative becomes the regression fixture.*

**B-4. The governance promise is false in five places.** (J9; Pass A predicted it, the walk
proved it.) The Director's governance screen promises on the intro, the where-this-appears
panel, two per-field notes, the save button ("Save — the organizer's plan reads this") and
the post-save banner that the text lands in the organizer's plan sections 10/12 and
requirement 15. Three marker strings later: the organizer's plan (both routes) and
requirements screen show none of it. *Bug: wire `governanceFor` into the plan screen
(read-only, non-overwritable, as promised) — or every one of those five strings is wrong.*

**B-5. The public lookup can never demonstrate, and would misreport a real event.** (J2,
J15.) Every event a demo account creates inherits `is_demo=1`, and demo references never
resolve — correct in isolation, but it means the reference on the acknowledgment the
organizer is told to hand to the authorizing authority is unverifiable for every account
that exists in this environment; the Ministry cannot walk the lookup. Worse, latent:
`findByReference` returns `level: row.demo_level ?? 1` — a real (non-demo) filed Level 3
event would be publicly reported as **Level 1**, because the lookup never reads the derived
level. (Status was unified to the recorded outcome earlier; level was not.) *Bug: derive
the level in the lookup; decision: whether one demo reference should resolve for
walkthrough purposes.*

**B-6. The reviewer records determinations against a bare level chip.** (J11; Pass A row
confirmed end-to-end.) The submission review screen shows no domain scores, no
minimum-conditions result, no "which governed", no submitted answers or documents — a
"Level 3" chip and a provider list. Non-negotiable 1 requires both results and which
governed to be reported. *Bug: render the derivation panel (the organizer's screens already
have the component's content) on the review screen.*

### Systemic — one cause, many sightings

**B-7. Two clocks.** (J3, J4, J6, J9, J10, J11, J13.) Every date **gate** computes on the
review clock (2026-08-13), but every **recorded** timestamp uses the real clock
(2026-08-25): determinations, signatures, registrations, notifications, ledger
affirmations. Sequences read backwards (registration 08-25 → assessment 08-13); a
determination is dated twelve days after "today" on the same screen; seeded notifications
are date-only while generated ones carry seconds. *Bug (one fix): route `datetime('now')`
writes through the review-clock override, and normalize timestamp granularity.*

**B-8. The dashboard and the record disagree about state.** (J1, J11.) Real (non-demo)
events have blank FILE BY tiles and no stage line — the tile reads `demo_due`/`demo_stage`,
NULL for real rows, while the record computes the true deadline. EV-0244 reads "Stage 6 of
6" on the dashboard and "Stage 2 of 6" on its own rail (dashboard takes the furthest stage,
the rail takes the first incomplete). The record's stage 3 says "0 outstanding" while
submit blocks on 3 items, and the "named agencies yet to answer" counter never counts the
Director and counts the declined as unanswered (J8). *Bug: derive the dashboard tile from
the same rules the record uses (the outcome chip already went through this unification —
the deadline, stage and counters need the same treatment).*

**B-9. Published values: effective dates ignored, no revise path, dues not computed.**
(J13.) Values published "effective 2026-10-01" govern the ledger immediately on 2026-08-13
— while the operator notification promises "the validity ledger uses it from that date".
Once published, a value shows no revise control, though power 1 is literally named "set and
revise". The corrective-action caption claims dues run 30 days from raise after
publication, yet a really-raised action shows no due date (the only visible due date is
seeded narrative text), and the pre-publication caption sits unchanged beside a published
chip. The publish notification never names which value or the figure. *Bugs, all four.*

**B-10. Dead `?notice` params.** (J5, J10.) Recording a school-category interest redirects
to `/dashboard?notice=interest` — the dashboard never reads it; no banner, no trace, and
the promised "notify us when it activates" has no visible record. The first-response report
submit redirects with `?notice=reported` — no banner either; the only evidence is a count
incrementing. *Bug: render the banners; surface recorded interests somewhere the operator
can see.*

**B-11. Shared invitation copy misleads two audiences.** (J6, J7.) The Director's
invitation reuses the EMS response copy — a physician is told accepting "opens the
declaration" and declining means the organizer "must name another provider"; no declaration
ever opens for a Director. A Level 2 provider's invitation makes the same promise; at Level
2 no declaration exists. The organizer-side chip claims "accepted and operational detail
supplied" on mere acceptance. *Bug: per-kind, per-level response copy.*

### Needs a ruling — building either way would guess

**B-12. The masthead: الجاهزية الصحية للفعاليات.** (Every walker flagged it.) The
platform's own name renders the cardiac term (الجاهزية) over the event-side instrument
(التأهب) on every screen, including the acknowledgment — the most formal document in the
journey. The English name is "Event Health Readiness", so the Arabic may be a deliberate
brand line — but SPEC §2b's split says otherwise and no glossary covers the platform name.
*Ministry glossary ruling; one string, every screen.*

**B-13. Owner counts include demo rows.** (J14.) The demo-exclusion rule names the
registry, Ministry aggregates and reviewer queues; the owner's counts-only surface is
unnamed. *Ruling, then one query change either way.*

**B-14. Level 2's "NO DECLARATION AT LEVEL 2" slot.** (J7.) A named absence rather than an
absent element — a judgment call against rule 10's "absent entirely". *Reviewer ruling.*

**B-15. Anonymous visitors get the demonstration panel.** (J15.) Root redirects to sign-in,
which offers one-click access to every demo role including the Ministry console. Presumably
deployment-gated; nothing says so. *Decision: gate the demo panel by environment, and
record it.*

**B-16. Order-free co-signature.** (J9.) The Director can sign the post-event report before
the organizer. Possibly fine; nobody has ruled. Also: the inspector cannot *schedule* an
inspection anywhere (only record findings against seeded ones), and Ministry incident rows
are not links — in both cases "not built yet" is currently indistinguishable from
absent-by-design.

### Smaller breaks

- Venue change-report gate loses a same-second race (`reported_at > MAX(created_at)` at
  second granularity, lib/queries.ts:836) — the banner says the reassessment opened while
  the button stays disabled (J3).
- The filed record still shows FILE BY + DAYS LEFT (including negative "−35") after filing;
  requirements counters keep counting after determination (J2, J11).
- The EV-0362 report page self-contradicts: "waiting on your signature" beside "the
  organizer has not started the report yet"; the header says "held 2026-09-13" (the end
  date) in past tense while every other surface says 2026-09-12 and the clock says the
  event is a month away (J9).
- `/events/[id]/documents` 404s for the organizer rather than being absent or reasoned (J1).
- Submit-page copy: two sentences start lowercase ("…below. the compliance and submission
  form…") — the annex-name substitution left mid-sentence casing (J1, J8).
- "EMS readiness declaration … 0 of 0 signed" renders with no providers named; "0 of the 0
  named agencies have signed" likewise on the Director view (J1, J9).
- The invite form has ONE name field written to both `name_en` and `name_ar` — Arabic
  parity for party names is impossible by construction (J1, J6).
- The seeded corrective action carries "due 2026-09-01" in narrative text beside the
  caption that says no due date can be computed (J12).
- After declining, the invitation page still shows the "In full: complete and sign…"
  obligation block (J8).
- A signed readiness declaration survives un-confirming an item, with no statement of what
  that means (J10).
- The reporting-timeframe note says who sets the value but not what is in force now — the
  unset state dodged rather than answered (J10; the event-side unset states elsewhere are
  exemplary).

---

## What read wrongly in Arabic — consolidated

The walkers' verbatim quotes, grouped. RTL structure itself held everywhere: `lang=ar
dir=rtl` set, layouts mirror, most dates carry directional isolates, Western numerals
throughout, and **the three outcomes render in the compliance form's verbatim Arabic on
every Ministry surface checked** — queue, radios, history, generated notifications. The
التأهب/الجاهزية split holds on instrument bodies (facility side consistently الجاهزية,
review doctrine التأهب). What follows is what broke.

**Glossary and instrument naming**
1. «الجاهزية الصحية للفعاليات» — the masthead, every screen (B-12 above).
2. «إحاطة الفرق والتحقق من الجاهزية وإقامة الفعالية» — plan workflow step 7: event-side
   operational readiness as الجاهزية.
3. «خطة EHMP مطلوبة» · «محددة في خطة EHMP» · «الملحق أ (NEHRAT)» · «متطلبات الملحق ب» —
   Latin acronyms and annex names inside Arabic regulatory copy while the English spells
   them out; either the Arabic issue's verbatim wording (then the EN is the paraphrase and
   the divergence must be recorded) or build-authored (then it violates the annex-naming
   rule). Requirements-matrix and compliance-form data both affected.
4. «فتح التقرير اللاحق» — an invented shorthand for التقرير الطبي لما بعد الفعالية, on the
   same screen that uses the full name.
5. «الجهوزية التشغيلية» vs «الجاهزية التشغيلية» — two spellings, two lines apart, on the
   first-response readiness page.

**Grammar and number agreement (templated counts — one systemic cause)**
6. «3 يوماً» «7 يوماً» — 3–10 take the plural (أيام); the unit is fixed singular for every
   count. «3 بند ينتهي» for three items (بنود تنتهي). «1 متطلباً بقي معالجته» (should be
   «بقي متطلب واحد لم يُعالَج»). «2 فعالية» ignores the dual («فعاليتان»). «وقد وقّعت 1 من
   الجهات الـ1 المُسمّاة» — «الـ1» is not Arabic. English shows the same class: "1 items
   still to confirm", "1 events".
7. «لا موجب قائماً قبل الفعالية» / «لا موجب إضافياً عليكم» — after لا النافية للجنس the
   predicate must be nominative («لا موجبَ قائمٌ»).
8. Gender agreement: the physician Director carries chips declined feminine for جهة —
   «مُسمّاة» / «مؤكِّدة» beside "Dr. Nadim Haddad" / "Dr. Rana Khoury"; «معتذرة» would
   misfire the same way.

**Meaning drift between the languages**
9. «وفي حال كانت وحدة الاستجابة غير مخوّلة بنقل المرضى» vs EN "Where the responding unit
   does not transport patients" — "not authorized" is a materially different condition
   (licence vs fact). Record as a divergence for a Ministry decision.
10. «عند الطلب» for EN "when required" (plan workflow steps 5 and 8) — "on request" changes
    who triggers the obligation (عند الاقتضاء would match).
11. «إشعار مستلَم» / «تم استلام إشعار المستوى 1» for EN "Notification acknowledged" —
    receipt is not acknowledgment, and the acknowledgment is the regulatory point.
12. «معلومات المرفق والحادثة» for EN "Incident information" — the Arabic silently adds
    "facility and".
13. The seeded notification paraphrases the revision outcome («مطلوب معلومات إضافية أو
    تعديل») while the generated one is verbatim («يلزم تقديم معلومات إضافية أو إجراء
    تعديلات») — two renderings of one determination in one inbox.
14. «الطلب» for the submission in gate strings and a notification («يُتاح بعد تقديم
    الطلب») against the platform's own التقديم/الملف on the same screens.

**Parity breaks (English showing in Arabic mode)**
15. The additional-measures catalogue `<option>` elements render entirely in English on the
    Arabic review screen — native options cannot carry the `data-l` span mechanism.
16. «مالك المنصة / Platform operations» — the owner console subtitle untranslated.
17. Party names Latin-only by construction (the single name field, item B above); level
    values as "Level 1/3" inside Arabic compliance headers («المستوى 1» expected);
    browser-native date inputs showing "mm/dd/yyyy" in AR mode; seeded location strings
    untranslated in the reviewer lane.

**Register and BiDi nits**
18. «الرقاقات الرمادية» for the grey chips (رقاقة is the electronics wafer; الشارات fits
    the register); «كتالوغ المتطلبات» loanword; «أُقيم في 2026-09-13» past tense for a
    future event; «تغطية على 1 من 1» terse to obscurity; «ترتيبات إخلاء المريض» vs «مسارات
    إخلاء المرضى» singular/plural drift; «أُرفق تقرير رعاية المرضى الخاص» dangling
    complement; a HOW-TO panel opening mid-sentence with «و…» unmarked as quotation; bare
    (un-isolated) dates on the provider dashboard card, notification timestamps and change
    history where every other date is isolated.

**Positive findings worth keeping:** the school-category end state is exemplary in both
languages («هذا هو الجواب، لا نقص فيه…»); the nine domains, minimum conditions, blockers
and the Level 1 conditional-deadline sentence are in proper regulatory register; the
source-divergence badges (الإصدار العربي فقط / الإصدار الإنكليزي فقط) render on both sides;
the decline consequence is stated fully before the action in both languages.

---

## Per-journey record

The five walkers' full reports, with page-text logs, live under the session scratchpad
(`j01/`–`j05/`). Summary of each journey's verdict:

| # | Journey | Completed? | Headline |
|---|---|---|---|
| 1 | Organizer, event, L3 | To the third-party handoff (by design) | Blockers named correctly; invitation link surfaced nowhere (B-1); dashboard tiles blank for real rows (B-8) |
| 2 | Organizer, event, L1 | **Yes — files end to end** (the showstopper-1 fix holds) | Conditional deadline stated as a condition; L3 rows absent not greyed; public lookup can't verify the reference (B-5) |
| 3 | Organizer, venue | Yes | Yes/No with no early verdict; same-second race on the change gate; two clocks on one rail |
| 4 | Organizer, facility sports | Yes | Ledger arithmetic consistent; "Ali Hassan collapsed" passes the name gate (B-3) |
| 5 | Organizer, facility school | Yes — ends at step 2 as designed | The strongest screen in the build, both languages; the recorded interest lands nowhere (B-10) |
| 6 | Provider, L3 | Yes (token via DB — B-1) | Ten items gate the signature correctly; Director invitation wears EMS copy (B-11) |
| 7 | Provider, L2 | Yes | No declaration anywhere — correct; a labelled empty slot needs a ruling (B-14) |
| 8 | Provider declining | Consequence and notification correct | Declined provider deadlocks filing (B-2); decline and change record unlinked |
| 9 | Director | Yes | Scoped correctly; requirement 15 alone; governance promise false ×5 (B-4); report page self-contradicts |
| 10 | First-response unit | Yes | 5/7/5 checklist gates exactly; both report routes reach the Ministry lane; no patient-name field anywhere |
| 11 | Ministry reviewer | Yes | Outcome recorded and the organizer sees it (the unification holds); the derivation is invisible to the reviewer (B-6) |
| 12 | Ministry inspector | Yes | Outcome control absent not greyed; refusals byte-identical to 404; cannot schedule an inspection (B-16) |
| 13 | Ministry administrator | Yes | Publishing now reaches the ledger and screens (showstopper-5 fix holds); effective dates ignored, no revise path (B-9) |
| 14 | Platform owner | Yes | Counts only, zero name leakage verified programmatically; demo rows in counts need a ruling (B-13) |
| 15 | Public, signed out | Yes | Four fields exactly, uniform not-found, rate limit bites; the public gets a sign-in wall and nothing else (Slice 0); demo panel exposed (B-15) |

**Environment caveats (not defects):** the Next dev server transiently 404'd valid routes
after hot reloads under load, and concurrent walkers corrupted the shared `.next` once —
two walkers re-verified their "dead routes" on isolated copies and every one reproduced
healthy. Anyone who saw a bare unstyled 404 during the walk should re-check before filing
it.
