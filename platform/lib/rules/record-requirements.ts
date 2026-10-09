/**
 * The single record page's one source of status (brief item 7).
 *
 * Plain TypeScript, like everything in lib/rules/. The catalogue
 * (data/requirement-catalogue.json) says what each requirement IS at a level: its
 * obligation, who may enter it, how it completes and which plan sections it feeds. This
 * module turns the catalogue plus the facts of one record into REQUIREMENT INSTANCES.
 * Summary counts, the cards, the submit gate, the generated plan and the reviewer's
 * view all read the same instances, so skipping the screen cannot bypass a required
 * item and a future-phase row can never become a false pre-event blocker.
 *
 * A requirement that does not apply at the level is ABSENT from the result -- no row,
 * not "not required" (non-negotiable 10). A later-phase row (after the event, when care
 * is given, if an incident occurs) is present in the 'later' group for clarity and is
 * never pending.
 */

import catalogue from './data/requirement-catalogue.json';
import { MAJOR_INCIDENT_ITEMS, PLAN_SECTIONS } from './content';
import { requirementsForLevel } from './requirements';
import type { NextStep } from './rail';
import type { Level } from './types';

export type RecordService = 'event' | 'venue';
export type AuthorRole = 'organizer' | 'ems' | 'director';
export type Obligation =
  | 'required' | 'requiredWhereApplicable' | 'inPlan' | 'recommended' | 'perAgency'
  | 'afterEvent' | 'whenCare' | 'ifIncident' | 'ifRequested' | 'notRequired';
export type RequirementGroup = 'required' | 'recommended' | 'later';
/** Where the page shows it: the readiness rows, the compact assessment block, or the final declaration. */
export type RequirementSection = 'requirement' | 'assessment' | 'declaration';
export type RequirementState = 'complete' | 'pending' | 'notAdded' | 'notProvided' | 'waiting' | 'later';
export type FieldType = 'text' | 'textarea' | 'number' | 'checkbox' | 'choice' | 'date';
export type AnswerValue = string | boolean | number;
export type PartyStatus = 'nominated' | 'confirmed' | 'declined' | 'withdrawn' | 'removed';

export interface FieldDef {
  key: string;
  type: FieldType;
  labelEn: string;
  labelAr: string;
  placeholderEn?: string;
  placeholderAr?: string;
  optional?: boolean;
  options?: readonly { value: string; en: string; ar: string }[];
  showWhen?: { field: string; equals: string };
}

export interface StoredAnswer {
  values: Readonly<Record<string, AnswerValue>>;
  savedByRole: AuthorRole;
  savedByName: string;
  savedAt: string;
  version: number;
}

export interface StoredFile {
  fileName: string;
  savedAt: string;
  savedByRole?: AuthorRole;
}

export interface PartyFact {
  token: string;
  name: string;
  status: PartyStatus;
  /** Level 3 EMS agencies: whether the readiness declaration is signed. */
  declarationSigned?: boolean;
}

export interface RecordFacts {
  service: RecordService;
  level: Level;
  /** Catalogue key -> the one shared answer. Plan text and major-incident items live here too. */
  answers: Readonly<Record<string, StoredAnswer>>;
  /** Catalogue key -> the stored file (maps, insurance evidence, a supporting plan document). */
  files: Readonly<Record<string, StoredFile>>;
  organizerContact: { name: string; phone: string } | null;
  assessmentComplete: boolean;
  ems: readonly PartyFact[];
  director: PartyFact | null;
  /** Level 3: the named Director's approval stands against the current plan and assessment versions. */
  planApprovalCurrent: boolean;
  declaration: { statementsComplete: boolean; certificationComplete: boolean };
  /** Catalogue keys the Ministry has recorded a request for (e.g. the Level 2 plan). */
  requested: readonly string[];
  /**
   * Catalogue keys whose completion is not demanded for THIS filing: a requirement that
   * took effect after the record was filed applies from its effective date forward
   * (Ministry ruling, 2026-08-29) and is asked through revision, never as a block.
   */
  waived?: readonly string[];
  /**
   * A hosting venue: the PAD facility registration on the same site, read through the
   * site and never copied (Hosting Venue Registration, 8 October 2026). Null when none.
   */
  padFacility?: { id: string; nameEn: string; nameAr: string; devices: number } | null;
  /**
   * An event held at a registered Facility/Site (latest revision, sections 16 and 17). What the
   * site offers is used only on the organizer's word: `confirmed` once they confirm the site
   * information applies to this event (the patient access answer then prefills the event's own
   * row); `aedReuse` once they answer that the site's AEDs remain accessible and operational
   * throughout the event (the AED part of the CPR and AED step is then the site's). The event
   * still answers every row itself; a prefilled value is a value the organizer can change.
   */
  site?: { confirmed: boolean; patientAccess: string; aedReuse: boolean; aedLocations: string } | null;
}

