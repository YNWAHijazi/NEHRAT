# September 18 platform review

This release addresses the partner's September 15 screenshots and reviews the organizer, EMS, Medical Director, Ministry and owner workflows. Source changes are in the existing local project. The deployment target is the connected GitHub `main` branch and Railway NEHRAT production service; Railway's deployment history records the deployed commit and live status.

## Partner feedback

| Reported issue | Change | Evidence |
| --- | --- | --- |
| Attaching a map causes a server exception | Raised both Next.js request limits above the advertised 20 MB file limit; shared client validation rejects unsupported, empty and oversized files before upload. Server validation remains enforced. | Railway logs identified the original 1 MB server-action limit. Production-mode browser tests upload and download a byte-identical 20 MB map in English and Arabic and reject a file one byte over the limit. |
| Unrelated sports remain visible after selecting an event category | Secondary activities are inside an optional expander; changing the primary type clears stale secondary selections. | Browser test selects motor racing, adds running, changes category, and checks that the old selection is cleared. |
| “This event has been held before” has no visible follow-up | Selecting it immediately reveals the existing previous-history assessment question and an archive/duplicate hint. The same question is not repeated below. | Browser test verifies the question appears and its answer is selected. Regulatory scores and thresholds are unchanged. |
| The Medical Director should prepare the medical plan | A confirmed Level 3 Director can open and edit the shared plan; the organizer retains submission responsibility. Other nominees cannot open the full plan. | Browser test walks Director → shared plan → organizer view and verifies refusal for an unrelated event and EMS account. Protocol §11 is the basis for Level 3 access. |
| Plan components are difficult to fill | The first unfinished section opens; each section has a “What to include” help control with the existing guidance. | Browser test opens the guidance and saves the Director's contribution. |
| Shared edits could overwrite each other | Version checks and a transaction protect text and attachments. Prior attachment bytes and authors are retained. Conflicts keep unsaved text in the browser. | Two-session browser test rejects a stale organizer save and downloads the earlier attachment unchanged. |
| Mobile pages clip or become unusable | Verified the revised requirements/upload journey at 390 px in both languages. | Full-size upload tests assert no horizontal page overflow. |

## Additional corrections

- Archived records refuse mutations even from old tabs, including invitation, plan, compliance and report actions.
- Removed or withdrawn nominations cannot submit operational details or declarations through stale forms. Already signed declarations are not silently overwritten.
- Unexpected page errors provide a retry and a route back to the dashboard.
- Resend HTTPS sending is implemented and tested with simulated provider responses; existing SMTP fallback remains supported.
- Updated vulnerable dependencies. The installation audit reported zero known vulnerabilities.
- Removed the accidentally tracked Railway SSH files from future commits while keeping the local files. The exposed key was not registered in the checked Railway account or workspace. The separate active Railway key was preserved. No Git history rewrite was performed.

## Verification

| Check | Result |
| --- | --- |
| Unit tests | 439 passed across 43 files, including actual database action-boundary checks and Resend success/failure cases. |
| Application browser suite | 172 passed with no test retries: 95 in shard 1 and 77 in shard 2. Covers accounts, event/venue/facility journeys, provider nominations, permissions, reviews, certificates, printing, archive/duplicate, owner controls and quiet help. |
| English/Arabic reference suite | All 65 checks resolved: 63 passed in the full run; two venue checks passed after correcting an outdated expectation that still required the permanent explanation removed in the September 13 simplification. The new help behavior was also exercised in both languages. |
| Final production build and production-mode regression tests | Build passed; all four production-mode tests passed, including byte-identical 20 MB uploads in English and Arabic. Mobile captures were visually reviewed. |
| Final affected-journey check | Seven additional checks passed: nomination withdrawal/removal, cancellation, filing through all three Ministry outcomes, desktop/mobile help, administrative visibility and unavailable-email recovery. |
| TypeScript and diff validation | Passed. |
| Live data upgrade rehearsal | Passed on a disposable copy: all existing data in 49 tables preserved; integrity and foreign-key checks passed. |

The first unsplit browser run exhausted this laptop's available disk after 97 passing tests. It was not counted as a successful run. Generated caches were cleared and the complete app suite was run successfully in two fresh-server shards. No personal documents or working databases were deleted.

## Data and operating limits

The application still uses SQLite on Railway's persistent `/data` volume. Supabase connection work exists, but the application and stored records have **not** been migrated to Supabase. GitHub stores code, not the live database or uploaded files.

Before release, a consistent live backup was created at `/data/release-backup-20260918` and downloaded into the ignored local `var/backups/release-backup-20260918` directory. SHA-256: `90b3ac5f915c8aa0ad7f21d83e739c22046a8a57aace5a97860239c5e6992b38`. Integrity and foreign keys passed. The Railway volume currently has a 500 MB capacity; uploaded files and plan attachment history count toward it.

The owner explicitly postponed email activation on September 18 because there is no sending domain yet. Automatic invitation, activation and password-reset emails remain unavailable. Manual invitation links are available. No external test emails were sent and no inbox-delivery claim is made. See [Resend setup](resend-setup.md).

See [Operations](../OPERATIONS.md) for editing, previewing, checks, publishing, backups and recovery. A Ministry preparedness certificate records the applicable determination; it is not an event licence.
