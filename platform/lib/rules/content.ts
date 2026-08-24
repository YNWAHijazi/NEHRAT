/**
 * Typed access to the Slice 2 regulatory content. Screens import from here, never from
 * the raw JSON -- one place narrows, and the no-hardcoded-values sweep enforces it.
 */

import complianceJson from './data/compliance-form.json';
import materialChangeJson from './data/material-change.json';
import planJson from './data/plan.json';
import postEventJson from './data/post-event-report.json';

export interface BilingualField {
  key: string;
  en: string;
  ar: string;
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
