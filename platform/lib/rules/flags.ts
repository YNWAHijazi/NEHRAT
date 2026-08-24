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
