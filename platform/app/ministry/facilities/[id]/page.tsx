import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { L } from '../../../../components/L';
import { MinistryShell } from '../../../../components/MinistryShell';
import { EvidenceSection } from '../../../facilities/[id]/EvidenceSection';
import { HistoryTab } from '../../../facilities/[id]/SiteSections';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { getDb } from '../../../../lib/db';
import { beirutToday } from '../../../../lib/clock';
import { facilityAedStatus, facilityDesignation } from '../../../../lib/facility-gis';
import { facilityRegistrationFacts } from '../../../../lib/facility-registration';
import { facilityDetail, facilityDevices, facilityIncidentCount, ministryConfig } from '../../../../lib/queries';
import {
  siteApplicabilityFor,
  siteChanges,
  siteRequests,
  siteReviewActs,
  siteStatusFacts,
  siteSubmissionSnapshot,
  siteSubmissions,
  type SiteDocument,
} from '../../../../lib/site-registration';
import { FACILITY_CONTENT, can, deviceStatus, facilityCategory } from '../../../../lib/rules';
import { submissionFacts } from '../../../../lib/rules/facility-workflow';
import {
  SITE_OUTCOMES,
  categoryNeedsDesignation,
  reviewActLabel,
  siteReviewActions,
  siteStatusLabel,
  siteStatusTone,
  siteSubmissionSummary,
  type SiteReviewActKind,
} from '../../../../lib/rules/site';
import {
  closeSiteCorrectiveAction,
  raiseSiteCorrectiveAction,
  recordSiteDesignationAction,
  recordSiteInspectionAction,
  answerSiteChangeAction,
  recordSiteOutcomeAction,
  reopenSiteForChangeAction,
  startSiteReviewAction,
} from '../../../ministry-site-actions';
import { siteChangeRequests } from '../../../../lib/site-registration';
import { SITE_CHANGE_ASPECTS } from '../../../../lib/rules/site-changes';

