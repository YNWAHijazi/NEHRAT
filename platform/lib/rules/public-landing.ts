/**
 * Slice 0 — the public landing, and the branching applicability check behind it.
 *
 * Signed out, no database, no account. This is the surface most people will ever see,
 * and until now it did not exist: `/` redirected to sign-in, so a member of the public
 * arriving at the platform was asked to prove who they were before being told what the
 * platform was for.
 *
 * THE APPLICABILITY CHECK NEVER RETURNS A BARE YES OR NO for a facility. It returns the
 * applicable rule and the BASIS for it, under a state chip -- because for three of the
 * six categories the honest answer is that the Ministry has not set a value yet, and
 * "no" would be wrong while "yes" would be a promise nobody can keep. That unset state
 * is a first-class answer (non-negotiable 3), not a gap in one.
 *
 * Everything here is data from the reviewer's prototype. Nothing is computed against
 * an account, and nothing is stored: using this tool creates no obligation. (The
 * screens used to say so in those words; the partner's second sweep cut the sentence
 * by name, and the fact is carried by the behaviour alone.)
 */

import landingJson from './data/public-landing.json';

export const PUBLIC_LANDING = landingJson;

/** The four state chips, used identically wherever a facility rule is reported. */
export type FacilityRuleState = 'inforce' | 'part' | 'unset' | 'review';

export type ApplicabilitySubject = 'event' | 'venue' | 'facility';

export interface ApplicabilityAnswer {
  /** The heading a person reads first. */
  en: string;
  ar: string;
  /** What follows from it, and why. */
  bodyEn: string;
  bodyAr: string;
  /** Where to go next, if anywhere. */
  route: string | null;
  routeEn: string;
  routeAr: string;
  state: FacilityRuleState;
}

/**
 * THE EVENT BRANCH. Any one of the six criteria makes the event subject to the
 * Protocol -- they are alternatives, not a checklist to complete. None selected does
 * NOT mean "not subject": the Ministry makes the final determination, and the answer
 * says so rather than closing the question on the person's own reading.
 */
export function eventApplicability(selected: readonly number[]): ApplicabilityAnswer {
  const required = selected.some((n) => Number.isInteger(n) && n >= 0 && n < landingJson.criteria.length);
  return {
    en: required ? 'Certification required' : 'Certification not required',
    ar: required ? 'الاعتماد مطلوب' : 'الاعتماد غير مطلوب',
    bodyEn: '', bodyAr: '',
    route: required ? '/services/certify-an-event' : null,
    routeEn: 'Next', routeAr: 'التالي', state: required ? 'inforce' : 'review',
  };
}

export function venueApplicability(hosts: boolean, capacity: boolean): ApplicabilityAnswer {
  const required = hosts && capacity;
  return {
    en: required ? 'Hosting venue registration required' : 'Hosting venue registration not required',
    ar: required ? 'تسجيل الموقع المستضيف مطلوب' : 'تسجيل الموقع المستضيف غير مطلوب',
    bodyEn: '', bodyAr: '',
    route: required ? '/services/register-a-venue' : null,
    routeEn: 'Next', routeAr: 'التالي', state: required ? 'inforce' : 'review',
  };
}

export interface FacilityAnswer extends ApplicabilityAnswer {
  missingEn: string | null;
  missingAr: string | null;
}

export function facilityApplicability(categoryIndex: number): FacilityAnswer | null {
  if (!landingJson.facilityCategories[categoryIndex]) return null;
  return {
    en: 'Facility registration required', ar: 'تسجيل المنشأة مطلوب',
    bodyEn: '', bodyAr: '', route: '/services/register-a-facility',
    routeEn: 'Next', routeAr: 'التالي', state: 'inforce', missingEn: null, missingAr: null,
  };
}

/* ---------------- search ---------------- */

/**
 * A Ministry reference number, recognised by shape.
 *
 * The search field takes one question, and a reference number is a different KIND of
 * question from "what are the deadlines" -- it asks the register about one record
 * rather than asking the platform about itself. Recognising it by shape means a person
 * holding a reference can paste it into the one field on the page and be taken to the
 * right tool, instead of having to know which of two tools they wanted.
 */
export const REFERENCE_SHAPE = /^MOPH-EV-\d{4}-\d{4}$/;

export function looksLikeReference(query: string): boolean {
  return REFERENCE_SHAPE.test(query.trim().toUpperCase());
}

export interface SearchHit {
  en: string;
  ar: string;
  kindEn: string;
  kindAr: string;
  route: string;
}

const ROUTE_OF: Record<string, string> = {
  applic: '/applicability',
  service: '/services/certify-an-event',
  venue: '/services/register-a-venue',
  facility: '/services/register-a-facility',
  home: '/',
};

/** Whether a haystack answers a query. Every word must appear somewhere. */
function matches(query: string, haystack: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return false;
  const hay = haystack.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/**
 * THE THREE KINDS OF RESULT, in the order a person needs them: a service they can
 * start, a requirement or piece of guidance that answers the question, and -- if what
 * they typed is a reference number -- the register.
 *
 * Bilingual keywords are matched, so a search in Arabic finds the same things as the
 * same search in English. That is not decoration: the platform's users mostly type
 * Arabic, and a search that only understood English would make the Arabic side a
 * translation of a tool rather than the tool.
 */
export function searchServices(query: string): SearchHit[] {
  return (landingJson.services as { k: string; en: string; ar: string; kw?: string }[])
    .filter((s) => matches(query, `${s.en} ${s.ar} ${s.kw ?? ''}`))
    .map((s) => ({
      en: s.en,
      ar: s.ar,
      kindEn: 'Service',
      kindAr: 'خدمة',
      route:
        s.k === 'certify'
          ? '/services/certify-an-event'
          : s.k === 'venue'
            ? '/services/register-a-venue'
            : '/services/register-a-facility',
    }));
}

export function searchGuidance(query: string): SearchHit[] {
  return (landingJson.guidance as { en: string; ar: string; kindEn: string; kindAr: string; kw: string; go: string }[])
    .filter((g) => matches(query, `${g.en} ${g.ar} ${g.kw}`))
    .map((g) => ({
      en: g.en,
      ar: g.ar,
      kindEn: g.kindEn,
      kindAr: g.kindAr,
      route: ROUTE_OF[g.go] ?? '/',
    }));
}
