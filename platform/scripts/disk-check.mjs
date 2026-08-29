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

/**
 * Enough for a full run, MEASURED rather than guessed.
 *
 * The floor was 1024 MB, set when the suite was smaller, and a run starting with 3 GB
 * free still hit ENOSPC mid-flight -- which surfaced as forty-four failures across
 * unrelated specs, exactly the misdiagnosis this check exists to prevent. The check
 * ran, passed, and was wrong.
 *
 * What a run actually consumes, MEASURED by watching free space across one:
 *
 *   an app-only run took the volume from ~3.5 GB free to 583 MB -- about 2.9 GB.
 *
 * And here is the part that matters: clearing every artifact afterwards recovered
 * only ~350 MB of it. The artifacts are NOT the appetite.
 *
 *   .next-e2e            ~325 MB, and it is the largest thing we write
 *   test-results          ~28 MB clean, far more when traces are retained
 *   e2e/output            reference, built and diff images (reference project only)
 *
 * The rest is `next dev` rewriting chunks continuously for twenty minutes and
 * rebuilding wholesale after each memory-watchdog restart. That churn is transient
 * and mostly reclaimed by the OS, which is exactly why a floor set from the size of
 * the artifacts is far too low: it measures what is left at the end rather than what
 * was needed in the middle.
 *
 * THE FLOOR IS PER-RUN, not one number for both projects. The reference project writes
 * three images per region per language and is most of the appetite; the app project
 * writes traces only on failure. Asking every run for the image-heavy figure would
 * refuse app-only runs that would have finished comfortably -- and a guard that refuses
 * work it did not need to refuse gets lowered by whoever it annoys.
 */
const REFERENCE_MB = 5120;
const APP_ONLY_MB = 3584;

export default function checkDisk() {
  // WHICH PROJECTS WILL ACTUALLY RUN, read from the command line rather than from the
  // config. FullConfig.projects lists every CONFIGURED project regardless of
  // --project, so asking it whether the reference project runs always answers yes --
  // which was measured here rather than assumed after it refused an app-only run.
  const selected = process.argv.filter((a) => a.startsWith('--project'));
  const runsReference =
    selected.length === 0 || selected.some((a) => a.includes('reference'));
  const requiredMb = runsReference ? REFERENCE_MB : APP_ONLY_MB;

  const { bsize, bavail } = statfsSync(PLATFORM);
  const freeMb = Math.floor((bsize * bavail) / (1024 * 1024));
  if (freeMb >= requiredMb) return { freeMb, requiredMb };
  throw new Error(
    `\nNOT ENOUGH DISK FOR THIS RUN\n\n` +
      `  free:     ${freeMb} MB\n` +
      `  required: ${requiredMb} MB${runsReference ? '' : ' (this run does not build reference images)'}\n\n` +
      `Refusing to start. A run below this line fails with ENOSPC on assertions\n` +
      `that read exactly like visual regressions and navigation flakes, and are\n` +
      `neither -- one such run produced forty-four failures across unrelated specs.\n\n` +
      `An app-only run was measured consuming 2.9 GB. Most of that is next dev\n` +
      `rewriting chunks over a long run, not the artifacts -- clearing everything\n` +
      `afterwards recovers only a few hundred MB of it.\n\n` +
      `Free space and run again:\n\n` +
      `  npm run preflight        clears .next-e2e, test-results, e2e/output\n` +
      `  rm -rf platform/.next    the dev build cache; it rebuilds\n` +
      `  npm cache clean --force  safe, and usually several hundred MB\n` +
      `  ~/Library/Caches         browser and package caches\n`,
  );
}
