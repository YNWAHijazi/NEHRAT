# Event Health Readiness Platform — build specification

Ministry of Public Health, Republic of Lebanon. A regulatory platform, not a consumer product. Nobody uses it by choice: an organizer arrives because a municipality told them to, or because their event will not be authorised without a reference number from it.

`/pages` holds six reference designs — complete, bilingual, interactive HTML. They are the source of truth for layout, wording and behaviour. This document carries the rules that are **not** visible in the markup, and those rules are what make the product correct.

Read `ROUTES.md` for the screen inventory, `tokens.css` for the visual system, `PROMPTS.md` for the build sequence.

---

## 1. The one rule everything else hangs off

An event has a **level: 1, 2 or 3.**

The level is produced by a scored assessment. **It is never a user choice, never a dropdown, never editable.** Everything downstream derives from it:

| | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| Filing deadline | notification only | ≥ 14 calendar days before the event | ≥ 30 calendar days before the event |
| Compliance form | only if the Ministry requests it | required | required |
| Medical plan | brief written arrangements, ~1 page | written plan | comprehensive plan, maps, EMS declarations |
| Event Medical Director | — | — | required, a licensed physician |
| EMS readiness declarations | — | — | one per named agency |
| Post-event medical report | after a reportable incident | after a reportable incident | after **every** event |

If a build lets someone pick a level, the build is wrong.

### How the level is derived

Nine risk domains, scored 0–2 each, total 0–18. Bands: 0–5 → Level 1 · 6–11 → Level 2 · 12–18 → Level 3.

Then a set of **minimum conditions** applies — ten of them, e.g. 20,000 or more people present at the same time forces Level 3 regardless of score. **The final level is the higher of the two results.** Show both and show which one governed; an organizer who scored 9 but lands at Level 3 must be able to see why.

**Domain 2 cannot resolve a discipline floor on its own.** Its three options bundle running with cycling, triathlon, open water, combat sport and motor racing, while the minimum conditions treat those separately and four of them force Level 3. The assessment therefore captures **event disciplines as a structured list** alongside the domain answer, plus **attendance as a number** and **course distance** on running events. Seven of the ten conditions cannot be derived from domain answers alone.

**An unset derivation input returns "incomplete", naming the field — never a level.** A checkbox left unticked on a marathon returning Level 2 is the precise failure this instrument exists to prevent.

The assessment is **versioned, never edited in place.** A re-assessment creates a new version and the previous one remains readable.

---

## 2. The three outcomes

A Ministry reviewer records exactly one of three, and there are no others:

1. Submission received but incomplete
2. Additional information or revision required
3. Health and medical preparedness requirements satisfied

**Never "approved". Never "rejected". Never a status invented for convenience.**

Internal workflow states — assigned, in progress, in queue — must be visually distinguishable from outcomes (grey, quiet) so they are never mistaken for determinations.

Two limits appear wherever an outcome is recorded:

> The Ministry reviews health and medical preparedness only. Authorization of the event remains with the legally competent authority.

> This status does not replace any other permit or authorization required under Lebanese law.

Separately from a revision request, the Ministry **may require additional measures** where necessary. That is a distinct action, not a fourth outcome. Attestations and inspections are also not outcomes, and never block one.

---

## 3. Seven user classes, and who can do what to whom

**Organizer** — creates events, completes assessments, files submissions. Cannot file until their organization is recorded by the Ministry, but *can* create events and complete assessments while that is pending. Never sees another organizer's records.

**EMS agency** — **invited only.** An agency can never add itself to an event and never sees an event it was not named in. It accepts or declines. At Level 3 it signs an EMS Readiness Declaration (ten items). Declining is a **material change** the organizer must report to the Ministry.

**Event Medical Director** — a licensed physician, **nominated by the organizer**, Level 3 only. Same rule: never self-adds, never sees an unnamed event. Named as responsible on five requirements; **requirement 15, the event medical command function, is theirs alone** — no other party is named against it and the organizer cannot file without it.

**Ministry reviewer / inspector / administrator** — reviews, inspects, configures. An inspector records corrective actions and **cannot record any of the three outcomes.**

**Platform owner** — above the Ministry. Sees platform-wide usage. A Ministry administrator cannot reach it.

**Facility cardiac-readiness coordinator** / منسّق الجاهزية للاستجابة لحالات توقف القلب — one named person per **covered facility** / مرفق مشمول, and the same person named on that facility's AED records. Maintains the cardiac emergency response plan, confirms readiness annually, files the incident report after any use. Cardiac-arrest instrument only.

