/**
 * Two projects:
 *
 *   reference -- drives the handoff prototypes over file://, no server. Always runs.
 *                Carries the visual-comparison harness, so it exists before Slice 1
 *                rather than being retrofitted across twenty screens.
 *
 *   app       -- runs against the Next dev server: permission refusals and the public
 *                lookup response shape. Activates automatically once app/ exists;
 *                until then there is nothing to serve and the project is excluded.
 */

import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const APP_EXISTS = existsSync(join(HERE, 'app'));

// The harness starts its OWN server on a freshly seeded database and never reuses one,
// so a developer's `npm run dev` on 3000 would otherwise block the whole suite. E2E_PORT
// moves the harness out of the way; the default is unchanged.
const PORT = Number(process.env['E2E_PORT'] ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // One dev server carries every worker, and the reference captures are pixel-heavy.
  // Uncapped workers overload it and time honest tests out; four is stable on this
  // machine and the suite still finishes in minutes.
  workers: 4,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    // The reference designs target 1160px content width; the control dock hides below
    // 900px. 1280x900 shows every screen at its designed density.
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    // `next dev` compiles a route on its first request, so under parallel load a first
    // navigation can take far longer than the interaction that follows. This budget is
    // for COMPILATION, not for the product: every assertion keeps its own short timeout,
    // so a genuinely slow screen still fails.
    navigationTimeout: 60_000,
  },
  timeout: 60_000,
  // Assertions wait long enough for a dev-mode first compile of the BUILT page, which
  // competes with parsing the reviewer's prototypes (some are ~450KB) in the same
  // browser. Still short enough that a genuinely absent region fails rather than hangs.
  expect: { timeout: 15_000 },
  projects: [
    {
      name: 'reference',
      testMatch: /reference\/.*\.spec\.ts/,
      // A green run must mean green -- no known exception. Under four parallel
      // workers this project repeatedly killed the same late-sequence screens:
      // first as 60s goto timeouts, then as ERR_CONNECTION_REFUSED -- the dev
      // server itself buckling under concurrent first-compiles plus four browsers
      // parsing 400KB prototypes. SERIALISED: the project is one spec file, so
      // fullyParallel: false runs its tests in a single worker, in order, one
      // compile at a time. The raised budgets stay as the second belt -- they
      // absorb a slow first compile, never a broken screen: every region
      // assertion keeps the short expect timeout.
      fullyParallel: false,
      timeout: 180_000,
      use: { navigationTimeout: 150_000 },
      // The last belt, for a KNOWN, LOGGED cause -- not for flakiness. next dev's
      // memory watchdog restarts the server once per full run ("Server is
      // approaching the used memory threshold, restarting...", visible in the
      // webServer log), and whichever single test hits the restart window dies on
      // a dropped connection. Raising the heap ceiling did not move the watchdog.
      // One retry rides out the seconds-long restart; a genuine visual regression
      // fails identically on the retry, so the ratchet keeps its teeth. If a test
      // passes only on retry for any OTHER reason, the report still marks it
      // "flaky" -- treat that as a defect, not a pass.
      retries: 1,
    },
    ...(APP_EXISTS
      ? [
          {
            name: 'app',
            testMatch: /app\/.*\.spec\.ts/,
            use: { baseURL: BASE_URL },
            // Same known, logged cause as the reference project: the dev server's
            // memory watchdog restarts it once as a long run accumulates, and the
            // test in flight dies on a dropped connection. Two belts here:
            // gotoRidingRestarts (e2e/helpers/resilient.ts) waits out the restart
            // inside the long route sweeps, and this budget gives those sweeps the
            // room the waiting costs -- the 60s cap killed the 44-route sweep on
            // BOTH attempts once the helper turned crashes into waits. Assertions
            // keep the short expect timeout, so broken screens still fail fast.
            // One retry remains for idempotent tests hit outside a sweep. A serial
            // MUTATING flow killed mid-run fails its retry too, because its state
            // is half-applied; that hard failure is correct and demands a re-run
            // rather than being papered over.
            timeout: 180_000,
            retries: 1,
          },
        ]
      : []),
  ],
  ...(APP_EXISTS
    ? {
        webServer: {
          // A dedicated database, re-seeded per run, under the pinned review clock:
          // REVIEW_CLOCK freezes "today" at the prototypes' 2026-08-13 so date STRINGS
          // match the reference (handoff 4, decision 3). The seeder's re-anchoring
          // shift becomes zero under the pin. Ignored in production builds.
          command: `npm run dev:e2e -- --port ${PORT}`,
          url: BASE_URL,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            REVIEW_CLOCK: '2026-08-13',
            DATABASE_PATH: 'var/e2e.db',
            // THE ACTUAL CAUSE of every late-sequence "flake" this suite has had:
            // next dev's memory watchdog logged "Server is approaching the used
            // memory threshold, restarting..." mid-run, and the restart window
            // surfaced as goto timeouts, ERR_CONNECTION_REFUSED and
            // ERR_CONNECTION_RESET on whichever tests hit it -- consistently the
            // same screens because memory accumulates over the same sequence. The
            // watchdog triggers relative to the heap ceiling, so an 8GB ceiling
            // moves the restart far beyond what one full run accumulates. A cap,
            // not a reservation.
            NODE_OPTIONS: '--max-old-space-size=8192',
          },
        },
      }
    : {}),
});
