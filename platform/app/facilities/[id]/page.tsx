import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { L } from '../../../components/L';
import { FacilityWorkspace } from '../../../components/FacilityWorkspace';
import { NextStepCard } from '../../../components/NextStepCard';
import { StageRail } from '../../../components/StageRail';
import { RecordStepper, type StepperStep } from '../../../components/record/RecordStepper';
import { JumpTo } from '../../../components/record/JumpTo';
import { AedWhereToBuy } from '../../../components/AedWhereToBuy';
import { VendorDirectoryLink } from '../../../components/VendorDirectoryLink';
import { FacilityIncidentReports, type FacilityIncidentReport } from '../../../components/FacilityIncidentReports';
import { DeviceRegistry } from './DeviceRegistry';
import { FacilityPlan } from './FacilityPlan';
import { PlanConfirmation } from './PlanConfirmation';
import { InfrastructureForm } from './InfrastructureForm';
import { EvidenceSection } from './EvidenceSection';
import { SubmitReview } from './SubmitReview';
import { EventsTab, HistoryTab, SiteTabsNav, TabSection } from './SiteSections';
import { currentAccount } from '../../../lib/auth';
import { beirutToday } from '../../../lib/clock';
import { getDb } from '../../../lib/db';
import { devicePoint, facilityAedStatus, facilityPoint } from '../../../lib/facility-gis';
import { facilityRegistrationFacts } from '../../../lib/facility-registration';
import { paymentFor } from '../../../lib/payments';
import { facilityInfrastructure } from '../../../lib/site-infrastructure';
import {
  siteApplicabilityFor,
  siteChanges,
  siteDocuments,
  siteEventsFor,
  siteRequests,
  siteReviewActs,
  siteSubmissions,
  upcomingSiteEventCount,
} from '../../../lib/site-registration';
import {
  capabilityConfigFor,
  facilityDetail,
  facilityDevices,
  facilityIncidentCount,
  facilityLedgerFor,
  facilityPersons,
  facilityPlanConfirmation,
  ministryConfig,
  publishedCycles,
  type FacilityDetail,
} from '../../../lib/queries';
import {
  FACILITY_CONTENT,
  addDaysIso,
  applicationFee,
  effectiveFlag,
  facilityCategory,
  facilityStanding,
  type ObligationStatus,
} from '../../../lib/rules';
import { UPLOADS_CONTENT } from '../../../lib/rules/uploads';
import {
  facilityConfirmationReady,
  facilityInitialStep,
  facilityNextAction,
  facilityRailStages,
  facilityRecordMode,
  facilityRegistrationSteps,
  submissionFacts,
  type FacilityStep,
  type FacilityStepKey,
} from '../../../lib/rules/facility-workflow';
import { siteCertificateAvailable, siteStatusLabel, siteSubmissionSummary, siteTabFor, type SiteTabKey } from '../../../lib/rules/site';

/**
 * THE FACILITY/SITE'S SINGLE RECORD PAGE (owner decision, 9 October 2026; latest revision,
 * sections 1-15). While the registration is in preparation it is a vertical step path under
 * the record header, the next step, the rail and the compact details card: basic site
 * infrastructure, AEDs, the cardiac emergency response plan, the readiness confirmation,
 * supporting evidence, then review and "Submit Facility/Site registration to MOPH". From the
 * first submission the same address is the site's persistent dashboard, in tabs: Overview,
 * Cardiac readiness, AEDs, Events, Incident reports, Documents, Ministry history. No venue
 * tab and no VN-ID. Old sub-routes and step links land on the matching step or tab.
 */

const STATUS_STYLE: Record<ObligationStatus, { color: string; chipBg: string }> = {
  current: { color: 'var(--brand)', chipBg: 'var(--brand-soft)' },
  lapsing: { color: 'var(--accent-ink)', chipBg: 'var(--accent-soft)' },
  lapsed: { color: 'var(--bad)', chipBg: 'var(--bad-soft)' },
  notRecorded: { color: 'var(--bad)', chipBg: 'var(--bad-soft)' },
};

/** Where each validity row is acted on (the details edit screen for the contact). */
const ACTION_HREF: Record<string, (id: string) => string> = {
  padExpiry: (id) => `/facilities/${id}?tab=aeds`,
  batteryExpiry: (id) => `/facilities/${id}?tab=aeds`,
  latestCheck: (id) => `/facilities/${id}?tab=aeds`,
  drill: () => '#confirmation',
  annualConfirmation: () => '#confirmation',
  coordinator: (id) => `/facilities/${id}/profile#contact`,
};

const band: React.CSSProperties = { padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 };
const editLink: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, paddingInline: 16, border: '1px solid var(--line)', borderRadius: 22, fontSize: '13.5px', color: 'var(--ink)', background: 'var(--bg)' };