**BLS or designated first-response unit** / جهة الإنعاش الأساسي أو وحدة الاستجابة الطبية الأولية المعتمدة — holds the minimum equipment, personnel competence and operational readiness to respond to a cardiac arrest, works to a written response procedure, and files the minimum dataset. Its own account context. Cardiac-arrest instrument only.

> **The Participating EMS provider and the BLS or designated first-response unit are different actors**, answering to different instruments, even where one organisation holds both roles. They never share a surface. An EMS readiness declaration is not a first-response readiness declaration, and neither substitutes for the other.

**Lebanese Order of Physicians** — a *configurable, non-determinative* lane, **off by default**. Verifies physician credentials and may attest to clinical content. It informs the Ministry; it never decides. A reviewer may record any of the three outcomes whether or not Order review is complete. Turning the lane off suspends that access.

### Nomination states, used consistently everywhere

`Nominated` → `Confirmed` / `Declined`, and for declarations `Draft` → `Signed`. A draft is visible to its author only and does not reach the organizer's package. An organizer cannot certify that participating providers have been identified while a named agency is still merely nominated.

### Responsible parties are computed, not written

Twenty requirements each name a responsible party, and four of them name the Event Medical Director. Because that role exists only at Level 3, the party list must be **derived from the level being viewed**:

- Cardiac-arrest readiness — Level 2: *Organizer / participating EMS or medical provider*. Level 3: the same, **plus Event Medical Director**.
- Receiving emergency departments, major-incident preparedness, post-event medical report — same pattern.
- Event medical command function — *Event Medical Director* alone, and it appears only at Level 3.

Hard-coding "Medical Director at Level 3" into a static string puts a role on a screen where it does not exist. Do not do it.

---

## 3a. Reference numbers must not be enumerable

Record identifiers and Ministry reference numbers are sequential and legible by design — an organizer quotes one over the telephone. Public reference lookup is unauthenticated by design — an authorising authority must be able to verify without an account.

Together those two facts let anyone walk the national register by incrementing a number, and recover the name, level and status of every event in the country. Each individual lookup returns only what §4 permits; the aggregate is a different disclosure.

**The lookup must not be enumerable.** The mechanism is a build decision — rate limiting per client, a second factor known only to the holder such as the event date, a non-sequential public token distinct from the human-readable reference, or a combination. What is not acceptable is an endpoint that answers an incrementing sequence.

This applies to the public lookup only. Inside an authenticated session, sequential identifiers are correct and useful.

---

## 3b. Demonstration data is not seed data

Every named record in `/pages` — Beirut Coastal 12K, Baalbeck Summer Festival, Forum de Beyrouth, Hamra Sports Hall, AED-002, MOPH-EV-2026-0362, and every person named against them — is **demonstration content written to show what a populated screen looks like.** None of it is seeded into the product.

**A new account is empty.** No events, no venues, no facilities, no notifications, no reference numbers. The empty dashboard with **Start a service** is the primary state; the populated dashboard is what it becomes. Build it in that order, not the other way round.

**What is forced off in a deployed environment is the seeder, not the accounts.** The distinction matters: demonstration organizations are *real rows* carrying `is_demo = true`, and they exist in production so the Ministry can walk the platform. What must never run in production is the seeder that invents new fictional records. Demonstration rows are excluded from the national registry, from every Ministry aggregate count, and from every reviewer queue. A reviewer never sees a demonstration submission in their work.

**Role-set demonstration logins**, offered on the sign-in screen so the Ministry can walk the platform without creating records: `test_organizer`, `test_ems`, `test_director`, `test_response`, `test_moph`, `test_moph_admin`. Each lands on its own dashboard, populated with the records in the reference files for that role.

Demonstration data is **isolated in both directions** — it never appears in a real account, and real records never appear in a demonstration one. A demonstration session carries a persistent band reading *Demonstration account. These records are examples.*

---

## 4. Sequence

Fixed, and the UI should not imply it is skippable:

1. Register the organization → 2. Create the event → 3. Complete the assessment → 4. Read the requirements for the resulting level → 5. Prepare the plan and documents → 6. Obtain EMS declarations (Level 3) → 7. File → 8. Receive the Ministry reference number.

