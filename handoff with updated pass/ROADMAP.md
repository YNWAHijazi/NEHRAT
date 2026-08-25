# Build roadmap — every page, and how it is reached

Ministry of Public Health, Republic of Lebanon. **National Health and Medical Readiness.**

Read this with `SPEC.md`. That file carries the rules; this one carries the routes. Where the two disagree, `SPEC.md` wins.

---

## ⚠ Before you read anything else — the tab strip is not navigation

Every reference file opens with a horizontal strip of pills: *Sign in and organization · Dashboard · Applicability and assessment · Event record · Requirements and attachments · Material change · Health and medical plan · Submission package · Acknowledgment · Post-event report · Register a venue · Annual venue assessment · Venue record · Report a venue change · Register a facility · Facility readiness · Defibrillator registry · Facility response plan · Facility incident report · Empty and edge states · Notifications.*

**That strip does not exist in the product. Do not build it.** It is a reviewer's index, carrying `data-prototype-nav`, and it exists for one reason: so you can open each screen and see what it looks like without a session and without working through the flow.

An organizer never sees a list of all twenty-one screens. They see a dashboard, and they reach each screen by acting on a record. The routes in this document are the real navigation, and every screen carries a **sequence footer** at its foot naming where it leads next — that is what you build.

The same applies to **Empty and edge states** and **Notification templates**: reference material, not routes.

---

## 0. Read this first, or the rest will not make sense

> **This document is authoritative on routing.** `ROUTES.md` and `PROMPTS.md` were written for an earlier build and are removed. Where an older document survives in a copy of this pack and disagrees with this one, this one wins.
>
> **Invitation links carry an unguessable token, never a sequential id.** They are opened by an unauthenticated party from an email.
>
> **Facilities and venues are lists on one account.** Their routes carry an id — `/facilities/:id`, never a bare `/facility`. One organization holds several.

**One platform, two regulatory instruments.**

| Instrument | Covers | Produces |
|---|---|---|
| **Mass-gathering events** | A single event, or a venue that repeatedly hosts events | A Ministry reference number, or a dated venue classification |
| **Cardiac-arrest readiness** | A building the public uses in the ordinary course of its business | A registered facility record with continuing obligations |

They **apply independently**. Registering under one does not satisfy the other. Where two applicable requirements differ, **the higher governs**. They share the organization record and its registered assets; their submissions and approvals stay separate.

**One account does all three services.** A sports club that runs races at its own hall is an organizer, a venue operator and a covered facility on one login. Do not build three account types.

**Three actors have their own accounts and never share a surface with each other:**

- **Organizer / venue operator / facility operator** — one account, three services (`Organizer Journey.dc.html`)
- **Participating EMS provider** and, separately, **first-response unit** (`EMS Agency.dc.html`)
- **Event Medical Director** (`Medical Director.dc.html`)
- **Ministry** — reviewer, inspector, administrator, platform owner (`Ministry Review.dc.html`)

**The tab strip at the top of every file is not product navigation.** It carries `data-prototype-nav` and exists so a reviewer can reach any screen without a session. **Do not build it.** Build the routes described below. Every screen also carries a **sequence footer** at the bottom naming where it leads — that *is* product navigation and should be built.

---

### Demonstration accounts, and what a real account looks like

Every record you see in the reference files — Beirut Coastal 12K, Baalbeck Summer Festival, Forum de Beyrouth, Hamra Sports Hall, AED-002, MOPH-EV-2026-0362 — is **demonstration content**. None of it is seeded into the product.

**A new account is empty.** Someone who signs up today has no events, no venues, no facilities, no notifications. The first thing they see is the empty dashboard and **Start a service**. Build the empty state as the primary state; the populated dashboard is what it becomes.

**Demonstration logins**, offered on the sign-in screen so the Ministry can walk the platform without creating records:

| Login | Lands on | Populated with |
|---|---|---|
| `test_organizer` | Organizer dashboard | Two events at different levels, one venue, one facility |
| `test_ems` | EMS provider dashboard | One Level 2 participation, one Level 3 declaration |
| `test_director` | Medical Director dashboard | One Level 3 event |
| `test_response` | First-response unit | A readiness record and one dataset report |
| `test_moph` | Ministry console, reviewer | The queue, one submission mid-review |
| `test_moph_admin` | Ministry console, administrator | Configuration, catalogue, users |

