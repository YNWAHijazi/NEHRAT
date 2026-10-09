import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { L } from '../../../../components/L';
import { OptionText } from '../../../../components/OptionText';
import { MinistryShell } from '../../../../components/MinistryShell';
import { RecordHeader } from '../../../../components/RecordHeader';
import { EvidenceSection } from '../../../facilities/[id]/EvidenceSection';
import { HistoryTab } from '../../../facilities/[id]/SiteSections';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { getDb } from '../../../../lib/db';
import { beirutToday } from '../../../../lib/clock';
import { facilityAedStatus, facilityDesignation, facilityPoint } from '../../../../lib/facility-gis';
import { facilityRegistrationFacts } from '../../../../lib/facility-registration';
import { facilityInfrastructure } from '../../../../lib/site-infrastructure';
import { facilityDetail, facilityDevices, facilityIncidentCount, facilityPersons, facilityPlanConfirmation, ministryConfig } from '../../../../lib/queries';
import {
  siteApplicabilityFor,
  siteChanges,
  siteDocuments,
  siteRequests,
  siteReviewActs,
  siteStatusFacts,
  siteSubmissions,
} from '../../../../lib/site-registration';
import { FACILITY_CONTENT, can, deviceStatus, facilityCategory } from '../../../../lib/rules';
import { submissionFacts } from '../../../../lib/rules/facility-workflow';
import { categoryNeedsDesignation, siteReviewActions, siteStatusLabel, siteStatusTone, siteSubmissionSummary } from '../../../../lib/rules/site';
import {
  acceptSiteRegistrationAction,
  closeSiteCorrectiveAction,
  raiseSiteCorrectiveAction,
  recordSiteDesignationAction,
  recordSiteInspectionAction,
  requestSiteInformationAction,
  startSiteReviewAction,
} from '../../../ministry-site-actions';

const TONE = {
  grey: { color: 'var(--muted)', bg: 'var(--surface2)' },
  accent: { color: 'var(--accent-ink)', bg: 'var(--accent-soft)' },
  bad: { color: 'var(--bad)', bg: 'var(--bad-soft)' },
  brand: { color: 'var(--brand)', bg: 'var(--brand-soft)' },
} as const;
const input: React.CSSProperties = { width: '100%', minHeight: 44, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 14.5 };
const button: React.CSSProperties = { minHeight: 44, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: 14, cursor: 'pointer', color: 'var(--ink)' };
const primary: React.CSSProperties = { ...button, border: 0, background: 'var(--brand)', color: 'var(--bg)', fontWeight: 500 };
const card: React.CSSProperties = { padding: '20px 22px', background: 'var(--surface2)', borderRadius: 14, marginBlockEnd: 16 };

