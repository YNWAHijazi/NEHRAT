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
import { ContactStep } from './ContactStep';
import { FacilityPlan } from './FacilityPlan';
import { PlanConfirmation, ReadinessChecks, ReadinessProvider, RegistrationReview } from './PlanConfirmation';
import { currentAccount } from '../../../lib/auth';
import { accountContact } from '../../../lib/account-contact';
import { beirutToday } from '../../../lib/clock';
import { getDb } from '../../../lib/db';
import { devicePoint, facilityAedStatus, facilityPoint } from '../../../lib/facility-gis';
import { facilityCheckHref, facilityRegistrationFacts } from '../../../lib/facility-registration';
import { paymentFor } from '../../../lib/payments';
import { hostingVenueForFacility } from '../../../lib/sites';
import {
  capabilityConfigFor,
  facilityDetail,
  facilityDevices,
  facilityLedgerFor,
  facilityPersons,
  facilityPlanConfirmation,
  facilityRequests,
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
  facilityChecksComplete,
  facilityInitialStep,
  facilityNextAction,
  facilityRailStages,
  facilityRecordMode,
  facilityRegistrationSteps,
  facilityRemainingBeforeConfirmation,
  type FacilityStep,
  type FacilityStepKey,
} from '../../../lib/rules/facility-workflow';

/**
 * THE FACILITY'S SINGLE RECORD PAGE, in the event's and the hosting venue's format (owner,
 * 9 October 2026). While the registration is open it is a vertical step path -- AEDs,
 * responsible contact, cardiac emergency response plan, review and register -- under the
 * record header, the next step, the rail and the compact details card. Once the first
 * readiness confirmation is recorded the facility is registered and the same address is
 * where it is managed: status and certificate, AEDs, the response plan, incidents, the
 * Ministry's requests, the details and contact, and the hosting venue on the same site,
 * as sections on one page. No section tabs. The old sub-routes land here.
 *
 * Readiness is not a score and does not progress: the validity record derives each
 * obligation's dates from the facts (lib/rules/facility.ts), and the as-of pills preview
 * the same derivation at a future date.
 */

const STATUS_STYLE: Record<ObligationStatus, { color: string; chipBg: string }> = {
  current: { color: 'var(--brand)', chipBg: 'var(--brand-soft)' },
  lapsing: { color: 'var(--accent-ink)', chipBg: 'var(--accent-soft)' },
  lapsed: { color: 'var(--bad)', chipBg: 'var(--bad-soft)' },
  notRecorded: { color: 'var(--bad)', chipBg: 'var(--bad-soft)' },
};

/** Where each validity row is acted on, on this page (the details edit screen for the contact). */
const ACTION_HREF: Record<string, (id: string) => string> = {
  padExpiry: () => '#aeds',
  batteryExpiry: () => '#aeds',
  latestCheck: () => '#aeds',
  drill: () => '#confirmation',
  annualConfirmation: () => '#confirmation',
  coordinator: (id) => `/facilities/${id}/profile#contact`,
};

const band: React.CSSProperties = { padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 };
const sectionTitle: React.CSSProperties = { margin: '0 0 18px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' };
const editLink: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, paddingInline: 16, border: '1px solid var(--line)', borderRadius: 22, fontSize: '13.5px', color: 'var(--ink)', background: 'var(--bg)' };

