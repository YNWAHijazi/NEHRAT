# Supabase transition and usability work

Started 2026-09-11 at the owner's request. The owner authorizes simplifying the existing design while preserving the workflow; the old pixel reference is not a requirement to retain unnecessary interface elements. Regulatory derivation, nomination boundaries, Ministry outcomes, EN/AR support, and existing records remain part of acceptance.

## Verified starting point

- Railway project/service: NEHRAT; environment: production; repository: YNWAHijazi/NEHRAT.
- Active deployment inspected: commit `66e85d0eaa36f1458e154fa073f530b2c9d348b2`.
- Node 22.23.2; SQLite source: `/data/nehrat-demonstration.db` on persistent volume `nehrat-data`.
- A consistent snapshot was created via SQLite `VACUUM INTO`, using a read-only source connection, at `/data/migration-backup-20260911-01/database.sqlite` and downloaded into `platform/var/migration-backups/railway-20260911.sqlite`.
- Verified local backup: `platform/var/migration-backups/verified-20260911/database.sqlite`; manifest and schema inventory are beside it. All are Git-ignored. Integrity check passed and foreign-key check found zero violations.
- Inventory: 47 tables; 10 accounts (9 marked demo); 7 events (5 marked demo); 4 organizations (3 marked demo); 3 venues and 2 facilities, all marked demo; 10 invitations; 4 submissions. Demo status is inherited by some dependent tables rather than stored directly.
- Stored document BLOBs: 9 event attachments, 3 plan attachments, 3 shared documents, and no venue attachment BLOBs. A non-null BLOB count alone does not establish that every expected attachment is present.
- Non-demo records must be preserved. Their actual business significance has not been confirmed by the owner.
- This is a point-in-time backup, not an automated backup schedule. New production writes will require another snapshot at cutover.

## First local delivery

- Service selection is three direct links, with outside-click, Escape, and keyboard-focus dismissal. The event action says “Start an event” / “بدء فعالية”. No derivation or eligibility logic changed.
- Account creation is expanded near the top of Users and Roles; it retains the existing permitted roles and activation-link mechanism.
- Sign-in demonstration descriptions now correctly state that Ministry administrators record outcomes and platform owners can inspect records and manage users. No permissions were expanded.
- The Records screen offers a CSV download reflecting the current filters. The endpoint enforces `viewRegistry`, uses the session's demonstration boundary, excludes credentials and document contents, and disables response caching. CSV output includes Arabic and protects text cells against formula execution.
- `npm run db:backup` creates a consistent, private, non-overwriting SQLite snapshot with schema, counts, document-byte inventory, SHA-256 checksum, integrity check, and foreign-key report. It does not import or migrate the source application.

## Target and migration order

1. Keep the Next.js application and its rules engine. Continue serving it on Railway. Use a separate staging environment and database for review.
2. Put relational data in an owner-controlled Supabase Postgres project. Confirm the project and the Ministry's acceptable hosting region before transfer. Start with server-side access; do not expose the legacy account/session tables through a public Data API.
3. Translate and test the schema and SQL explicitly. Existing SQLite access is synchronous and spread across `lib/db.ts`, `lib/queries.ts`, authentication, server actions, and route handlers. The old README's “one file plus queries” estimate is incorrect. Postgres calls will be asynchronous. Preserve transactions, identifiers, constraints, assessment versions, nomination links, demo boundaries, and Beirut date rules. Replace SQLite-specific `datetime`, `strftime`, PRAGMAs, custom functions, and insert-result handling where they occur.
4. Rehearse import into an empty staging database from the verified snapshot. Compare per-table counts, foreign-key relationships, identifiers, and document hashes. Keep existing account IDs stable; use a separate mapping for Supabase Auth identities.
5. Move documents to private Supabase Storage buckets. Preserve each document's event/invitation ownership, MIME type, and metadata. Authorize every download before issuing a short-lived link. Back up storage objects separately from the database.
6. Migrate identity separately. Existing credentials are custom scrypt hashes; do not assume Supabase Auth can directly import them. Validate a supported transition or arrange account activation/reset. Preserve application roles and event-scoped access independently of login identity. Account creation must not grant unrestricted EMS/director access.
7. Connect a verified email sender. Cover activation, reset, nomination, and status-change messages; persist delivery jobs, retry transient failures, and surface delivery status. Avoid duplicate delivery on retries. No messages have been sent during this work.
8. Walk organizer → EMS → Medical Director → Ministry review in English and Arabic, including non-applicable requirements, pending organizations, returned submissions, attachments, and post-event reporting. Exercise role refusals and demo isolation against Postgres.
9. Review the staging link. Before cutover, pause writes briefly, take a fresh source snapshot, import and reconcile, then switch the deployment configuration. Retain the source backup and document rollback. Once Postgres accepts writes, rollback requires reconciling those new writes; restoring the old SQLite file alone would lose them.