Demonstration data is **isolated**: it never appears in a real account, and a real account's records never appear in a demonstration one. Label the demonstration session visibly — a persistent band reading *Demonstration account. These records are examples.* — so nobody mistakes it for live.

### First run — what happens after sign-up

1. Account created → **empty dashboard**, one visible action: **Start a service**.
2. **Organization registration is required before filing, not before starting.** An organizer may create an event, complete the assessment, gather requirements and write the plan while the Ministry has not yet recorded their organization. The **Submit** action is what is blocked, with the reason named and a route to the organization screen.
3. The dashboard carries a registration banner while the organization is pending. It disappears once recorded.

---

## 1. `Event Health Readiness.dc.html` — the public landing page

Signed out. Anyone can reach every screen here.

### Screens

| # | Screen | Route | Reached from |
|---|---|---|---|
| 1 | **Overview** | `/` | Logo, and the sequence footer of every other screen |
| 2 | **Certify an event** | `/services/certify-an-event` | Journey card 1 · search result · footer |
| 3 | **Determination of applicability** | `/applicability` | Utility card 1 · search · "check whether the rules apply" links |
| 4 | **Register a recurring venue** | `/services/register-a-venue` | Journey card 2 · search · cross-reference from the facility page |
| 5 | **Register a facility** | `/services/register-a-facility` | Journey card 3 · search · cross-reference from the venue page · the level explainer |
| 6 | **Search results** | `/search?q=` | The hero field, Enter or the button · the "Verify a reference number" utility card |

### Overview, top to bottom

1. **Hero** — the platform's one-sentence definition, a search field, four suggestion chips.
2. **Services**, in two ranks:
   - **Regulated processes** — the three journeys as large cards, each with an instrument chip and its facts. These are the primary route into the platform.
   - **Where the two instruments meet** — the stadium case, and the three rules.
   - **Public tools** — applicability and reference verification, visually subordinate, each stating no account and no obligation.
3. **Who the platform is for** — six parties in two groups by instrument.
4. **How an event level is determined** — the interactive score rail. Scoped "Mass-gathering events only". Ends with a short block saying facilities classify by category, not by score.
5. **Jurisdiction notice** — this platform records preparedness; it does not authorize events.
6. **Cardiac-arrest readiness in facilities** — the instrument behind journey 3.
7. **Footer** — five columns.

### Determination of applicability — a branching check

Asks first **what are you asking about**: an event, a venue, or a place you operate.

- **Event** → six criteria as checkboxes. Any one selected → subject to the Protocol, route to Certify an event. None selected → the Ministry makes the final determination, route to contact.
- **Venue** → two conditions plus a sports flag. Both met → recurring venue, route to registration. One or neither → not a recurring venue, but individual events may still be subject; route to the event branch.
- **Facility** → six categories. **Never returns a bare yes or no.** Returns the applicable rule and its basis under a state chip.

**The four state chips, used identically everywhere in the build:**

| Chip | Meaning |
|---|---|
| **In force now** | The category carries the requirement on its own |
| **Partly in force** | Some of the category is live, the rest waits on a value |
| **Awaiting a Ministry value** | Nothing is in force under this category yet |
| **Determined by Ministry review** | The requirement comes from a review, not from the category |

For the three categories awaiting a value, a second panel headed **Waiting on the Ministry** names the missing value and says: *this is the answer, not a gap in it.* Build that as a first-class result. It will be the live state for schools for some time.

**"What is not routinely subject"** renders **only** in the event branch.

---

## 2. `Organizer Journey.dc.html` — one account, three services

Signed in. **21 screens.** This is the largest module and the one most users will live in.

### Global chrome

- **Header** — Ministry mark, organization name, registration state, language toggle, a **Dashboard** back button on every screen except the dashboard and sign-in, a **notification bell** with an unread count, and an **account menu** carrying organization details, notifications and **Sign out**.
- **Dashboard** is the hub. Everything returns to it.
- **"Start a service"** — a searchable menu on the dashboard, next to the organization name. Three items: Certify an event · Register a recurring venue · Register a facility. Each shows its instrument. This is how a new service is started.

### 2a. Entry

| Screen | Route | Reached from |
|---|---|---|
| **Sign in and organization** | `/signin` | Landing page · the dashboard's registration banner ("Add the document") |
| **Dashboard** | `/dashboard` | Sign-in · the header back button · every sequence footer |
| **Notifications** | `/notifications` | The header bell · the account menu · the dashboard footer |

