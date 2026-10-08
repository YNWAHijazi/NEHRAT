# Single record page redesign — 7 October 2026

The owner's request: replace the organizer's tab-based, attachment-led event journey with one
requirement-led record page, and reuse it for venues.

- `implementation-brief.txt` — the brief: layout, rules, 24 acceptance items, venue differences.
- `event-and-venue-requirements.xlsx` — the companion workbook (decisions, Level 1/2/3 rows,
  medical plan, venues, page checks, sources). `event-and-venue-requirements.md` is a plain-text
  export of it.
- `mockup-level1-record-page.webp` — the proposed Level 1 layout (fictional example).

## Owner decisions (7 October 2026)

- Build all of it now (events at every level, venues); the Ministry demo was postponed.
- D1, D2, D4 are confirmed in the workbook.
- D3, D5, D8, D9, D10 ("For review"): build the workbook's proposed treatment, recorded as a
  proposal awaiting partner sign-off.
- D6 (late serious-incident reports) and D7 (renewal window and validity start): "Pending" —
  leave the current behaviour unchanged until they are decided.
- Work on branch `redesign/single-record-page` and open a pull request. `main` deploys to the
  live site automatically, so nothing reaches it until the owner merges.

## Partner review (7 October 2026) — applied

The partner reviewed the workbook (`Workbook_Review.docx`, received 7 October). Decisions and their state in the build (`lib/rules/data/requirement-catalogue.json` → `decisions`):

| Decision | Partner | Build |
|---|---|---|
| D1 Level 2 Medical Director | Incorrect — the Event Medical Director is Level 3; no medical-leadership title at Levels 1–2 | Corrected: the Director row is absent below Level 3, no Level 2 row names a Director author, the Level 2 plan is the EMS agency's, Director invitations are refused below Level 3 (events and venues) |
| D2 Level 2 plan | Confirm | Confirmed (recommended; required when the Ministry requests it) |
| D3 Level 2 escalation | Confirm | Confirmed (short coordinated procedure at Level 2; major-incident plan at Level 3) |
| D4 Level 3 plan | Confirm | Confirmed (EMS may draft; the Director approves the current version) |
| D5 Level 1 supplies | Confirm | Confirmed (no kit inventory, no oxygen requirement) |
| D6 late serious reports | Correct approach | Unchanged: the official deadline stands, late filing is allowed and flagged, history is kept |
| D7 venue renewal | Correct — no invented validity periods | Unchanged: the annual assessment stands; the validity date is written at issue and is a configurable value, not a fixed period |
| D8 venue annual reporting | Confirm | Confirmed (no annual report solely because a venue renews) |
| D9 UI questions | Approve in principle — prompts, not new requirements | Confirmed as prompts; the catalogue says so |
| D10 patient-care documentation | Confirm | Confirmed (never a pre-event requirement) |

Other items of the review:

- **Level 2 map** — "Required where applicable": the organizer uploads the map or records that none applies, with the reason; either discharges the row. Applied to venue Level 2 as well, since the catalogue cell is shared — say if venues should keep the plain requirement.
- **Order of Physicians review** — the lane page (`/ministry/order`), when the platform owner turns the lane on, lists the filed Level 3 submissions with the Director's credential information, records the Order's two review items with an audit line (who, when, deficiency reason), and shows the clinical content of the filed plan (sections 3–9 and 11). The organizer's Director row reports the verification state. The Ministry's outcome stays the Ministry's; the Order records no outcome.
- **Event lifecycle** — already in the build: material change (`/events/[id]/change`, after filing; an edit re-derives the level and affected requirements), postponement and cancellation (`/events/[id]/lifecycle`; the record and its history remain), short-notice submission (accepted, marked expedited, no requirement waived).
- **Official review statuses** — the three outcomes verbatim, the acknowledgment, the Ministry reference number, reviewer and date, and the revision history are in the Ministry console and on the organizer's record.
- **Cross-cutting, recorded here and not built in this change:** (1) *Platform owner layer* — event and venue data and dashboards remain accessible through the platform owner's administration while the Ministry alone holds regulatory decision authority (non-negotiable 13). (2) *AI readiness* — the event and venue module exposes its workflow context, permissions, requirement logic and data (the catalogue, the resolver, the frozen requirement record) for the user and Ministry-reviewer assistants; the platform-level intelligence assistant stays a platform function (non-negotiable 14).
- **Confirmed vs. for review** — the catalogue records each decision's state. A decision still "for review" never changes a rule and never becomes a submission blocker; the record page says which decisions stand.


## Partner UI audit (8 October 2026) — applied

The partner audited the organizer workflows (`UI_In_the_Product_Specification.docx`, received 8 October; red = major). Each comment and where it landed:

