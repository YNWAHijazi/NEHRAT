/**
 * THE FACILITY/SITE (owner decision, 9 October 2026; latest revision, sections 1-15).
 * Hosting Venue is removed as a regulatory entity: the Facility/Site is the one persistent
 * place record, anchored on its Site ID, registered once, reviewed by the Ministry and
 * maintained over time. Plain TypeScript like everything in lib/rules: no React, no next/*,
 * callable from a screen, a server action and a test.
 *
 * Four rules live here and no screen re-implements them:
 *  - APPLICABILITY (section 10): automatic for the objective categories, by the published
 *    capacity threshold for event-hosting venues, and by Ministry designation -- never the
 *    applicant's claim -- for the three designated categories;
 *  - THE SITE STATUS (section 11): product-defined operational labels, never the event
 *    outcomes and never an approval;
 *  - THE SUBMISSION SUMMARY AND ITS BLOCKERS (section 8): what the review page lists, and
 *    what must be complete before "Submit Facility/Site registration to MOPH";
 *  - THE DASHBOARD TABS (section 13), and where an old step link lands on them.
 */

import facilityJson from './data/facility.json';
import lifecycleJson from './data/lifecycle.json';
import { organizerEventState, type OutcomeKey } from './ministry';

const SITE = facilityJson.site;

export interface Bilingual { en: string; ar: string }

/* ---------------- the event-hosting capacity threshold ---------------- */

/** A value the Ministry has published, with the date it takes effect (null: none stated). */
export interface PublishedFigure {
  value: string;
  effective: string | null;
}

/**
 * The capacity at or above which an event-hosting venue is covered. A published Ministry
 * value governs once in force; otherwise the instrument's own figure from the data. Null
 * when neither exists -- the unset state, which the screens name rather than guess.
 */