const input: React.CSSProperties = { width: '100%', minHeight: 44, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 14.5 };
const button: React.CSSProperties = { minHeight: 44, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: 14, cursor: 'pointer', color: 'var(--ink)' };
const panel: React.CSSProperties = { padding: 25, background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 16 };
const h2: React.CSSProperties = { margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' };

function Section({ id, en, ar, children }: { id: string; en: string; ar: string; children: ReactNode }) {
  return (
    <section id={`review-${id}`} data-region={`review-${id}`} style={{ marginBlockEnd: 28, scrollMarginBlockStart: 16 }}>
      <h2 style={h2}><L en={en} ar={ar} /></h2>
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

type Row = Record<string, unknown>;
const str = (r: Row | undefined, k: string): string => (r && typeof r[k] === 'string' ? (r[k] as string) : r && typeof r[k] === 'number' ? String(r[k]) : '');

/**
 * ONE CONSOLIDATED REVIEW SCREEN for a facility/site, in the event submission review's
 * structure (owner, 9 October 2026): the header with the record's line, its status chip and
 * "Take this submission"; the section links; the record AS SUBMITTED -- the frozen version,
 * the revision's section 9 parts: site, cardiac readiness, AEDs with photographs, supporting
 * evidence, history -- beside the review and decision column: the outcome form with its note,
 * the corrective action, the inspection, the designation a designated category needs, and the
 * decision history. PAD statuses only; no event outcome and no approval appear here.
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
  const tone = siteStatusTone(facts.status);
  const acts = siteReviewActions(siteStatusFacts(id));
  const mayAct = can(account.role, 'recordCorrective') && f.archivedAt === null;
  const mayDesignate = can(account.role, 'designateCovered') && f.archivedAt === null && categoryNeedsDesignation(f.categoryKey) && facilityDesignation(id) === null;
  const category = facilityCategory(f.categoryKey);
  const applicability = siteApplicabilityFor(id);
  const submissions = siteSubmissions(id);
  const latest = submissions[0] ?? null;
  const history = siteReviewActs(id);
  const reviewer = latest ? history.find((a) => a.kind === 'reviewStarted' && a.version === latest.version)?.actor ?? '' : '';
  const timeline = ministryConfig().get('correctiveTimelines');
  const timelineInForce = timeline && (!timeline.effective || timeline.effective <= beirutToday());
  const yes = (v: boolean) => (v ? <L en="Yes" ar="نعم" /> : <L en="No" ar="لا" />);

  // THE RECORD AS SUBMITTED: the latest version's frozen snapshot, never the live record.
  const snap = latest ? siteSubmissionSnapshot(id, latest.version) : null;
  const sf = (snap?.['facility'] ?? undefined) as Row | undefined;
  const people = (snap?.['people'] ?? []) as Row[];
  const contact = people.find((p) => p['role'] === 'coordinator');
  const devices = (snap?.['devices'] ?? []) as Row[];
  const infra = (snap?.['infrastructure'] ?? {}) as Record<string, string>;
  const docs = (snap?.['documents'] ?? []) as Pick<SiteDocument, 'id' | 'purpose' | 'docType' | 'issuer' | 'issueDate' | 'reviewDate' | 'fileName' | 'uploadedAt'>[];
  const confirmation = (snap?.['confirmation'] ?? null) as { checks: Record<string, boolean>; drillDate: string | null; coordinator: string; createdAt: string } | null;
  const changedSince = latest ? siteChanges(id).some((c) => c.at > latest.submittedAt) : false;
  const livePhotos = facilityDevices(id).filter((d) => d.hasPhoto).map((d) => ({ label: d.label, locationEn: d.locationEn, locationAr: d.locationAr || d.locationEn }));
  const summary = siteSubmissionSummary(submissionFacts(facts));
  const lat = typeof sf?.['latitude'] === 'number' ? (sf['latitude'] as number) : null;
  const lng = typeof sf?.['longitude'] === 'number' ? (sf['longitude'] as number) : null;

  const notices: Record<string, { en: string; ar: string }> = {
    started: { en: 'The review has started.', ar: 'بدأت المراجعة.' },
    accepted: { en: 'The outcome has been recorded: readiness current. The operator has been notified.', ar: 'سُجّلت النتيجة: الجاهزية سارية. وأُبلغ المشغّل.' },
    information: { en: 'The outcome has been recorded: information required. The record is open for revision and the operator has been notified.', ar: 'سُجّلت النتيجة: مطلوب معلومات. السجل مفتوح للتعديل وأُبلغ المشغّل.' },
    correction: { en: 'The outcome has been recorded: a correction is required. The record is open for revision and the operator has been notified.', ar: 'سُجّلت النتيجة: مطلوب تصحيح. السجل مفتوح للتعديل وأُبلغ المشغّل.' },
    corrective: { en: 'The corrective action has been raised and the operator notified.', ar: 'أُثير الإجراء التصحيحي وأُبلغ المشغّل.' },
    closed: { en: 'The corrective action has been closed with what was verified.', ar: 'أُقفل الإجراء التصحيحي مع ما جرى التحقق منه.' },
    inspection: { en: 'The inspection has been recorded.', ar: 'سُجّل التفتيش.' },
    'change-reopened': { en: 'The registration has been reopened for the operator’s change. The operator has been notified and submits the updated registration as a new version.', ar: 'أُعيد فتح التسجيل لإجراء تغيير المشغّل. وأُبلغ المشغّل ويقدّم التسجيل المحدَّث بنسخة جديدة.' },
    'change-answered': { en: 'The change request has been answered; the operator has been notified.', ar: 'أُجيب عن طلب التغيير؛ وأُبلغ المشغّل.' },
    designated: { en: 'The designation has been recorded; the operator has been notified.', ar: 'سُجّل التحديد؛ وأُبلغ المشغّل.' },
  };
  const errors: Record<string, { en: string; ar: string }> = {
    change: { en: 'That change request is no longer open.', ar: 'طلب التغيير هذا لم يعد مفتوحاً.' },
    'change-answer': { en: 'Not sent: write the answer to the operator.', ar: 'لم يُرسل: اكتبوا الجواب إلى المشغّل.' },
    act: { en: 'That act is not open for this site now.', ar: 'هذا الإجراء غير متاح لهذا الموقع الآن.' },
    outcome: { en: 'Choose an outcome.', ar: 'اختاروا نتيجة.' },
    note: { en: 'A request for information or a correction needs the note: it is what the operator reads.', ar: 'يحتاج طلب المعلومات أو التصحيح إلى الملاحظة: فهي ما يقرأه المشغّل.' },
    request: { en: 'Write what the operator must provide or correct.', ar: 'اكتبوا ما يجب على المشغّل تقديمه أو تصحيحه.' },
    corrective: { en: 'Name the deficiency and the corrective action requested.', ar: 'حدّدوا النقص والإجراء التصحيحي المطلوب.' },
    verified: { en: 'Record what was verified before closing the action.', ar: 'سجّلوا ما جرى التحقق منه قبل إقفال الإجراء.' },
    inspection: { en: 'Enter the inspection date (not in the future) and the findings.', ar: 'أدخلوا تاريخ التفتيش (ليس في المستقبل) والنتائج.' },
    designation: { en: 'This category does not take a Ministry designation.', ar: 'لا تحتاج هذه الفئة إلى تحديد من الوزارة.' },
  };
  const outcomeKinds: SiteReviewActKind[] = ['accepted', 'infoRequested', 'correctionRequested'];
  const decisions = history.filter((a) => outcomeKinds.includes(a.kind));
  const standing = latest ? decisions.find((a) => a.version === latest.version) ?? null : null;

  return (
    <MinistryShell account={account} back={{ href: '/ministry/facilities/queue', en: 'Facility/site review queue', ar: 'قائمة مراجعة المنشآت/المواقع' }}>
      {q.notice && notices[q.notice] ? <div role="status" style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}><L {...notices[q.notice]!} /></div> : null}
      {q.error && errors[q.error] ? <div role="alert" style={{ padding: '16px 22px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}><L {...errors[q.error]!} /></div> : null}

      <div data-region="site-review-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 28 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 8, fontVariantNumeric: 'tabular-nums' }}>
            <L
              en={`${f.operatingOrganization || '—'} · ${f.siteId ?? id} · ${id}${latest ? ` · filed ${latest.submittedAt.slice(0, 10)}` : ' · not yet submitted'}${latest && latest.version > 1 ? ` · revised submission, version ${latest.version}` : ''}`}
              ar={`${f.operatingOrganization || '—'} · ${f.siteId ?? id} · ${id}${latest ? ` · قُدّم في ⁦${latest.submittedAt.slice(0, 10)}⁩` : ' · لم يُقدَّم بعد'}${latest && latest.version > 1 ? ` · تقديم معدَّل، النسخة ${latest.version}` : ''}`}
            />
          </div>
          <h1 data-sec-h1="" style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}><L en={f.nameEn} ar={f.nameAr} /></h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlockStart: 10 }}>
            <span style={{ padding: '3px 9px', borderRadius: 13, background: 'var(--surface2)', fontSize: 13 }}>
              <L en={category?.en ?? f.categoryKey} ar={category?.ar ?? f.categoryKey} />
            </span>
            {/* Grey while it is an internal workflow state; the PAD status in its own words once recorded. */}
            <span data-region="site-status" data-status={facts.status} style={{ padding: '3px 9px', borderRadius: 13, fontSize: 13, background: tone === 'brand' ? 'var(--brand-soft)' : tone === 'bad' ? 'var(--bad-soft)' : tone === 'accent' ? 'var(--accent-soft)' : 'var(--surface2)', color: tone === 'grey' ? 'var(--muted)' : 'var(--ink)' }}>
              <L en={status.en} ar={status.ar} />{reviewer ? ` · ${reviewer}` : null}
            </span>
          </div>
        </div>
        {mayAct && acts.start ? (
          <form action={startSiteReviewAction.bind(null, id)}>
            <button type="submit" data-act="start" style={{ minHeight: 44, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '13.5px', cursor: 'pointer' }}>
              <L en="Take this submission" ar="تولّي هذا التقديم" />
            </button>
          </form>
        ) : null}
      </div>

      <nav aria-label="Review sections" style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBlockEnd: 22 }}>
        <a href="#review-site"><L en="Site" ar="الموقع" /></a>
        <a href="#review-readiness"><L en="Cardiac readiness" ar="الجاهزية لتوقف القلب" /></a>
        <a href="#review-aeds"><L en="AEDs" ar="الأجهزة" /></a>
        <a href="#review-evidence"><L en="Supporting evidence" ar="الأدلة الداعمة" /></a>
        <a href="#review-history"><L en="History" ar="السجل" /></a>
        <a href="#review-decision"><L en="Review and decision" ar="المراجعة والقرار" /></a>
      </nav>

      <p data-region="frozen-note" style={{ margin: '0 0 22px', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
        {latest
          ? <L en={`The record as submitted: version ${latest.version}, ${latest.submittedAt.slice(0, 16)} (Beirut time), declared by ${latest.representative || '—'}${latest.position ? `, ${latest.position}` : ''}.`} ar={`السجل كما قُدِّم: النسخة ${latest.version}، ⁦${latest.submittedAt.slice(0, 16)}⁩ (بتوقيت بيروت)، أقرّ به ${latest.representative || '—'}${latest.position ? `، ${latest.position}` : ''}.`} />
          : <L en="This site has not been submitted. Nothing below is frozen yet." ar="لم يُقدَّم هذا الموقع بعد. ولا شيء أدناه مجمَّد بعد." />}
        {changedSince ? <> <span data-region="changed-since" style={{ color: 'var(--accent-ink)' }}><L en="The site record changed after this version was submitted; the changes are listed in the history." ar="تغيّر سجل الموقع بعد تقديم هذه النسخة؛ والتغييرات مدرجة في السجل." /></span></> : null}
      </p>

      <div data-split="" style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 20, alignItems: 'start' }}>
        <div>
          <Section id="site" en="Site" ar="الموقع">
            <Rows rows={[
              { en: 'Identity', ar: 'الهوية', value: <L en={`${str(sf, 'name_en') || f.nameEn} · ${f.siteId ?? id}`} ar={`${str(sf, 'name_ar') || f.nameAr} · ${f.siteId ?? id}`} /> },
              { en: 'Category', ar: 'الفئة', value: <L en={category?.en ?? f.categoryKey} ar={category?.ar ?? f.categoryKey} /> },
              { en: 'Applicability', ar: 'الانطباق', value: <span data-region="review-applicability" data-applicability={applicability.key}><L en={applicability.en} ar={applicability.ar} /></span> },
              { en: 'AED requirement', ar: 'متطلب الجهاز', value: facilityAedStatus(id) === 'required' ? <L en="Required" ar="مطلوب" /> : facilityAedStatus(id) === 'notRequired' ? <L en="Not required" ar="غير مطلوب" /> : <L en="Waiting on the Ministry" ar="بانتظار الوزارة" /> },
              { en: 'Approved or licensed capacity', ar: 'السعة المعتمدة أو المرخّصة', value: str(sf, 'licensed_capacity') || '—' },
              { en: 'Address and municipality', ar: 'العنوان والبلدية', value: <L en={`${str(sf, 'address')}, ${str(sf, 'municipality_en')}`} ar={`${str(sf, 'address')}، ${str(sf, 'municipality_ar')}`} /> },
              { en: 'GIS location', ar: 'الموقع الجغرافي', value: lat !== null && lng !== null ? <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`} target="_blank" rel="noreferrer" dir="ltr">{lat.toFixed(5)}, {lng.toFixed(5)}</a> : '—' },
              { en: 'Operating organization', ar: 'الجهة المشغّلة', value: str(sf, 'operating_organization') || '—' },
              { en: 'Operating hours', ar: 'ساعات العمل', value: str(sf, 'operating_hours') || '—' },
              { en: 'Site telephone and email', ar: 'هاتف الموقع وبريده الإلكتروني', value: <span dir="ltr">{str(sf, 'phone')} · {str(sf, 'email')}</span> },
              { en: 'Responsible contact', ar: 'جهة الاتصال المسؤولة', value: contact ? <span>{str(contact, 'name_or_position')} · <span dir="ltr">{str(contact, 'phone')} · {str(contact, 'email')}</span></span> : '—' },
            ]} />
            {Object.keys(infra).length > 0 ? (
              <details style={{ marginBlockStart: 12 }}>
                <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer' }}><L en="Basic site infrastructure" ar="البنية الأساسية للموقع" /></summary>
                <Rows rows={FACILITY_CONTENT.site.infrastructure.fields.filter((fl) => infra[fl.key]).map((fl) => ({ en: fl.en, ar: fl.ar, value: infra[fl.key]! }))} />
              </details>
            ) : null}
          </Section>

          <Section id="readiness" en="Cardiac readiness" ar="الجاهزية لتوقف القلب">
            <div style={panel}>
              <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600 }}><L en={FACILITY_CONTENT.planTitle.en} ar={FACILITY_CONTENT.planTitle.ar} /></h3>
              <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}><L en="The standard procedure, displayed to the site with its own details and AEDs:" ar="الإجراء الموحّد، معروضاً للموقع مع بياناته وأجهزته:" /></p>
              <ol style={{ margin: 0, paddingInlineStart: 22, fontSize: 14.5, lineHeight: 1.7 }}>
                {FACILITY_CONTENT.procedure.map((p) => <li key={p.n}><L en={p.en} ar={p.ar} /></li>)}
              </ol>
            </div>
            <Rows rows={[
              { en: 'EMS access: main entrance or access point', ar: 'وصول خدمات الطوارئ الطبية: المدخل الرئيسي أو نقطة الوصول', value: str(sf, 'access_point') || '—' },
              { en: 'EMS contact number used by the site', ar: 'رقم الاتصال بخدمات الطوارئ الطبية المعتمد لدى الموقع', value: <span dir="ltr">{str(sf, 'ems_number') || '—'}</span> },
              { en: 'Readiness confirmation', ar: 'تأكيد الجاهزية', value: confirmation ? <L en={`Recorded ${confirmation.createdAt.slice(0, 10)} by ${confirmation.coordinator}`} ar={`سُجّل في ⁦${confirmation.createdAt.slice(0, 10)}⁩ من ${confirmation.coordinator}`} /> : <L en="Not recorded" ar="غير مسجَّل" /> },
              { en: 'Annual drill: latest', ar: 'التمرين السنوي: الأحدث', value: confirmation?.drillDate ?? '—' },
              ...FACILITY_CONTENT.planChecks.map((c) => ({ en: c.en, ar: c.ar, value: confirmation ? yes(Boolean(confirmation.checks[c.key])) : '—' })),
            ]} />
            <div style={{ ...panel, marginBlockStart: 16 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600 }}><L en="The registration summary, today" ar="ملخص التسجيل، اليوم" /></h3>
              <ul data-region="review-summary-lines" style={{ margin: 0, paddingInlineStart: 20, fontSize: 14, lineHeight: 1.7 }}>
                {summary.map((l) => <li key={l.key}><L en={`${l.en} — ${l.valueEn}`} ar={`${l.ar} — ${l.valueAr}`} /></li>)}
              </ul>
            </div>
          </Section>

          <Section id="aeds" en="AEDs" ar="أجهزة إزالة الرجفان">
            {devices.length === 0 ? <p style={{ margin: 0, color: 'var(--muted)' }}><L en="No AED registered." ar="لم يُسجَّل أي جهاز." /></p> : (
              <div data-region="review-aed-list" style={{ display: 'grid', gap: 10 }}>
                {devices.map((d) => {
                  const label = str(d, 'label');
                  const st = deviceStatus({ operational: d['operational'] === 1, accessibleHours: d['accessible_hours'] === 1 });
                  const photo = livePhotos.some((p) => p.label === label);
                  return (
                    <div key={label} data-device={label} style={{ ...panel, marginBlockEnd: 0, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/facility-device-photos/${id}/${label}`} alt="" style={{ width: 112, height: 84, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                      ) : null}
                      <div style={{ flex: '1 1 260px', minWidth: 0, fontSize: 14.5, lineHeight: 1.55 }}>
                        <div style={{ fontWeight: 600 }}>{label} · <span dir="ltr">{str(d, 'identification')}</span></div>
                        <div><L en={str(d, 'location_en')} ar={str(d, 'location_ar') || str(d, 'location_en')} /></div>
                        <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                          <L en={`${st.en} · publicly accessible: ${d['publicly_accessible'] === 1 ? 'yes' : 'no'} · pediatric: ${d['pediatric'] === 'yes' ? 'yes' : d['pediatric'] === 'na' ? 'not applicable' : 'no'}`} ar={`${st.ar} · متاح للعموم: ${d['publicly_accessible'] === 1 ? 'نعم' : 'لا'} · للأطفال: ${d['pediatric'] === 'yes' ? 'نعم' : d['pediatric'] === 'na' ? 'غير منطبق' : 'لا'}`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section id="evidence" en="Supporting evidence" ar="الأدلة الداعمة">
            <EvidenceSection facilityId={id} documents={docs.filter((d) => d.purpose === 'evidence').map((d) => ({ ...d, contentType: '', byteSize: 0 }))} photos={livePhotos} editable={false} />
          </Section>

          <Section id="history" en="History" ar="السجل">
            <HistoryTab
              facilityId={id}
              submissions={submissions}
              acts={history}
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
        </div>

        <div id="review-decision" data-region="review-actions" style={{ scrollMarginBlockStart: 16 }}>
          <ChangeRequests id={id} mayAct={mayAct} mayReopen={acts.request} />
          {standing ? (
            <div data-region="standing-determination" style={panel}>
              <h2 style={{ ...h2, margin: '0 0 10px' }}><L en="Outcome recorded on this version" ar="النتيجة المسجّلة على هذه النسخة" /></h2>
              <div style={{ fontSize: '14.5px', lineHeight: 1.5 }}><L {...reviewActLabel(standing.kind)} /></div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, fontVariantNumeric: 'tabular-nums' }}>{standing.at} · {standing.actor}</div>
              {standing.note ? <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockStart: 6, lineHeight: 1.6 }}>{standing.note}</div> : null}
            </div>
          ) : null}

          {mayAct && (acts.accept || acts.request) ? (
            <div id="review-outcome" data-region="outcome" style={panel}>
              <h2 style={{ ...h2, margin: '0 0 16px' }}><L en="Record an outcome" ar="تسجيل نتيجة" /></h2>
              <form action={recordSiteOutcomeAction.bind(null, id)}>
                <div data-region="outcome-options" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 14 }}>
                  {SITE_OUTCOMES.filter((o) => (o.key === 'accept' ? acts.accept : acts.request)).map((o) => (
                    <label key={o.key} style={{ display: 'flex', gap: 12, alignItems: 'start', minHeight: 44, padding: '14px 16px', border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 10, cursor: 'pointer' }}>
                      <input type="radio" name="outcome" value={o.key} data-outcome={o.key} style={{ marginBlockStart: 4 }} />
                      <span style={{ fontSize: '14.5px', lineHeight: 1.5 }}><L en={o.en} ar={o.ar} /></span>
                    </label>
                  ))}
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBlockEnd: 14 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}><L en="Note to the operator, sent as written (required for a request)" ar="ملاحظة إلى المشغّل، تُرسل كما هي (مطلوبة للطلب)" /></span>
                  <textarea name="note" rows={3} style={{ padding: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, lineHeight: 1.6, resize: 'vertical' }} />
                </label>
                <button type="submit" data-act="outcome" style={{ minHeight: 44, paddingInline: 20, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  <L en="Record the outcome" ar="تسجيل النتيجة" />
                </button>
              </form>
            </div>
          ) : null}

          <div style={panel}>
            <div data-region="limits" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              <L en="These are operational site statuses, not event determinations. A third-party document is supporting evidence only; it does not itself establish MOPH acceptance." ar="هذه حالات تشغيلية للموقع، لا قرارات فعاليات. والمستند الصادر عن جهة ثالثة دليل داعم فقط؛ ولا يُثبت بحد ذاته قبول وزارة الصحة العامة." />
            </div>
          </div>

          {mayAct && acts.record ? (
            <>
              <details data-region="corrective-panel" style={{ ...panel, padding: '14px 22px' }}>
                <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}><L en="Raise a corrective action" ar="إثارة إجراء تصحيحي" /></summary>
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
              <details data-region="inspection-panel" style={{ ...panel, padding: '14px 22px' }}>
                <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}><L en="Record an inspection" ar="تسجيل تفتيش" /></summary>
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
            <form action={recordSiteDesignationAction.bind(null, id)} data-region="designation-form" style={{ ...panel, display: 'grid', gap: 10 }}>
              <h2 style={{ ...h2, margin: 0 }}><L en="Designation" ar="التحديد" /></h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}><L en="This category applies only once the Ministry records the designation. The applicant cannot designate itself." ar="لا تنطبق هذه الفئة إلا عندما تسجّل الوزارة التحديد. ولا يستطيع مقدّم الطلب تحديد نفسه." /></p>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en="Basis for the designation" ar="أساس التحديد" /></span>
                <input name="note" style={input} />
              </label>
              <button type="submit" data-act="designate" style={{ ...button, justifySelf: 'start' }}><L en="Record the designation for this category" ar="تسجيل التحديد لهذه الفئة" /></button>
            </form>
          ) : null}

          <h2 style={h2}><L en="Decision history" ar="سجل القرارات" /></h2>
          <div data-region="determinations" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {decisions.map((d) => (
              <div key={d.id} data-decision={d.kind} style={{ paddingBlock: '15px', paddingInlineStart: '18px', paddingInlineEnd: '19px', background: 'var(--surface2)', borderInlineStart: `3px solid ${d.kind === 'accepted' ? 'var(--brand)' : 'var(--accent)'}`, borderRadius: 10 }}>
                <div style={{ fontSize: '14.5px', lineHeight: 1.5 }}><L {...reviewActLabel(d.kind)} /></div>
                <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, fontVariantNumeric: 'tabular-nums' }}>{d.at} · {d.actor}{d.version ? ` · v${d.version}` : ''}</div>
                {d.note ? <div style={{ fontSize: '13px', color: 'var(--muted)', marginBlockStart: 6, lineHeight: 1.6 }}>{d.note}</div> : null}
              </div>
            ))}
            {decisions.length === 0 ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en="No decision has been recorded yet." ar="لم يُسجَّل قرار بعد." />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </MinistryShell>
  );
}