export default async function FacilityRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ asof?: string; notice?: string; error?: string; step?: string; tab?: string; version?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const facility = facilityDetail(account.id, id);
  if (!facility) notFound();
  const q = await searchParams;

  const facts = facilityRegistrationFacts(id);
  const mode = facilityRecordMode(facts);
  const next = facilityNextAction(facts);
  const archived = facility.archivedAt !== null;
  const devices = facilityDevices(id);
  const contact = facilityPersons(id).find((p) => p.role === 'coordinator') ?? null;
  const confirmation = facilityPlanConfirmation(id);
  const point = facilityPoint(id);
  const today = beirutToday();
  const infrastructure = facilityInfrastructure(id);
  const documents = siteDocuments(id);
  const evidence = documents.filter((d) => d.purpose === 'evidence');
  const photos = devices.filter((d) => d.hasPhoto).map((d) => ({ label: d.label, locationEn: d.locationEn, locationAr: d.locationAr || d.locationEn }));
  const summary = siteSubmissionSummary(submissionFacts(facts));
  const nextHref = (href: string) => href === 'profile' ? `/facilities/${id}/profile` : href.startsWith('profile#') ? `/facilities/${id}/${href}` : href.startsWith('?') ? `/facilities/${id}${href}` : href;

  const notices = (
    <>
      {q.notice === 'confirmed' ? <div role="status" style={band}><L en="The readiness confirmation has been recorded." ar="سُجِّل تأكيد الجاهزية." /></div> : null}
      {q.notice === 'profile' ? <div role="status" style={band}><L en="The site details have been saved." ar="حُفظت تفاصيل الموقع." /></div> : null}
      {q.notice === 'infrastructure' ? <div role="status" style={band}><L en="The site infrastructure has been saved." ar="حُفظت البنية الأساسية للموقع." /></div> : null}
      {q.notice === 'evidence' ? <div role="status" style={band}><L en="The document has been uploaded." ar="رُفع المستند." /></div> : null}
      {q.notice === 'removed' ? <div role="status" style={band}><L en="The document has been removed." ar="أُزيل المستند." /></div> : null}
      {q.notice === 'response' ? <div role="status" style={band}><L en="Your answer has been sent to the Ministry. The Ministry closes the action once it has verified it." ar="أُرسل ردّكم إلى الوزارة. وتُقفل الوزارة الإجراء بعد التحقق منه." /></div> : null}
      {q.notice === 'submitted' ? (
        <div role="status" data-region="submitted-band" style={band}>
          <L en={`The registration has been submitted to the Ministry as version ${q.version ?? ''}. Its status is shown above.`} ar={`قُدِّم التسجيل إلى الوزارة بوصفه الإصدار ${q.version ?? ''}. وتظهر حالته أعلاه.`} />
        </div>
      ) : null}
      {q.error === 'not-open' ? <p role="alert"><L en="The registration is with the Ministry. It can be submitted again only when the Ministry asks for information or a correction." ar="التسجيل لدى الوزارة. ولا يمكن تقديمه مجدداً إلا عندما تطلب الوزارة معلومات أو تصحيحاً." /></p> : null}
      {q.error?.startsWith('layout-') ? <p role="alert"><L en="The layout map was not saved: attach a PDF or an image within the size limit." ar="لم تُحفظ خريطة المخطط: أرفقوا ملف PDF أو صورة ضمن الحد المسموح." /></p> : null}
    </>
  );

  // The AED registry: the AED step while registering, the AEDs tab once submitted.
  const photoError = q.error?.startsWith('photo-') ? q.error.slice('photo-'.length) : null;
  const uploadCopy = UPLOADS_CONTENT.copy;
  const photoMessage = photoError === 'tooLarge'
    ? { en: uploadCopy.tooLargeEn.replace('{max}', UPLOADS_CONTENT.maxBytesLabel), ar: uploadCopy.tooLargeAr.replace('{max}', UPLOADS_CONTENT.maxBytesLabel) }
    : photoError === 'empty' ? { en: uploadCopy.emptyEn, ar: uploadCopy.emptyAr }
      : photoError ? { en: uploadCopy.notImageEn, ar: uploadCopy.notImageAr } : null;
  const aedRequirement = facilityAedStatus(id);
  const aeds = (
    <div data-region="aeds">
      <p data-region="aed-requirement" style={{ margin: '0 0 18px', fontSize: '14.5px', lineHeight: 1.6 }}>
        {aedRequirement === 'required'
          ? <L en="Every covered site maintains at least one AED. An AED is required for this site." ar="يحتفظ كل موقع مشمول بجهاز واحد على الأقل. يلزم توفير جهاز إزالة رجفان لهذا الموقع." />
          : aedRequirement === 'notRequired'
            ? <L en="An AED is not required for this site. Record any AEDs it has." ar="لا يلزم توفير جهاز إزالة رجفان لهذا الموقع. سجّلوا أي أجهزة متوفرة لديه." />
            : <L en="The AED requirement waits on the Ministry: its designation or review. Record any AEDs the site has." ar="ينتظر متطلب الجهاز قرار الوزارة: تحديدها أو مراجعتها. سجّلوا أي أجهزة متوفرة لدى الموقع." />}
      </p>
      {q.notice === 'saved' ? <div role="status" style={band}><L en="The device record has been saved." ar="حُفظ سجل الجهاز." /></div> : null}
      {!point && !archived ? <p role="status"><a href={`/facilities/${id}/profile`}><L en="Add the site map pin before registering an AED." ar="أضيفوا موقع الموقع على الخريطة قبل تسجيل الجهاز." /></a></p> : null}
      {photoMessage ? <p role="alert"><L en={photoMessage.en} ar={photoMessage.ar} /></p>
        : q.error === 'details' ? <p role="alert"><L en="Check the device ID, location, representative and map pin, then save again." ar="تحقّقوا من معرّف الجهاز وموقعه والممثل والعلامة على الخريطة ثم احفظوا مجدداً." /></p> : null}
      <DeviceRegistry
        facilityId={id}
        devices={devices}
        facilityLocation={point}
        deviceLocations={Object.fromEntries(devices.map((d) => { const location = devicePoint(id, d.label); return [d.label, location.separate ? location.point : null]; }))}
        editable={!archived}
      />
      <AedWhereToBuy />
      <VendorDirectoryLink />
    </div>
  );

  const plan = <FacilityPlan facility={facility} devices={devices} contact={contact} point={point} aedsHref={mode === 'register' ? '#aeds' : `/facilities/${id}?tab=aeds`} contactHref={`/facilities/${id}/profile#contact`} />;
  const readinessError = q.error === 'readiness'
    ? <p role="alert"><L en="Confirm all readiness items, add a drill date within the last 12 months, and check the site map, the contact and the AED status." ar="أكّدوا جميع بنود الجاهزية وأضيفوا تاريخ تمرين خلال آخر 12 شهراً وتحقّقوا من خريطة الموقع وجهة الاتصال وحالة الأجهزة." /></p>
    : null;
  const confirmationForm = archived
    ? <p><L en="Archived record · Read-only" ar="سجل مؤرشف · للقراءة فقط" /></p>
    : <PlanConfirmation facilityId={id} representative={contact?.nameOrPosition ?? ''} today={today} existing={confirmation} ready={facilityConfirmationReady(facts)} />;
  const infrastructureForm = (
    <InfrastructureForm facilityId={id} initial={infrastructure?.answers as Record<string, string> ?? {}} layoutMap={infrastructure?.layoutMap ?? null} editable={!archived} />
  );
  const evidenceSection = <EvidenceSection facilityId={id} documents={evidence} photos={photos} editable={!archived} error={q.error?.startsWith('evidence-') ? q.error : undefined} />;

  if (mode === 'register') {
    const rail = facilityRailStages(facts);
    return (
      <FacilityWorkspace account={account} facility={facility} active="record">
        {notices}
        {next ? <NextStepCard step={next} to={nextHref(next.href)} /> : null}
        <JumpTo />
        <StageRail titleEn="Registration progress" titleAr="تقدّم التسجيل" stages={rail.stages} noteEn={`Stage ${rail.stage} of ${rail.stages.length}`} noteAr={`المرحلة ${rail.stage} من ${rail.stages.length}`} />
        <FeeDue facility={facility} />
        <CategoryRequirements />
        <DetailsCard facility={facility} point={point} editable />
        <Applicability id={id} />
        <RecordStepper
          steps={stepperSteps(facilityRegistrationSteps(facts), {
            infrastructure: infrastructureForm,
            aeds,
            plan,
            confirmation: <>{readinessError}{confirmationForm}</>,
            evidence: evidenceSection,
            review: <SubmitReview facilityId={id} lines={summary} managing={false} refused={q.error === 'submit'} />,
          })}
          initialKey={facilityInitialStep(facts, q.step)}
          groups={{ required: { en: 'Required', ar: 'مطلوب' }, recommended: { en: 'Recommended', ar: 'موصى به' } }}
          finalNext={{ en: 'Next: review and submit', ar: 'التالي: المراجعة والتقديم' }}
        />
      </FacilityWorkspace>
    );
  }

  const tab: SiteTabKey = siteTabFor(q.tab, q.step);
  const siteId = facility.siteId;
  return (
    <FacilityWorkspace account={account} facility={facility} active="record">
      {notices}
      {next ? <NextStepCard step={next} to={nextHref(next.href)} /> : null}
      <SiteTabsNav facilityId={id} active={tab} />
      <div data-region={`tab-${tab}`}>
        {tab === 'overview' ? (
          <>
            {archived ? <ArchivedBand facility={facility} /> : null}
            <Overview id={id} facility={facility} siteId={siteId} today={today} />
            {facts.status === 'informationRequired' ? (
              <TabSection id="resubmit" titleEn="Answer the Ministry’s request" titleAr="الرد على طلب الوزارة">
                <OpenRequests id={id} />
                <SubmitReview facilityId={id} lines={summary} managing refused={q.error === 'submit'} />
              </TabSection>
            ) : null}
            {!archived ? <Maintenance id={id} /> : null}
            <TabSection id="details" titleEn="Site profile and responsible contact" titleAr="ملف الموقع وجهة الاتصال المسؤولة">
              <DetailsCard facility={facility} point={point} editable={!archived} />
              <ContactSummary id={id} contact={contact} editable={!archived} />
            </TabSection>
            <TabSection id="infrastructure" titleEn={FACILITY_CONTENT.site.steps.infrastructure.en} titleAr={FACILITY_CONTENT.site.steps.infrastructure.ar}>
              {infrastructureForm}
            </TabSection>
            <FeeDue facility={facility} />
          </>
        ) : null}
        {tab === 'readiness' ? (
          <>
            <TabSection id="readiness" titleEn="Cardiac readiness" titleAr="الجاهزية لتوقف القلب">
              <PlanDue id={id} />
              <ReadinessLedger facility={facility} asof={q.asof} />
              <CategoryRequirements />
            </TabSection>
            <TabSection id="plan" titleEn={FACILITY_CONTENT.planTitle.en} titleAr={FACILITY_CONTENT.planTitle.ar}>
              {plan}
              {readinessError}
              {confirmationForm}
            </TabSection>
          </>
        ) : null}
        {tab === 'aeds' ? <TabSection id="aeds" titleEn="AEDs" titleAr="أجهزة إزالة الرجفان">{aeds}</TabSection> : null}
        {tab === 'events' ? (
          <TabSection id="events" titleEn="Events at this site" titleAr="الفعاليات في هذا الموقع">
            <EventsTab siteId={siteId} events={siteId ? siteEventsFor(account.id, siteId, facility.isDemo) : []} archived={archived} />
          </TabSection>
        ) : null}
        {tab === 'incidents' ? (
          <TabSection id="incidents" titleEn="Incident reports" titleAr="تقارير الحوادث">
            <Incidents id={id} archived={archived} submitted={q.notice === 'incident'} />
          </TabSection>
        ) : null}
        {tab === 'documents' ? (
          <>
            <TabSection id="layout" titleEn="Site or layout map" titleAr="خريطة الموقع أو مخططه">
              <p style={{ margin: 0, fontSize: '14.5px' }}>
                {infrastructure?.layoutMap
                  ? <a href={`/api/facility-documents/${id}/${infrastructure.layoutMap.id}`} target="_blank" rel="noreferrer">{infrastructure.layoutMap.fileName}</a>
                  : <L en="No layout map uploaded." ar="لم تُرفع خريطة مخطط." />}
                {' · '}
                <Link href={`/facilities/${id}?tab=overview#infrastructure`}><L en="Change it with the site infrastructure" ar="غيّروها مع البنية الأساسية للموقع" /></Link>
              </p>
            </TabSection>
            <TabSection id="evidence" titleEn={FACILITY_CONTENT.site.steps.evidence.en} titleAr={FACILITY_CONTENT.site.steps.evidence.ar}>
              {evidenceSection}
            </TabSection>
          </>
        ) : null}
        {tab === 'history' ? (
          <TabSection id="history" titleEn="Ministry history" titleAr="سجل الوزارة">
            <HistoryTab facilityId={id} submissions={siteSubmissions(id)} acts={siteReviewActs(id)} requests={siteRequests(id)} incidentCount={facilityIncidentCount(id)} changes={siteChanges(id)} respond={!archived} />
          </TabSection>
        ) : null}
      </div>
    </FacilityWorkspace>
  );
}

