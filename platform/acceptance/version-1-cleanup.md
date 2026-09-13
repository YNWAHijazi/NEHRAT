# Version 1 interface and journey review — 12 September 2026

## Interface changes

- Ministry configuration opens on its values and links. Removed the versioning essay and the internal deferred-capability section. The latter is now collapsed under Planned capabilities in the owner console only.
- Added an information button for secondary help: mouse hover, click/touch, keyboard activation, and Escape. The expanded text remains in normal flow to avoid off-screen popovers. Both languages are retained.
- Capability descriptions, vendor-management notes, configuration-field help, commercial/assistive group notes, the Order lane explanation, account-admin introductions, dashboard service explanations, and supporting requirements copy now use this control.
- Removed the repeated capability prerequisite panel and the explanation of audit logging. Actual unmet prerequisites still appear beside the disabled enable button. Public commercial disclaimers, required declarations, errors, destructive-action consequences and regulatory gates remain visible where relevant.
- Renamed capability audit heading to Change history and shortened its empty state. Vendor category options now follow the selected language.
- The Ministry header wraps on small screens. Archive confirmation now uses the same Archive label as the organizer dashboard.
- Organization-registration guidance appears during signup only, not on sign-in and password recovery.

## Journey loose end repaired

Password recovery previously issued database tokens but did not call the mail transport. It now sends an expiring single-use activation-route link through the existing verified-TLS sender. Unknown, suspended and demonstration accounts do not receive mail. Repeated requests within a minute do not issue another token. Failed delivery removes that attempt's token so a retry is possible; older delivered links are not invalidated. Public responses do not reveal account existence, and an unconfigured sender has a separate honest unavailable state with a support link.

No external emails were sent for this review. Live invitation, activation and password recovery still require sender configuration and an inbox delivery check.

## Release scope

Local changes only. These checks do not migrate the database, publish a Ministry policy, enable fees/vendors, push GitHub, or deploy Railway. Supabase migration and production cutover remain outstanding. The dependency advisories noted in the prior workflow handover still need a separate release review.

## Verification

- Production build completed successfully, including type validation and static page generation, in `.next-v1-build` (ignored build output).
- 429 unit tests passed across 42 files; final TypeScript check and `git diff --check` passed.
- 34 distinct targeted browser checks passed across the review runs: 11 capability checks, 8 English/Arabic journeys, 6 role dead-end scans, 4 help/recovery checks, 2 event duplication checks and 3 workflow/report/certificate checks.
- The first browser pass found an actual mobile header overflow, repaired with wrapping. Its other failures were outdated selectors: information buttons were counted as feature controls, a prerequisite was expected after a vendor already existed, and a source-note selector targeted an unused component. The final recovery assertion was scoped to the page's alert because Next.js also inserts a route-announcer alert. Corrected checks passed on subsequent runs. This is not a claim of a single clean full-suite run.
- Inspected desktop and Arabic mobile vendor screenshots after the fix. Real SMTP delivery, production database migration and deployment were not exercised.