/**
 * CHANGES THE OPERATOR ASKED TO MAKE while the registration was with the Ministry (owner,
 * 10 October 2026). Open ones lead the decision column with the two answers: reopen the
 * registration for the change -- the same act as a correction request -- or answer without
 * reopening. Answered ones stay listed with what was decided.
 */
function ChangeRequests({ id, mayAct, mayReopen }: { id: string; mayAct: boolean; mayReopen: boolean }) {
  const requests = siteChangeRequests(id);
  if (!requests.length) return null;
  const aspectByKey = Object.fromEntries(SITE_CHANGE_ASPECTS.map((a) => [a.key, a]));
  return (
    <div id="change-requests" data-region="ministry-change-requests" style={{ ...panel, border: requests.some((r) => r.status === 'open') ? '1px solid var(--accent-ink)' : undefined, scrollMarginBlockStart: 16 }}>
      <h2 style={{ ...h2, margin: '0 0 12px' }}><L en="Changes the operator asked to make" ar="التغييرات التي طلب المشغّل إجراءها" /></h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {requests.map((r) => (
          <div key={r.id} data-change-request={r.id} data-status={r.status} style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 10, fontSize: 14, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 500 }}>{r.aspects.map((k, i) => <span key={k}>{i > 0 ? ' · ' : ''}<L en={aspectByKey[k]!.en} ar={aspectByKey[k]!.ar} /></span>)}</div>
            <div>{r.description}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{r.requestedAt}</div>
            {r.status !== 'open' ? (
              <div style={{ marginBlockStart: 6, fontSize: 13, color: 'var(--muted)' }}>
                {r.status === 'reopened' ? <L en="Reopened for the change" ar="أُعيد فتحه لإجراء التغيير" /> : <L en="Answered" ar="أُجيب عنه" />}
                {` · ${r.answeredAt ?? ''} · ${r.answeredBy}`}{r.answer ? ` — ${r.answer}` : ''}
              </div>
            ) : mayAct ? (
              <div style={{ display: 'grid', gap: 10, marginBlockStart: 10 }}>
                {mayReopen ? (
                  <form action={reopenSiteForChangeAction.bind(null, id, r.id)} style={{ display: 'grid', gap: 8 }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}><L en="Note to the operator (optional)" ar="ملاحظة إلى المشغّل (اختيارية)" /></span>
                      <input name="note" style={input} />
                    </label>
                    <button type="submit" data-act="reopen-for-change" style={{ ...button, background: 'var(--brand)', color: 'var(--bg)', border: 0 }}>
                      <L en="Reopen the registration for this change" ar="إعادة فتح التسجيل لإجراء هذا التغيير" />
                    </button>
                  </form>
                ) : null}
                <form action={answerSiteChangeAction.bind(null, id, r.id)} style={{ display: 'grid', gap: 8 }}>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}><L en="Or answer without reopening, for example: make the change once the review is complete" ar="أو أجيبوا من دون إعادة الفتح، مثلاً: أجروا التغيير بعد اكتمال المراجعة" /></span>
                    <textarea name="answer" rows={2} required style={{ ...input, minHeight: 64, lineHeight: 1.5 }} />
                  </label>
                  <button type="submit" data-act="answer-change" style={button}><L en="Answer without reopening" ar="الإجابة من دون إعادة الفتح" /></button>
                </form>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