Two identifiers, and they are different things: a **record identifier** issued at creation (`EV-0418`, `VN-0032`), and a **Ministry reference number** issued at submission (`MOPH-EV-2026-0362`). The reference number is what the organizer gives to the authorising authority. Public reference lookup returns only: that a submission exists, the event name, its level, and the current Ministry status — **never contact details, documents or assessment answers.**

---

## 5. Obligations that are distinct and must never be merged

- **24-hour serious-incident notification** and the **post-event medical report** are separate obligations on the same event. Filing the report does not satisfy the notification. Show them separately, and cross-reference them: an overdue report on an event that generated a notification is a different priority from an ordinary late report.
- The **post-event medical report** is due within **7 calendar days**, on three distinct triggers: after every Level 3 event; after a reportable incident at Level 1 or 2; or when the Ministry requests one.
- At **Level 3 the post-event report carries two signatures** — the organizer's and the Event Medical Director's. It is not complete with one.
- A **postponement or cancellation is a notification, not a decision.** A postponed event's status does not automatically carry to a new date.
- The **cardiac-arrest readiness instrument** (covered facilities, AEDs, first-response units) is a **peer regulatory instrument**, live, with its own actors, records and obligations. The two apply independently: registering under one does not satisfy the other, and submissions and approvals stay separate. Only the organisation and physician profile is shared. Do not merge their data.
- **Where two applicable requirements differ, the higher governs.** Registered AEDs, trained responders and cardiac arrangements may be **referenced** from a facility record into an event or venue submission rather than re-entered — never copied; the facility record stays the source of truth — provided they remain accessible and operational throughout the event, which the organizer confirms and does not inherit.
- **Nothing regulatory is hard-coded.** Phased schedules, capacity thresholds, facility designations, reporting timeframes and corrective-action timelines are Ministry-configurable. Never render a threshold as a fixed number in copy. **The unset state is a first-class answer**, not an error or an empty result: name the missing value, say nothing is in force under that rule until the Ministry sets and publishes it, and say operators are notified when it does.

---

## 5b. Nothing is always-on

Every action is derived from the record's own state. A control that is always clickable is a bug, not a simplification.

**Two behaviours, and conflating them is the mistake that matters:**

**Visible and disabled** where the action *will* become available — it waits on a date, an answer or a step. Show the control, greyed, with the condition in plain words: *Available after the event ends, 2 October 2026.*

**Hidden entirely** where the action does not apply to this record and never will — a matter of level, category or instrument. No row, no greyed control, no mention.

A Level 2 organizer must not see a greyed Event Medical Director row. There is no director at Level 2, and showing one implies there could be. A post-event report before the event **is** shown, greyed, with its date — because it is coming.

| Gate | Behaviour |
|---|---|
| Post-event report before the event ends | Disabled, with the date it opens |
| Venue reassessment more than 60 days before expiry | Disabled, with the date it opens |
| Material change before the submission is filed | Disabled, *available once filed* |
| Event Medical Director below Level 3 | Hidden |
| Readiness declaration below Level 3 | Hidden — Level 2 gets participation detail and no declaration |
| The sixteen plan sections at Level 1 | Collapsed behind the note that brief written arrangements suffice |
| Submit, while the organization is pending registration | Disabled, with the reason and a route to the organization screen |
| Submit, while a document is unattached or a named party unanswered | Disabled, naming the specific item |
| *Requirements satisfied*, while a blocking attestation, visit or added requirement is outstanding | Disabled, each item named. **The other two outcomes stay available** |
| Sign the declaration, below ten confirmed items | Disabled, *{n} of 10 still to confirm* |
| Continue past the facility category step, where the category awaits a Ministry value | No Continue at all. **Record an interest**, and a route back |

**Derived, never entered:** the event level, the plan's device section, the venue floor, every deadline date, every count and badge.

---

## 5c. Invitations

An organizer names a party **from inside the requirement that needs them**, on the requirements screen — not from a separate invitations area. They are reading the requirement; the invite belongs there.

Named EMS providers sit in group 2 of the requirements page; the Event Medical Director sits on the requirement-15 row, Level 3 only. Both take a name and an email and send.

**The invited party self-registers against the invitation.** The email carries a link; they create their own account, and accepting links it to the event. The organizer never creates an account on their behalf, and never sees their credentials.

---

## 6. Copy rules

