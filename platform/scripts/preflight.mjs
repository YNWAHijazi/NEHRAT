/**
 * Preflight for the visual comparison: clear the previous run's artifacts, then
 * refuse the run if there is not enough disk for the next one.
 *
 * THE FLOOR IS NOT DEFINED HERE. It was, and it was 1024 MB -- the figure from when
 * the suite was smaller -- while the corrected per-run floors lived only in
 * disk-check.mjs. Both guards ran. The stale one ran FIRST and printed the
 * reassuring line, so a chain starting with 3.9 GB was told "Preflight: 3896 MB
 * free" and started anyway; only the globalSetup half would have caught it. Two
 * copies of a threshold is one threshold and one lie about it, so this half now
 * asks the other half.
 *
 * The clearing stays here rather than moving to globalSetup, because globalSetup
 * fires once per project and would delete the reference run's output before the
 * app run began.
 */
import { rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import checkDisk from './disk-check.mjs';

const PLATFORM = join(dirname(fileURLToPath(import.meta.url)), '..');

// .next-e2e is the e2e server's own build directory -- 300 MB of the fill, and
// a build cache like any other, so it goes with the rest.
const stale = ['test-results', 'e2e/output', 'playwright-report', '.next-e2e'];
await Promise.all(
  stale.map((d) => rm(join(PLATFORM, d), { recursive: true, force: true })),
);

// Measured AFTER the clearing, so the figure is what the run will actually have.
try {
  const { freeMb, requiredMb } = checkDisk();
  process.stdout.write(
    `Preflight: ${freeMb} MB free against a ${requiredMb} MB floor, stale artifacts cleared.\n`,
  );
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
