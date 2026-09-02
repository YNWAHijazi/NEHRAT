/**
 * Capabilities: capability without content (SPEC 2c). The product specification requires
 * the architecture to support commercial and assistive capability; the Lebanon tenant
 * ships with every flag off and renders nothing commercial. This module is the only reader.
 *
 * THE SHAPE (partner ruling, 2026-09-02): the list does not toggle -- each capability has
 * its own page carrying what it is, the toggle, and its configuration beneath. A capability
 * with no configuration cannot be enabled: `missingForEnable` is the one rule that says
 * whether the toggle is live, and when it is not, it names what is missing -- a dependency,
 * a configuration field, a readiness check, or an unmade decision. Turning one on is a
 * licensing act, recorded with who, when, and the configuration at that moment.
 */

import flagsJson from './data/feature-flags.json';

export type FeatureFlag = keyof typeof flagsJson.flags;

export function featureEnabled(flag: FeatureFlag): boolean {
  return flagsJson.flags[flag] === true;
}

export const ALL_FLAGS: readonly FeatureFlag[] = Object.keys(flagsJson.flags) as FeatureFlag[];

/** The plain-language line beside each capability on the list. Data, like the flag it describes. */
export function flagDescription(flag: FeatureFlag): { en: string; ar: string } {
  const d = (flagsJson as unknown as { descriptions: Record<string, { en: string; ar: string }> }).descriptions[flag];
  if (!d) throw new Error(`feature-flags.json: no description for ${flag}`);
  return d;
}

/**
 * The EFFECTIVE state: the shipped default, unless an override is recorded in
 * ministry_config (key `flag:<name>`, value 'on'/'off'). Pure -- the caller passes
 * the config map -- so a screen, an action and a test read one rule. Defaults stay
 * OFF in the file; an override is a recorded licensing decision.
 */
export function effectiveFlag(flag: FeatureFlag, config: ReadonlyMap<string, string>): boolean {
  const override = config.get(`flag:${flag}`);
  if (override === 'on') return true;
  if (override === 'off') return false;
  return featureEnabled(flag);
}

/* ---------------- the capability detail: groups, pages, the enable rule ---------------- */

export type FlagGroup = keyof typeof flagsJson.groups;

export interface ConfigField {
  key: string;
  labelEn: string;
  labelAr: string;
  kind: 'text' | 'number' | 'select';
  options?: string[];
  /** Required only while another field holds this value (e.g. per-level fees). */
  requiredIf?: { key: string; value: string };
}

export interface ReadinessCheck {
  key: string;
  labelEn: string;
  labelAr: string;
}

export interface FlagDetail {
  titleEn: string;
  titleAr: string;
  whatEn: string;
  whatAr: string;
  requiredConfig: ConfigField[];
  requiredChecks?: ReadinessCheck[];
  dependsOn?: FeatureFlag;
  /** An unmade decision blocks enabling outright; the page surfaces it, nothing resolves it. */
  blocked?: { reasonEn: string; reasonAr: string };
}

const DETAILS = (flagsJson as unknown as { details: Record<string, FlagDetail> }).details;

export function flagDetail(flag: FeatureFlag): FlagDetail {
  const d = DETAILS[flag];
  if (!d) throw new Error(`feature-flags.json: no detail for ${flag}`);
  return d;
}

export const FLAG_GROUPS: readonly FlagGroup[] = Object.keys(flagsJson.groups) as FlagGroup[];

export function groupFlags(group: FlagGroup): readonly FeatureFlag[] {
  return flagsJson.groups[group] as readonly FeatureFlag[];
}

export function groupTitle(group: FlagGroup): { en: string; ar: string } {
  return (flagsJson as unknown as { groupTitles: Record<string, { en: string; ar: string }> }).groupTitles[group]!;
}

export function groupNote(group: FlagGroup): { en: string; ar: string } {
  return (flagsJson as unknown as { groupNotes: Record<string, { en: string; ar: string }> }).groupNotes[group]!;
}

