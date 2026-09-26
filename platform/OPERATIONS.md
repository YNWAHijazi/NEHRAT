# Working on this platform

## Where everything lives

| Item | Location |
| --- | --- |
| Editable source | `platform/app`, `platform/components`, `platform/lib` in this local project |
| Version history | GitHub repository `YNWAHijazi/NEHRAT`, branch `main` |
| Live application | https://nehrat-production.up.railway.app |
| Live records and uploaded files | SQLite on Railway's persistent `/data` volume; selected by `DATABASE_PATH` |
| Email provider | Resend, once the production sender and API key are configured |
| Supabase | Connection prepared previously; application/data migration remains unfinished |

Saving a local file changes the local preview. It does not commit or push it. Pushing a committed change to the connected `main` branch starts Railway's deployment. Database rows and uploaded files are independent of GitHub and require their own backups.

## Edit and preview

From the `platform` directory:

```sh
npm ci
NEXT_DIST_DIR=.next-preview npm run dev -- --port 3100
```

Open http://localhost:3100. The local database defaults to `var/dev.db`; it is separate from production. Use `DATABASE_PATH` to select an existing local review database. Avoid `db:reseed` on any database whose working records you want to keep.

The Ministry administrator manages users, invitations, roles and policy through the platform. The owner manages platform capabilities, fees and vendor listings. Text and layout changes belong in the source files. Regulatory calculations live in `lib/rules`; revise them against the source documents, then run the tests.

## Check and publish

```sh
npm run verify
npm run test:release
```

`verify` includes TypeScript, unit tests, English/Arabic visual checks and all browser journeys. Browser checks use an isolated database and two app-suite shards to limit memory growth. Allow sufficient free disk; the preflight guard refuses an undersized run. `test:release` builds production code, seeds a disposable `var/release-runtime.db`, then tests full-size uploads, form simplification, shared-plan editing, duplication, service navigation and certificate access on port 3102.

Review `git status` and the diff, stage the intended source files, commit them, then run `git push origin main` from the repository. Never stage `.env` files, database backups or private keys. Confirm Railway reports a successful deployment for that commit, then check sign-in and the affected journeys on the live URL.

## Back up and recover

Before a release, create a fresh consistent snapshot with the existing backup script. On Railway:

```sh
railway ssh -- node scripts/backup-database.mjs --output-dir /data/backup-UNIQUE-DATE
```

Choose a new directory each time. The script refuses overwrites and writes `database.sqlite`, `schema.json` and `manifest.json`. Download the folder to private local storage and verify its SHA-256 against the manifest. GitHub is not a live-data backup.

The September 26 release snapshot is held at `/data/release-backup-20260926` and in the ignored local directory `var/backups/release-backup-20260926`. The downloaded snapshot passed hash, integrity and foreign-key checks. The release migration was tested on a separate copy and preserved all existing data across its 49 original tables. See [the release record](acceptance/owner-workflow-2026-09-26.md).

For an application regression, redeploy the preceding successful Railway commit. This release adds columns without removing old columns. Restore a database snapshot only deliberately, with writes paused: restoring an old snapshot would discard records created after it. Keep the current database copy before any restore.

## Email

Follow [Resend setup](acceptance/resend-setup.md). Store `RESEND_API_KEY`, `MAIL_FROM` and `APP_BASE_URL` as Railway variables. Real inbox delivery must be checked; demonstration accounts never send external email. Review delivery/bounce details in Resend.
