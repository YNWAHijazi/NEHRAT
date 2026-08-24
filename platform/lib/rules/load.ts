/**
 * Loads and narrows the regulatory data.
 *
 * The JSON files in lib/rules/data/ are the regulatory values. This file is the only
 * place that reads them, so a shape change surfaces here rather than in nine call sites.
 * Nothing in here decides anything -- it loads, validates and narrows.
 */

import domainsJson from './data/domains.json';
import minimumConditionsJson from './data/minimum-conditions.json';
import levelsJson from './data/levels.json';
import bannedTermsJson from './data/banned-terms.json';
import type { Level, Predicate } from './types';

function asLevel(n: number): Level {
  if (n === 1 || n === 2 || n === 3) return n;
  throw new Error(`Not a valid level: ${n}`);
}

export interface DomainOption {
  readonly score: 0 | 1 | 2;
  readonly en: string;
  readonly ar: string;
}

export interface Domain {
  readonly number: number;
  readonly en: string;
  readonly ar: string;
  readonly noteEn: string;
  readonly noteAr: string;
  readonly options: readonly DomainOption[];
}

export interface MinimumCondition {
  readonly key: string;
  readonly level: Level;
  readonly en: string;
  readonly ar: string;
  readonly derivation: Predicate;
}

export interface Band {
  readonly level: Level;
  readonly minScore: number;
  readonly maxScore: number;
}

export const DOMAINS: readonly Domain[] = domainsJson.domains.map((d) => ({
  number: d.number,
  en: d.en,
  ar: d.ar,
  noteEn: d.noteEn,
  noteAr: d.noteAr,
  options: d.options.map((o) => ({
    score: o.score as 0 | 1 | 2,
    en: o.en,
    ar: o.ar,
  })),
}));

export const DOMAIN_COUNT: number = domainsJson.domainCount;

/** Which issue of the instrument scores assessments; stamped onto every assessment row. */
export const NEHRAT_TOOL_VERSION: string = domainsJson.toolVersion;

export interface ArabicOnlyNote {
  readonly where: string;
  readonly ar: string;
  readonly en: string;
  readonly source: string;
}

/**
 * Deltas the Arabic issue of Annex A carries that the English lacks, surfaced as
 * source-tagged notes rather than folded in silently (handoff 5, decision 1).
 */
export const ARABIC_ONLY_NOTES: readonly ArabicOnlyNote[] = domainsJson.arabicOnlyNotes;
export const MAX_SCORE_PER_DOMAIN: number = domainsJson.maxScorePerDomain;

export const MINIMUM_CONDITIONS: readonly MinimumCondition[] =
  minimumConditionsJson.conditions.map((c) => ({
    key: c.key,
    level: asLevel(c.level),
    en: c.en,
    ar: c.ar,
    derivation: c.derivation as Predicate,
  }));

export const BANDS: readonly Band[] = levelsJson.bands.map((b) => ({
  level: asLevel(b.level),
  minScore: b.minScore,
  maxScore: b.maxScore,
}));

export const TIMEZONE: string = levelsJson.timezone;

export interface FilingDeadlineRule {
  readonly leadTimeDays: number;
  readonly conditional: boolean;
  readonly conditionEn?: string;
  readonly conditionAr?: string;
}

const filing = levelsJson.filingDeadline as Record<string, unknown>;

export function filingDeadlineRule(level: Level): FilingDeadlineRule {
  const rule = filing[String(level)] as FilingDeadlineRule | undefined;
  if (!rule) throw new Error(`No filing deadline configured for level ${level}`);
  return rule;
}

export const POST_EVENT_REPORT = levelsJson.postEventReport;
export const SERIOUS_INCIDENT_NOTIFICATION = levelsJson.seriousIncidentNotification;
export const REASSESSMENT_WINDOW = levelsJson.reassessmentWindow;
export const BANNED_TERMS = bannedTermsJson;

/** Signatures required on the post-event report at a given level. Level 3 needs two. */
export function postEventSignaturesRequired(level: Level): number {
  const map = POST_EVENT_REPORT.signaturesRequired as Record<string, number>;
  const n = map[String(level)];
  if (typeof n !== 'number') {
    throw new Error(`No signature count configured for level ${level}`);
  }
  return n;
}
