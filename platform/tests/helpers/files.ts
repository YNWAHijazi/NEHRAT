import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

export const PLATFORM_ROOT = new URL('../..', import.meta.url).pathname;

/**
 * Every file under `dir` with one of `exts`.
 *
 * THIS FUNCTION USED TO RETURN [] FOR A MISSING DIRECTORY, and that made every
 * guard built on it a check that passes without checking. A sweep over an empty
 * corpus finds no offenders and reports green, and the green is indistinguishable
 * from a clean codebase. `filesUnder('styles', ['.css'])` in the logical-CSS guard
 * had been sweeping a directory that does not exist -- harmless today, because no
 * CSS lives there, and a silent hole the day any does.
 *
 * That is the third shape of one family this build keeps finding: rules with
 * passing tests and no caller; a visual exception whose claim nothing checked; a
 * sign-in helper that returned success without signing in. In every case something
 * reported success without doing its job, and the resulting state looked correct.
 *
 * So: an absent directory THROWS, and so does a present one that yields nothing.
 * A guard pointed at a corpus that isn't there is a broken guard, and it should
 * fail like one. `optional` exists for a directory that may genuinely be absent --
 * pass a `because` naming the condition, so the exemption carries its reason the
 * way every other exception in this build has to.
 */
export function filesUnder(
  dir: string,
  exts: readonly string[],
  optional?: { because: string },
): string[] {
  const abs = join(PLATFORM_ROOT, dir);
  if (!existsSync(abs)) {
    if (optional) return [];
    throw new Error(
      `filesUnder("${dir}") -- no such directory. A guard sweeping a corpus that ` +
        `does not exist finds nothing and passes, which is indistinguishable from ` +
        `finding no violations. Point it at the real directory, or pass ` +
        `{ because: '...' } if the directory is genuinely optional.`,
    );
  }
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (exts.includes(extname(entry))) out.push(full);
    }
  };
  walk(abs);
  if (out.length === 0 && !optional) {
    throw new Error(
      `filesUnder("${dir}", [${exts.join(', ')}]) -- the directory exists and ` +
        `matched no files. Either the extensions are wrong or the corpus moved; ` +
        `either way the guard using this is checking nothing.`,
    );
  }
  return out;
}

export function read(path: string): string {
  return readFileSync(path, 'utf-8');
}

export function relative(path: string): string {
  return path.startsWith(PLATFORM_ROOT) ? path.slice(PLATFORM_ROOT.length) : path;
}

/** Every string value in a nested object, with its dotted key path. */
export function walkStrings(
  value: unknown,
  path = '',
): { path: string; value: string }[] {
  if (typeof value === 'string') return [{ path, value }];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => walkStrings(v, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      walkStrings(v, path ? `${path}.${k}` : k),
    );
  }
  return [];
}
