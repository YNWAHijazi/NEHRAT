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
