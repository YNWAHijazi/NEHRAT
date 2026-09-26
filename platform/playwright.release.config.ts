import { defineConfig, devices } from '@playwright/test';

/** Run after test:release has built and seeded its disposable, isolated database. */
export default defineConfig({
  testDir: 'e2e/app',
  testMatch: ['partner-feedback.spec.ts', 'owner-workflow-20260926.spec.ts', 'facility-gis.spec.ts'],
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results/release',
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3102', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run start -- --port 3102',
    url: 'http://localhost:3102',
    reuseExistingServer: false,
    env: { NEXT_DIST_DIR: '.next-v1-build', DATABASE_PATH: 'var/release-runtime.db' },
    timeout: 60_000,
  },
});
