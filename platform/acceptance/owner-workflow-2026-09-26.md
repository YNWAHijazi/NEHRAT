# Owner workflow update — 26 September 2026

This change follows the owner's September 26 request. It intentionally changes several earlier product rules; it is not a claim that an unchanged regulatory source requires these changes.

## Requested behavior

- Five short event criteria; the recurring hosting venue criterion is removed from the event check. Exemptions appear first. The result says certification required/not required and links to the service with Next.
- Hosting venue check: regular events and capacity of at least 1,000, answered yes/no. All six facility categories proceed to registration. Public wording no longer advertises pending activation.
- Public service pages use plain language. The chosen service is preserved through sign-in/signup.
- Organization details are self-service and do not block submission or require a separate Ministry registration step.
- Event progress is always open. Organizer events can be searched and sorted by update time, pending requirements, submission deadline, status or date.
- Level 3 major-incident arrangements/checklist are edited by a confirmed Medical Director or EMS agency. The organizer cannot overwrite them. EMS sees only its medical section on the editor; full plan attachments, unrelated sections and plan history remain restricted. Level 2 has an optional recommendation acknowledgement and no mandatory major-incident checklist.
- Only the confirmed Level 3 Medical Director uploads/replaces the medical deployment map. Other organizer documents retain their owner permissions.
- Requirements provide a next-item link; plan sections provide save-and-continue controls. Review actions say Mark as reviewed and move to the next pending item.
- Duplicating opens the full editable application under a new event ID. New dates and fresh certification are required. A previous serious incident opens a reminder with links to the original reports.
- Incident notification closes 24 hours after the recorded event closing time. Legacy records without a closing time use the end of the event's last calendar day. Submitted post-event reports remain read-only.
- Venue renewal uses the same record ID. Certificate versions remain accessible, printable, and retain their recorded classification and dates. New versions snapshot the venue identity/address/capacity. Older versions retain the identity available at migration; earlier names that were never stored cannot be reconstructed.
- Ministry navigation has horizontal Events, Hosting venues and Facilities tabs; event search matches name, reference, ID and organizer.
- Phone capture is available during signup. Email OTP uses Resend: 6 digits, 10-minute expiry, five attempts, resend throttling, single use and no plain-text code storage. It is enabled with REQUIRE_EMAIL_OTP=true only after a verified sending domain and mail credentials are configured. When enabled, failed delivery never bypasses verification.

## Open configuration / clarification

- No sending domain has been provided. Real email/OTP activation remains pending. No test sends real mail.
- Existing routine-activity exemption at a licensed facility is preserved. A blanket exemption for all high-risk events at licensed venues was not assumed.

## Validation

- TypeScript passed. All 455 unit/rule/security tests passed across 45 files, including real SQLite action checks and mocked email delivery.
- All 185 application browser cases resolved: 100 passed in shard 1 and 80 in shard 2; the five failures were corrected or updated for the requested policy and cleared in a fresh 10-case run. That run also repeated both complete organizer → Ministry → certificate journeys and the new service workflows. One initial failure was a logged local dev-server restart, not a production exception.
- English and Arabic public screens were visually checked at 320px; no horizontal overflow was found. All 65 visual-reference checks passed.
- The production build passed, including type checks. All eight production-runtime browser checks passed: public intake/sign-up routing, role-specific medical tasks, organizer sorting, duplicated event edits persisting, venue certificates, Ministry service navigation/search, full-size map uploads in both languages, and concurrent shared-plan editing.
- This file is not a deployment claim. Deployment status is recorded separately after verification and backup.

## Data protection

Before release, a live snapshot was created at `/data/release-backup-20260926` and downloaded into the ignored private directory `var/backups/release-backup-20260926`.

- SHA-256: `1c298c98b046d2b8c2f52813ea246ad54d2828c3ee9b339fbe645d6c79776f45`.
- Snapshot integrity passed with no foreign-key errors.
- Migration was exercised on a separate copy. All existing columns and rows in all 49 original tables matched the snapshot exactly. Added fields, triggers and the email challenge table passed integrity and foreign-key checks.
- The live application remains on Railway's persistent SQLite database. This update does not migrate it to Supabase.