export interface RequirementInstance {
  key: string;
  /** The revised matrix row number, when the row is one. */
  n: number | null;
  labelEn: string;
  labelAr: string;
  promptEn: string;
  promptAr: string;
  infoEn: string | null;
  infoAr: string | null;
  /** The quoted level rule and the source responsibility from the matrix, when the row is one. */
  sourceEn: string;
  sourceAr: string;
  responsibilityEn: string;
  responsibilityAr: string;
  obligation: Obligation;
  obligationEn: string;
  obligationAr: string;
  group: RequirementGroup;
  section: RequirementSection;
  state: RequirementState;
  stateEn: string;
  stateAr: string;
  /** One line under the chip when the state needs a reason -- waiting on whom, requested by whom. */
  detailEn: string | null;
  detailAr: string | null;
  /** Who may enter it. Empty when it is derived or completes from someone else's act. */
  authors: readonly AuthorRole[];
  approver: 'director' | null;
  fields: readonly FieldDef[];
  values: Readonly<Record<string, AnswerValue>>;
  /** Field keys still owed, in form order. */
  missing: readonly string[];
  file: { labelEn: string; labelAr: string; present: StoredFile | null } | null;
  linkedPlan: readonly string[];
  answeredBy: { role: AuthorRole; name: string; at: string; version: number } | null;
  /** The Ministry asked for a row that is otherwise optional or absent. */
  requested: boolean;
  /** Required and not complete: a submission blocker. Derived rows never block twice. */
  blocks: boolean;
  /** The id the summary jumps to. */
  anchor: string;
}

export interface PlanSectionInstance {
  key: string;
  n: number;
  en: string;
  ar: string;
  promptEn: string;
  promptAr: string;
  source: 'derived' | 'linked' | 'own';
  /** The requirement instances this section reads from. */
  linked: readonly RequirementInstance[];
  /** The Protocol's own wording for the item, kept verbatim beneath the record's name for it. */
  protocolEn: string;
  protocolAr: string;
  /** Own narrative text, when the section has one (optional on linked sections, the answer on own ones). */
  text: string | null;
  ownText: boolean;
  complete: boolean;
  /** Level 3 section 12 carries the eleven items. */
  items: readonly MajorIncidentInstance[];
}

export interface MajorIncidentInstance {
  key: string;
  n: number;
  en: string;
  ar: string;
  promptEn: string;
  promptAr: string;
  linked: readonly RequirementInstance[];
  text: string | null;
  complete: boolean;
}

type CatalogueCell = {
  obligation: Obligation;
  authors?: readonly AuthorRole[];
  approver?: 'director';
  completion?: string;
  linkedPlan?: readonly string[];
  fields?: readonly FieldDef[];
  labelEn?: string; labelAr?: string;
  promptEn?: string; promptAr?: string;
  infoEn?: string; infoAr?: string;
  statements?: boolean;
};

type CatalogueRow = {
  key: string;
  n?: number;
  service: 'event' | 'venue' | 'both';
  labelEn: string; labelAr: string;
  venueLabelEn?: string; venueLabelAr?: string;
  /** Absent when the fields ask the question themselves (owner, 8 October 2026): the card then shows no prompt line. */
  promptEn?: string; promptAr?: string;
  venuePromptEn?: string; venuePromptAr?: string;
  infoEn?: string; infoAr?: string;
  fields?: readonly FieldDef[];
  file?: { labelEn: string; labelAr: string };
  levels: Record<'1' | '2' | '3', CatalogueCell>;
};

const ROWS = catalogue.rows as unknown as readonly CatalogueRow[];
const STATES = catalogue.states as Record<RequirementState, { en: string; ar: string }>;
const OBLIGATIONS = catalogue.obligations as Record<Obligation, { en: string; ar: string }>;
export const REQUIREMENT_COPY = catalogue.copy;
export const REQUIREMENT_GROUPS = catalogue.groups as Record<RequirementGroup, { en: string; ar: string; noteEn: string; noteAr: string }>;
export const REQUIREMENT_AUTHORS = catalogue.authors as Record<AuthorRole, { en: string; ar: string }>;
export const REQUIREMENT_DECISIONS = catalogue.decisions as Record<string, { state: 'confirmed' | 'proposal'; en: string; ar: string }>;
export const CATALOGUE_REVISION: string = catalogue.revision;

const TEXT_FIELD: FieldDef = { key: 'text', type: 'textarea', labelEn: 'Text', labelAr: 'النص' };

/**
 * The facility reference (SPEC 2e), now the event's link to its Site's AEDs (latest revision,
 * section 17): where the event is held at a registered Facility/Site with registered AEDs, the
 * CPR and AED step asks whether those AEDs will remain accessible and operational throughout
 * the event. Yes reuses them for the AED part of the step; No leaves the event to document its
 * own AED arrangement. The answer and the two event facts the shortfalls derive from are one
 * stored answer under this key, written by the organizer at every level, never inherited.
 * An answer stored before the question was asked this way ('confirmed') reads as Yes.
 */