export default async function FacilityRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ asof?: string; notice?: string; error?: string; step?: string }>;
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
  const rail = facilityRailStages(facts);
  const archived = facility.archivedAt !== null;
  const devices = facilityDevices(id);
  const contact = facilityPersons(id).find((p) => p.role === 'coordinator') ?? null;
  const confirmation = facilityPlanConfirmation(id);
  const point = facilityPoint(id);
  const venue = hostingVenueForFacility(account.id, id);
  const today = beirutToday();

  const notices = (
    <>
      {q.notice === 'confirmed' ? <div role="status" style={band}><L en="The readiness confirmation has been recorded." ar="سُجِّل تأكيد الجاهزية." /></div> : null}
      {q.notice === 'profile' ? <div role="status" style={band}><L en="The facility details have been saved." ar="حُفظت تفاصيل المنشأة." /></div> : null}
    </>
  );

  // The AED registry: the AED step while registering, the AED section once registered.
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
          ? <L en="An AED is required for this facility." ar="يلزم توفير جهاز إزالة رجفان لهذه المنشأة." />
          : aedRequirement === 'notRequired'
            ? <L en="An AED is not required for this facility. Record any AEDs it has." ar="لا يلزم توفير جهاز إزالة رجفان لهذه المنشأة. سجّلوا أي أجهزة متوفرة لديها." />
            : <L en="Ministry review needed for the AED requirement. Record any AEDs the facility has." ar="مراجعة الوزارة مطلوبة لتحديد متطلبات الجهاز. سجّلوا أي أجهزة متوفرة لدى المنشأة." />}
      </p>
      {q.notice === 'saved' ? <div role="status" style={band}><L en="The device record has been saved." ar="حُفظ سجل الجهاز." /></div> : null}
      {!point && !archived ? <p role="status"><a href={`/facilities/${id}/profile`}><L en="Add the facility map pin before registering an AED." ar="أضيفوا موقع المنشأة على الخريطة قبل تسجيل الجهاز." /></a></p> : null}
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

  const plan = (contactHref: string) => (
    <FacilityPlan facility={facility} devices={devices} contact={contact} point={point} aedsHref="#aeds" contactHref={contactHref} />
  );

  return (
    <FacilityWorkspace account={account} facility={facility} active="record">
      {notices}
      {next ? <NextStepCard step={next} to={next.href === 'profile' ? `/facilities/${id}/profile` : next.href} /> : null}
      {mode === 'register' ? (
        <>
          <JumpTo />
          <StageRail titleEn="Registration progress" titleAr="تقدّم التسجيل" stages={rail.stages} noteEn={`Stage ${rail.stage} of ${rail.stages.length}`} noteAr={`المرحلة ${rail.stage} من ${rail.stages.length}`} />
          <FeeDue facility={facility} />
          <CategoryRequirements />
          <DetailsCard facility={facility} point={point} editable />
          {venue ? <VenueLink venue={venue} /> : null}
          <ReadinessProvider existing={confirmation}>
            <RecordStepper
              steps={stepperSteps(facilityRegistrationSteps(facts), {
                aeds,
                contact: <ContactStep facilityId={id} initial={{ name: contact?.nameOrPosition ?? '', phone: contact?.phone ?? '', email: contact?.email ?? '' }} me={accountContact(account.id)} />,
                plan: (
                  <>
                    {plan('#contact')}
                    <ReadinessChecks existing={confirmation} />
                  </>
                ),
                review: (
                  <RegistrationReview
                    facilityId={id}
                    representative={contact?.nameOrPosition ?? ''}
                    today={today}
                    remaining={facilityRemainingBeforeConfirmation(facts).map((c) => ({ key: c.key, en: c.en, ar: c.ar, href: c.key === 'details' ? `/facilities/${id}/profile` : c.key === 'devices' ? '#aeds' : '#contact' }))}
                    refused={q.error === 'readiness'}
                  />
                ),
              })}
              initialKey={facilityInitialStep(facts, q.step)}
              groups={{ required: { en: 'Required', ar: 'مطلوب' }, recommended: { en: 'Recommended', ar: 'موصى به' } }}
              finalNext={{ en: 'Next: review and register', ar: 'التالي: المراجعة والتسجيل' }}
            />
          </ReadinessProvider>
        </>
      ) : (
        <>
          <Section id="status" titleEn="Status and certificate" titleAr="الحالة والشهادة">
            <StatusSection facility={facility} complete={facilityChecksComplete(facts)} asof={q.asof} />
          </Section>
          <Section id="aeds" titleEn="AEDs" titleAr="أجهزة إزالة الرجفان">{aeds}</Section>
          <Section id="plan" titleEn={FACILITY_CONTENT.planTitle.en} titleAr={FACILITY_CONTENT.planTitle.ar}>
            <PlanDue id={id} />
            {plan(`/facilities/${id}/profile#contact`)}
            {q.error === 'readiness' ? <p role="alert"><L en="Confirm all readiness items, add a drill date within the last 12 months, and check the facility map and AED status." ar="أكّدوا جميع بنود الجاهزية وأضيفوا تاريخ تمرين خلال آخر 12 شهراً وتحقّقوا من الخريطة وحالة الأجهزة." /></p> : null}
            {archived ? (
              <p><L en="Archived record · Read-only" ar="سجل مؤرشف · للقراءة فقط" /></p>
            ) : (
              <PlanConfirmation facilityId={id} representative={contact?.nameOrPosition ?? ''} today={today} existing={confirmation}
                ready={facilityRemainingBeforeConfirmation(facts).length === 0} />
            )}
          </Section>
          <Section id="incidents" titleEn="Incident reports" titleAr="تقارير الحوادث">
            <Incidents id={id} archived={archived} submitted={q.notice === 'incident'} />
          </Section>
          <Section id="requests" titleEn="Ministry requests and corrective actions" titleAr="طلبات الوزارة والإجراءات التصحيحية">
            <Requests id={id} archived={archived} />
          </Section>
          <Section id="details" titleEn="Facility details and responsible contact" titleAr="تفاصيل المنشأة وجهة الاتصال المسؤولة">
            <DetailsCard facility={facility} point={point} editable={!archived} />
            <ContactSummary id={id} contact={contact} editable={!archived} />
          </Section>
          {venue ? (
            <Section id="venue" titleEn="Hosting venue at the same place" titleAr="موقع الاستضافة في المكان نفسه">
              <VenueLink venue={venue} />
            </Section>
          ) : null}
        </>
      )}
    </FacilityWorkspace>
  );
}

