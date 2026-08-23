import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

export const PLATFORM_ROOT = new URL('../..', import.meta.url).pathname;

/** Every file under `dir` with one of `exts`. Returns [] when the directory does not exist yet. */
export function filesUnder(dir: string, exts: readonly string[]): string[] {
  const abs = join(PLATFORM_ROOT, dir);
  if (!existsSync(abs)) return [];
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