export function eventVenueThreshold(published: PublishedFigure | null, today: string): number | null {
  if (published && (!published.effective || published.effective <= today)) {
    const n = Number(published.value);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  const v = (SITE.eventVenueCapacity as { minCapacity?: unknown }).minCapacity;
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null;
}

/** The figure as copy prints it: grouped, Western digits in both languages. */
export function formatCapacity(n: number): string {
  return n.toLocaleString('en-US');
}

/** The Ministry configuration key a published event-hosting threshold is stored under. */
export const EVENT_VENUE_CAPACITY_KEY: string = SITE.eventVenueCapacity.configKey;

/* ---------------- categories and applicability ---------------- */

export type ApplicabilityMode = 'objective' | 'capacity' | 'designation';

/** How a category's coverage is decided: by itself, by capacity, or only by Ministry designation. */
export function categoryApplicabilityMode(categoryKey: string): ApplicabilityMode | null {
  const c = facilityJson.categories.find((x) => x.key === categoryKey) as { applicability?: string } | undefined;
  return c?.applicability === 'objective' || c?.applicability === 'capacity' || c?.applicability === 'designation' ? c.applicability : null;
}

/** True for the categories the applicant may name but never decide (revision sections 1 and 10). */
export function categoryNeedsDesignation(categoryKey: string): boolean {
  return categoryApplicabilityMode(categoryKey) === 'designation';
}

/** A category template with its {capacity} filled, or its unset wording while no threshold exists. */
export function fillCapacity(template: string, unset: string | undefined, threshold: number | null): string {
  if (!template.includes('{capacity}')) return template;
  if (threshold === null) return unset ?? template.replace('{capacity}', '—');
  return template.replace('{capacity}', formatCapacity(threshold));
}

export type ApplicabilityKey = 'covered' | 'awaitingDesignation' | 'designated' | 'belowThreshold' | 'capacityMissing' | 'thresholdUnset';

export interface Applicability extends Bilingual {
  key: ApplicabilityKey;
  /** The category reaches the site: its obligations run. */
  covered: boolean;
}

/**
 * Whether the chosen category reaches the site (revision section 10). The objective
 * categories apply automatically; an event-hosting venue applies at or above the
 * threshold; a designated category applies only where a Ministry designation names the
 * site. An unknown category is not covered.
 */
export function siteApplicability(input: {
  categoryKey: string;
  capacity: number | null;
  threshold: number | null;
  /** The date of the Ministry designation naming this site, null when none does. */
  designatedOn: string | null;
}): Applicability {
  const t = SITE.applicability;
  const mode = categoryApplicabilityMode(input.categoryKey);
  const fill = (s: Bilingual, cap: number | null = input.threshold) => ({
    en: s.en.replace('{capacity}', cap === null ? '' : formatCapacity(cap)).replace('{date}', input.designatedOn ?? ''),
    ar: s.ar.replace('{capacity}', cap === null ? '' : formatCapacity(cap)).replace('{date}', input.designatedOn ?? ''),
  });
  if (mode === 'designation') {
    return input.designatedOn
      ? { key: 'designated', covered: true, ...fill(t.designated) }
      : { key: 'awaitingDesignation', covered: false, ...fill(t.awaitingDesignation) };
  }
  if (mode === 'capacity') {
    if (input.threshold === null) return { key: 'thresholdUnset', covered: false, ...fill(t.thresholdUnset) };
    if (input.capacity === null) return { key: 'capacityMissing', covered: false, ...fill(t.capacityMissing) };
    if (input.capacity < input.threshold) return { key: 'belowThreshold', covered: false, ...fill(t.belowThreshold) };
    return { key: 'covered', covered: true, ...fill(t.covered) };
  }
  if (mode === 'objective') return { key: 'covered', covered: true, ...fill(t.covered) };
  return { key: 'awaitingDesignation', covered: false, ...fill(t.awaitingDesignation) };
}

/**
 * Whether the intake can go on with this category and capacity. Only a capacity the
 * category cannot reach ends it (rule 10: what never applies is absent, so the Continue
 * control is not drawn). A designated category registers -- the Ministry decides later.
 */
export function intakeEndsForCapacity(a: Applicability): boolean {
  return a.key === 'belowThreshold' || a.key === 'thresholdUnset';
}

/* ---------------- the site status ---------------- */

export type SiteStatusKey =
  | 'inPreparation' | 'submitted' | 'underReview' | 'informationRequired'
  | 'readinessCurrent' | 'expiringSoon' | 'expired' | 'correctiveActionRequired' | 'noLongerCovered';

/** The Ministry acts that move the status, as recorded against the latest submission. */
export type SiteReviewActKind = 'reviewStarted' | 'accepted' | 'infoRequested' | 'correctionRequested' | 'inspection' | 'designation';

export interface SiteStatusFacts {
  archived: boolean;
  /** Submissions to the Ministry, every version. */
  submissionCount: number;
  /** The status-moving Ministry acts recorded against the LATEST submission, oldest first. */
  actsOnLatest: SiteReviewActKind[];
  /** Open corrective actions raised by the Ministry (not information requests, not confirmation requests). */
  openCorrective: number;
  /** The Ministry has accepted some version: from then on the site is managed from its dashboard. */
  everAccepted?: boolean;
  /** Where the annual readiness confirmation and drill stand (siteRenewal below); absent reads as current. */
  renewal?: SiteRenewalKey;
}

/**
 * Whether the record is locked while the Ministry has it, as an event's is once filed: a
 * submission nobody has accepted yet, not returned for information or a correction. It
 * reopens exactly as an event's does when the Ministry asks for more. After a first
 * acceptance the site is maintained (revision section 14) and never locks again.
 */
export function siteRecordLocked(f: SiteStatusFacts): boolean {
  if (f.archived || f.everAccepted) return false;
  const status = siteStatus(f);
  return status === 'submitted' || status === 'underReview';
}

/** The outcomes a reviewer records on a submission (revision section 11), each with the status it leads to. */
export type SiteOutcomeKey = 'accept' | 'information' | 'correction';
export const SITE_OUTCOMES: readonly { key: SiteOutcomeKey; en: string; ar: string; noteRequired: boolean }[] = [
  { key: 'accept', en: 'Accept the registration and readiness record — readiness current', ar: 'قبول التسجيل وسجل الجاهزية — الجاهزية سارية', noteRequired: false },
  { key: 'information', en: 'Request additional information — information required', ar: 'طلب معلومات إضافية — مطلوب معلومات', noteRequired: true },
  { key: 'correction', en: 'Request a correction — information required', ar: 'طلب تصحيح — مطلوب معلومات', noteRequired: true },
];

/**
 * The site's status (revision section 11): operational labels, not regulatory
 * classifications. Precedence: coverage ended; never submitted; the Ministry asked for
 * information or a correction on the latest submission; an open corrective action; the
 * latest submission accepted -- current, expiring soon or expired by the annual renewal; the
 * review started; submitted.
 */
export function siteStatus(f: SiteStatusFacts): SiteStatusKey {
  if (f.archived) return 'noLongerCovered';
  if (f.submissionCount === 0) return 'inPreparation';
  const moving = f.actsOnLatest.filter((k) => k === 'reviewStarted' || k === 'accepted' || k === 'infoRequested' || k === 'correctionRequested');
  const last = moving[moving.length - 1] ?? null;
  if (last === 'infoRequested' || last === 'correctionRequested') return 'informationRequired';
  if (f.openCorrective > 0) return 'correctiveActionRequired';
  if (last === 'accepted') return f.renewal === 'expired' ? 'expired' : f.renewal === 'expiringSoon' ? 'expiringSoon' : 'readinessCurrent';
  if (last === 'reviewStarted') return 'underReview';
  return 'submitted';
}

export function siteStatusLabel(key: SiteStatusKey): Bilingual {
  const s = SITE.statuses[key];
  return { en: s.en, ar: s.ar };
}

/** The colour family a status is drawn in. Internal states are grey; nothing here is a determination. */
export function siteStatusTone(key: SiteStatusKey): 'grey' | 'accent' | 'bad' | 'brand' {
  if (key === 'readinessCurrent') return 'brand';
  if (key === 'correctiveActionRequired' || key === 'expired') return 'bad';
  if (key === 'informationRequired' || key === 'expiringSoon') return 'accent';
  return 'grey';
}

/** The registration may be submitted (again) only while in preparation or answering a request. */
export function siteMaySubmit(key: SiteStatusKey): boolean {
  return key === 'inPreparation' || key === 'informationRequired';
}

/**
 * The certificate is issued only while readiness is current (not in the revision; recorded).
 * Expiring soon is still current; expired is not.
 */
export function siteCertificateAvailable(key: SiteStatusKey): boolean {
  return key === 'readinessCurrent' || key === 'expiringSoon';
}

/* ---------------- the annual renewal ---------------- */

/**
 * WHEN A SITE'S READINESS EXPIRES (owner, 9 October 2026). The policy sets no licence term
 * for a site; what it sets is annual: the readiness confirmation and the practical drill,
 * each within the previous 12 months. A site is EXPIRED once either is past that date,
 * and EXPIRING SOON from the Ministry-set number of days before it (lapseWindowDays, 60 by
 * default). The dates come from the facility ledger (lib/rules/facility.ts), so the ledger,
 * the status and the event alert cannot disagree. An obligation never recorded has no date
 * and is the ledger's to name, not this rule's to guess.
 */
export type SiteRenewalKey = 'current' | 'expiringSoon' | 'expired' | 'notRecorded';
export type RenewalObligation = 'annualConfirmation' | 'drill';
export const RENEWAL_OBLIGATIONS: readonly RenewalObligation[] = ['annualConfirmation', 'drill'];

export interface SiteRenewal {
  key: SiteRenewalKey;
  /** The earliest date an annual obligation stops counting; null while neither is recorded. */
  dueDate: string | null;
  /** The obligations that fall due on that date. */
  obligations: RenewalObligation[];
}

export function siteRenewal(rows: readonly { key: string; until: string | null; status: string }[]): SiteRenewal {
  const dated = rows.filter((r): r is { key: RenewalObligation; until: string; status: string } =>
    (RENEWAL_OBLIGATIONS as readonly string[]).includes(r.key) && r.until !== null);
  if (dated.length === 0) return { key: 'notRecorded', dueDate: null, obligations: [] };
  const due = dated.reduce((a, r) => (r.until < a ? r.until : a), dated[0]!.until);
  const key: SiteRenewalKey = dated.some((r) => r.status === 'lapsed') ? 'expired' : dated.some((r) => r.status === 'lapsing') ? 'expiringSoon' : 'current';
  return { key, dueDate: due, obligations: RENEWAL_OBLIGATIONS.filter((o) => dated.some((r) => r.key === o && r.until === due)) };
}

function obligationNames(list: readonly RenewalObligation[]): Bilingual {
  const label = (o: RenewalObligation) => {
    const row = facilityJson.ledger.obligations.find((x) => x.key === o)!;
    return { en: row.en.toLowerCase(), ar: row.ar };
  };
  const names = list.map(label);
  return {
    en: `The ${names.map((n) => n.en).join(' and the ')}`,
    ar: names.map((n) => n.ar).join(' و'),
  };
}

/** The line the site's own dashboard shows while it is expiring soon or expired; null otherwise. */
export function siteRenewalNotice(r: SiteRenewal): Bilingual | null {
  if ((r.key !== 'expiringSoon' && r.key !== 'expired') || !r.dueDate) return null;
  const n = obligationNames(r.obligations);
  const plural = r.obligations.length > 1;
  const date = `⁦${r.dueDate}⁩`;
  return r.key === 'expiringSoon'
    ? {
        en: `${n.en} ${plural ? 'are' : 'is'} due by ${r.dueDate}. Record ${plural ? 'them' : 'it'} before then to keep the site’s readiness current.`,
        ar: `يحين موعد ${n.ar} في ${date}. سجّلوا ذلك قبل هذا التاريخ لتبقى جاهزية الموقع سارية.`,
      }
    : {
        en: `${n.en} ${plural ? 'were' : 'was'} due by ${r.dueDate}. The site’s readiness is not current until ${plural ? 'they are' : 'it is'} recorded.`,
        ar: `انقضى موعد ${n.ar} في ${date}. لا تكون جاهزية الموقع سارية حتى يُسجَّل ذلك.`,
      };
}

export type EventSiteAlertKey = 'expired' | 'dueBeforeEventEnds' | 'expiringSoon';

/** The same alert, short, for the event's card on the dashboard. */
export const EVENT_SITE_ALERT_SHORT: Record<EventSiteAlertKey, Bilingual> = {
  expired: { en: 'Site expired', ar: 'انتهت جاهزية الموقع' },
  dueBeforeEventEnds: { en: 'Site renewal due before the event ends', ar: 'يحين تجديد الموقع قبل انتهاء الفعالية' },
  expiringSoon: { en: 'Site expiring soon', ar: 'تنتهي جاهزية الموقع قريباً' },
};

/**
 * The alert an event held at a site carries (owner, 9 October 2026): the site has expired; or
 * its annual confirmation or drill falls due before the event ends -- before or during it, so
 * readiness would not be current for the whole event unless the site renews; or the site is
 * expiring soon. Null when none applies, or the site's readiness was never accepted (that
 * state is the site's status, not a renewal).
 */
export function eventSiteAlert(
  r: SiteRenewal,
  event: { startDate: string | null; endDate: string | null },
  site: { nameEn: string; nameAr: string; siteId: string },
): (Bilingual & { key: EventSiteAlertKey }) | null {
  if (!r.dueDate || r.key === 'notRecorded') return null;
  const n = obligationNames(r.obligations);
  const lower = { en: n.en.replace(/^The /, 'the '), ar: n.ar };
  const date = `⁦${r.dueDate}⁩`;
  const who = { en: `${site.nameEn} (${site.siteId})`, ar: `${site.nameAr} (⁦${site.siteId}⁩)` };
  const end = event.endDate ?? event.startDate;
  if (r.key === 'expired') {
    return {
      key: 'expired',
      en: `The site this event is held at, ${who.en}, has expired: ${lower.en} ${r.obligations.length > 1 ? 'were' : 'was'} due by ${r.dueDate}. Its readiness is not current until the site records ${r.obligations.length > 1 ? 'them' : 'it'}.`,
      ar: `انتهت جاهزية الموقع الذي تُقام فيه هذه الفعالية، ${who.ar}: انقضى موعد ${lower.ar} في ${date}. لا تكون جاهزيته سارية حتى يسجّل الموقع ذلك.`,
    };
  }
  if (end && r.dueDate <= end) {
    return {
      key: 'dueBeforeEventEnds',
      en: `For the site this event is held at, ${who.en}, ${lower.en} ${r.obligations.length > 1 ? 'are' : 'is'} due by ${r.dueDate}, before this event ends. Unless the site records ${r.obligations.length > 1 ? 'them' : 'it'} by then, its readiness will not be current for the event.`,
      ar: `يحين موعد ${lower.ar} للموقع الذي تُقام فيه هذه الفعالية، ${who.ar}، في ${date}، قبل انتهاء الفعالية. ما لم يسجّل الموقع ذلك قبل هذا التاريخ، لن تكون جاهزيته سارية خلال الفعالية.`,
    };
  }
  if (r.key === 'expiringSoon') {
    return {
      key: 'expiringSoon',
      en: `The site this event is held at, ${who.en}, is expiring soon: ${lower.en} ${r.obligations.length > 1 ? 'are' : 'is'} due by ${r.dueDate}.`,
      ar: `تنتهي قريباً جاهزية الموقع الذي تُقام فيه هذه الفعالية، ${who.ar}: يحين موعد ${lower.ar} في ${date}.`,
    };
  }
  return null;
}

/**
 * Which review acts the Ministry may take now (revision section 11), from the same facts as
 * the status. Starting the review needs a submission nobody has acted on; accepting needs
 * the latest submission still open (not already accepted, not waiting on the operator); a
 * request for information or a correction needs a submission not already waiting on one.
 * Corrective actions, inspections and designations are recorded at any time after a
 * submission and move nothing but their own records.
 */
export function siteReviewActions(f: SiteStatusFacts): { start: boolean; accept: boolean; request: boolean; record: boolean } {
  if (f.archived || f.submissionCount === 0) return { start: false, accept: false, request: false, record: false };
  const moving = f.actsOnLatest.filter((k) => k === 'reviewStarted' || k === 'accepted' || k === 'infoRequested' || k === 'correctionRequested');
  const last = moving[moving.length - 1] ?? null;
  const waiting = last === 'infoRequested' || last === 'correctionRequested';
  return { start: last === null, accept: last === null || last === 'reviewStarted', request: !waiting, record: true };
}

export function reviewActLabel(kind: SiteReviewActKind): Bilingual {
  const a = SITE.reviewActs[kind];
  return { en: a.en, ar: a.ar };
}

/* ---------------- the review page and its blockers ---------------- */

export interface SiteSubmissionFacts {
  /** Name, organization, address, municipality, hours, telephone, email and, where the category needs it, the capacity. */
  profileComplete: boolean;
  mapConfirmed: boolean;
  contactComplete: boolean;
  /** Main EMS entrance and the EMS number used by the site. */
  emsAccessComplete: boolean;
  aedRequired: boolean;
  deviceCount: number;
  devicesNotReady: number;
  confirmationRecorded: boolean;
  confirmationCurrent: boolean;
  infrastructureRecorded: boolean;
  documentCount: number;
  photoCount: number;
  /** A capacity category the recorded capacity does not reach: the site is not covered by it. */
  outsideCategory: boolean;
}

export type SummaryKey = 'profile' | 'contact' | 'emsAccess' | 'aeds' | 'plan' | 'confirmation' | 'infrastructure' | 'evidence';

export interface SummaryLine {
  key: SummaryKey;
  en: string; ar: string;
  valueEn: string; valueAr: string;
  /** Complete, or nothing owed (an optional line). */
  done: boolean;
  optional: boolean;
}

const COMPLETE: Bilingual = { en: 'Complete', ar: 'مكتمل' };
const INCOMPLETE: Bilingual = { en: 'Incomplete', ar: 'غير مكتمل' };

/** The AEDs are done: none owed where none is required, and every registered AED ready. */
export function siteAedsDone(f: Pick<SiteSubmissionFacts, 'aedRequired' | 'deviceCount' | 'devicesNotReady'>): boolean {
  return (!f.aedRequired || f.deviceCount > 0) && f.devicesNotReady === 0;
}

/** The plan reuses what is entered: it is complete when the profile, the contact, EMS access and the AEDs are. */
export function sitePlanComplete(f: SiteSubmissionFacts): boolean {
  return f.profileComplete && f.mapConfirmed && f.contactComplete && f.emsAccessComplete && siteAedsDone(f);
}

/** The single review page's lines, in the revision's order (section 8). */
export function siteSubmissionSummary(f: SiteSubmissionFacts): SummaryLine[] {
  const yes = (done: boolean): Bilingual => (done ? COMPLETE : INCOMPLETE);
  const aedsValue: Bilingual = f.devicesNotReady > 0
    ? { en: 'An AED is not ready', ar: 'جهاز غير جاهز' }
    : f.deviceCount === 0
      ? (f.aedRequired ? { en: 'No AED registered', ar: 'لم يُسجَّل أي جهاز' } : { en: 'None registered — not required', ar: 'لا أجهزة مسجّلة — غير مطلوبة' })
      : f.deviceCount === 1 ? { en: '1 AED registered', ar: 'جهاز واحد مسجَّل' } : { en: `${f.deviceCount} AEDs registered`, ar: `${f.deviceCount} أجهزة مسجّلة` };
  const confirmation: Bilingual = f.confirmationCurrent ? COMPLETE
    : f.confirmationRecorded ? { en: 'To be confirmed again', ar: 'يلزم تأكيدها مجدداً' } : { en: 'Not recorded', ar: 'غير مسجَّل' };
  const evidenceCount = f.documentCount + f.photoCount;
  const docs = f.documentCount === 1 ? { en: '1 document', ar: 'مستند واحد' } : { en: `${f.documentCount} documents`, ar: `${f.documentCount} مستندات` };
  const photos = f.photoCount === 1 ? { en: '1 photograph', ar: 'صورة واحدة' } : { en: `${f.photoCount} photographs`, ar: `${f.photoCount} صور` };
  const none: Bilingual = { en: 'None — optional', ar: 'لا شيء — اختياري' };
  const plan = facilityJson.planTitle;
  return [
    { key: 'profile', en: 'Site profile', ar: 'ملف الموقع', ...val(yes(f.profileComplete && f.mapConfirmed && !f.outsideCategory)), done: f.profileComplete && f.mapConfirmed && !f.outsideCategory, optional: false },
    { key: 'contact', en: 'Responsible contact', ar: 'جهة الاتصال المسؤولة', ...val(yes(f.contactComplete)), done: f.contactComplete, optional: false },
    { key: 'emsAccess', en: 'EMS access', ar: 'وصول خدمات الطوارئ الطبية', ...val(yes(f.emsAccessComplete)), done: f.emsAccessComplete, optional: false },
    { key: 'aeds', en: 'AED registration', ar: 'تسجيل أجهزة إزالة الرجفان', ...val(aedsValue), done: siteAedsDone(f), optional: false },
    { key: 'plan', en: plan.en, ar: plan.ar, ...val(yes(sitePlanComplete(f))), done: sitePlanComplete(f), optional: false },
    { key: 'confirmation', en: 'Readiness confirmation', ar: 'تأكيد الجاهزية', ...val(confirmation), done: f.confirmationCurrent, optional: false },
    { key: 'infrastructure', en: 'Basic site infrastructure', ar: 'البنية الأساسية للموقع', ...val(f.infrastructureRecorded ? { en: 'Recorded', ar: 'مسجّلة' } : none), done: true, optional: true },
    {
      key: 'evidence', en: 'Supporting evidence', ar: 'الأدلة الداعمة',
      ...val(evidenceCount === 0 ? none : { en: `${docs.en} / ${photos.en}`, ar: `${docs.ar} / ${photos.ar}` }),
      done: true, optional: true,
    },
  ];
}

function val(v: Bilingual): { valueEn: string; valueAr: string } {
  return { valueEn: v.en, valueAr: v.ar };
}

/** What still stands between the site and "Submit Facility/Site registration to MOPH". Empty when it may be submitted. */
export function siteSubmitBlockers(f: SiteSubmissionFacts): SummaryLine[] {
  return siteSubmissionSummary(f).filter((l) => !l.done);
}

/* ---------------- the dashboard after registration ---------------- */

export type SiteTabKey = 'overview' | 'readiness' | 'aeds' | 'events' | 'incidents' | 'documents' | 'history';

/** The tabs, in the revision's order (section 13). No venue tab and no VN-ID. */
export const SITE_TABS: readonly { key: SiteTabKey; en: string; ar: string }[] = [
  { key: 'overview', en: 'Overview', ar: 'نظرة عامة' },
  { key: 'readiness', en: 'Cardiac readiness', ar: 'الجاهزية لتوقف القلب' },
  { key: 'aeds', en: 'AEDs', ar: 'أجهزة إزالة الرجفان' },
  { key: 'events', en: 'Events', ar: 'الفعاليات' },
  { key: 'incidents', en: 'Incident reports', ar: 'تقارير الحوادث' },
  { key: 'documents', en: 'Documents', ar: 'المستندات' },
  { key: 'history', en: 'Ministry history', ar: 'سجل الوزارة' },
];

/**
 * The tab a request lands on: the one named, else the one an old step link or a redirect's
 * step meant, else the overview. Old links (?step=aeds, ?step=plan, /incidents) keep working.
 */
export function siteTabFor(tab: string | null | undefined, step: string | null | undefined): SiteTabKey {
  const named = SITE_TABS.find((t) => t.key === tab);
  if (named) return named.key;
  switch (step) {
    case 'aeds': return 'aeds';
    case 'plan': case 'confirmation': case 'contact': return 'readiness';
    case 'evidence': return 'documents';
    case 'incidents': return 'incidents';
    default: return 'overview';
  }
}

/* ---------------- documents ---------------- */

export interface EvidenceType { key: string; en: string; ar: string }

/** The document types an operator chooses from, plus the response to a corrective action. */
export function evidenceTypes(): EvidenceType[] {
  return SITE.evidence.types.map((t) => ({ key: t.key, en: t.en, ar: t.ar }));
}

export function evidenceTypeLabel(key: string): Bilingual {
  if (key === SITE.evidence.responseType.key) return { en: SITE.evidence.responseType.en, ar: SITE.evidence.responseType.ar };
  const t = SITE.evidence.types.find((x) => x.key === key);
  return t ? { en: t.en, ar: t.ar } : { en: key || '—', ar: key || '—' };
}

export const CORRECTIVE_RESPONSE_TYPE: string = SITE.evidence.responseType.key;

/** A date an operator typed, kept only when it is a real calendar date. */
export function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
}

/* ---------------- the events held at the site ---------------- */

/**
 * The status an event at the site shows on the site's Events tab: its lifecycle where it was
 * cancelled or postponed, else the plain record status every surface reads (lib/rules/ministry.ts
 * organizerEventState) -- never one of the three determinations in their own words.
 */
export function siteEventStatus(r: { lifecycle: string; outcome: string | null; filed: number }): Bilingual {
  const states = lifecycleJson.states as Record<string, Bilingual>;
  if (r.lifecycle === 'cancelled' || r.lifecycle === 'postponed') return states[r.lifecycle]!;
  return organizerEventState({ outcome: (r.outcome as OutcomeKey | null) ?? null, filed: r.filed === 1, assessed: true });
}