**The inbox** lists everything the Ministry, a named party or the platform has sent, filtered by All / Unread / Needs action / For information. Each row states what happened and opens **the record it concerns** — a returned submission opens the event record, an overdue report opens the report. The copy is explicit that the notification is never the obligation: the record is where the obligation lives. Unread rows carry a dot, a heavier subject and a surface tint; the bell badge is the unread count.

**Sign out** sits at the foot of the account menu, in `--bad`, and returns to `/signin`.

**Dashboard content, in order:** organization-registration banner (if pending) → **Events** → **Facilities** → **Venues**. Each row opens its record. Every row shows what is owed and by when.

### 2b. Event service — the flow the user described

```
Dashboard
   └─ press an event ─────────────────► Event record
                                          ├─► Requirements and attachments
                                          ├─► Health and medical plan
                                          ├─► Submission package ──► Acknowledgment
                                          ├─► Report a material change
                                          └─► Post-event report   (after the event)
```

| Screen | Route | Reached from |
|---|---|---|
| **Applicability and assessment** | `/events/new` | "Start a service" → Certify an event · dashboard "New event" |
| **Event record** | `/events/:id` | Dashboard event row · assessment completion · sequence footers |
| **Requirements and attachments** | `/events/:id/requirements` | Event record → "Open requirements and attachments" · summary card |
| **Health and medical plan** | `/events/:id/plan` | Event record · requirements screen (the plan attachment row) |
| **Submission package** | `/events/:id/submit` | Event record · requirements · plan |
| **Acknowledgment** | `/events/:id/acknowledgment` | Filing from the submission package |
| **Report a material change** | `/events/:id/change` | Event record · acknowledgment |
| **Post-event report** | `/events/:id/post-event` | Event record, **after the event date** · Ministry request |

**Requirements and attachments** is one page in four numbered groups, in the order they need acting on:

1. **Documents to attach** — the four submitted documents
2. **Named EMS agencies** — nomination states; a nomination is not a confirmation
3. **Requirements you certify to** — the remaining Annex B requirements, nothing to attach
4. **Inspections and visits** — conducted by an authority, not scheduled by the organizer

**The plan** offers two routes — write it in the platform, or attach an existing document and confirm section coverage. Sixteen sections at Level 2 and 3; at Level 1 they collapse behind a note that brief written arrangements are what is required.

### 2c. Venue service

| Screen | Route | Reached from |
|---|---|---|
| **Register a venue** | `/venues/new` | "Start a service" → Register a recurring venue |
| **Annual venue assessment** | `/venues/:id/assessment` | Registration · venue record |
| **Venue record** | `/venues/:id` | Dashboard venue row · assessment completion |
| **Report a venue change** | `/venues/:id/change` | Venue record |

The classification stands twelve months and sets a **floor** for organizers using the venue. It does not certify their events.

### 2d. Facility service — cardiac-arrest instrument

**Six steps. Only four are forms. Step 2 is a determination and may end the journey.**

```
Start a service → Register a facility
   1  Facility profile
   2  Category and what it requires   ← determination; may stop here
   3  Coordinator and responsible persons
   4  Device records                   ← one record per device, repeatable
   5  Cardiac emergency response plan  ← largely derived
   6  Registered — facility readiness  ← the standing state
```

| Screen | Route | Reached from |
|---|---|---|
| **Register a facility** (steps 1–3) | `/facilities/new` | "Start a service" → Register a facility |
| **Defibrillator registry** (step 4) | `/facilities/:id/devices` | Step 3 completion · facility readiness · device cards · the plan's derived section |
| **Facility response plan** (step 5) | `/facilities/:id/plan` | Registry · facility readiness |
| **Facility readiness** (step 6) | `/facilities/:id` | Dashboard facility row · every facility screen's footer |
| **Facility incident report** | `/facilities/:id/incidents/new` | Facility readiness · response plan |

**Three shared records, referenced not re-collected:** the facility profile, the coordinator, the device records.

- The **coordinator** is a facility-level record shown read-only on every device record and on the plan. The annexes require the same person in all three. **Build it as one entity referenced by all, not as validation between editable fields.**
- **Devices before the plan.** The plan's device section is **derived from the registry and is not editable** — availability, count, exact locations, accessibility, latest readiness check, pediatric capability. A button routes back to the registry to change anything.
- **Two different signatories.** The device record is signed by the **facility representative**. The plan is signed by the **coordinator**. Do not collapse them.

