# National Health and Medical Readiness — platform

Ministry of Public Health, Republic of Lebanon. Two regulatory instruments on one
platform: health and medical preparedness at mass-gathering events, and cardiac-arrest
readiness in designated facilities.

Authority order: `../handoff 5/source-documents/` (the regulation itself) over
`SPEC.md`/`ROADMAP.md` (the summary) over everything else. See `../CLAUDE.md`.

## Running the review build

```
npm install
npm run dev          # http://localhost:3000
npm run verify       # tsc + unit suite + Playwright (permissions, lookup, visual)
npm run rules:regenerate   # re-extract domains/conditions after a reference change
```

Sign in with a demonstration account (`test_organizer` and the rest are listed on the
sign-in screen) or create an account.

## Data store — read this before deploying anything

**The deployed application currently uses SQLite on a Railway persistent volume.**
Development defaults to `var/dev.db`; production requires `DATABASE_PATH`. On
2026-09-11 the deployed path was verified as `/data/nehrat-demonstration.db`.
Local development databases are not copies of production, and GitHub does not back up
the live database. Supabase Postgres is the planned destination; migration is not yet
implemented. Database access also exists in authentication, server actions, and route
handlers, so this is not a connection-string-only change. See
[the transition record](acceptance/supabase-transition.md) for verified inventory and sequencing.

Create a consistent backup, including committed WAL data and uploaded documents:

```sh
npm run db:backup -- --source /path/to/database.db --output-dir var/new-backup
```

The output directory must not exist; its parent must exist. The command refuses
overwrites and writes a private SQLite snapshot, schema inventory, and verification
manifest. The source is opened read-only, with no application migrations or seeding.
In deployment, `DATABASE_PATH` may replace `--source`. This is an operator command,
not a scheduled backup service; retain an off-host copy and verify restoration.

The same applies to credentials: passwords are hashed (scrypt) and the policy is data in
`lib/rules/data/auth-policy.json`, but real credential policy — SSO, email verification,
complexity — is a Ministry decision. Invitations, account activation and password recovery use Resend over HTTPS when
`RESEND_API_KEY`, `MAIL_FROM` and `APP_BASE_URL` are configured. Generic SMTP remains
available as an alternative. Demo accounts never send mail. See
[Resend setup](acceptance/resend-setup.md) and `email.env.example`.

The demonstration seeder runs only outside production (`lib/db.ts` guards it on
NODE_ENV, and no variable re-enables it). Demonstration rows are real rows carrying
`is_demo = 1`, excluded from the national registry, every Ministry aggregate and every
reviewer queue.

## Layout

- `lib/rules/` — the derivation and gating engine. Plain TypeScript, no framework
  imports; regulatory values are JSON under `lib/rules/data/`.
- `lib/reference/reference-snapshot.json` — generated from the reference prototype;
  `tests/reference-drift.test.ts` fails when either side moves.
- `app/` — Next.js App Router screens. Screens ask `lib/rules`; none decides.
- `e2e/` — Playwright: permission refusals by navigation, the public-lookup wire shape,
  and the visual comparison against `../handoff 5/pages/` (per-region where declared).
  The e2e server runs with `REVIEW_CLOCK=2026-08-13` so date strings match the pinned
  reference; the clock override is ignored in production builds.