export const FACILITY_REFERENCE_KEY = 'REF';
const REFERENCE_FIELDS: readonly FieldDef[] = [
  {
    key: 'reuse', type: 'choice',
    labelEn: 'Will these AEDs remain accessible and operational throughout this event?',
    labelAr: 'هل ستبقى أجهزة AED هذه متاحة وصالحة للتشغيل طوال مدة هذه الفعالية؟',
    options: [{ value: 'yes', en: 'Yes', ar: 'نعم' }, { value: 'no', en: 'No', ar: 'لا' }],
  },
  { key: 'admitsChildren', type: 'checkbox', optional: true, showWhen: { field: 'reuse', equals: 'yes' }, labelEn: 'The event admits children.', labelAr: 'تستقبل الفعالية أطفالاً.' },
  { key: 'temporaryAreas', type: 'checkbox', optional: true, showWhen: { field: 'reuse', equals: 'yes' }, labelEn: 'The event uses temporary areas outside the facility’s registered footprint.', labelAr: 'تستخدم الفعالية مناطق مؤقتة خارج النطاق المسجَّل للمنشأة.' },
];

/** The stored AED answer, reading an answer given under the earlier confirmation wording as Yes. */
export function siteAedAnswer(values: Readonly<Record<string, AnswerValue>> | null | undefined): 'yes' | 'no' | null {
  if (!values) return null;
  if (values['reuse'] === 'yes' || values['reuse'] === 'no') return values['reuse'];
  return values['confirmed'] === true ? 'yes' : null;
}

/** The catalogue row for a key, or null when the key is not a requirement. */
export function catalogueRow(key: string): CatalogueRow | null {
  return ROWS.find((r) => r.key === key) ?? null;
}

/** The plan section / major-incident item keys that carry their own text. */
export function planTextKeys(): string[] {
  return [
    ...(catalogue.planSections as { key: string; ownText?: boolean }[]).filter((s) => s.ownText).map((s) => s.key),
    ...(catalogue.majorIncidentItems as { key: string; linked?: string[] }[]).filter((m) => !m.linked).map((m) => m.key),
  ];
}

/**
 * The fields a key carries at a level and service -- the save action validates against
 * this, so a client cannot post a field the catalogue does not define. Plan text keys
 * carry one textarea. Null when the key does not exist or does not apply at the level.
 */
export function fieldsFor(key: string, level: Level, service: RecordService): FieldDef[] | null {
  if (planTextKeys().includes(key)) return [TEXT_FIELD];
  if (key === FACILITY_REFERENCE_KEY) return service === 'event' && level >= 1 ? [...REFERENCE_FIELDS] : null;
  const row = catalogueRow(key);
  if (!row) return null;
  const cell = row.levels[String(level) as '1' | '2' | '3'];
  if (!cell || !appliesAt(row, cell, service, [])) return null;
  if (cell.completion === 'rosterLink') return [];
  return (cell.fields ?? row.fields ?? []).map((f) => venueField(f, service));
}

/** The authors allowed on a key at a level, for the save action's role check. */
export function authorsFor(key: string, level: Level, service: RecordService): AuthorRole[] {
  // The plan is the medical team's: the EMS agency at Level 2, with the Director at Level 3
  // (decision D1: no Director below Level 3). No plan at Level 1.
  if (planTextKeys().includes(key)) return level === 3 ? ['ems', 'director'] : level === 2 ? ['ems'] : [];
  if (key === FACILITY_REFERENCE_KEY) return service === 'event' && level >= 1 ? ['organizer'] : [];
  const row = catalogueRow(key);
  const cell = row?.levels[String(level) as '1' | '2' | '3'];
  if (!row || !cell || !appliesAt(row, cell, service, [])) return [];
  return [...(cell.authors ?? [])];
}

/** Whether a row exists at a level and service at all -- an absent row is never shown and never invited for. */
export function requirementApplies(key: string, level: Level, service: RecordService): boolean {
  const row = catalogueRow(key);
  const cell = row?.levels[String(level) as '1' | '2' | '3'];
  return Boolean(row && cell && appliesAt(row, cell, service, []));
}

function appliesAt(row: CatalogueRow, cell: CatalogueCell, service: RecordService, requested: readonly string[]): boolean {
  if (row.service !== 'both' && row.service !== service) return false;
  if (cell.obligation === 'notRequired') return false;
  if (cell.obligation === 'ifRequested') return requested.includes(row.key);
  return true;
}

function venueField(f: FieldDef & { venueLabelEn?: string; venueLabelAr?: string }, service: RecordService): FieldDef {
  if (service !== 'venue' || !f.venueLabelEn || !f.venueLabelAr) {
    const { venueLabelEn: _e, venueLabelAr: _a, ...rest } = f;
    return rest;
  }
  const { venueLabelEn, venueLabelAr, ...rest } = f;
  return { ...rest, labelEn: venueLabelEn, labelAr: venueLabelAr };
}