**Where step 2 returns "Awaiting a Ministry value" the journey ends there, cleanly.** Name the missing value, state that nothing is in force and no registration is owed, offer **Record an interest and notify us when it activates**, and route back to the dashboard. No Continue button appears. A school must leave understanding it has done everything available to it.

### 2e. The §12 reference — "enter once, satisfy both"

On the event health and medical plan, **only where the event's venue is itself a registered covered facility.** Where it is not, the block does not render, and the organizer is **not** prompted to go register it — that is a different obligation on a different party.

Two conditions are visible and both must be built:

1. **The organizer confirms** the referenced arrangements will remain accessible and operational throughout the event. **Not inherited** from the facility's registration.
2. **Where the event requires more than the facility provides**, the shortfall is surfaced by name and the organizer must meet the higher requirement.

It is a **reference, never a copy**. The facility record stays the source of truth.

### 2f. Reference screens — not routes

**Empty and edge states** and **Notification templates** are design references for you to build against. They are not product screens. The templates screen carries the bilingual copy each of the six notifications sends; the inbox at `/notifications` is the real route where an organizer reads them.

---

## 3. `EMS Agency.dc.html` — two separate accounts

**These are two different actors under two different instruments. They never share a surface, even where one organisation holds both roles.** The header names which account is showing.

### Participating EMS provider — mass-gathering instrument

| Screen | Route | Reached from |
|---|---|---|
| **Nomination and account** | `/invitations/:token` | The organizer's invitation email |
| **Provider profile** | `/profile` | Accepting a nomination · dashboard |
| **Dashboard** | `/dashboard` | Sign-in · every footer |
| **Event participation — Level 2** | `/events/:id/participation` | Dashboard row, Level 2 events |
| **Readiness declaration — Level 3** | `/events/:id/declaration` | Dashboard row, Level 3 events |
| **Shared documents** | `/events/:id/documents` | Participation · declaration |

**Invited only.** A provider can never add itself to an event and never sees an event it was not named in. Declining is a **material change** the organizer must report.

At Level 2 there is **no declaration** — operational detail only, for the organizer's plan. At Level 3 the declaration is ten items, and signing is blocked until all ten are confirmed. A draft is visible to the provider only.

### First-response unit — cardiac-arrest instrument

| Screen | Route | Reached from |
|---|---|---|
| **First-response readiness** | `/first-response/readiness` | Its own sign-in |
| **Minimum dataset** | `/first-response/reports/new` | Readiness screen |

Readiness carries minimum equipment (5), personnel competence (7), operational readiness (5) and the written response procedure (6 steps). The dataset is **one report per patient, five sections, no patient name**, with age group as adult, child or unknown, and the onsite device distinguished from the unit's own device. A unit may **attach its own patient-care report** where it captures everything required — build both routes.

---

## 4. `Medical Director.dc.html` — Level 3 only

| Screen | Route | Reached from |
|---|---|---|
| **Nomination and account** | `/invitations/:token` | The organizer's nomination |
| **Physician profile** | `/profile` | Accepting · dashboard |
| **Dashboard** | `/dashboard` | Sign-in · every footer |
| **Event** | `/events/:id` | Dashboard row |
| **Clinical governance and command** | `/events/:id/governance` | Event screen |
| **Post-event report** | `/events/:id/report` | Event screen · dashboard |
| **Credentials** | `/credentials` | Profile · dashboard |

**Nominated by the organizer, never self-adds.** Requirement 15 — the event medical command function — is **theirs alone**; no other party is named against it and the organizer cannot file without it. At Level 3 the post-event report carries **two signatures**, the organizer's and the Director's; it is not complete with one.

---

## 5. `Ministry Review.dc.html` — the Ministry console

**17 screens across four permission levels.** A reviewer sees the first group; administrator screens are marked; two screens belong to the platform owner alone.

### Reviewer

