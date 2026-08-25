/**
 * Typed access to the Slice 2 regulatory content. Screens import from here, never from
 * the raw JSON -- one place narrows, and the no-hardcoded-values sweep enforces it.
 */

import complianceJson from './data/compliance-form.json';
import venueJson from './data/venue.json';
import materialChangeJson from './data/material-change.json';
import planJson from './data/plan.json';
import postEventJson from './data/post-event-report.json';
import facilityJson from './data/facility.json';

export interface BilingualField {
  key: string;
  en: string;
  ar: string;
  /** True where the value itself is a proper noun entered in both languages. */
  bilingual?: boolean;
}

/** A yes/no fact a derivation needs, tagged by which issue of the regulation asks it. */
export interface EligibilityQuestion {
  en: string;
  ar: string;
  issue: 'both' | 'en-only' | 'ar-only';
}

export interface ComplianceDeclaration {
  en: string;
  ar: string;
  minLevel: number;
  arabicIsTranslation?: boolean;
  divergence?: string;
  fields?: BilingualField[];
}

export const COMPLIANCE_DECLARATIONS: readonly ComplianceDeclaration[] = complianceJson.sectionA;
export const COMPLIANCE_HEADER: readonly BilingualField[] = complianceJson.header;

export interface PlanSectionDef {
  n: number;
  en: string;
  ar: string;
  bodyEn: string;
  bodyAr: string;
}

export const PLAN_SECTIONS: readonly PlanSectionDef[] = planJson.sections;
export const MAJOR_INCIDENT_ITEMS: readonly { n: number; en: string; ar: string }[] =
  planJson.majorIncidentItems;
export const GUIDANCE_TEMPLATE = planJson.guidanceTemplate;
export const GUIDANCE_WORKFLOW = planJson.guidanceWorkflow;
export const GUIDANCE_DEPTH = planJson.guidanceDepth;

export interface MaterialChangeAspect {
  key: string;
  en: string;
  ar: string;
  affectsEn: string;
  affectsAr: string;
  consequenceEn: string;
  consequenceAr: string;
  levelMayChange: boolean;
}

export const MATERIAL_CHANGE_ASPECTS: readonly MaterialChangeAspect[] = materialChangeJson.aspects;

export const POST_EVENT_ACTIVITY_FIELDS: readonly BilingualField[] = postEventJson.activityFields;
export const POST_EVENT_SIGNIFICANT: readonly BilingualField[] = postEventJson.significantEvents;

/* ---------------- The venue service (Slice 3) ---------------- */

export interface VenueChangeAspect {
  key: string;
  en: string;
  ar: string;
  affectsEn: string;
  affectsAr: string;
  consequenceEn: string;
  consequenceAr: string;
}

export const VENUE_APPLICABILITY_INTRO: { en: string; ar: string } = venueJson.applicabilityIntro;
export const VENUE_CAPACITY_FIELD: BilingualField = venueJson.capacityField;
export const VENUE_REGISTRATION_FIELDS: readonly BilingualField[] = venueJson.registrationFields;
export const VENUE_REASSESSMENT_TRIGGERS: readonly { en: string; ar: string }[] = venueJson.reassessmentTriggers;
export const VENUE_CHANGE_ASPECTS: readonly VenueChangeAspect[] = venueJson.changeAspects;
export const VENUE_FLOOR_NOTE: { en: string; ar: string } = venueJson.floorNote;
export const VENUE_ELIGIBILITY_QUESTIONS: { regularlyHosts: EligibilityQuestion; nightclub: EligibilityQuestion } =
  venueJson.eligibilityQuestions as { regularlyHosts: EligibilityQuestion; nightclub: EligibilityQuestion };

/* ---------------- The facility service (Slice 4) ---------------- */
/* Categories and derivations live in lib/rules/facility.ts; screen content here. */

export const FACILITY_CONTENT = facilityJson;

/** Where the Director's governance text lands in the organizer's plan (the
 *  governance screen's own promises): clinical + command into section 10,
 *  the incident role into section 12. */
export const GOVERNANCE_LANDING = { clinicalSection: 10, incidentSection: 12 } as const;