| Comment | Build |
|---|---|
| Product specification: a section under generated records / Ministry review on formal downloadable certificates, two types | Recorded below as the addendum to the product specification (S7); the specification document itself is the partner's to amend |
| `/applicability?subject=event`: ask first whether this is a planned organized event (Yes / No / Not sure), then the five criteria in the audit's wording; any one → required | Two-step event branch; the criteria text is the audit's. "NEHRAT required" renders as "Certification required" (copy rule: the instrument is not named for the task) |
| `/services/certify-an-event` 1 (major): replace the fixed document counts | Per-level package wording (risk assessment and notification; standard Level 2 package; comprehensive Level 3 package incl. a declaration from each EMS agency) and a note that the exact list appears on the record |
| 2: name the certificate in step 5 | "Download your Event Health and Medical Readiness Certificate from the Ministry of Public Health when the requirements are satisfied." |
| 3: tighten the scope statement | The audit's sentence, plus one line routing venues and facilities to their own services (the footer is shared by every public page) |
| `/services/register-a-venue`: remove "starts at Level 2, whatever the score" | "A qualifying recurring venue completes the assessment annually. Its final level is determined by the assessment score and any applicable minimum-event-level rule." |
| `/services/register-a-facility`: official category wording; CPR and AED defined once behind an information icon; "Register each AED where required or present"; incident wording; "facility cardiac-readiness coordinator"; "during operating hours"; certificate as the final step; conditional logic per category | All applied in `public-landing.json`; the definitions sit above the category list and the rest of the page uses the initials |
| "Level 1 event: requirements cannot be updated or filled" / "shadowed" | Not reproduced locally: a fresh Level 1 event created by the test organizer has every input enabled (25 controls). A card the viewer would write but cannot now says why on the card (submitted / archived / cancelled). The record id of "NEW Test 1" is needed to look at the live row |
| First aid / BLS: no names, counts or shifts; identify the provider, confirm BLS, ask whether it also covers first aid; Level 3 shows each agency's declaration state | B5 is "BLS medical response team(s)": the invited provider, a BLS confirmation and the first-aid question. B4 reuses the provider's Yes; otherwise one confirmation. B20 lists each agency with its declaration state |
| Level 1 structure: contact → first aid → EMS access → supplies → emergency access → patient extraction → communication → escalation → AED (recommended) → review and submit; AED never blocks; care documentation as a statement; arrangements summary generated; post-event report conditional | Catalogue revision 2026-10-08.1: every Level 1 row is a confirmation or one short field; a No on vehicle access or the patient route asks for the alternative; the AED row is Yes/No with an optional location; the final step carries the generated medical arrangements summary; the post-event row says it is required only after a reportable event or a Ministry request |
| Level 2: confirmations only; renames (BLS team, patient access and extraction, receiving emergency department(s)); EMS card without "if an ambulance leaves"; AED without a name; supplies confirmation; backup channel optional; concise escalation; map "where applicable" kept; treatment point and plan recommended; care documentation one confirmation | Applied; "what happens if an ambulance leaves" lives in plan section 14 |
| Level 3: the sequence organizer → Director → first aid → BLS → treatment post → EMS → CPR/AED → supplies → access → extraction → receiving ED → communications → medical command → major-incident plan → insurance → site map → deployment map → EMS declarations → care documentation → plan → review | The catalogue order is the sequence; the treatment post is location + operational; medical command is location + the Director's confirmation; the major-incident row is the plan's section 12; the post-event report at Level 3 says "after every Level 3 event" |
| Facility side (table, Major): step 3 is "Responsible contact" with one person; the plan's responsible-persons panel becomes a read-only contact card with an Edit link; step 6 reads "Ensure EMS personnel are met or directed promptly to the patient"; the annual readiness confirmation, the maintenance dates and the coordinator leave the AED record; the registry status derives from the AED record (Operational / Not operational / Not accessible during operating hours) | Applied (`app/facilities/**`, `lib/rules/data/facility.json`, `lib/rules/facility.ts`). Removed fields stop being collected; their columns stay so existing rows remain readable |
| Facility side (Minor): "AED information"; no "Latest readiness check"; "EMS contact number used by the facility"; "Use a separate map pin for this AED." with its note; expanded category 1 and narrowed category 3 | Applied |
| AED photo; plan font; lean AED record; cardiac emergency response plan ends AED information → facility information → responsible contact → readiness confirmation (six items, drill date) → facility confirmation (statement, representative, date) → review and submit | Applied; the confirmation date is the platform's (Asia/Beirut), never typed. The AED photo is an optional image stored like other uploads |
| Final stage: the facility registration/readiness certificate and its verification | `app/facilities/[id]/certificate` once the registration is complete, verifiable at `/lookup/facility/[token]` by an unguessable token that returns name, record id, category, registration date and status only. No QR image yet: the platform carries no QR encoder; the verification address is printed in full |
| Venue registration: nothing happens after Continue, the fields clear | The server now names the refused field; the form keeps every value, shows the reason beside the field and focuses it; Arabic-Indic digits in the telephone number are accepted. Covered by `e2e/app/venue-registration.spec.ts` |

### Product specification addendum — certificates (8 October 2026)

Under *generated records / Ministry review*: the platform generates formal downloadable certificates once the applicable requirements are satisfied and the Ministry has recorded the corresponding outcome. Two certificate types:

1. **Event Health and Medical Readiness Certificate** — issued on the outcome "Health and medical preparedness requirements satisfied" for an event; carries the Ministry reference number, the event name, the level and the verification reference.
2. **Venue / Facility Registration or Readiness Certificate** — issued for a hosting venue on the same outcome (annual, with the validity date the Ministry sets at issue) and for a registered facility once its registration requirements are complete.

Both are verifiable through the public verification page by their reference, which returns the four public fields only.

Open after this change, for a ruling: the facility validity record still lists legacy device-date rows (pad expiry, battery expiry, latest readiness check) for records that hold old dates; new records never produce them. Hide them, or keep them read-only.
