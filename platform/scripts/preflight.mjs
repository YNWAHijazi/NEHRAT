/**
 * Preflight for the visual comparison.
 *
 * The comparison writes three PNGs per region per language and a trace per failure.
 * When the disk fills, Playwright reports ENOSPC as a failed assertion, which reads
 * exactly like a real visual regression -- and a reviewer then spends an hour
 * diagnosing a full disk. Cheaper to check first and say so.
 *
 * Also clears the artifacts of previous runs, which are what fills the disk.
 */
import { statfsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLATFORM = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Enough for a full run's screenshots, diffs and traces, with room to spare. */
const REQUIRED_MB = 1024;

const stale = ['test-results', 'e2e/output', 'playwright-report'];
await Promise.all(
  stale.map((d) => rm(join(PLATFORM, d), { recursive: true, force: true })),
);

const { bsize, bavail } = statfsSync(PLATFORM);
const freeMb = Math.floor((bsize * bavail) / (1024 * 1024));

if (freeMb < REQUIRED_MB) {
  process.stderr.write(
    `\nNOT ENOUGH DISK FOR THE VISUAL COMPARISON\n\n` +
      `  free:     ${freeMb} MB\n` +
      `  required: ${REQUIRED_MB} MB\n\n` +
      `The comparison writes a reference, a built and a diff image per region per\n` +
      `language, plus a trace for every failure. Running it now would fail with\n` +
      `ENOSPC on assertions that look like visual regressions but are not.\n\n` +
      `Free some space and run again. The usual culprits:\n` +
      `  platform/.next          the dev build cache -- safe to delete, it rebuilds\n` +
      `  ~/Library/Caches        browser and package caches\n\n`,
  );
  process.exit(1);
}

process.stdout.write(`Preflight: ${freeMb} MB free, stale artifacts cleared.\n`);