## Remaining access and decisions

- Supabase destination supplied by the owner: `https://zdujmsnlvohidgjlrvqf.supabase.co`. Session pooler: `aws-0-ap-northeast-2.pooler.supabase.com:5432`, database `postgres`, user `postgres.zdujmsnlvohidgjlrvqf`. The screenshot shows Seoul; suitability for live Ministry records remains to be confirmed.
- Private local connection configuration prepared at `platform/.env.supabase-staging.local`, excluded from Git and created with owner-only permissions. The supplied password has been stored there. This file is not automatically loaded by Next.js. Secrets belong in local/provider configuration, not chat or version control.
- `npm run db:check-supabase` runs an explicitly read-only connection check, pinned to the supplied project and pooler, with certificate verification enabled and credential-safe error reporting. The initial certificate-chain failure was resolved using the owner-supplied `prod-ca-2021.crt`, copied to Git-ignored `platform/var/supabase/` and configured through `PGSSLROOTCERT`. Connection and authentication succeeded on 2026-09-11; no base tables exist in the `public` or `nehrat` schemas. Client-to-pooler TLS is certificate-verified. `pg_stat_ssl` reports SSL false for the pooler's backend session, which is a different connection hop. No records or schema have been transferred.
- Whether non-demo production rows are real submissions or test records. Default: preserve all.
- Email sender/domain and provider access.
- Hosted staging environment and preview domain.

Supabase migration, Supabase Auth/Storage, email delivery, scheduled backups, and hosted staging are not implemented by this first local delivery. No application deployment or database cutover has been made.

## Verification and preview

- TypeScript and all 418 unit tests pass, including backup/restore with committed WAL transactions and BLOBs, overwrite refusal, export access checks, and CSV formula protection.
- All 65 reference browser checks passed before the final mobile-menu adjustment and demonstration-description correction.
- The full app run reported 152 passed, 3 flaky, and 2 failed. One failure exposed an Arabic mobile-menu overflow, which was fixed. The other was the existing Ministry attestation flow; its retry encountered state modified by the first attempt.
- A fresh, single-worker rerun of the Ministry and owner-controls files passed all 15 checks, including the corrected mobile menu in EN/AR and a filtered CSV download. The three other full-run failures passed on retry. A completely clean full-suite run has not been established.
- Local preview: `http://127.0.0.1:3100/signin`, using `var/preview-20260911.db` and `.next-preview`. It contains seeded demonstration data, not the production backup. Its availability depends on the local dev-server process; it is not hosted staging.
- No regulatory gating reasons or outcome strings were changed. The export uses the existing `viewRegistry` permission and refuses unauthorized requests with 404. New action copy: “Start an event” / “بدء فعالية” in the service picker; “Export these records (CSV)” / “تصدير هذه السجلات (CSV)” in the administrative Records screen.

## References

- [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase email transport](https://supabase.com/docs/guides/auth/auth-smtp)
- [Railway volume backups](https://docs.railway.com/volumes/backups)