| Screen | Route | Reached from |
|---|---|---|
| **Dashboard** | `/ministry` | Sign-in · every footer |
| **Review queue** | `/ministry/queue` | Dashboard counters |
| **Submission review** | `/ministry/submissions/:id` | Queue row · dashboard |
| **Organizations** | `/ministry/organizations` | Dashboard counter |
| **Determinations and designations** | `/ministry/determinations` | Dashboard · public enquiries |
| **Changes and notifications** | `/ministry/changes` | Dashboard |
| **Incidents and reports** | `/ministry/incidents` | Dashboard counters |
| **Enquiries** | `/ministry/enquiries` | Dashboard |
| **Facility oversight** | `/ministry/facilities` | Dashboard facility band |
| **Reported arrest locations** | `/ministry/facilities/arrests` | Dashboard facility band · facility oversight |
| **Order of Physicians lane** | `/ministry/order` | Submission review, when the lane is on |

**The three outcomes are the only regulatory determinations**, and only a reviewer records them:

1. Submission received but incomplete
2. Additional information or revision required
3. Health and medical preparedness requirements satisfied

Internal workflow states — *in queue, in progress, assigned* — render in grey and **are not determinations**. An **inspector** records corrective actions and **cannot record any of the three**. The **Order of Physicians** lane is off by default, non-determinative, and never extends into the facility lane.

**The facility lane is separate from the event lane** and carries no event outcome. **Reported arrest locations** groups incidents by place and category so a pattern is visible, and is the mechanism by which a facility with a confirmed arrest is designated as covered.

### Administrator

| Screen | Route |
|---|---|
| **Configuration and versioning** | `/ministry/admin/configuration` |
| **Cardiac-arrest configuration** | `/ministry/admin/cardiac` |
| **Users and roles** | `/ministry/admin/users` |
| **National registry** | `/ministry/admin/registry` |

**Cardiac-arrest configuration holds the seven values operators are told they are waiting for.** Each needs an unset state, a **set-and-publish** action, and an **effective date** — the public page promises operators are notified when the obligation begins. Its counters describe **publication** (values published / partly published / not yet published / set case by case), and a panel states that two categories are in force without any configured value and so do not appear in the seven rows.

### Platform owner

| Screen | Route |
|---|---|
| **Master admin** | `/platform/admin` |
| **Platform activity** | `/platform/activity` |

Above the Ministry. **A Ministry administrator cannot reach these.** Activity is counts only — no organizer, account, event or patient is named, and it cannot be filtered to one organization's behaviour.

---

## 5b. Conditional gating — what locks, what hides, and why

**This is the section that decides whether the build is a prototype or a form.** Every action below is derived from the record's own state. Nothing is always-on.

**Two gating behaviours, and they are not interchangeable:**

| Behaviour | When | What the user sees |
|---|---|---|
| **Visible and disabled** | The action *will* become available — it is waiting on a date, an answer, or a step | The control, greyed, with the condition named in plain words beside it |
| **Hidden entirely** | The action does not apply to this record and never will — it is a matter of level, category or instrument | Nothing. No row, no greyed control, no mention |

A Level 2 organizer must not see an Event Medical Director row greyed out. There is no director at Level 2, and showing one implies there could be. A post-event report before the event **is** shown, greyed, reading *Available after the event ends, 2 October 2026* — because it is coming.

### Time-based — visible, disabled, with the date

| Action | Opens when | Disabled note |
|---|---|---|
| **Post-event report** | The event's end date and time has passed | *Available after the event ends, {date}* |
| **Annual venue reassessment** | 60 days before the classification expires | *Opens {date}, 60 days before expiry* |
| **Annual facility readiness confirmation** | 60 days before the confirmation lapses | *Opens {date}* |
| **Report a material change** | The submission has been filed | *Available once the submission is filed* |

### Level-based — hidden entirely

| Element | Renders only when |
|---|---|
| **Event Medical Director** — the requirement row, the nomination action, every mention | Final level is 3 |
| **Readiness declaration** on the EMS provider's screen | The event is Level 3. At Level 2 they get participation detail and **no declaration** |
| **The sixteen plan sections** | Level 2 or 3. At Level 1 they collapse behind a note that brief written arrangements are what is required |
| **Major-incident plan** — eleven items | Level 2 or 3 |
| **Requirement rows generally** | The requirement applies at the derived level. A row that does not apply is absent, not shown as "not required" |

### State-based — visible, disabled, with the reason