/** The resolved steps, each in its card, for the shared stepper. Every step is the operator's own. */
function stepperSteps(defs: FacilityStep[], bodies: Record<FacilityStepKey, ReactNode>): StepperStep[] {
  return defs.map((s) => ({
    key: s.key, anchor: s.anchor, labelEn: s.en, labelAr: s.ar, stateEn: s.stateEn, stateAr: s.stateAr, state: s.state,
    kind: s.state === 'final' ? 'final' : 'required', yours: true, whoEn: '', whoAr: '',
    body: <StepCard step={s}>{bodies[s.key]}</StepCard>,
  }));
}

/** One step's card: its title and its state in words and colour, amber while open and green when complete. */
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

function Section({ id, titleEn, titleAr, children }: { id: string; titleEn: string; titleAr: string; children: ReactNode }) {
  return (
    <section id={id} data-region={`section-${id}`} tabIndex={-1} style={{ marginBlockEnd: 56, scrollMarginBlockStart: 16 }}>
      <h2 style={sectionTitle}><L en={titleEn} ar={titleAr} /></h2>
      {children}
    </section>
  );
}

/** The compact details card, as on the venue record: the profile in one line, and a deliberate Edit. */
function DetailsCard({ facility, point, editable }: { facility: FacilityDetail; point: { lat: number; lng: number } | null; editable: boolean }) {
  const category = facilityCategory(facility.categoryKey);
  const short = FACILITY_CONTENT.categories.find((c) => c.key === facility.categoryKey) as { shortEn?: string; shortAr?: string } | undefined;
  return (
    <section data-region="facility-details" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 24 }}>
      <div style={{ fontSize: 14, lineHeight: 1.5, minWidth: 0 }}>
        <span style={{ fontWeight: 500 }}><L en="Facility profile and category" ar="ملف المنشأة وفئتها" /></span>
        <span style={{ display: 'block', color: 'var(--muted)', fontSize: 13 }}>
          <L
            en={`${short?.shortEn ?? category?.en ?? ''} · ${facility.address}, ${facility.municipalityEn} · ${facility.operatingHours}`}
            ar={`${short?.shortAr ?? category?.ar ?? ''} · ${facility.address}، ${facility.municipalityAr} · ${facility.operatingHours}`}
          />
          {' · '}
          {point ? (
            <a href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=18/${point.lat}/${point.lng}`} target="_blank" rel="noreferrer"><L en="View map" ar="عرض الخريطة" /></a>
          ) : <L en="Map pin needed" ar="موقع الخريطة مطلوب" />}
        </span>
      </div>
      {editable ? (
        <Link href={`/facilities/${facility.id}/profile`} data-region="edit-details-link" style={editLink}><L en="Edit the facility details" ar="تعديل تفاصيل المنشأة" /></Link>
      ) : null}
    </section>
  );
}

/** The one responsible contact, read-only on the management page, edited on the details screen. */
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

/** The hosting venue on the same site: two registrations of one place, each with its own record. */
function VenueLink({ venue }: { venue: { id: string; nameEn: string; nameAr: string } }) {
  return (
    <p data-region="facility-venue-link" style={{ margin: '0 0 24px', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, fontSize: '14.5px', lineHeight: 1.6 }}>
      <L
        en={`This facility is at the same place as the hosting venue ${venue.nameEn} (${venue.id}). The two registrations stay separate; the venue shows this facility's AEDs.`}
        ar={`هذه المنشأة في المكان نفسه الذي يشغله موقع الاستضافة ${venue.nameAr} (⁦${venue.id}⁩). يبقى التسجيلان منفصلين؛ ويعرض الموقع أجهزة إزالة الرجفان المسجّلة لهذه المنشأة.`}
      />{' '}
      <Link href={`/venues/${venue.id}`} style={{ color: 'var(--brand)' }}><L en="Open the venue record" ar="فتح سجل الموقع" /></Link>
    </p>
  );
}