/** The resolved steps, each in its card, for the shared stepper. Every step is the operator's own. */
function stepperSteps(defs: FacilityStep[], bodies: Record<FacilityStepKey, ReactNode>): StepperStep[] {
  return defs.map((s) => ({
    key: s.key, anchor: s.anchor, labelEn: s.en, labelAr: s.ar, stateEn: s.stateEn, stateAr: s.stateAr, state: s.state,
    kind: s.state === 'final' ? 'final' : s.optional ? 'recommended' : 'required', yours: true, whoEn: '', whoAr: '',
    body: <StepCard step={s}>{bodies[s.key]}</StepCard>,
  }));
}

/** One step's card: its title and its state in words and colour, amber while open, green when complete, grey while optional. */
function StepCard({ step, children }: { step: FacilityStep; children: ReactNode }) {
  const tone = step.state === 'complete' ? { edge: 'var(--success)', bg: 'var(--success-soft)', color: 'var(--success)' }
    : step.state === 'pending' ? { edge: 'var(--accent)', bg: 'var(--accent-soft)', color: 'var(--accent-ink)' }
      : { edge: 'var(--line)', bg: 'var(--surface2)', color: 'var(--muted)' };
  return (
    <section id={step.anchor} data-facility-step={step.key} data-state={step.state} tabIndex={-1}
      style={{ padding: '22px 24px', background: 'var(--bg)', border: '1px solid var(--line)', borderInlineStart: `4px solid ${tone.edge}`, borderRadius: 12, scrollMarginBlockStart: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-.02em' }}><L en={step.en} ar={step.ar} /></h2>
        {step.state !== 'final' ? (
          <span data-region="step-state" style={{ flex: 'none', padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 500, background: tone.bg, color: tone.color }}>
            <L en={step.stateEn} ar={step.stateAr} />
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** The compact details card: the profile in one line, and a deliberate Edit. */
function DetailsCard({ facility, point, editable }: { facility: FacilityDetail; point: { lat: number; lng: number } | null; editable: boolean }) {
  const category = facilityCategory(facility.categoryKey);
  const short = FACILITY_CONTENT.categories.find((c) => c.key === facility.categoryKey) as { shortEn?: string; shortAr?: string } | undefined;
  const capacity = facility.licensedCapacity !== null ? { en: ` · capacity ${facility.licensedCapacity}`, ar: ` · السعة ${facility.licensedCapacity}` } : { en: '', ar: '' };
  return (
    <section data-region="facility-details" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 16 }}>
      <div style={{ fontSize: 14, lineHeight: 1.5, minWidth: 0 }}>
        <span style={{ fontWeight: 500 }}><L en="Site profile and category" ar="ملف الموقع وفئته" /></span>
        <span style={{ display: 'block', color: 'var(--muted)', fontSize: 13 }}>
          <L
            en={`${short?.shortEn ?? category?.en ?? ''}${facility.operatingOrganization ? ` · ${facility.operatingOrganization}` : ''} · ${facility.address}, ${facility.municipalityEn} · ${facility.operatingHours}${capacity.en}`}
            ar={`${short?.shortAr ?? category?.ar ?? ''}${facility.operatingOrganization ? ` · ${facility.operatingOrganization}` : ''} · ${facility.address}، ${facility.municipalityAr} · ${facility.operatingHours}${capacity.ar}`}
          />
          {' · '}
          {point ? (
            <a href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=18/${point.lat}/${point.lng}`} target="_blank" rel="noreferrer"><L en="View map" ar="عرض الخريطة" /></a>
          ) : <L en="Map pin needed" ar="موقع الخريطة مطلوب" />}
        </span>
      </div>
      {editable ? (
        <Link href={`/facilities/${facility.id}/profile`} data-region="edit-details-link" style={editLink}><L en="Edit the site details" ar="تعديل تفاصيل الموقع" /></Link>
      ) : null}
    </section>
  );
}

/** Whether the category reaches the site (revision section 10): automatic, by capacity, or by Ministry designation. */
function Applicability({ id }: { id: string }) {
  const a = siteApplicabilityFor(id);
  return (
    <p data-region="applicability" data-applicability={a.key} style={{ margin: '0 0 24px', padding: '12px 16px', background: a.covered ? 'var(--surface2)' : 'var(--accent-soft)', border: a.covered ? '0' : '1px solid var(--accent)', borderRadius: 10, fontSize: '14.5px', lineHeight: 1.6 }}>
      <L en={a.en} ar={a.ar} />
    </p>
  );
}

/** The one responsible contact, read-only on the dashboard, edited on the details screen. */
function ContactSummary({ id, contact, editable }: { id: string; contact: { nameOrPosition: string; phone: string; email: string } | null; editable: boolean }) {
  const content = FACILITY_CONTENT;
  return (
    <div id="contact" data-region="contact-summary" style={{ padding: '18px 20px', background: 'var(--surface2)', borderRadius: 12, scrollMarginBlockStart: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 12 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}><L en={content.persons[0]!.en} ar={content.persons[0]!.ar} /></h3>
        {editable ? <Link href={`/facilities/${id}/profile#contact`} data-region="edit-contact-link" style={editLink}><L en="Edit contact" ar="تعديل جهة الاتصال" /></Link> : null}
      </div>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 12 }}>
        {content.personFields.map((f) => {
          const v = f.key === 'nameOrPosition' ? contact?.nameOrPosition : f.key === 'phone' ? contact?.phone : contact?.email;
          return (
            <div key={f.key}>
              <dt style={{ fontSize: '13px', color: 'var(--muted)' }}><L en={f.en} ar={f.ar} /></dt>
              <dd style={{ margin: '2px 0 0', fontSize: '14.5px' }} dir={f.key === 'nameOrPosition' ? undefined : 'ltr'}>{v || '—'}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function ArchivedBand({ facility }: { facility: FacilityDetail }) {
  return (
    <div data-region="archived-band" style={{ padding: '20px 26px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
      <L
        en={`No longer covered by the Ministry, ${facility.archivedAt!.slice(0, 10)}${facility.archivedReason ? `: ${facility.archivedReason}` : ''}. This record is read-only; its obligations are no longer tracked here. Coverage returns by Ministry designation.`}
        ar={`لم يعد مشمولاً لدى الوزارة، ⁦${facility.archivedAt!.slice(0, 10)}⁩${facility.archivedReason ? `: ${facility.archivedReason}` : ''}. والسجل للقراءة فقط؛ ولم تعد موجباته تُتابع هنا. وتعود الشمولية بتحديد من الوزارة.`}
      />
    </div>
  );
}

/**
 * THE OVERVIEW (revision section 13): the site's identity and the figures that matter --
 * readiness status, operational AEDs, the last drill, open corrective actions, upcoming
 * events -- with the applicability and the certificate while readiness is current.
 */
function Overview({ id, facility, siteId, today }: { id: string; facility: FacilityDetail; siteId: string | null; today: string }) {
  const facts = facilityRegistrationFacts(id);
  const devices = facilityDevices(id);
  const operational = devices.filter((d) => d.operational && d.accessibleHours).length;
  const drill = facilityPlanConfirmation(id)?.drillDate ?? null;
  const openCorrective = siteRequests(id).filter((r) => r.kind === 'corrective' && r.status === 'open').length;
  const upcoming = siteId ? upcomingSiteEventCount(siteId, facility.isDemo, today) : 0;
  const category = facilityCategory(facility.categoryKey);
  const status = siteStatusLabel(facts.status);
  const tiles: { key: string; en: string; ar: string; value: ReactNode }[] = [
    { key: 'site-id', en: 'Site ID', ar: 'معرّف الموقع', value: siteId ?? '—' },
    { key: 'name', en: 'Name', ar: 'الاسم', value: <L en={facility.nameEn} ar={facility.nameAr} /> },
    { key: 'category', en: 'Category', ar: 'الفئة', value: <L en={category?.en ?? '—'} ar={category?.ar ?? '—'} /> },
    { key: 'readiness', en: 'Cardiac readiness', ar: 'الجاهزية لتوقف القلب', value: <L en={status.en} ar={status.ar} /> },
    { key: 'aeds', en: 'AEDs', ar: 'الأجهزة', value: <L en={`${operational} operational`} ar={`${operational} صالح للتشغيل`} /> },
    { key: 'drill', en: 'Last drill', ar: 'آخر تمرين', value: drill ?? '—' },
    { key: 'corrective', en: 'Open corrective actions', ar: 'الإجراءات التصحيحية المفتوحة', value: openCorrective },
    { key: 'events', en: 'Upcoming events', ar: 'الفعاليات المقبلة', value: upcoming },
  ];
  return (
    <section id="overview" data-region="site-overview" style={{ marginBlockEnd: 36 }}>
      <dl style={{ margin: '0 0 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {tiles.map((t) => (
          <div key={t.key} data-overview={t.key} style={{ background: 'var(--bg)', padding: '14px 18px' }}>
            <dt style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 6 }}><L en={t.en} ar={t.ar} /></dt>
            <dd style={{ margin: 0, fontSize: 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>{t.value}</dd>
          </div>
        ))}
      </dl>
      <Applicability id={id} />
      {siteCertificateAvailable(facts.status) ? (
        <div data-region="registered-band" role="status" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}><L en="Readiness is current. The registration certificate is available." ar="الجاهزية سارية. وشهادة التسجيل متاحة." /></span>
          <Link href={`/facilities/${id}/certificate`} style={{ flex: 'none', minHeight: 44, paddingInline: 22, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
            <L en="Open the certificate" ar="فتح الشهادة" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}

/** The Ministry's open requests for information or a correction, as the operator reads them above the resubmission. */
function OpenRequests({ id }: { id: string }) {
  const open = siteRequests(id).filter((r) => r.status === 'open' && (r.kind === 'information' || r.kind === 'correction'));
  return (
    <ul data-region="open-information-requests" style={{ margin: '0 0 18px', paddingInlineStart: 20, fontSize: '14.5px', lineHeight: 1.7 }}>
      {open.map((r) => (
        <li key={r.id}>
          {r.kind === 'correction' ? <L en="Correction requested: " ar="طُلب تصحيح: " /> : <L en="Additional information requested: " ar="طُلبت معلومات إضافية: " />}
          <L en={r.bodyEn} ar={r.bodyAr} />
        </li>
      ))}
    </ul>
  );
}

/**
 * ONGOING RESPONSIBILITIES (revision section 14): the site is maintained, not re-registered.
 * Each change the revision names, with where it is made. The annual element is the drill.
 */
function Maintenance({ id }: { id: string }) {
  const items: { en: string; ar: string; href: string }[] = [
    { en: 'Responsible contact changes', ar: 'تغيّر جهة الاتصال المسؤولة', href: `/facilities/${id}/profile#contact` },
    { en: 'An AED is added, moved, replaced or becomes non-operational', ar: 'إضافة جهاز أو نقله أو استبداله أو توقفه عن العمل', href: `/facilities/${id}?tab=aeds` },
    { en: 'EMS access changes', ar: 'تغيّر وصول خدمات الطوارئ الطبية', href: `/facilities/${id}/profile` },
    { en: 'The location or layout materially changes', ar: 'تغيّر جوهري في الموقع أو المخطط', href: `/facilities/${id}?tab=overview#infrastructure` },
    { en: 'Operating information changes', ar: 'تغيّر معلومات التشغيل', href: `/facilities/${id}/profile` },
    { en: 'A readiness deficiency is corrected', ar: 'تصحيح نقص في الجاهزية', href: `/facilities/${id}?tab=history#requests` },
  ];
  return (
    <TabSection id="maintenance" titleEn="Keep the site record current" titleAr="الحفاظ على تحديث سجل الموقع">
      <p style={{ margin: '0 0 12px', fontSize: '14.5px', lineHeight: 1.6, maxWidth: '76ch' }}>
        <L en="The site is not registered again each year. Update the record when any of these change; the annual element is the practical cardiac-emergency drill." ar="لا يُعاد تسجيل الموقع كل عام. حدّثوا السجل عند تغيّر أي مما يلي؛ والعنصر السنوي هو التمرين العملي على طوارئ توقف القلب." />
      </p>
      <ul data-region="maintenance" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 8 }}>
        {items.map((i) => (
          <li key={i.href + i.en}>
            <Link href={i.href} style={{ display: 'flex', alignItems: 'center', minHeight: 44, padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 10, fontSize: '14px', color: 'var(--ink)', background: 'var(--bg)' }}>
              <L en={i.en} ar={i.ar} />
            </Link>
          </li>
        ))}
      </ul>
    </TabSection>
  );
}

/**
 * THE REGISTRATION FEE, as a state on the record (register closure, 2026-09-03): an amount
 * due, never a gate. Absent while no fee is in force or once paid.
 */
function FeeDue({ facility }: { facility: FacilityDetail }) {
  const feeConfig = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
  const fee = applicationFee('registerFacility', null, effectiveFlag('applicationFees', feeConfig), capabilityConfigFor('applicationFees'));
  if (fee === null || paymentFor(facility.id, 'registerFacility') !== null) return null;
  return (
    <div data-region="amount-due" style={{ padding: '17px 22px', border: '1px solid var(--accent-ink)', borderRadius: 12, marginBlockEnd: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '14.5px', fontWeight: 500 }}><L en="Registration fee" ar="رسم التسجيل" /></span>
        <span style={{ fontSize: '14.5px', fontVariantNumeric: 'tabular-nums' }}>
          <L en={`Amount due: ${fee.amount} ${fee.currency}`} ar={`المبلغ المستحق: ${fee.amount} ${fee.currency}`} />
        </span>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.65 }}>
        <L
          en="Keep devices, the response plan and reports up to date while payment is pending. Online payment is not available yet."
          ar="حافظوا على تحديث الأجهزة وخطة الاستجابة والتقارير أثناء انتظار الدفع. الدفع الإلكتروني غير متاح بعد."
        />
      </p>
    </div>
  );
}

/** What the Ministry has published for this category, verbatim; absent while nothing is. */
function CategoryRequirements() {
  const catRequirements = ministryConfig().get('categoryRequirements') ?? null;
  if (!catRequirements) return null;
  return (
    <div data-region="category-requirements" style={{ paddingBlock: '23px', paddingInlineStart: '26px', paddingInlineEnd: '27px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--line)', borderRadius: 12, marginBlockEnd: 24, maxWidth: '86ch' }}>
      <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
        <L en="Additional requirements for this category — published by the Ministry" ar="متطلبات إضافية لهذه الفئة — منشورة من الوزارة" />
      </div>
      <div style={{ fontSize: '14.5px', lineHeight: 1.65 }}>{catRequirements.value}</div>
      {catRequirements.effective ? (
        <div style={{ marginBlockStart: 8, fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
          <L en={`Effective ${catRequirements.effective}`} ar={`يسري اعتباراً من ⁦${catRequirements.effective}⁩`} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The standing line and the validity record with its as-of preview: readiness is not a
 * score and does not progress; each obligation's dates derive from the facts
 * (lib/rules/facility.ts), and the pills preview the same derivation at a future date.
 */
function ReadinessLedger({ facility, asof }: { facility: FacilityDetail; asof: string | undefined }) {
  const id = facility.id;
  const content = FACILITY_CONTENT;
  const windowDays = publishedCycles().lapseWindowDays;
  // The preview offsets are the lapse window and three windows out -- the GOVERNED window.
  const offsets = [0, windowDays, windowDays * 3];
  const requested = Number.parseInt(asof ?? '0', 10) || 0;
  const offset = offsets.includes(requested) ? requested : 0;
  const today = beirutToday();
  const asOfDate = offset === 0 ? today : addDaysIso(today, offset);
  const ledger = facilityLedgerFor(id, asOfDate);
  const standing = facilityStanding(ledger);
  const aedStatus = facilityAedStatus(id);
  const fill = (tpl: string, n: number): string => tpl.replace('{n}', String(n)).replace('{days}', String(windowDays));
  const standingLine =
    aedStatus === 'review' ? { en: 'The AED requirement waits on the Ministry.', ar: 'ينتظر متطلب الجهاز قرار الوزارة.', border: 'var(--accent)', bg: 'var(--accent-soft)' } :
    standing.kind === 'lapsed'
      ? { en: fill(standing.lapsedCount === 1 ? content.standing.lapsed.enOne : content.standing.lapsed.enMany, standing.lapsedCount), ar: fill(content.standing.lapsed.ar, standing.lapsedCount), border: 'var(--bad)', bg: 'var(--bad-soft)' }
      : standing.kind === 'lapsing'
        ? { en: fill(standing.lapsingCount === 1 ? content.standing.lapsing.enOne : content.standing.lapsing.enMany, standing.lapsingCount), ar: fill(content.standing.lapsing.ar, standing.lapsingCount), border: 'var(--accent)', bg: 'var(--accent-soft)' }
        : { en: fill(content.standing.met.en, 0), ar: fill(content.standing.met.ar, 0), border: 'var(--line)', bg: 'var(--surface)' };
  const obligationByKey = new Map(content.ledger.obligations.map((o) => [o.key, o]));
  const archived = facility.archivedAt !== null;

  return (
    <>
      <div data-region="standing" style={{ padding: '24px 28px', border: `1px solid ${standingLine.border}`, background: standingLine.bg, borderRadius: 16, marginBlockEnd: 14 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
          <L en="Obligations" ar="الموجبات" />
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.4, maxWidth: '60ch' }}>
          <L en={standingLine.en} ar={standingLine.ar} />
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'end', marginBlock: '28px 12px' }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>
          <L en="Validity record" ar="سجل الصلاحية" />
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'start' }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <L en="Viewing as of" ar="العرض بتاريخ" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {offsets.map((v) => {
              const on = offset === v;
              return (
                <Link
                  key={v}
                  href={v === 0 ? `/facilities/${id}?tab=readiness` : `/facilities/${id}?tab=readiness&asof=${v}`}
                  scroll={false}
                  style={{ minHeight: 44, paddingInline: 13, border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'transparent', color: on ? 'var(--brand)' : 'var(--muted)', borderRadius: 22, fontSize: 13, display: 'inline-flex', alignItems: 'center' }}
                >
                  {v === 0 ? <L en="Today" ar="اليوم" /> : <L en={`+${v} days`} ar={`+${v} يوماً`} />}
                </Link>
              );
            })}
            <span style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{asOfDate}</span>
          </div>
        </div>
      </div>
      <div data-region="ledger" data-stack="" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr .9fr .8fr', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockEnd: 24 }}>
        {content.ledger.columns.map((c) => (
          <div key={c.en} data-th="" style={{ background: 'var(--surface2)', padding: '12px 18px', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <L en={c.en} ar={c.ar} />
          </div>
        ))}
        <div data-th="" style={{ background: 'var(--surface2)', padding: '12px 18px' }} />
        {ledger.map((row) => {
          const o = obligationByKey.get(row.key);
          const st = STATUS_STYLE[row.status];
          const statusLabel = content.statuses[row.status];
          return [
            <div key={`${row.key}-name`} style={{ background: 'var(--bg)', padding: 18, borderInlineStart: `3px solid ${st.color}`, fontSize: 16, fontWeight: 500 }}>
              <L en={o?.en ?? row.key} ar={o?.ar ?? row.key} />
            </div>,
            <div key={`${row.key}-from`} style={{ background: 'var(--bg)', padding: 18, fontSize: '14.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              {row.lastAffirmed ?? '—'}
            </div>,
            <div key={`${row.key}-until`} style={{ background: 'var(--bg)', padding: 18, fontSize: '14.5px', fontVariantNumeric: 'tabular-nums', color: st.color }}>
              {row.until ?? '—'}
            </div>,
            <div key={`${row.key}-status`} style={{ background: 'var(--bg)', padding: 18, fontSize: '13.5px' }}>
              <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: st.chipBg, color: st.color }}>
                <L en={statusLabel.en} ar={statusLabel.ar} />
              </span>
            </div>,
            <div key={`${row.key}-action`} style={{ background: 'var(--bg)', padding: 18, fontSize: 14 }}>
              {!archived ? (
                <a href={ACTION_HREF[row.key]?.(id) ?? '#plan'}>
                  <L en={o?.actionEn ?? ''} ar={o?.actionAr ?? ''} />
                </a>
              ) : null}
            </div>,
          ];
        })}
      </div>
    </>
  );
}

/** When the confirmation and the drill are next due: the validity record's own rows, at today. */
function PlanDue({ id }: { id: string }) {
  const ledger = facilityLedgerFor(id, beirutToday());
  const confirmation = ledger.find((r) => r.key === 'annualConfirmation');
  const drill = ledger.find((r) => r.key === 'drill');
  if (!confirmation?.until && !drill?.until) return null;
  return (
    <p data-region="plan-due" style={{ margin: '0 0 20px', fontSize: '14.5px', lineHeight: 1.6 }}>
      {confirmation?.until ? <L en={`The next readiness confirmation is due by ${confirmation.until}.`} ar={`يُستحق تأكيد الجاهزية التالي في موعد أقصاه ⁦${confirmation.until}⁩.`} /> : null}
      {confirmation?.until && drill?.until ? ' ' : null}
      {drill?.until ? <L en={`The next practical drill is due by ${drill.until}.`} ar={`يُستحق التمرين العملي التالي في موعد أقصاه ⁦${drill.until}⁩.`} /> : null}
    </p>
  );
}

/** Incident reports (revision section 15): Site → Report cardiac-arrest incident, and the reports with their links. */
function Incidents({ id, archived, submitted }: { id: string; archived: boolean; submitted: boolean }) {
  const reports = getDb().prepare('SELECT id,payload,narrative,created_at,device_label,event_id FROM facility_incidents WHERE facility_id=? ORDER BY id DESC').all(id) as unknown as FacilityIncidentReport[];
  return (
    <div data-region="incidents">
      {submitted ? <div role="status" style={band}><L en="The incident report has been submitted to the Ministry." ar="قُدِّم تقرير الحادثة إلى الوزارة." /></div> : null}
      {!archived ? (
        <Link href={`/facilities/${id}/incidents/new`} data-region="report-incident" style={{ ...editLink, marginBlockEnd: 12 }}>
          <L en="Report a cardiac-arrest incident" ar="الإبلاغ عن حادثة توقف قلب" />
        </Link>
      ) : null}
      <FacilityIncidentReports reports={reports} />
    </div>
  );
}