function filled(field: FieldDef, value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  switch (field.type) {
    case 'checkbox': return value === true;
    case 'number': return typeof value === 'number' ? Number.isFinite(value) && value >= 0 : /^\d+$/.test(String(value).trim());
    default: return String(value).trim() !== '';
  }
}

function visible(field: FieldDef, values: Readonly<Record<string, AnswerValue>>): boolean {
  if (!field.showWhen) return true;
  return values[field.showWhen.field] === field.showWhen.equals;
}

function missingFields(fields: readonly FieldDef[], values: Readonly<Record<string, AnswerValue>>): string[] {
  return fields.filter((f) => !f.optional && visible(f, values) && !filled(f, values[f.key])).map((f) => f.key);
}

/**
 * What a confirmed site supplies to a row: `fill` stands until the organizer saves their own
 * value; `fixed` is the site's by the organizer's answer (the AED itself, once they answer that
 * the site's AEDs remain accessible and operational throughout the event).
 */
function siteValues(
  key: string,
  fields: readonly FieldDef[],
  site: RecordFacts['site'] | null,
): { fill: Record<string, AnswerValue>; fixed: Record<string, AnswerValue> } {
  const fill: Record<string, AnswerValue> = {};
  const fixed: Record<string, AnswerValue> = {};
  if (!site) return { fill, fixed };
  const has = (k: string) => fields.find((f) => f.key === k) ?? null;
  if (key === 'B8' && site.aedReuse) {
    const aed = has('aed');
    if (aed) fixed['aed'] = aed.type === 'checkbox' ? true : 'yes';
    if (has('location') && site.aedLocations.trim() !== '') fill['location'] = site.aedLocations;
  }
  if (key === 'B11' && site.confirmed && site.patientAccess.trim() !== '' && has('route')) fill['route'] = site.patientAccess;
  return { fill, fixed };
}

function fill(t: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), t);
}

/* ---------------- the resolver ---------------- */

export function resolveRequirements(facts: RecordFacts): RequirementInstance[] {
  const matrix = requirementsForLevel(facts.level);
  const levelKey = String(facts.level) as '1' | '2' | '3';
  const out: RequirementInstance[] = [];
  const byKey = new Map<string, RequirementInstance>();

  // Two passes: rows that derive from another row (first aid from the roster, the plan
  // from every linked row) resolve after the rows they read, in catalogue order
  // otherwise. The catalogue lists B5 before B4's dependants? No -- B4 precedes B5, so the
  // derived kinds are resolved in a second pass.
  const deferred: { row: CatalogueRow; cell: CatalogueCell }[] = [];
  for (const row of ROWS) {
    const cell = row.levels[levelKey];
    if (!cell || !appliesAt(row, cell, facts.service, facts.requested)) continue;
    if (cell.completion === 'rosterLink' || cell.completion === 'firstAidCoverage' || cell.completion === 'plan' || cell.completion === 'planApproved' || cell.completion === 'majorIncident') {
      deferred.push({ row, cell });
      continue;
    }
    const inst = instance(row, cell, facts, matrix, byKey);
    byKey.set(inst.key, inst);
    out.push(inst);
  }
  for (const { row, cell } of deferred) {
    const inst = instance(row, cell, facts, matrix, byKey);
    byKey.set(inst.key, inst);
    out.push(inst);
  }
  // Catalogue order is the page order; the deferred rows go back where the catalogue put them.
  const order = new Map(ROWS.map((r, i) => [r.key, i]));
  return out.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
}