/**
 * THE REGISTRATION FEE, as a state on the record (register closure, 2026-09-03). A
 * facility has no reference-minting moment, so the fee is an amount due on the record,
 * not a gate: no readiness obligation ever waits on money. Absent while no fee is in
 * force or once paid.
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
 * Status and certificate: the receipt band and the certificate while the registration is
 * complete, what is pending when it is not, the fee, the status line and the validity
 * record with its as-of preview. Status wording is provisional (SPEC); the caveat renders
 * on the Ministry's cardiac configuration screen, not here (partner ruling, second sweep).
 */
function StatusSection({ facility, complete, asof }: { facility: FacilityDetail; complete: boolean; asof: string | undefined }) {
  const id = facility.id;
  const content = FACILITY_CONTENT;
  const cycles = publishedCycles();
  const windowDays = cycles.lapseWindowDays;
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
    aedStatus === 'review' ? { en: 'Ministry review needed for the AED requirement.', ar: 'مراجعة الوزارة مطلوبة لتحديد متطلبات الجهاز.', border: 'var(--accent)', bg: 'var(--accent-soft)' } :
    standing.kind === 'lapsed'
      ? { en: fill(standing.lapsedCount === 1 ? content.standing.lapsed.enOne : content.standing.lapsed.enMany, standing.lapsedCount), ar: fill(content.standing.lapsed.ar, standing.lapsedCount), border: 'var(--bad)', bg: 'var(--bad-soft)' }
      : standing.kind === 'lapsing'
        ? { en: fill(standing.lapsingCount === 1 ? content.standing.lapsing.enOne : content.standing.lapsing.enMany, standing.lapsingCount), ar: fill(content.standing.lapsing.ar, standing.lapsingCount), border: 'var(--accent)', bg: 'var(--accent-soft)' }
        : { en: fill(content.standing.met.en, 0), ar: fill(content.standing.met.ar, 0), border: 'var(--line)', bg: 'var(--surface)' };
  const obligationByKey = new Map(content.ledger.obligations.map((o) => [o.key, o]));
  const archived = facility.archivedAt !== null;
  const pending = facilityRegistrationFactsPending(id);
  const openRequests = facilityRequests(id).filter((r) => r.status === 'open').length;

  return (
    <>
      {archived ? (
        <div data-region="archived-band" style={{ padding: '20px 26px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
          <L
            en={`No longer covered by the Ministry, ${facility.archivedAt!.slice(0, 10)}${facility.archivedReason ? `: ${facility.archivedReason}` : ''}. This record is read-only; its obligations are no longer tracked here. Coverage returns by Ministry designation.`}
            ar={`لم يعد مشمولاً لدى الوزارة، ⁦${facility.archivedAt!.slice(0, 10)}⁩${facility.archivedReason ? `: ${facility.archivedReason}` : ''}. والسجل للقراءة فقط؛ ولم تعد موجباته تُتابع هنا. وتعود الشمولية بتحديد من الوزارة.`}
          />
        </div>
      ) : complete ? (
        // THE RECEIPT BAND, as on the event and venue after filing: the record ID, and the certificate one click away.
        <div data-region="registered-band" role="status" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 20 }}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--brand)', marginBlockEnd: 6 }}>
              <L en={content.certificate.titleEn} ar={content.certificate.titleAr} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5 }}>
              <L en={`Registered. The record ID is ${id}.`} ar={`مُسجَّلة. معرّف السجل هو ⁦${id}⁩.`} />
            </div>
          </div>
          <Link href={`/facilities/${id}/certificate`} style={{ flex: 'none', height: 44, paddingInline: 22, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
            <L en="Open the certificate" ar="فتح الشهادة" />
          </Link>
        </div>
      ) : (
        // Registered, but an item is no longer complete: the certificate is withheld until it is.
        <div data-region="registration-pending" style={{ padding: '18px 22px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 12, marginBlockEnd: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, marginBlockEnd: 8 }}>
            <L en="The certificate is withheld until every item below is complete." ar="تُحجب الشهادة إلى أن يكتمل كل بند أدناه." />
          </div>
          <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: '14.5px', lineHeight: 1.7 }}>
            {pending.map((r) => <li key={r.key}><a href={r.href}><L en={r.en} ar={r.ar} /></a></li>)}
          </ul>
        </div>
      )}
      {openRequests > 0 && !archived ? (
        <p data-region="open-requests" style={{ margin: '0 0 20px', fontSize: '14.5px' }}>
          <a href="#requests"><L en={openRequests === 1 ? '1 open request from the Ministry' : `${openRequests} open requests from the Ministry`} ar={`طلبات مفتوحة من الوزارة: ${openRequests}`} /></a>
        </p>
      ) : null}
      <FeeDue facility={facility} />
      <div data-region="standing" style={{ padding: '28px 32px', border: `1px solid ${standingLine.border}`, background: standingLine.bg, borderRadius: 16, marginBlockEnd: 14 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
          <L en="Status" ar="الحالة" />
        </div>
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.4, maxWidth: '60ch' }}>
          <L en={standingLine.en} ar={standingLine.ar} />
        </div>
      </div>
      <CategoryRequirements />

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
                  href={v === 0 ? `/facilities/${id}#status` : `/facilities/${id}?asof=${v}#status`}
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
      <div data-region="ledger" data-stack="" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr .9fr .8fr', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
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

/** The items still pending on a registered facility, with where each is completed. */
function facilityRegistrationFactsPending(id: string) {
  const facts = facilityRegistrationFacts(id);
  return [
    ...facilityRemainingBeforeConfirmation(facts).map((c) => ({ ...c, href: c.key === 'details' ? facilityCheckHref(id, c.key) : c.key === 'devices' ? '#aeds' : `/facilities/${id}/profile#contact` })),
    ...(facts.confirmationCurrent ? [] : [{ key: 'confirmation', en: 'Readiness confirmation', ar: 'تأكيد الجاهزية', href: '#confirmation' }]),
  ];
}

/** When the plan's confirmation and drill are next due: the validity record's own rows, at today. */
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

function Incidents({ id, archived, submitted }: { id: string; archived: boolean; submitted: boolean }) {
  const reports = getDb().prepare('SELECT id,payload,narrative,created_at FROM facility_incidents WHERE facility_id=? ORDER BY id DESC').all(id) as unknown as FacilityIncidentReport[];
  return (
    <div data-region="incidents">
      {submitted ? <div role="status" style={band}><L en="The incident report has been submitted to the Ministry." ar="قُدِّم تقرير الحادثة إلى الوزارة." /></div> : null}
      {!archived ? (
        <Link href={`/facilities/${id}/incidents/new`} data-region="report-incident" style={{ ...editLink, marginBlockEnd: 12 }}>
          <L en="Report an incident" ar="الإبلاغ عن حادثة" />
        </Link>
      ) : null}
      <FacilityIncidentReports reports={reports} />
    </div>
  );
}

function Requests({ id, archived }: { id: string; archived: boolean }) {
  const requests = facilityRequests(id);
  if (requests.length === 0) {
    return <p data-region="no-requests" style={{ margin: 0, fontSize: '14.5px', color: 'var(--muted)' }}><L en="No requests from the Ministry." ar="لا طلبات من الوزارة." /></p>;
  }
  return (
    <div data-region="ministry-request" style={{ padding: '27px 31px', background: 'var(--surface2)', borderRadius: 16, maxWidth: '88ch' }}>
      <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
        <L en="Requested by the Ministry" ar="مطلوب من الوزارة" />
      </div>
      {requests.map((r) => (
        <div key={r.id} style={{ marginBlockEnd: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline' }}>
            <span style={{ fontSize: 16, lineHeight: 1.6, flex: 1, minWidth: 240 }}>
              <L en={r.bodyEn} ar={r.bodyAr} />
            </span>
            {r.status === 'corrected' ? (
              <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}>
                <L en={`Closed${r.correctedAt ? ` ${r.correctedAt}` : ''}`} ar={`أُقفل${r.correctedAt ? ` ⁦${r.correctedAt}⁩` : ''}`} />
              </span>
            ) : (
              <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontSize: '12.5px' }}>
                {r.due ? (
                  <L en={`Open — due ${r.due}`} ar={`قائم — يُستحق في ⁦${r.due}⁩`} />
                ) : (
                  <L en="Open — no due date until the Ministry publishes a corrective timeline" ar="قائم — لا تاريخ استحقاق قبل نشر الوزارة مهلة تصحيحية" />
                )}
              </span>
            )}
          </div>
          {r.status === 'corrected' && r.closeNote ? (
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBlockStart: 4, lineHeight: 1.6 }}>
              <L en={`Closed by the Ministry: “${r.closeNote}”`} ar={`أقفلته الوزارة: «${r.closeNote}»`} />
            </div>
          ) : null}
          {r.status === 'open' && !archived ? (
            // The link goes to the CONTROL that answers it -- the confirmation sits in the
            // response-plan section, a device fix on the registry.
            <a href={r.kind === 'confirmation' ? '#confirmation' : '#aeds'} style={{ fontSize: '13.5px' }}>
              {r.kind === 'confirmation' ? (
                <L en="Record the readiness confirmation" ar="تسجيل تأكيد الجاهزية" />
              ) : (
                <L en="Open the device records to correct it" ar="فتح سجلات الأجهزة لتصحيحه" />
              )}
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}