- **Fee: None.** Never "free".
- Plain, declarative, sentence case. No marketing register, no encouragement, no exclamation, no emoji.
- **Deadlines as dates**, not "soon" or "3 days left" alone.
- **Never name an annex.** The regulatory documents are lettered annexes internally; users never see that. Say *risk assessment*, *compliance and submission form*, *readiness declaration*, *post-event medical report*, *event health and medical plan*. Never "Annex A", "Annex C", "EHMP".
- **The formal name and acronym NEHRAT** are permitted where they **name the regulatory instrument itself** — a version row, a configuration reference, a link to the document. They are banned where they **substitute for what the user is doing**. "NEHRAT tool version" is correct. "Complete the NEHRAT" is not. A reviewer reading a submission still sees *risk assessment*.
- State consequences plainly. "The organizer cannot file the Level 3 package without it" beats a warning icon.
- Don't explain the design to the user. Empty states say what the emptiness *means*; they don't editorialise about it. An empty urgent lane is good news and should read that way.
- **Document names, cardiac-arrest instrument.** *cardiac emergency response plan* / خطة الاستجابة لحالات توقف القلب · *AED record* / سجل جهاز إزالة الرجفان · *facility cardiac-arrest incident report* / تقرير حادثة توقف القلب في المرفق · *first-response readiness declaration* / إقرار جاهزية الاستجابة الأولية.
- **Mass-gathering status vocabulary never appears on the facility side.** The three outcome values belong to the mass-gathering instrument. The cardiac-arrest instrument prescribes no status labels at all. Any facility-side status wording is provisional pending Ministry approval and must be marked as such wherever it appears.
- Where a string is quoted from the regulation — the compliance declarations, the sixteen plan sections, the eleven major-incident items, the ten declaration items — it is verbatim and must not be paraphrased.

---

## 7. Bilingual and RTL — not optional

Full English / Arabic parity. Every string, every label, every notification. Switching to Arabic sets `dir="rtl"` and **mirrors the entire layout** — logo, navigation, tables (first column on the right), cards, controls. Logical CSS properties only (`margin-inline-start`, `border-inline-start`, `inset-inline-end`); never `left`/`right`.

Arabic typography differs: near-zero letter-spacing, looser line-height (~1.75 body, ~1.45 headings). Numerals stay Western Arabic. Dates as `YYYY-MM-DD`, tabular figures, never reversed.

Terminology is fixed:

| English | Arabic |
|---|---|
| Event Medical Director | المدير الطبي للفعالية |
| EMS Readiness Declaration | إقرار جاهزية خدمات الطوارئ الطبية |
| National Event Health Risk Assessment Tool | التقييم الوطني للمخاطر الصحية للفعاليات |
| Compliance and submission form | نموذج الامتثال والتقديم |
| Post-event medical report | التقرير الطبي لما بعد الفعالية |
| Clinical governance | الحوكمة السريرية |
| Event medical command | القيادة الطبية للفعالية |
| Credential verification | التحقق من المؤهلات |
| Material change | تغيير جوهري |
| Nominated | مُرشَّح |

---

## 8. Accessibility and platform

- Visible keyboard focus on every interactive element.
- **Status is never colour alone** — every state chip carries its text.
- Contrast holds in light and dark, in both palettes.
- `prefers-reduced-motion` respected.
- Responsive to 375px: tables collapse to single column, the control dock hides below 900px.
- Text-size control (100 / 112 / 125%), dark mode, palette switch. These are government-accessibility features, not decoration.

---

## 9. What would make the build wrong

- The design index tab strip built as product navigation
- Demonstration records seeded into a real account, or a new account arriving pre-populated
- A control that is always enabled — a post-event report fileable before the event, a submission fileable with an unanswered provider
- A level-based element shown greyed rather than hidden, implying a role exists where it does not
- A user choosing an event level, or editing one
- "Approved" / "Rejected" anywhere
- An EMS agency or medical director adding themselves to an event
- Requirement 15 shown as shared, or the Event Medical Director appearing at Level 2
- A shared requirement shown as a sole responsibility — two people each assume the other did it
- The Order of Physicians lane blocking a Ministry outcome
- A physician editing their own credential verification
- A Level 3 post-event report treated as complete with one signature
- The 24-hour notification and the post-event report collapsed into one thing
- A Level 1 organizer pushed through Level 3 depth
- Any annex letter visible to a user
- Arabic that changes text direction without mirroring layout
- Animation, gradients, shadows, emoji, or any promotional copy