| Action | Blocked while | Reason shown |
|---|---|---|
| **Submit the package** | The organization is not yet recorded by the Ministry | *Your organization is pending Ministry registration. You may prepare everything; filing opens once it is recorded.* |
| **Submit the package** | A required document is unattached, or a named provider has not answered | The specific item, named |
| **Record: requirements satisfied** (Ministry) | Any blocking attestation, visit or added requirement is outstanding | Each outstanding item listed by name. **The other two outcomes stay available.** |
| **Sign the readiness declaration** (EMS) | Fewer than ten items confirmed | *{n} of 10 items still to confirm* |
| **Continue past the facility category step** | The category is awaiting a Ministry value | No Continue button at all. **Record an interest** instead, and a route back |
| **Certify participating providers identified** | A named provider is nominated but has not answered | *A nomination is not a confirmation* |

### Derived, never entered

- **The event level** — from the assessment. Never a control.
- **The plan's device section** — from the facility's device registry. Read-only, with a route to the registry.
- **The venue floor** — from the venue's classification. It raises an event's level; it is never typed.
- **Deadline dates** — from the level and the event date. **Level 1 is 7 calendar days, conditionally**: §8.1 requires filing before final event authorization is issued, and where no external authorization is required, at least 7 calendar days before the event. Level 2 is 14, Level 3 is 30. Do not confuse the Level 1 lead time with the post-event report window, which is also 7 calendar days but runs *after* the event.
- **Every count and every badge** — from the records. Never a stored number.

### Instrument-based

Cardiac-arrest screens never show a mass-gathering outcome, deadline or level. Mass-gathering screens never show a facility readiness state. The §12 reference block on the event plan renders **only** where the venue is a registered covered facility, and where it is not, nothing renders and the organizer is not prompted to register it.

---

## 5c. Invitations — how the organizer names a party

**Sent from the requirement itself**, on `/events/:id/requirements`, not from a separate screen. The organizer is reading the requirement that needs a party; the invite belongs there.

- **Named EMS providers** — group 2 of the requirements page. Each row carries **Invite a provider**: organization name, contact email, and send. The row then shows **Nominated** until they answer, then **Confirmed** or **Declined**.
- **Event Medical Director** — the requirement-15 row, **Level 3 only**. Same pattern: name, email, send.
- An invited party **self-registers against the invitation**. The email carries a link; they create their own account, and accepting links it to the event. The organizer never creates an account for them.
- **A nomination is not a confirmation.** The organizer cannot certify that participating providers are identified while any named party is still unanswered, and the requirements page says so.
- **Declining is a material change** the organizer must report to the Ministry.

---

## 6. Non-negotiables

1. **The event level is derived, never chosen.** Nine domains scored 0–2, total 0–18, bands 0–5 / 6–11 / 12–18, and certain event types carry a minimum level. **The final level is the higher of the two.** If a build lets someone pick a level, the build is wrong.
2. **Nothing regulatory is hard-coded.** Phased schedules, capacity thresholds, designations, reporting timeframes and corrective-action timelines are Ministry-configurable. Never render a threshold as a fixed number in copy. **The unset state is a first-class answer.**
3. **No mass-gathering status vocabulary on the facility side.** That instrument prescribes no status labels; any wording used is provisional pending Ministry approval and must be marked as such.
4. **Full English/Arabic parity.** Every string. Arabic sets `dir="rtl"` and **mirrors the whole layout**. Use logical CSS properties throughout. SVG arrows are the one thing logical properties cannot flip — the build carries `html[lang="ar"] [data-flip]{transform:scaleX(-1)}`; use it on any directional glyph.
5. **No patient-identifying data anywhere.** The facility incident report actively blocks submission when a personal name is detected in the narrative.
6. **No vendor directories, purchase links, fees or commercial content.** Excluded by policy.
7. **Fee: None.** Never "free".
8. **A new account is empty.** Demonstration records live behind demonstration logins and never leak into a real account. Build the empty state first.

9. **Nothing is always-on.** Every action is gated on the record's own state, per §5b. Time-based gates are visible and disabled with the date; level-based gates are hidden entirely.

10. **Two identifiers, and they are different things.** A **record identifier** at creation (`EV-0418`, `VN-0032`, `FC-0014`) and a **Ministry reference number** at submission (`MOPH-EV-2026-0362`). The reference number is what the organizer gives the authorising authority. Public lookup returns only that a submission exists, the event name, its level and the current status — **never contact details, documents or assessment answers.**

---

## 7. What every screen owes the user

Every screen in every module carries a **sequence footer** naming where it leads next, with a short line on what each destination is for. That is not decoration — it is how a user moves without the tab strip. Build it.

Confirmed by audit: **59 screens across five modules, and every one of them has at least one outbound route.** Nothing dead-ends.
