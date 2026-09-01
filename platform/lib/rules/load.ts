/**
 * Loads and narrows the regulatory data.
 *
 * The JSON files in lib/rules/data/ are the regulatory values. This file is the only
 * place that reads them, so a shape change surfaces here rather than in nine call sites.
 * Nothing in here decides anything -- it loads, validates and narrows.
 */

import domainsJson from './data/domains.json';
import minimumConditionsJson from './data/minimum-conditions.json';
import venueJson from './data/venue.json';
import levelsJson from './data/levels.json';
import authPolicyJson from './data/auth-policy.json';
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
  /** Which issue of Annex A carries this row: both, en-only, or ar-only (SPEC 1). */
  readonly issue: 'both' | 'en-only' | 'ar-only';
  /** True where the row's Arabic is a translation pending the Ministry (club). */
  readonly arabicIsTranslation: boolean;
  /** Lay one-line why, shown when this condition governs the level. */
  reasonEn: string;
  reasonAr: string;
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

export const MAX_SCORE_PER_DOMAIN: number = domainsJson.maxScorePerDomain;

export const MINIMUM_CONDITIONS: readonly MinimumCondition[] =
  minimumConditionsJson.conditions.map((c) => ({
    key: c.key,
    level: asLevel(c.level),
    en: c.en,
    ar: c.ar,
    derivation: c.derivation as Predicate,
    issue: (c as { issue?: MinimumCondition['issue'] }).issue ?? 'both',
    arabicIsTranslation: Boolean((c as { arabicIsTranslation?: boolean }).arabicIsTranslation),
    reasonEn: c.reasonEn,
    reasonAr: c.reasonAr,
  }));

/** The result panel's why-line templates when no single condition governs. Data, not code. */
export const LEVEL_REASON_TEMPLATES = minimumConditionsJson.reasons;

/**
 * The venue-registration capacity threshold, Protocol 3.1 (English issue). It used to be
 * read from the recur minimum condition; the partner ruling (English governs, 2026-09-01)
 * removed that condition while the venue instrument keeps the criterion, so the number
 * lives in venue.json now. Registration screen and eligibility rule read one value.
 */
export const RECURRING_VENUE_MIN_CAPACITY: number = (() => {
  const v = (venueJson as { registrationCriterion?: { minLicensedCapacity?: number } }).registrationCriterion;
  if (typeof v?.minLicensedCapacity !== 'number') {
    throw new Error('venue.json: registrationCriterion.minLicensedCapacity is missing');
  }
  return v.minLicensedCapacity;
})();

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

/** Signatures required on the post-event report at a given level. Level 3 needs two. */
export function postEventSignaturesRequired(level: Level): number {
  const map = POST_EVENT_REPORT.signaturesRequired as Record<string, number>;
  const n = map[String(level)];
  if (typeof n !== 'number') {
    throw new Error(`No signature count configured for level ${level}`);
  }
  return n;
}

/**
 * The authentication policy. A Ministry decision pending, so it lives in the data like
 * every other configurable value -- and it is read THROUGH this module, not straight
 * from the JSON. lib/password.ts used to import the file directly, which is exactly the
 * bypass the "import from lib/rules, which narrows and validates" guard exists to catch;
 * the guard only swept app and components, so it never saw it.
 */
export const AUTH_POLICY = authPolicyJson;
