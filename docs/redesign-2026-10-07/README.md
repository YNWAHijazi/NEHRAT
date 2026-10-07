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