function instance(
  row: CatalogueRow,
  cell: CatalogueCell,
  facts: RecordFacts,
  matrix: ReturnType<typeof requirementsForLevel>,
  resolved: ReadonlyMap<string, RequirementInstance>,
): RequirementInstance {
  const venue = facts.service === 'venue';
  const requested = facts.requested.includes(row.key);
  // A Ministry request makes an optional or otherwise-absent row required.
  const obligation: Obligation =
    requested && (cell.obligation === 'ifRequested' || cell.obligation === 'recommended') ? 'required' : cell.obligation;
  // A derived row (first aid from the roster) has nothing to enter: its fields are the roster's.
  const fields = cell.completion === 'rosterLink' ? [] : (cell.fields ?? row.fields ?? []).map((f) => venueField(f, facts.service));
  const stored = facts.answers[row.key] ?? null;
  // The organizer contact is prefilled from the account (or the venue's responsible
  // person) until the organizer saves a different one -- entered once, never retyped.
  const prefill: Readonly<Record<string, AnswerValue>> =
    cell.completion === 'organizerContact' && facts.organizerContact
      ? { name: facts.organizerContact.name, phone: facts.organizerContact.phone }
      : {};
  const reused = siteValues(row.key, fields, facts.site ?? null);
  const values: Readonly<Record<string, AnswerValue>> = { ...reused.fill, ...(stored?.values ?? prefill), ...reused.fixed };
  const matrixRow = row.n ? matrix.find((m) => m.n === row.n) ?? null : null;
  const file = row.file ? { ...row.file, present: facts.files[row.key] ?? null } : null;
  const group: RequirementGroup =
    obligation === 'recommended' ? 'recommended'
      : obligation === 'afterEvent' || obligation === 'whenCare' || obligation === 'ifIncident' ? 'later'
        : 'required';

  let state: RequirementState = 'pending';
  let missing: string[] = [];
  let detailEn: string | null = null;
  let detailAr: string | null = null;
  const copy = catalogue.copy;

  if (group === 'later') {
    state = 'later';
  } else {
    switch (cell.completion) {
      case 'organizerContact':
        missing = missingFields(fields, values);
        state = missing.length === 0 ? 'complete' : 'pending';
        break;
      case 'assessment':
        state = facts.assessmentComplete ? 'complete' : 'pending';
        break;
      case 'director': {
        const d = facts.director;
        if (d?.status === 'confirmed') state = 'complete';
        else if (d?.status === 'nominated') { state = 'waiting'; detailEn = copy.waitingDirectorEn; detailAr = copy.waitingDirectorAr; }
        else { state = group === 'recommended' ? 'notAdded' : 'pending'; detailEn = copy.noDirectorEn; detailAr = copy.noDirectorAr; }
        break;
      }
      case 'rosterLink': {
        const roster = resolved.get('B5');
        state = roster?.state === 'complete' ? 'complete' : 'pending';
        break;
      }
      case 'firstAidCoverage': {
        // Partner audit, 8 October 2026: where the BLS provider also supplies first aid, that
        // answer discharges this row; otherwise the organizer confirms separate trained personnel.
        const team = resolved.get('B5');
        if (team?.values['firstAid'] === 'yes') { state = 'complete'; detailEn = copy.firstAidFromTeamEn; detailAr = copy.firstAidFromTeamAr; }
        else { missing = missingFields(fields, values); state = missing.length === 0 ? 'complete' : 'pending'; }
        break;
      }
      case 'emsAndFields': {
        const confirmed = facts.ems.filter((p) => p.status === 'confirmed');
        const nominated = facts.ems.filter((p) => p.status === 'nominated');
        missing = missingFields(fields, values);
        // A nomination is not a confirmation: an unanswered invitation holds the row,
        // even beside an accepted one, until it is answered or withdrawn (rule 6).
        if (nominated.length > 0) { state = 'waiting'; detailEn = copy.waitingEmsEn; detailAr = copy.waitingEmsAr; }
        else if (confirmed.length === 0) { state = 'pending'; detailEn = copy.noEmsEn; detailAr = copy.noEmsAr; }
        else state = missing.length === 0 ? 'complete' : 'pending';
        break;
      }
      case 'aedChoice': {
        const choice = values['aed'];
        if (choice === 'yes') { missing = missingFields(fields, values); state = missing.length === 0 ? 'complete' : 'pending'; }
        else if (choice === 'no' || choice === 'notPlanned') state = 'notProvided';
        else state = 'notAdded';
        break;
      }
      case 'file':
        state = file?.present ? 'complete' : group === 'recommended' ? 'notAdded' : 'pending';
        break;
      case 'fileUnlessNotApplicable':
        // Required where applicable (partner review, 2026-10-07): the file discharges the row;
        // so does recording that none applies, with the reason. Neither, and the row stays open.
        if (file?.present) state = 'complete';
        else {
          missing = missingFields(fields, values);
          if (values['applicable'] === 'no' && missing.length === 0) { state = 'complete'; detailEn = copy.notApplicableEn; detailAr = copy.notApplicableAr; }
        }
        break;
      case 'fieldsAndFile':
        missing = missingFields(fields, values);
        state = missing.length === 0 && file?.present ? 'complete' : 'pending';
        break;
      case 'majorIncident': {
        const items = majorIncident(facts, resolved);
        state = items.every((i) => i.complete) ? 'complete' : 'pending';
        break;
      }
      case 'plan':
      case 'planApproved': {
        const sections = planSections(facts, resolved);
        const prepared = sections.every((s) => s.complete);
        if (!prepared) state = group === 'recommended' && !facts.answers['B2'] && sections.every((s) => s.source !== 'own' || !s.text) ? 'notAdded' : 'pending';
        else if (cell.completion === 'planApproved' && !facts.planApprovalCurrent) {
          state = 'waiting';
          detailEn = copy.waitingApprovalEn; detailAr = copy.waitingApprovalAr;
        } else state = 'complete';
        break;
      }
      case 'perAgency': {
        const live = facts.ems.filter((p) => p.status === 'confirmed' || p.status === 'nominated');
        if (live.length === 0) { state = 'pending'; detailEn = copy.noEmsEn; detailAr = copy.noEmsAr; }
        else if (live.every((p) => p.status === 'confirmed' && p.declarationSigned)) state = 'complete';
        else {
          state = 'waiting';
          detailEn = live.map((p) => fill(p.declarationSigned ? copy.agencySignedEn : copy.agencyUnsignedEn, { name: p.name })).join(' · ');
          detailAr = live.map((p) => fill(p.declarationSigned ? copy.agencySignedAr : copy.agencyUnsignedAr, { name: p.name })).join(' · ');
        }
        break;
      }
      case 'padLink': {
        // The facility registration on the same site discharges the row; so does recording that there is none.
        const pad = facts.padFacility ?? null;
        if (pad) {
          state = 'complete';
          detailEn = fill(copy.padLinkedEn, { name: pad.nameEn, id: pad.id, n: pad.devices });
          detailAr = fill(copy.padLinkedAr, { name: pad.nameAr, id: pad.id, n: pad.devices });
        } else if (values['none'] === true) {
          state = 'complete';
          detailEn = copy.padNoneEn; detailAr = copy.padNoneAr;
        } else state = 'pending';
        break;
      }
      case 'organizerDeclaration':
        state = (cell.statements === false || facts.declaration.statementsComplete) && facts.declaration.certificationComplete ? 'complete' : 'pending';
        break;
      case 'fields':
      default:
        missing = missingFields(fields, values);
        if (missing.length === 0 && fields.length > 0) state = 'complete';
        else state = group === 'recommended' && !stored ? 'notAdded' : 'pending';
    }
  }
  if (Object.keys(reused.fixed).length > 0 && detailEn === null) { detailEn = copy.siteAedsEn; detailAr = copy.siteAedsAr; }
  if (requested) { detailEn = detailEn ? `${copy.requestedEn} · ${detailEn}` : copy.requestedEn; detailAr = detailAr ? `${copy.requestedAr} · ${detailAr}` : copy.requestedAr; }
  const waived = state !== 'complete' && group === 'required' && (facts.waived ?? []).includes(row.key);
  if (waived) { detailEn = copy.waivedEn; detailAr = copy.waivedAr; }

  const derived = cell.completion === 'rosterLink';
  // A level's own wording wins; then the venue's; then the row's.
  const pick = (cellText: string | undefined, venueText: string | undefined, rowText: string | undefined): string =>
    cellText ?? (venue && venueText ? venueText : rowText ?? '');
  return {
    key: row.key,
    n: row.n ?? null,
    labelEn: pick(cell.labelEn, row.venueLabelEn, row.labelEn),
    labelAr: pick(cell.labelAr, row.venueLabelAr, row.labelAr),
    promptEn: pick(cell.promptEn, row.venuePromptEn, row.promptEn),
    promptAr: pick(cell.promptAr, row.venuePromptAr, row.promptAr),
    infoEn: cell.infoEn ?? row.infoEn ?? null,
    infoAr: cell.infoAr ?? row.infoAr ?? null,
    sourceEn: matrixRow?.valueEn ?? OBLIGATIONS[obligation].en,
    sourceAr: matrixRow?.valueAr ?? OBLIGATIONS[obligation].ar,
    responsibilityEn: matrixRow?.respEn ?? '',
    responsibilityAr: matrixRow?.respAr ?? '',
    obligation,
    obligationEn: OBLIGATIONS[obligation].en,
    obligationAr: OBLIGATIONS[obligation].ar,
    group,
    section: row.key === 'P-A' ? 'assessment' : row.key === 'P-C' ? 'declaration' : 'requirement',
    state,
    stateEn: STATES[state].en,
    stateAr: STATES[state].ar,
    detailEn,
    detailAr,
    authors: cell.authors ?? [],
    approver: cell.approver ?? null,
    fields,
    values,
    missing,
    file,
    linkedPlan: cell.linkedPlan ?? [],
    answeredBy: stored ? { role: stored.savedByRole, name: stored.savedByName, at: stored.savedAt, version: stored.version } : null,
    requested,
    blocks: group === 'required' && state !== 'complete' && !derived && !waived,
    anchor: `req-${row.key}`,
  };
}

