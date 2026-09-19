# Interface simplification — September 18

The owner requested a quieter platform: fields and the next action visible, with supporting explanations available through an information button. The later Level 2 hover report identified a layout regression in that control.

## Changes

- Shared help now floats above the page, stays inside the viewport, and does not resize its trigger or surrounding layout. It supports mouse hover, click/tap, keyboard activation, Escape, and outside dismissal. English and Arabic use the same control.
- The event header has one level figure with optional calculation details. Level, submission date and days remaining align consistently; overdue days have an explicit label.
- Next-action cards keep one short task and a separate action link. Opening help cannot navigate away.
- Secondary instructions on account setup, assessment, requirements, plans, facilities, venues, reviewer and owner pages use optional help. Required certifications, deadlines, errors and reasons for unavailable actions remain visible.
- Dashboards use Pending and Completed. Submission history and assessment versions expand on demand.
- A compact shared header keeps language, notifications and the account menu together. Organization and role details live in that menu. Display preferences use a single settings button.
- Mobile review columns stack, and EMS upload controls wrap within the screen.
- Demonstration accounts remain visibly identified. The full demonstration disclaimer remains present on printed certificates.

Regulatory calculation, permission and filing rules are unchanged. Existing visual comparisons explicitly identify the regions changed by the owner's request; unchanged regulatory regions retain their comparisons.

## Verification

- TypeScript: passed.
- Unit tests: 439 passed across 43 files.
- Focused interface and organizer browser checks: 12 passed. Includes a 30-frame hover stability check, matching label positions, 320 px English/Arabic touch navigation, and mobile checks for organizer, EMS, director, Ministry administrator and owner.
- September 20 TypeScript and unit rerun: passed; 439 tests across 43 files.
- Full application coverage: all 181 distinct application tests passed across the two batches and targeted clean reruns. Batch 1 passed 102/103; its English submission journey was interrupted by a logged development-server restart and passed on a fresh server. Batch 2 passed 76/78; Arabic display settings were blocked by Next's development badge (now disabled), and the history test expected the previous save message. Both corrected checks passed. The final reruns also repeated the English/Arabic creation-to-print journeys and both display-settings checks.
- Medical-plan history: the revised test verifies two saves and reads the first version after reload; passed.
- Initial visual run: 64/65 passed. The Arabic AED table exceeded its 2% threshold because the shortened heading changed its fractional-pixel capture origin. Region captures now align both sides to the pixel grid without changing dimensions or thresholds; both AED languages passed. The complete visual rerun passed all 65 checks with zero retries. The production build, including TypeScript validation, passed. All four production-runtime smoke tests passed: English/Arabic upload limits and recovery, event-type/previous-edition branching, and concurrent director/organizer plan edits. Release checks are complete.

## Test resources — September 20

Testing was paused when the Mac ran below 1 GB of free disk. After the owner authorized cleanup, approximately 8 GB of Hugging Face Xet download chunks were removed, restoring 9.5 GB free. The separate downloaded MedGemma model, project documents, databases and uploaded files were retained. The unchanged disk-space guard now passes and release checks have resumed.

## Operating status

Automatic email remains postponed at the owner's request until a sending domain is available. This interface update does not change storage: production data remains on Railway's persistent SQLite volume; Supabase migration is still separate work.

## Production backup — September 20

Before deployment, a fresh Railway database backup passed integrity and foreign-key checks across 49 tables. The private local copy is under `var/backups/interface-backup-20260920`; the server copy is under `/data/interface-backup-20260920`. The database SHA-256 is `cbfe2e307f7e34e1b6fb7aed2d12338fff55f04649b7c79989d3c87c0d4115a4`. No live records were edited during verification.

## Editing this interface later

Optional help is implemented once in `components/InfoNote.tsx`; shared header and display controls live under `components/`. Spacing and responsive behavior live in `app/globals.css`. Next-step labels are in `lib/rules/submission.ts`; calculation and permission rules were not changed by this release. Page-specific English/Arabic text remains beside its field or action.
