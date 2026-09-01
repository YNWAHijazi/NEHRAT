/**
 * Feature flags: capability without content (SPEC 2c). The product specification requires
 * the architecture to support commercial and AI capability; the Lebanon tenant ships with
 * every flag off and renders nothing commercial. This module is the only reader.
 */

import flagsJson from './data/feature-flags.json';

export type FeatureFlag = keyof typeof flagsJson.flags;

export function featureEnabled(flag: FeatureFlag): boolean {
  return flagsJson.flags[flag] === true;
}

export const ALL_FLAGS: readonly FeatureFlag[] = Object.keys(flagsJson.flags) as FeatureFlag[];

/** The plain-language line beside each switch. Data, like the flag it describes. */
export function flagDescription(flag: FeatureFlag): { en: string; ar: string } {
  const d = (flagsJson as unknown as { descriptions: Record<string, { en: string; ar: string }> }).descriptions[flag];
  if (!d) throw new Error(`feature-flags.json: no description for ${flag}`);
  return d;
}

/**
 * The EFFECTIVE state: the shipped default, unless the Ministry has recorded an
 * override in ministry_config (key `flag:<name>`, value 'on'/'off'). Pure -- the
 * caller passes the config map -- so a screen, an action and a test read one rule.
 * Defaults stay OFF in the file; an override is a recorded governance decision
 * (partner review: every capability flag is genuinely controllable).
 */
export function effectiveFlag(flag: FeatureFlag, config: ReadonlyMap<string, string>): boolean {
  const override = config.get(`flag:${flag}`);
  if (override === 'on') return true;
  if (override === 'off') return false;
  return featureEnabled(flag);
}

