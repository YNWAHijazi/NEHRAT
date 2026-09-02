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

export const FACILITY_RULE_CHIPS: Record<FacilityRuleState, { en: string; ar: string }> = {
  inforce: { en: 'In force now', ar: 'ساري الآن' },
  part: { en: 'Partly in force', ar: 'ساري جزئياً' },
  unset: { en: 'Awaiting a Ministry value', ar: 'بانتظار قيمة من الوزارة' },
  review: { en: 'Determined by Ministry review', ar: 'يُحدَّد بمراجعة الوزارة' },
};

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
  if (selected.length > 0) {
    return {
      en: 'Subject to the Protocol',
      ar: 'خاضعة للبروتوكول',
      bodyEn:
        'At least one criterion applies, so the event is subject to the health and medical preparedness requirements. Certifying it begins with the assessment, which derives the level.',
      bodyAr:
        'ينطبق معيار واحد على الأقل، فالفعالية خاضعة لمتطلبات التأهب الصحي والطبي. ويبدأ اعتمادها بالتقييم الذي يشتق المستوى.',
      route: '/services/certify-an-event',
      routeEn: 'Read what certifying an event involves',
      routeAr: 'قراءة ما يستلزمه اعتماد الفعالية',
      state: 'inforce',
    };
  }
  return {
    en: 'The Ministry makes the final determination',
    ar: 'تتخذ الوزارة القرار النهائي',
    bodyEn:
      'None of the six criteria is met on your reading, which is not the same as the event being outside the Protocol. The Ministry may still designate an event, and a competent authority may refer one. If you are unsure, ask before the event rather than after it.',
    bodyAr:
      'لا ينطبق أي من المعايير الستة بحسب قراءتكم، وهذا ليس كالقول إن الفعالية خارج البروتوكول. فقد تحدد الوزارة فعالية، وقد تحيلها سلطة مختصة. وإذا كنتم غير متأكدين، فاسألوا قبل الفعالية لا بعدها.',
    route: null,
    routeEn: '',
    routeAr: '',
    state: 'review',
  };
}

/**
 * THE VENUE BRANCH. Both conditions must be met -- regularly hosting organized events
 * AND a licensed capacity of 1,000 or more. One or neither is not the end of the
 * question: individual events at the venue may still be subject, so the answer routes
 * to the event branch rather than stopping.
 */
export function venueApplicability(hosts: boolean, capacity: boolean): ApplicabilityAnswer {
  if (hosts && capacity) {
    return {
      en: 'A recurring event venue',
      ar: 'موقع فعاليات متكرر',
      bodyEn:
        'Both conditions are met, so the venue is a recurring event venue and is classified annually. Registration records it once; the classification is reassessed each year.',
      bodyAr:
        'استُوفي الشرطان، فالموقع موقع فعاليات متكرر ويُصنَّف سنوياً. ويسجّله التسجيل مرة واحدة؛ ويُعاد تقييم التصنيف كل سنة.',
      route: '/services/register-a-venue',
      routeEn: 'Read what registering a venue involves',
      routeAr: 'قراءة ما يستلزمه تسجيل الموقع',
      state: 'inforce',
    };
  }
  return {
    en: 'Not a recurring event venue',
    ar: 'ليس موقع فعاليات متكرر',
    bodyEn:
      'Both conditions have to be met, and they are not. That settles the venue question and not the event question: an individual event held here may still be subject to the Protocol on its own criteria.',
    bodyAr:
      'يجب استيفاء الشرطين معاً، ولم يُستوفيا. وهذا يحسم مسألة الموقع لا مسألة الفعالية: فقد تبقى الفعالية الفردية التي تُقام هنا خاضعة للبروتوكول بمعاييرها الخاصة.',
    route: '/applicability?subject=event',
    routeEn: 'Check whether an individual event is subject',
    routeAr: 'التحقق مما إذا كانت فعالية فردية خاضعة',
    state: 'review',
  };
}

/**
 * THE FACILITY BRANCH, which never returns a bare yes or no.
 *
 * It returns the applicable rule and its basis under a state chip, because for three
 * of the six categories the honest answer is that the Ministry has not set a value.
 * Saying "no" there would be wrong, and saying "yes" would promise a requirement that
 * does not exist yet.
 */
export interface FacilityAnswer extends ApplicabilityAnswer {
  /** Named when the category waits on a Ministry value. This is the answer, not a gap in it. */
  missingEn: string | null;
  missingAr: string | null;
}

export function facilityApplicability(categoryIndex: number): FacilityAnswer | null {
  const cats = landingJson.facilityCategories as {
    en: string; ar: string; state: string; ruleEn: string; ruleAr: string;
    basisEn: string; basisAr: string; missingEn?: string; missingAr?: string;
  }[];
  const cat = cats[categoryIndex];
  if (!cat) return null;
  return {
    en: cat.ruleEn,
    ar: cat.ruleAr,
    bodyEn: cat.basisEn,
    bodyAr: cat.basisAr,
    route: '/services/register-a-facility',
    routeEn: 'Read what registering a facility involves',
    routeAr: 'قراءة ما يستلزمه تسجيل المنشأة',
    state: (cat.state as FacilityRuleState) ?? 'review',
    missingEn: cat.missingEn ?? null,
    missingAr: cat.missingAr ?? null,
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
