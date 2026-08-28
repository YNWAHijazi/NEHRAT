/**
 * Reading a bilingual lookup out of the rules data.
 *
 * Every data file carries `$comment` keys -- notes to whoever reads the JSON next,
 * and the reason several decisions in this build are still traceable. They are not
 * content, and they break every `as Record<string, { en, ar }>` cast because a string
 * is not a bilingual pair. That has now happened three times (panelOwners, roleLabels,
 * and a third caught before it shipped), each fixed with a slightly different local
 * cast, which is how three call sites end up with three behaviours.
 *
 * One accessor. It drops keys beginning with `$` -- the convention used throughout
 * lib/rules/data for a note -- and returns what the screens actually want.
 */

export interface Bilingual {
  readonly en: string;
  readonly ar: string;
}

function isBilingual(value: unknown): value is Bilingual {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { en?: unknown }).en === 'string' &&
    typeof (value as { ar?: unknown }).ar === 'string'
  );
}

/**
 * The bilingual entries of a lookup, with notes and anything malformed dropped.
 *
 * Malformed entries are dropped rather than thrown on deliberately: this is read
 * during render, and a half-written data edit should cost one missing label, not a
 * blank screen. The bilingual-parity guard is what fails on a missing translation --
 * that is its job, and it runs before anything renders.
 */
export function bilingualMap(source: unknown): Record<string, Bilingual> {
  if (typeof source !== 'object' || source === null) return {};
  const out: Record<string, Bilingual> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith('$')) continue;
    if (isBilingual(value)) out[key] = value;
  }
  return out;
}
