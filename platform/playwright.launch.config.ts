import { defineConfig } from '@playwright/test';
import release from './playwright.release.config';

// Run every application journey against a production build and a disposable database.
// Re-seed between shards. Never point this configuration at the live database.
export default defineConfig({
  ...release,
  globalSetup: './scripts/disk-check.mjs',
  testMatch: '**/*.spec.ts',
  timeout: 180_000,
  outputDir: 'test-results/launch',
  projects: [{ name: 'app' }],
});
