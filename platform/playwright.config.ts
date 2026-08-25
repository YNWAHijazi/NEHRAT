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
    },
    ...(APP_EXISTS
      ? [
          {
            name: 'app',
            testMatch: /app\/.*\.spec\.ts/,
            use: { baseURL: 'http://localhost:3000' },
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
          command: 'npm run dev:e2e',
          url: 'http://localhost:3000',
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            REVIEW_CLOCK: '2026-08-13',
            DATABASE_PATH: 'var/e2e.db',
          },
        },
      }
    : {}),
});
