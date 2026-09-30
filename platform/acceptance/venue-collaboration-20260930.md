Venue collaboration and record IDs — 30 September 2026

This release supersedes the manual medical-document provenance and deferred event-plan approval described in venue-workflow-20260930.md. It does not declare the whole platform ready for public launch.

Source: the attached ANNEX B Revised (1).docx matches handoff 5/source-documents/updates/2026-09-30/ANNEX B Revised.docx (SHA-256 4eeb3ed0cd8becd09acdcf6b0e7048248b488ea4204e8f5e81a71383f7a7f95f). The user's latest instructions assign clinical entry to invited medical partners and require Medical Director approval of Level 3 plans.

Responsibility formula

- Annex B selects the requirements by level. Optional items never block submission.
- Medical plan: Level 1 not required; Level 2 recommended (events may have a specific Ministry request); Level 3 required, prepared by EMS or the Director and approved by the assigned Medical Director. Editing the plan requires fresh approval. Event approval is tied to both the plan version and assessment version.
- Venue contact is derived from the saved responsible person's name and phone. Director appointment is derived from an accepted invitation, licence and contact details.
- Organizer: venue details, assessment, emergency-vehicle access, insurance, final declaration and submission. Level 1 routine first-aid/transport/supplies/communication arrangements may also be recorded by the operator.
- Confirmed EMS or Director: clinical requirements such as BLS teams, CPR/AED arrangements, clinical supplies, EMS coverage and patient transfer. Medical command is Director-only. Each participating EMS agency supplies its own Level 3 readiness declaration.
- A green clinical requirement needs a complete, explicitly confirmed answer from a currently assigned, active professional at the current assessment version. Free-text preparer names alone do not count.
- Submission requires all required rows, all outstanding invitation responses, closed details/assessment edits, any applicable fee and the organizer declaration. Optional and recommended items are shown separately.
- Ministry sees the actual answers, attachments, authenticated contributors, Director approval and submitted snapshot. Acceptance issues the certificate.
- Routine venue registration has no invented annual post-event report. Reports for actual events remain with those events.

Experience and safeguards

- Saved details and assessment open read-only, including older venues with incomplete newly separated contact fields. The organizer can explicitly choose Edit while preparing the package. Submitted/accepted preparation is locked server-side, including replayed old forms.
- Changing venue details or assessment clears current medical confirmations; stale open forms cannot overwrite newer work. Renewal keeps the same venue ID, certificates and immutable submitted packages, and requires fresh assessment/team confirmation.
- Responsible name and phone are separate fields. Legacy combined values are split only when a trailing phone number is recognisable; uncertain values need operator confirmation.
- Detailed five-stage venue progress stays visible. Overview, Details, Assessment, Medical team, Requirements and Submit use the same record header.
- Invitation acceptance requires an authenticated account with the matching email, role and demo scope. Creating an account does not accept an invitation. Invitation links expire after 30 days before acceptance. Demo invitations do not send email.
- Events, venues and facilities use their existing record ID in the interface and certificates. New event submissions use that same ID; historical reference aliases still resolve for compatibility. Public verification still requires event date, excludes demo records and exposes only its existing four-field projection.

Validation

- TypeScript and production build passed.
- 495 tests passed across 50 files. New integration coverage checks role boundaries, automatic contact, stale forms, required per-agency declarations, plan approval/invalidation, submission locks, Ministry acceptance, renewal and record-ID privacy.
- 17 distinct targeted browser checks passed. Includes full venue invitation → acceptance → clinical completion → Director approval → organizer submission → Ministry review/acceptance → certificate journey, event/venue/facility tab layout in English and Arabic at desktop/mobile sizes, and public verification privacy. The first combined run had a test-selector failure; the corrected full venue journey passed in its focused rerun.
- The live read-only check found an older-record edge case on VN-0034: incomplete contact fields left details editable. A dedicated integration and browser regression now requires an explicit Edit action even for incomplete saved records.
- Browser writes used a disposable local database (var/release-runtime.db), not production records. Desktop and phone screenshots were visually reviewed.

Pre-release live backup: /data/venue-collaboration-backup-20260930/database.sqlite; 55 tables; integrity ok; SHA-256 b9cbf1f2cb067ce2917b2ab25808df2813446a4f9933436fc4f5073540ba2ab8. Schema additions preserve existing records and historical certificates.

Still outside this release: real invitation-email delivery and OTP activation (the sender domain remains postponed by the owner), Supabase production migration, automatic off-site backups. The platform provides shareable invitation links and in-app notifications for existing accounts while email setup is pending.

Linked-team correction — 1 October 2026

The initial venue collaboration still asked for agency/contact identity inside individual requirements. Those fields now derive from accepted invitations and account contact details. BLS staffing asks for staffing only; EMS arrangements ask for coverage/transport only. The plan author and each agency's declaration identity come from the authenticated contributor. Director identity comes from the accepted appointment. Client-supplied replacement identity values are ignored. At Level 1, Annex B still permits recording a local EMS contact where no agency is invited; once an agency is linked, its identity is automatic.

Organizer requirements separate the organizer's work from medical-team work. Pending clinical cards no longer present empty answer sheets. Actual completed answers and contributor receipts appear for review. Linked team details appear once above the requirements; optional supporting uploads are collapsed. Ministry submissions retain the populated contact/agency answers in their immutable snapshot. Later account-phone edits do not change the filed answers. Acceptance/withdrawal changes invalidate stale editing forms and current Director approval.

Validation: TypeScript, production build and all 496 unit/integration tests passed. Six browser checks passed, including the multi-role submission journey, explicit checks for absence of duplicate EMS/BLS inputs, organizer pending/completed displays, and desktop/mobile English/Arabic layouts. Production backup: /data/venue-linked-team-backup-20261001/database.sqlite, 59 tables, integrity ok, SHA-256 e8f3da62c393b3180d18a7ca86bb9efd09fb1ed41189f7466e5b04658863a3db. No schema change or rewrite of historical submissions is needed for this correction.
