# Launch check — 27 September 2026

## Scope and language

The owner requested a final plain-language pass and operational checks. More than 130 messages were revised across account setup, organizer requirements, medical-team tasks, post-event reporting, venues, facilities, Ministry review and owner settings. English and Arabic messages were reviewed together. Short labels identify actions; optional help keeps longer explanations off the main workflow.

Examples: “Final checklist,” “View Ministry decision,” “Decision history,” and “To change a submitted document, upload a replacement.” Account setup now shows password requirements derived from the same policy used for validation.

The help page now matches the implemented Level 3 plan responsibility and optional Level 2 major-incident checklist. Organization messages no longer claim separate Ministry registration unlocks submission. Old source-document quotations, legal declarations, official outcome wording, clinical checklist items and numeric rules were not broadly rewritten. Existing historical notifications were not altered.

This is a plain-language revision, not a certified reading-level assessment. It does not replace observation of people unfamiliar with the platform. Necessary medical and official terms remain.

## Operational evidence

- Live database and uploaded files remain on Railway SQLite. Supabase migration is unfinished and was not part of this release.
- Storage check before the recovery drill: 395,120,640 bytes free; database file 21,360,640 bytes. The configured volume limit is 500 MB. This establishes current headroom, not capacity for an unspecified public workload.
- Email sender, Resend credentials and email OTP are not configured. No real delivery or OTP activation is claimed. The owner previously postponed this until a sending domain is available.
- Native Railway backup schedules and native snapshots were empty. Both schedule setup and backup creation returned “Not Authorized” for the current API session. The workspace reports Hobby. The cause of the permission refusal is not yet established. A Railway browser sign-in was requested; no paid plan change was made.
- Fresh consistent snapshot: `/data/recovery-check-20260927/database.sqlite`.
- SHA-256: `c92f1d63c6931f6a0649bcf05ebfffec811189e026a242ad5faa14cabb6af2cf`.
- The recovery script restored to a separate new file, verified the snapshot hash, integrity, foreign keys, row counts in all 52 tables and all 15 stored BLOB files. A committed write survived closing and reopening the restored copy. The live database was not replaced or modified.
- Separate fixture checks verified refusal to overwrite an existing destination or source file.
- This is a database recovery drill on the existing host. It is not a complete host-loss disaster-recovery test or proof of automatic/off-host backups.

## Short usability pilot

Use consenting testers who have not been shown the interface. Let them use their usual phone or computer and their preferred language. Use test data. Do not tell them where to click; record where they hesitate, misunderstand a label or need help.

| Role | Task | Success |
| --- | --- | --- |
| Organizer | Create an account and start an event. | Can explain what is required next. |
| Organizer | Add a map and invite the medical team. | Finds the controls and understands Pending versus Complete. |
| Medical Director / EMS | Open an invitation and complete the Level 3 plan. | Finds the event details and their own responsibilities. |
| Organizer | Submit the completed application. | Finds the receipt and reference; understands that Ministry review follows. |
| Ministry reviewer | Find the application, review it and record the outcome. | Can locate documents and distinguish review checks from the final outcome. |
| Organizer | Retrieve the certificate and duplicate an old event. | Finds the certificate; changes dates in the copied application. |
| Venue operator | Renew a venue and retrieve the previous certificate. | Uses the same venue ID and can distinguish certificate versions. |
| Facility operator | Register a facility, place its map pin and record AED readiness. | Completes applicable fields and understands anything awaiting Ministry review. |
| Administrator | Create, activate, change the role of, suspend and restore a test account. | Understands who can sign in and what each role can access. |

Record completion, time taken, requests for help, misunderstood wording and any blocking error. Resolve blockers before inviting the public. Email delivery, OTP and password reset need a separate real-inbox check after the sender is configured.

## Validation

- TypeScript and production build passed.
- 469 unit checks passed across 46 files.
- All 187 distinct application browser checks passed across the two isolated shards and the targeted rerun. The second shard passed 82/82; the first passed 104/105 before an obsolete assertion was corrected. The final invitation/help rerun passed 17/17, including that remaining check.
- Older assertions were updated for the approved plain wording, moving demo dates and the already-implemented Level 3 medical-partner plan access. The test still requires organizer-only insurance and compliance documents to return 404 to EMS. No application permission was widened to satisfy a test.
- The browser checks cover account activation and roles, event creation/submission/review, uploads, shared medical plans, certificates, venue renewal, facility forms/maps, post-event reports, and English/Arabic phone navigation. The 320-pixel English and Arabic event captures were visually inspected.
- The final help-page clarification was rebuilt and included in the last targeted run. This pass did not rerun the separate historic prototype pixel-comparison suite; no new pixel-baseline claim is made.
- Rule-data comparison found only text changes: no numeric values, booleans, keys or array sizes changed.
- Database recovery verification is described above. Real email delivery, automatic backups and unfamiliar-user testing remain unverified or pending as stated.

Application changes: commit `3d7bbb9`. This release is suitable for a supervised pilot. Public-launch sign-off remains pending email/OTP setup, automatic-backup access and the usability pilot. Deployment status must be checked against the release commit.
