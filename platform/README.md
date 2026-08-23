# National Health and Medical Readiness — platform

Ministry of Public Health, Republic of Lebanon. Two regulatory instruments on one
platform: health and medical preparedness at mass-gathering events, and cardiac-arrest
readiness in designated facilities.

Authority order: `../handoff 4/source-documents/` (the regulation itself) over
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

**`node:sqlite` (a file under `var/`) is the review-build store, not the production
database.** It exists so the build runs anywhere Node runs, with zero setup, while the
platform is being reviewed. Production persistence is Postgres, and standing it up waits
on the Ministry's data-residency answer (where the national register may be hosted, and
under whose control). Nothing in `lib/` besides `db.ts` touches SQLite directly, so the
swap is confined to one file plus the queries layer.

The same applies to credentials: passwords are hashed (scrypt) and the policy is data in
`lib/rules/data/auth-policy.json`, but real credential policy — SSO, email verification,
complexity — is a Ministry decision. The review build's mail transport does not exist;
password-reset links are recorded, not sent.

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
  and the visual comparison against `../handoff 4/pages/` (per-region where declared).
  The e2e server runs with `REVIEW_CLOCK=2026-08-13` so date strings match the pinned
  reference; the clock override is ignored in production builds.
