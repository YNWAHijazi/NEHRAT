/**
 * The free-space check, as Playwright's globalSetup so it CANNOT be bypassed.
 *
 * scripts/preflight.mjs already refused a run on a full disk -- but only when the
 * suite was entered through `npm run verify` or `npm run test:e2e`. A bare
 * `npx playwright test` skipped it, the disk filled mid-run, and ENOSPC surfaced
 * as eight "visual regressions" and four navigation timeouts on screens nobody
 * had touched. A guard with a bypass is not a guard.
 *
 * This half runs on EVERY entry point and only reads: the clearing of stale
 * artifacts stays in preflight, because globalSetup fires once per project and
 * would delete the reference run's output before the app run began.
 */
import { statfsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLATFORM = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Enough for a full run's screenshots, diffs and traces, with room to spare. */
const REQUIRED_MB = 1024;

export default function checkDisk() {
  const { bsize, bavail } = statfsSync(PLATFORM);
  const freeMb = Math.floor((bsize * bavail) / (1024 * 1024));
  if (freeMb >= REQUIRED_MB) return;
  throw new Error(
    `\nNOT ENOUGH DISK FOR THIS RUN\n\n` +
      `  free:     ${freeMb} MB\n` +
      `  required: ${REQUIRED_MB} MB\n\n` +
      `Refusing to start. A run below this line fails with ENOSPC on assertions\n` +
      `that read exactly like visual regressions and navigation flakes, and are\n` +
      `neither. Free space and run again:\n\n` +
      `  npm run preflight        clears .next-e2e, test-results, e2e/output\n` +
      `  ~/Library/Caches         browser and package caches\n`,
  );
}