/* ---------------- the plan, generated from the same instances ---------------- */

function textOf(facts: RecordFacts, key: string): string | null {
  const v = facts.answers[key]?.values['text'];
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function majorIncident(facts: RecordFacts, resolved: ReadonlyMap<string, RequirementInstance>): MajorIncidentInstance[] {
  const titles = catalogue.majorIncidentItems as { key: string; n: number; promptEn: string; promptAr: string; linked?: string[] }[];
  return titles.map((m) => {
    const linked = (m.linked ?? []).map((k) => resolved.get(k)).filter((x): x is RequirementInstance => Boolean(x));
    const title = MAJOR_INCIDENT_ITEMS.find((t) => t.n === m.n);
    const text = textOf(facts, m.key);
    const complete = m.linked ? linked.length > 0 && linked.every((i) => i.state === 'complete') : text !== null;
    return { key: m.key, n: m.n, en: title?.en ?? '', ar: title?.ar ?? '', promptEn: m.promptEn, promptAr: m.promptAr, linked, text, complete };
  });
}

function planSections(facts: RecordFacts, resolved: ReadonlyMap<string, RequirementInstance>): PlanSectionInstance[] {
  const defs = catalogue.planSections as { key: string; n: number; source: 'derived' | 'linked' | 'own'; linked?: string[]; ownText?: boolean; promptEn: string; promptAr: string; titleEn?: string; titleAr?: string }[];
  return defs
    // Section 12 below Level 3 IS the escalation row; the eleven items are Level 3's.
    .map((d) => {
      const title = PLAN_SECTIONS.find((t) => t.n === d.n);
      // Linked rows that do not apply at this level (B15 at Level 2) or belong to a later
      // phase (care records below Level 3) are not read: a section whose links all fall
      // away is answered by its own text instead.
      const linked = (d.linked ?? []).map((k) => resolved.get(k)).filter((x): x is RequirementInstance => x !== undefined && x.group !== 'later');
      const text = d.ownText ? textOf(facts, d.key) : null;
      const items = d.key === 'P12' && facts.level === 3 ? majorIncident(facts, resolved) : [];
      let complete: boolean;
      if (d.source === 'derived') complete = d.key === 'P02' ? Boolean(facts.organizerContact) : true;
      else if (d.source === 'own' || linked.length === 0) complete = text !== null;
      else complete = linked.every((i) => i.state === 'complete') && (items.length === 0 || items.every((i) => i.complete));
      // The record's own name for the section (owner, 8 October 2026); section 12 below Level 3 is the escalation procedure.
      const named = d.key === 'P12' && facts.level < 3 ? { en: 'Emergency escalation', ar: 'التصعيد في حالات الطوارئ' } : d.titleEn && d.titleAr ? { en: d.titleEn, ar: d.titleAr } : null;
      return { key: d.key, n: d.n, en: named?.en ?? title?.en ?? '', ar: named?.ar ?? title?.ar ?? '', protocolEn: title?.en ?? '', protocolAr: title?.ar ?? '', promptEn: d.promptEn, promptAr: d.promptAr, source: d.source, linked, text, ownText: Boolean(d.ownText), complete, items };
    });
}

/**
 * The plan's sixteen sections for this record, each either derived, linked to the
 * requirement instances it reads, or carrying its own text. Reads the SAME instances the
 * cards show, so nothing is asked twice (brief item 10). Empty below Level 2.
 */
export function resolvePlan(facts: RecordFacts, instances: readonly RequirementInstance[]): PlanSectionInstance[] {
  // A hosting venue has no event health and medical plan: the plan is each event's (8 October 2026).
  if (facts.level === 1 || facts.service === 'venue') return [];
  return planSections(facts, new Map(instances.map((i) => [i.key, i])));
}

/* ---------------- what the page and the gate read ---------------- */

/** The instances that stand between this record and submission, in page order. */
export function requirementBlockers(instances: readonly RequirementInstance[]): RequirementInstance[] {
  return instances.filter((i) => i.blocks);
}

export interface RequirementSummary {
  required: { total: number; complete: number };
  recommended: { total: number; complete: number };
  later: number;
}

/** The two summary counts cover the readiness rows; the assessment and the declaration have their own blocks. */
export function requirementSummary(instances: readonly RequirementInstance[]): RequirementSummary {
  const count = (g: RequirementGroup) => {
    const rows = instances.filter((i) => i.group === g && i.section === 'requirement');
    return { total: rows.length, complete: rows.filter((i) => i.state === 'complete').length };
  };
  return { required: count('required'), recommended: count('recommended'), later: instances.filter((i) => i.group === 'later').length };
}

/**
 * May this role enter the instance? The organizer when named; a medical party when named
 * -- the screen additionally requires a confirmed invitation on the record, which is a
 * fact of the record, not of the catalogue.
 */
export function mayAuthor(instance: RequirementInstance, role: AuthorRole): boolean {
  return instance.authors.includes(role);
}

/**
 * The one task the record page leads with, from the SAME instances the cards show --
 * so the panel can never disagree with the card it sends the reader to. Null once the
 * record is with the Ministry or closed.
 */
export function recordNextStep(input: {
  service: RecordService;
  level: Level | null;
  editable: boolean;
  filed: boolean;
  returned: boolean;
  instances: readonly RequirementInstance[];
  organizationPending: boolean;
}): NextStep | null {
  if (!input.editable) return null;
  if (input.level === null) {
    return { kind: 'assessment', href: '#assessment', tone: 'accent',
      titleEn: 'Complete the assessment', titleAr: 'إكمال التقييم',
      bodyEn: 'The level is derived from your answers and sets the requirements.', bodyAr: 'يُستنتج المستوى من إجاباتكم ويحدّد المتطلبات.',
      buttonEn: 'Open the assessment', buttonAr: 'فتح التقييم' };
  }
  const blockers = requirementBlockers(input.instances);
  const yours = blockers.filter((b) => b.section === 'requirement' && b.state !== 'waiting' && b.authors.includes('organizer'));
  const theirs = blockers.filter((b) => b.section === 'requirement' && b.state !== 'waiting' && !b.authors.includes('organizer') && b.authors.length > 0);
  const waiting = blockers.filter((b) => b.state === 'waiting');
  const declaration = blockers.find((b) => b.section === 'declaration');
  if (yours.length > 0) {
    const first = yours[0]!;
    return { kind: 'requirements', href: `#${first.anchor}`, tone: 'accent',
      titleEn: input.returned ? 'Update the requirements and resubmit' : yours.length === 1 ? 'Complete 1 remaining requirement' : `Complete ${yours.length} remaining requirements`,
      titleAr: input.returned ? 'حدّثوا المتطلبات وأعيدوا التقديم' : yours.length === 1 ? 'أكملوا المتطلب المتبقي' : `أكملوا المتطلبات المتبقية (${yours.length})`,
      bodyEn: theirs.length > 0 ? `Your medical team completes the other ${theirs.length}.` : 'Then review and submit at the foot of this page.',
      bodyAr: theirs.length > 0 ? `يستكمل فريقكم الطبي المتطلبات الأخرى (${theirs.length}).` : 'ثم راجعوا وقدّموا في أسفل هذه الصفحة.',
      buttonEn: `Open ${first.labelEn}`, buttonAr: `فتح ${first.labelAr}` };
  }
  if (theirs.length > 0) {
    const withDirector = theirs.some((b) => b.authors.includes('director'));
    return { kind: 'waitingOnOthers', href: `#${theirs[0]!.anchor}`, tone: 'accent',
      titleEn: 'Medical items pending', titleAr: 'البنود الطبية قيد الإنجاز',
      bodyEn: withDirector ? 'Your EMS agency or Medical Director completes the remaining items on this page.' : 'Your EMS agency completes the remaining items on this page.',
      bodyAr: withDirector ? 'تستكمل جهة الإسعاف أو المدير الطبي البنود المتبقية في هذه الصفحة.' : 'تستكمل جهة الإسعاف البنود المتبقية في هذه الصفحة.',
      buttonEn: 'View the items', buttonAr: 'عرض البنود' };
  }
  if (waiting.length > 0) {
    return { kind: 'waitingOnOthers', href: `#${waiting[0]!.anchor}`, tone: 'accent',
      titleEn: waiting.length === 1 ? 'Waiting for one response' : `Waiting for ${waiting.length} responses`,
      titleAr: waiting.length === 1 ? 'بانتظار ردّ واحد' : `بانتظار ${waiting.length} ردود`,
      bodyEn: 'Invitations, approvals and signatures that others owe hold up the submission.', bodyAr: 'الدعوات والاعتمادات والتواقيع المستحقة على الآخرين تؤخّر التقديم.',
      buttonEn: 'View', buttonAr: 'عرض' };
  }
  if (declaration) {
    return { kind: 'declarations', href: '#final-review', tone: 'accent',
      titleEn: 'Confirm and submit', titleAr: 'التأكيد والتقديم',
      bodyEn: 'Complete the declaration at the foot of this page, then submit.', bodyAr: 'أكملوا الإقرار في أسفل هذه الصفحة ثم قدّموا.',
      buttonEn: 'Open the declaration', buttonAr: 'فتح الإقرار' };
  }
  if (input.organizationPending) {
    return { kind: 'organizationPending', href: '/organization', tone: 'accent',
      titleEn: 'Wait for the Ministry to record the organization', titleAr: 'انتظروا تسجيل الوزارة للمؤسسة',
      bodyEn: 'Your preparation is complete. Organization registration is still required before submission.', bodyAr: 'اكتمل إعدادكم للملف. لا يزال تسجيل المؤسسة مطلوباً قبل التقديم.',
      buttonEn: 'Open the organization', buttonAr: 'فتح المؤسسة' };
  }
  return { kind: 'submit', href: '#final-review', tone: 'brand',
    titleEn: input.returned ? 'Ready to resubmit' : 'Ready to submit', titleAr: input.returned ? 'جاهز لإعادة التقديم' : 'جاهز للتقديم',
    bodyEn: 'Everything the level requires is in place.', bodyAr: 'كل ما يقتضيه المستوى مستوفى.',
    buttonEn: 'Review and submit', buttonAr: 'المراجعة والتقديم' };
}

/** "Who handles it", for the summary rows: the authors' labels, or "Included automatically". */
export function handledBy(instance: RequirementInstance): { en: string; ar: string } {
  if (instance.authors.length === 0) {
    if (instance.group === 'later') return { en: 'When it arises', ar: 'عند حدوثه' };
    return { en: catalogue.copy.derivedEn, ar: catalogue.copy.derivedAr };
  }
  const names = instance.authors.map((a) => REQUIREMENT_AUTHORS[a]);
  return { en: names.map((n) => n.en).join(' / '), ar: names.map((n) => n.ar).join(' / ') };
}