export function flagGroup(flag: FeatureFlag): FlagGroup {
  const g = FLAG_GROUPS.find((group) => (flagsJson.groups[group] as readonly string[]).includes(flag));
  if (!g) throw new Error(`feature-flags.json: ${flag} belongs to no group`);
  return g;
}

export interface VendorCategory {
  key: string;
  en: string;
  ar: string;
}

/**
 * The directory's categories, from the regulation's vendor kinds -- data, never
 * a literal in a screen. The admin form, the public page and the AED
 * purchase-link resolution all read this one list.
 */
export function vendorCategories(): VendorCategory[] {
  return (flagsJson as unknown as { details: { vendorDirectory: { categories: VendorCategory[] } } }).details
    .vendorDirectory.categories;
}

/** Every listing states it: listing is commercial and is not Ministry endorsement. */
export function vendorDisclaimer(): { en: string; ar: string } {
  return (flagsJson as unknown as { details: { vendorDirectory: { disclaimer: { en: string; ar: string } } } })
    .details.vendorDirectory.disclaimer;
}

export interface AdPlacement {
  key: string;
  en: string;
  ar: string;
}

/**
 * THE PLACEMENT LIST IS STRUCTURAL, NOT A GUIDELINE: an advert renders only
 * through a placement on this list, each bound to the foot of one public
 * surface -- never a screen where someone is filing, reviewing or reporting an
 * incident. A guard test pins which files may mount the ad component; adding a
 * surface means adding a placement here and answering to that guard.
 */
export function adPlacements(): AdPlacement[] {
  return (flagsJson as unknown as { details: { advertising: { placements: AdPlacement[] } } }).details.advertising
    .placements;
}

/** Every advert is labelled as one, always. */
export function adLabel(): { en: string; ar: string } {
  return (flagsJson as unknown as { details: { advertising: { adLabel: { en: string; ar: string } } } }).details
    .advertising.adLabel;
}

/** One reason the toggle is not live, named. The page renders every one it gets. */
export interface EnableBlocker {
  kind: 'decision' | 'dependency' | 'field' | 'check';
  en: string;
  ar: string;
}

/**
 * A capability with no configuration cannot be enabled. This is the whole rule:
 * an unmade decision blocks first; then a dependency that is off; then every
 * declared configuration field with no stored value; then every readiness check
 * that is not met. Empty result = the toggle is live. Pure -- the caller passes
 * the stored per-field values and the evaluated checks.
 */
export function missingForEnable(
  flag: FeatureFlag,
  capabilityConfig: ReadonlyMap<string, string>,
  ctx: { flagOn: (dep: FeatureFlag) => boolean; checks: Readonly<Record<string, boolean>> },
): EnableBlocker[] {
  const d = flagDetail(flag);
  if (d.blocked) {
    return [{ kind: 'decision', en: d.blocked.reasonEn, ar: d.blocked.reasonAr }];
  }
  const blockers: EnableBlocker[] = [];
  if (d.dependsOn && !ctx.flagOn(d.dependsOn)) {
    const dep = flagDetail(d.dependsOn);
    blockers.push({
      kind: 'dependency',
      en: `Needs ${dep.titleEn} on first.`,
      ar: `يتطلب تشغيل ${dep.titleAr} أولاً.`,
    });
  }
  for (const field of d.requiredConfig) {
    if (field.requiredIf && capabilityConfig.get(field.requiredIf.key) !== field.requiredIf.value) continue;
    const value = capabilityConfig.get(field.key);
    if (value === undefined || value.trim() === '') {
      blockers.push({
        kind: 'field',
        en: `Configuration missing: ${field.labelEn}.`,
        ar: `إعداد ناقص: ${field.labelAr}.`,
      });
    }
  }
  for (const check of d.requiredChecks ?? []) {
    if (!ctx.checks[check.key]) {
      blockers.push({
        kind: 'check',
        en: `Not yet met: ${check.labelEn.toLowerCase()}.`,
        ar: `غير مستوفى بعد: ${check.labelAr}.`,
      });
    }
  }
  return blockers;
}