function Section({ id, en, ar, children }: { id: string; en: string; ar: string; children: ReactNode }) {
  return (
    <section id={id} data-region={`review-${id}`} style={{ marginBlockEnd: 40, scrollMarginBlockStart: 16 }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 600, letterSpacing: '-.02em' }}><L en={en} ar={ar} /></h2>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: { en: string; ar: string; value: ReactNode }[] }) {
  return (
    <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
      {rows.map((r) => (
        <div key={r.en} style={{ background: 'var(--bg)', padding: '11px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: '14.5px', lineHeight: 1.5 }}>
          <dt style={{ color: 'var(--muted)' }}><L en={r.en} ar={r.ar} /></dt>
          <dd style={{ margin: 0, textAlign: 'end', minWidth: 0, overflowWrap: 'anywhere' }}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * ONE CONSOLIDATED REVIEW SCREEN for a facility/site (latest revision, 9 October 2026,
 * section 9): the site, its cardiac readiness, its AEDs with their photographs, its supporting
 * evidence and its history -- one record, never separate venue and facility applications --
 * and the Ministry's acts on it (sections 10-12): start the review, accept, request
 * information or a correction, raise and close corrective actions, record an inspection, and
 * record the designation a designated category needs. Applicability for the objective
 * categories is the system's, shown, not decided here. No event outcome appears here.
 */
export default async function MinistrySiteReview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const account = await requireMinistryPage('viewFacilityLane');
  const { id } = await params;
  const q = await searchParams;
  const owner = getDb().prepare('SELECT account_id, is_demo FROM facilities WHERE id = ?').get(id) as { account_id: number; is_demo: number } | undefined;
  if (!owner || owner.is_demo !== Number(account.isDemo)) notFound();
  const f = facilityDetail(owner.account_id, id);
  if (!f) notFound();

  const facts = facilityRegistrationFacts(id);
  const status = siteStatusLabel(facts.status);
  const tone = TONE[siteStatusTone(facts.status)];
  const acts = siteReviewActions(siteStatusFacts(id));
  const mayAct = can(account.role, 'recordCorrective') && f.archivedAt === null;
  const mayDesignate = can(account.role, 'designateCovered') && f.archivedAt === null && categoryNeedsDesignation(f.categoryKey) && facilityDesignation(id) === null;
  const category = facilityCategory(f.categoryKey);
  const applicability = siteApplicabilityFor(id);
  const point = facilityPoint(id);
  const contact = facilityPersons(id).find((p) => p.role === 'coordinator') ?? null;
  const devices = facilityDevices(id);
  const confirmation = facilityPlanConfirmation(id);
  const infrastructure = facilityInfrastructure(id);
  const documents = siteDocuments(id).filter((d) => d.purpose === 'evidence');
  const photos = devices.filter((d) => d.hasPhoto).map((d) => ({ label: d.label, locationEn: d.locationEn, locationAr: d.locationAr || d.locationEn }));
  const summary = siteSubmissionSummary(submissionFacts(facts));
  const timeline = ministryConfig().get('correctiveTimelines');
  const timelineInForce = timeline && (!timeline.effective || timeline.effective <= beirutToday());
  const yes = (v: boolean) => (v ? <L en="Yes" ar="نعم" /> : <L en="No" ar="لا" />);

  const notices: Record<string, { en: string; ar: string }> = {
    started: { en: 'The review has started.', ar: 'بدأت المراجعة.' },
    accepted: { en: 'The registration has been accepted. Readiness is current; the operator has been notified.', ar: 'قُبل التسجيل. الجاهزية سارية؛ وأُبلغ المشغّل.' },
    information: { en: 'Additional information has been requested; the operator has been notified.', ar: 'طُلبت معلومات إضافية؛ وأُبلغ المشغّل.' },
    correction: { en: 'A correction has been requested; the operator has been notified.', ar: 'طُلب تصحيح؛ وأُبلغ المشغّل.' },
    corrective: { en: 'The corrective action has been raised and the operator notified.', ar: 'أُثير الإجراء التصحيحي وأُبلغ المشغّل.' },
    closed: { en: 'The corrective action has been closed with what was verified.', ar: 'أُقفل الإجراء التصحيحي مع ما جرى التحقق منه.' },
    inspection: { en: 'The inspection has been recorded.', ar: 'سُجّل التفتيش.' },
    designated: { en: 'The designation has been recorded; the operator has been notified.', ar: 'سُجّل التحديد؛ وأُبلغ المشغّل.' },
  };
  const errors: Record<string, { en: string; ar: string }> = {
    act: { en: 'That act is not open for this site now.', ar: 'هذا الإجراء غير متاح لهذا الموقع الآن.' },
    request: { en: 'Write what the operator must provide or correct.', ar: 'اكتبوا ما يجب على المشغّل تقديمه أو تصحيحه.' },
    corrective: { en: 'Name the deficiency and the corrective action requested.', ar: 'حدّدوا النقص والإجراء التصحيحي المطلوب.' },
    verified: { en: 'Record what was verified before closing the action.', ar: 'سجّلوا ما جرى التحقق منه قبل إقفال الإجراء.' },
    inspection: { en: 'Enter the inspection date (not in the future) and the findings.', ar: 'أدخلوا تاريخ التفتيش (ليس في المستقبل) والنتائج.' },
    designation: { en: 'This category does not take a Ministry designation.', ar: 'لا تحتاج هذه الفئة إلى تحديد من الوزارة.' },
  };

  return (
    <MinistryShell account={account} back={{ href: '/ministry/facilities/queue', en: 'Facility/site review queue', ar: 'قائمة مراجعة المنشآت/المواقع' }}>
      {q.notice && notices[q.notice] ? <div role="status" style={{ padding: '14px 20px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}><L {...notices[q.notice]!} /></div> : null}
      {q.error && errors[q.error] ? <p role="alert" style={{ color: 'var(--bad)' }}><L {...errors[q.error]!} /></p> : null}
      <div data-region="site-review-header">
        <RecordHeader
          facts={[
            { en: 'Site ID', ar: 'معرّف الموقع', value: f.siteId ?? '—', strong: true },
            { en: 'Registration reference', ar: 'مرجع التسجيل', value: f.id },
            { en: 'Status', ar: 'الحالة', value: <span data-region="site-status" data-status={facts.status} style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, background: tone.bg, color: tone.color, fontSize: 13.5 }}><L en={status.en} ar={status.ar} /></span> },
          ]}
          nameEn={f.nameEn}
          nameAr={f.nameAr}
          stats={[{ en: 'AEDs', ar: 'الأجهزة', value: devices.length, valueStyle: { fontVariantNumeric: 'tabular-nums' } }]}
        />
      </div>

      {mayAct || mayDesignate ? (
        <section data-region="review-actions" style={{ ...card, background: 'var(--bg)', border: '1px solid var(--line)', marginBlockEnd: 36 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600 }}><L en="Ministry review" ar="مراجعة الوزارة" /></h2>
          <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            <L en="Operational site statuses, not event determinations. Corrective actions, inspections and designations are recorded at any time after a submission." ar="حالات تشغيلية للموقع، لا قرارات فعاليات. تُسجَّل الإجراءات التصحيحية والتفتيش والتحديد في أي وقت بعد التقديم." />
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBlockEnd: 18 }}>
            {mayAct && acts.start ? (
              <form action={startSiteReviewAction.bind(null, id)}><button type="submit" data-act="start" style={button}><L en="Start the review" ar="بدء المراجعة" /></button></form>
            ) : null}
          </div>
          {mayAct && acts.accept ? (
            <form action={acceptSiteRegistrationAction.bind(null, id)} data-region="accept-form" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end', marginBlockEnd: 18 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 280px' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en="Note for the record (optional)" ar="ملاحظة للسجل (اختيارية)" /></span>
                <input name="note" style={input} />
              </label>
              <button type="submit" data-act="accept" style={primary}><L en="Accept the registration and readiness record" ar="قبول التسجيل وسجل الجاهزية" /></button>
            </form>
          ) : null}
          {mayAct && acts.request ? (
            <form action={requestSiteInformationAction.bind(null, id)} data-region="request-form" style={{ display: 'grid', gap: 10, marginBlockEnd: 18 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 1 260px' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en="Request" ar="الطلب" /></span>
                  <select name="kind" defaultValue="information" style={input}>
                    <option value="information"><OptionText en="Additional information" ar="معلومات إضافية" /></option>
                    <option value="correction"><OptionText en="Correction" ar="تصحيح" /></option>
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 320px' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en="What the operator must provide or correct, as they will read it" ar="ما يجب على المشغّل تقديمه أو تصحيحه، كما سيقرأه" /></span>
                  <input name="body" required style={input} />
                </label>
              </div>
              <button type="submit" data-act="request" style={{ ...button, justifySelf: 'start' }}><L en="Send the request — the operator is notified" ar="إرسال الطلب — يُبلَّغ المشغّل" /></button>
            </form>
          ) : null}
          {mayAct && acts.record ? (
            <>
              <details style={{ marginBlockEnd: 12 }}>
                <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 500 }}><L en="Raise a corrective action" ar="إثارة إجراء تصحيحي" /></summary>
                <form action={raiseSiteCorrectiveAction.bind(null, id)} data-region="corrective-form" style={{ display: 'grid', gap: 10, marginBlock: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en="Deficiency" ar="النقص" /></span>
                    <input name="deficiency" required style={input} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en="Corrective action requested, as the operator will read it" ar="الإجراء التصحيحي المطلوب، كما سيقرأه المشغّل" /></span>
                    <input name="action" required style={input} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en="Supporting note or evidence (optional)" ar="ملاحظة أو دليل داعم (اختياري)" /></span>
                    <textarea name="note" rows={2} style={{ ...input, lineHeight: 1.5 }} />
                  </label>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                    {timelineInForce
                      ? <L en={`Due ${timeline!.value} days from today, per the published corrective-action timeline.`} ar={`يُستحق بعد ${timeline!.value} يوماً من اليوم، وفق مهلة الإجراءات التصحيحية المنشورة.`} />
                      : <L en="The corrective-action timeline is a Ministry value not yet set: no due date is computed until it is published." ar="مهلة الإجراء التصحيحي قيمة وزارية لم تُحدَّد بعد: لا يُحتسب تاريخ استحقاق قبل نشرها." />}
                  </p>
                  <button type="submit" data-act="corrective" style={{ ...button, justifySelf: 'start' }}><L en="Raise the corrective action" ar="إثارة الإجراء التصحيحي" /></button>
                </form>
              </details>
              <details style={{ marginBlockEnd: 12 }}>
                <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 500 }}><L en="Record an inspection" ar="تسجيل تفتيش" /></summary>
                <form action={recordSiteInspectionAction.bind(null, id)} data-region="inspection-form" style={{ display: 'grid', gap: 10, marginBlock: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 260 }}>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en="Inspection date" ar="تاريخ التفتيش" /></span>
                    <input name="date" type="date" required style={{ ...input, fontVariantNumeric: 'tabular-nums' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en="Findings" ar="النتائج" /></span>
                    <textarea name="findings" required rows={3} style={{ ...input, lineHeight: 1.5 }} />
                  </label>
                  <button type="submit" data-act="inspection" style={{ ...button, justifySelf: 'start' }}><L en="Record the inspection" ar="تسجيل التفتيش" /></button>
                </form>
              </details>
            </>
          ) : null}
          {mayDesignate ? (
            <form action={recordSiteDesignationAction.bind(null, id)} data-region="designation-form" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end', marginBlockStart: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 280px' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en="Basis for the designation" ar="أساس التحديد" /></span>
                <input name="note" style={input} />
              </label>
              <button type="submit" data-act="designate" style={button}><L en="Record the designation for this category" ar="تسجيل التحديد لهذه الفئة" /></button>
            </form>
          ) : null}
        </section>
      ) : null}

      <Section id="site" en="Site" ar="الموقع">
        <Rows rows={[
          { en: 'Name', ar: 'الاسم', value: <L en={f.nameEn} ar={f.nameAr} /> },
          { en: 'Category', ar: 'الفئة', value: <L en={category?.en ?? f.categoryKey} ar={category?.ar ?? f.categoryKey} /> },
          { en: 'Applicability', ar: 'الانطباق', value: <span data-region="review-applicability" data-applicability={applicability.key}><L en={applicability.en} ar={applicability.ar} /></span> },
          { en: 'AED requirement', ar: 'متطلب الجهاز', value: facilityAedStatus(id) === 'required' ? <L en="Required" ar="مطلوب" /> : facilityAedStatus(id) === 'notRequired' ? <L en="Not required" ar="غير مطلوب" /> : <L en="Waiting on the Ministry" ar="بانتظار الوزارة" /> },
          { en: 'Approved or licensed capacity', ar: 'السعة المعتمدة أو المرخّصة', value: f.licensedCapacity ?? '—' },
          { en: 'Address and municipality', ar: 'العنوان والبلدية', value: <L en={`${f.address}, ${f.municipalityEn}`} ar={`${f.address}، ${f.municipalityAr}`} /> },
          { en: 'GIS location', ar: 'الموقع الجغرافي', value: point ? <a href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=18/${point.lat}/${point.lng}`} target="_blank" rel="noreferrer" dir="ltr">{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</a> : '—' },
          { en: 'Operating organization', ar: 'الجهة المشغّلة', value: f.operatingOrganization || '—' },
          { en: 'Operating hours', ar: 'ساعات العمل', value: f.operatingHours },
          { en: 'Site telephone and email', ar: 'هاتف الموقع وبريده الإلكتروني', value: <span dir="ltr">{f.phone} · {f.email}</span> },
          { en: 'Responsible contact', ar: 'جهة الاتصال المسؤولة', value: contact ? <span>{contact.nameOrPosition} · <span dir="ltr">{contact.phone} · {contact.email}</span></span> : '—' },
        ]} />
        {infrastructure && (Object.keys(infrastructure.answers).length > 0 || infrastructure.layoutMap) ? (
          <details style={{ marginBlockStart: 12 }}>
            <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer' }}><L en="Basic site infrastructure" ar="البنية الأساسية للموقع" /></summary>
            <Rows rows={[
              ...(infrastructure.layoutMap ? [{ en: 'Site or layout map', ar: 'خريطة الموقع أو مخططه', value: <a href={`/api/facility-documents/${id}/${infrastructure.layoutMap.id}`} target="_blank" rel="noreferrer">{infrastructure.layoutMap.fileName}</a> }] : []),
              ...FACILITY_CONTENT.site.infrastructure.fields
                .filter((fl) => (infrastructure.answers as Record<string, string | undefined>)[fl.key])
                .map((fl) => ({ en: fl.en, ar: fl.ar, value: (infrastructure.answers as Record<string, string>)[fl.key]! })),
            ]} />
          </details>
        ) : null}
      </Section>

      <Section id="readiness" en="Cardiac readiness" ar="الجاهزية لتوقف القلب">
        <div style={card}>
          <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 600 }}><L en={FACILITY_CONTENT.planTitle.en} ar={FACILITY_CONTENT.planTitle.ar} /></h3>
          <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}><L en="The standard procedure, displayed to the site with its own details and AEDs:" ar="الإجراء الموحّد، معروضاً للموقع مع بياناته وأجهزته:" /></p>
          <ol style={{ margin: 0, paddingInlineStart: 22, fontSize: 14.5, lineHeight: 1.7 }}>
            {FACILITY_CONTENT.procedure.map((p) => <li key={p.n}><L en={p.en} ar={p.ar} /></li>)}
          </ol>
        </div>
        <Rows rows={[
          { en: 'EMS access: main entrance or access point', ar: 'وصول خدمات الطوارئ الطبية: المدخل الرئيسي أو نقطة الوصول', value: f.accessPoint || '—' },
          { en: 'EMS contact number used by the site', ar: 'رقم الاتصال بخدمات الطوارئ الطبية المعتمد لدى الموقع', value: <span dir="ltr">{f.emsNumber || '—'}</span> },
          { en: 'Readiness confirmation', ar: 'تأكيد الجاهزية', value: confirmation ? <L en={`Recorded ${confirmation.createdAt.slice(0, 10)} by ${confirmation.coordinator}${confirmation.current ? '' : ' — the site or AED details changed since'}`} ar={`سُجّل في ⁦${confirmation.createdAt.slice(0, 10)}⁩ من ${confirmation.coordinator}${confirmation.current ? '' : ' — تغيّرت بيانات الموقع أو الأجهزة بعده'}`} /> : <L en="Not recorded" ar="غير مسجَّل" /> },
          { en: 'Annual drill: latest', ar: 'التمرين السنوي: الأحدث', value: confirmation?.drillDate ?? '—' },
          ...FACILITY_CONTENT.planChecks.map((c) => ({ en: c.en, ar: c.ar, value: confirmation ? yes(Boolean(confirmation.checks[c.key])) : '—' })),
        ]} />
        <div style={{ ...card, marginBlockStart: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 600 }}><L en="The submission summary" ar="ملخص التقديم" /></h3>
          <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 14, lineHeight: 1.7 }}>
            {summary.map((l) => <li key={l.key}><L en={`${l.en} — ${l.valueEn}`} ar={`${l.ar} — ${l.valueAr}`} /></li>)}
          </ul>
        </div>
      </Section>

      <Section id="aeds" en="AEDs" ar="أجهزة إزالة الرجفان">
        {devices.length === 0 ? <p style={{ margin: 0, color: 'var(--muted)' }}><L en="No AED registered." ar="لم يُسجَّل أي جهاز." /></p> : (
          <div data-region="review-aeds" style={{ display: 'grid', gap: 10 }}>
            {devices.map((d) => {
              const st = deviceStatus({ operational: d.operational, accessibleHours: d.accessibleHours });
              return (
                <div key={d.label} data-device={d.label} style={{ ...card, marginBlockEnd: 0, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                  {d.hasPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/facility-device-photos/${id}/${d.label}`} alt="" style={{ width: 112, height: 84, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                  ) : null}
                  <div style={{ flex: '1 1 260px', minWidth: 0, fontSize: 14.5, lineHeight: 1.55 }}>
                    <div style={{ fontWeight: 600 }}>{d.label} · <span dir="ltr">{d.identification}</span></div>
                    <div><L en={d.locationEn} ar={d.locationAr || d.locationEn} /></div>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                      <L en={`${st.en} · publicly accessible: ${d.publiclyAccessible ? 'yes' : 'no'} · pediatric: ${d.pediatric === 'yes' ? 'yes' : d.pediatric === 'na' ? 'not applicable' : 'no'}`} ar={`${st.ar} · متاح للعموم: ${d.publiclyAccessible ? 'نعم' : 'لا'} · للأطفال: ${d.pediatric === 'yes' ? 'نعم' : d.pediatric === 'na' ? 'غير منطبق' : 'لا'}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section id="evidence" en="Supporting evidence" ar="الأدلة الداعمة">
        <EvidenceSection facilityId={id} documents={documents} photos={photos} editable={false} />
      </Section>

      <Section id="history" en="History" ar="السجل">
        <HistoryTab
          facilityId={id}
          submissions={siteSubmissions(id)}
          acts={siteReviewActs(id)}
          requests={siteRequests(id)}
          incidentCount={facilityIncidentCount(id)}
          changes={siteChanges(id)}
          respond={false}
          closeFor={(r) => mayAct && r.kind === 'corrective' ? (
            <form action={closeSiteCorrectiveAction.bind(null, id, r.id)} data-region="close-corrective" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end', marginBlockStart: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 280px' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en="What was verified" ar="ما جرى التحقق منه" /></span>
                <input name="verified" required style={input} />
              </label>
              <button type="submit" style={button}><L en="Close — record what was verified" ar="إقفال — تسجيل ما جرى التحقق منه" /></button>
            </form>
          ) : null}
        />
        <p style={{ margin: '8px 0 0' }}><Link href={`/ministry/facilities/reports?facility=${id}`}><L en="Open the incident reports" ar="فتح تقارير الحوادث" /></Link></p>
      </Section>
    </MinistryShell>
  );
}
