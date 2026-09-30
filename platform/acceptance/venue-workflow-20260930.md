Venue workflow — 30 September 2026

Sources reviewed: handoff 5/source-documents/README.md; Protocol, Annex A, requirements/compliance form, Annex D, medical-plan guidance, PAD policy and product specification. The newly attached Annex B has the same SHA-256 as the previously supplied revised English Annex B: 4eeb3ed0cd8becd09acdcf6b0e7048248b488ea4204e8f5e81a71383f7a7f95f. Its raw file is preserved in handoff 5/source-documents/updates/2026-09-30.

User-requested workflow: prepare details/assessment, complete level-specific requirements, submit a complete package, Ministry requests changes or accepts, issue certificate on acceptance. This replaces the old automatic certificate on assessment. Existing certificates are preserved and remain accessible. Existing records have no fabricated requirement confirmations or map pins.

Venue type dropdown; district dropdown (not a complete municipality gazetteer); street/town input and a confirmed map pin. District choices checked against MOPH contact/geography references: https://www.moph.gov.lb/en/contact and https://maps.moph.gov.lb/server/rest/services/Administrative_Zones/MapServer.

Requirements: actual saved answers, supporting files and explicit required/recommended status. Post-event reports remain with the specific event per Annex D; an annual venue assessment is for routine operations and does not invent an annual post-event report. Professionally prepared venue plans are uploaded by the operator with preparer/approver details; this is not an authenticated EMS/Director collaboration workflow for venues.

Snapshots: submitted venue answers and file bytes are copied into an immutable revision; Ministry feedback remains visible. Acceptance creates the dated certificate; renewal keeps the record ID and earlier certificates/files, preserves details, and requires a fresh assessment and confirmed arrangements. Submitted/accepted requirements are locked server-side; material-change reporting remains available.

Cross-service consistency: shared identity and navigation across event/venue/facility tabs. Facility Submit collects its existing readiness confirmation; continuous AED upkeep and incident reports remain available. This does not introduce a new Ministry approval law for facilities.

Not part of this release: the previously identified event Medical Director approval gate; email/OTP activation; Supabase production migration; automatic off-site backups. These must not be described as completed by the venue update.

Validation:
- TypeScript and production build passed.
- 49 unit-test files passed: 488 tests.
- 20 targeted browser checks passed (19 in the regression run, the corrected venue journey in its final focused run). Includes event tabs/default dates, facility registration/AED/confirmation/incident/Ministry map, tenant restrictions, venue/facility tab geometry in English/Arabic at 1280 and 375px, and venue end-to-end review/renewal.
- A captured real server-action request from before filing was replayed after filing with altered answers. The stored answers stayed unchanged.
- Another account could not access the venue document. Ministry could access its submitted snapshot. Renewal preserved revision 1 file access and certificate 1.
- No production records were edited for these tests. The database was disposable (var/release-runtime.db).

Pre-release live backup:
- /data/venue-workflow-backup-20260930/database.sqlite
- 52 tables; integrity passed.
- SHA-256: 922010078e7716e02352aa6bcde598a4faff92b20cefaf4a06e0714393d2a958
- Schema changes are additive. New assessment versions explicitly start without an issued certificate; all existing versions retain their issued-certificate flag.
