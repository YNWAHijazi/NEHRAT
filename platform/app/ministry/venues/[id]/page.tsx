import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MinistryShell } from '../../../../components/MinistryShell';
import { RecordHeader } from '../../../../components/RecordHeader';
import { SectionHeading } from '../../../../components/SectionHeading';
import { L } from '../../../../components/L';
import { chip, alertBand, fieldInput } from '../../../../components/workspace-styles';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { getDb } from '../../../../lib/db';
import { can } from '../../../../lib/rules';
import { DOMAINS } from '../../../../lib/rules/load';
import { venueTypeLabel } from '../../../../lib/rules/venue-intake';
import { VENUE_STATUS, venueStatusForDecision, type VenueAnswers, type VenueRequirement } from '../../../../lib/rules/venue-workflow';
import { venuePackageFor } from '../../../../lib/venue/workspace';
import { reviewVenuePackageAction } from '../../../venues/actions';

type Decision = 'satisfied' | 'revision' | 'incomplete';
const stamp = (s: string | null | undefined) => (s ? s.slice(0, 16) : '—');

/** One submitted venue package, as the reviewer reads it: who, what, the answers, then the decision. */
export default async function MinistryVenueFile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ revision?: string; error?: string; recorded?: string }> }) {
  const account = await requireMinistryPage('viewSubmission');
  const { id } = await params;
  const q = await searchParams;
  const db = getDb();
  const owner = db.prepare('SELECT account_id, is_demo FROM venues WHERE id = ?').get(id) as { account_id: number; is_demo: number } | undefined;
  if (!owner || owner.is_demo !== +account.isDemo) notFound();
  const w = venuePackageFor(owner.account_id, id)!;
  const history = db
    .prepare('SELECT revision, submitted_at, decision, review_note, reviewed_at, snapshot FROM venue_package_history WHERE venue_id = ? ORDER BY revision DESC')
    .all(id) as unknown as { revision: number; submitted_at: string; decision: Decision | null; review_note: string; reviewed_at: string | null; snapshot: string }[];
  const record = q.revision ? history.find((h) => String(h.revision) === q.revision) : history[0];
  if (!record) notFound();
  const s = JSON.parse(record.snapshot) as {
    venue: typeof w.venue; district: string; point: { lat: number; lng: number } | null; level: number;
    requirements: (VenueRequirement & { receipts?: { display_name: string; completed_at: string }[] })[];
    answers: VenueAnswers; assessmentVersion: number; approval?: { display_name: string; approved_at: string };
  };
  const assessment = db.prepare('SELECT answers FROM venue_assessments WHERE venue_id = ? AND version = ?').get(id, s.assessmentVersion) as { answers: string } | undefined;
  const assessmentAnswers = assessment ? (JSON.parse(assessment.answers) as (number | null)[]) : [];
  const files = db
    .prepare('SELECT f.doc_key, f.file_name FROM venue_package_files f JOIN venue_package_history h ON h.id = f.package_id WHERE h.venue_id = ? AND h.revision = ?')
    .all(id, record.revision) as unknown as { doc_key: string; file_name: string }[];
  const outcome = record.decision ? VENUE_STATUS[venueStatusForDecision(record.decision)] : null;
  const canDecide = w.status === 'submitted' && record.revision === w.revision && can(account.role, 'recordOutcome');
  const type = venueTypeLabel(s.venue.category);
  const glance: { en: string; ar: string; value: React.ReactNode }[] = [
    { en: 'Venue type', ar: 'نوع الموقع', value: <L en={type.en} ar={type.ar} /> },
    { en: 'Approved or licensed capacity', ar: 'السعة المعتمدة أو المرخّصة', value: s.venue.licensedCapacity },
    { en: 'District', ar: 'القضاء', value: s.district || '—' },
    { en: 'Address', ar: 'العنوان', value: <L en={s.venue.addressMunicipalityEn} ar={s.venue.addressMunicipalityAr || s.venue.addressMunicipalityEn} /> },
    { en: 'Responsible person', ar: 'الشخص المسؤول', value: <bdi>{s.venue.responsibleName || s.venue.responsibleContact}</bdi> },
    { en: 'Phone number', ar: 'رقم الهاتف', value: <bdi>{s.venue.responsiblePhone || '—'}</bdi> },
  ];

  return (
    <MinistryShell account={account}>
      <Link href="/ministry/venues" style={{ fontSize: 14 }}><L en="Hosting venues" ar="مواقع الاستضافة" /></Link>
      <div style={{ marginBlockStart: 18 }}>
        <RecordHeader
          facts={[
            { en: 'Record ID', ar: 'معرّف السجل', value: id, strong: true },
            { en: 'Submission', ar: 'الطلب', value: `${record.revision} · ${stamp(record.submitted_at)}` },
            { en: 'Status', ar: 'الحالة', value: <L en={outcome?.en ?? VENUE_STATUS.submitted.en} ar={outcome?.ar ?? VENUE_STATUS.submitted.ar} /> },
          ]}
          nameEn={s.venue.nameEn}
          nameAr={s.venue.nameAr}
          stats={[{ en: 'Level', ar: 'المستوى', value: s.level ?? '—', valueStyle: { color: s.level ? `var(--l${s.level})` : 'var(--muted)' } }]}
        />
      </div>

      {q.recorded && outcome ? (
        <div role="status" data-region="outcome-recorded" style={{ padding: '16px 22px', background: 'var(--brand-soft)', border: '1px solid var(--brand)', borderRadius: 12, marginBlockEnd: 24 }}>
          <L en={`Outcome recorded: ${outcome.en}. The operator has been notified.`} ar={`سُجّلت النتيجة: ${outcome.ar}. أُبلغت الجهة المشغّلة.`} />
        </div>
      ) : null}
      {q.error ? (
        <div role="alert" style={alertBand}>
          <L en="Add a reason when the outcome is not satisfied. If another reviewer has already acted, reload the file." ar="أضيفوا سبباً عندما لا تكون النتيجة مستوفاة. إذا سبقتكم مراجعة أخرى، أعيدوا تحميل الملف." />
        </div>
      ) : null}
      {outcome && !q.recorded ? (
        <div data-region="determination-card" style={{ paddingBlock: '20px', paddingInlineStart: '24px', paddingInlineEnd: '24px', background: 'var(--surface2)', borderInlineStart: `3px solid ${record.decision === 'satisfied' ? 'var(--brand)' : 'var(--accent)'}`, borderRadius: 12, marginBlockEnd: 28 }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 6 }}><L en="Ministry outcome" ar="نتيجة الوزارة" /></div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBlockEnd: record.review_note ? 8 : 0 }}><L en={outcome.en} ar={outcome.ar} /></div>
          {record.review_note ? <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{record.review_note}</p> : null}
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockStart: 6, fontVariantNumeric: 'tabular-nums' }}>{stamp(record.reviewed_at)}</div>
        </div>
      ) : null}

      <section data-region="venue-review-summary" style={{ marginBlockEnd: 40 }}>
        <SectionHeading n={1} en="Venue at a glance" ar="ملخّص الموقع" />
        <dl style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', margin: 0 }}>
          {glance.map((g) => (
            <div key={g.en} style={{ background: 'var(--bg)', padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
              <dt style={{ flex: '0 0 220px', fontSize: 13, color: 'var(--muted)' }}><L en={g.en} ar={g.ar} /></dt>
              <dd style={{ flex: '1 1 220px', margin: 0, fontSize: '14.5px', overflowWrap: 'anywhere' }}>{g.value}</dd>
            </div>
          ))}
        </dl>
        {s.point ? (
          <p style={{ margin: '12px 0 0' }}>
            <a target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${s.point.lat}&mlon=${s.point.lng}#map=17/${s.point.lat}/${s.point.lng}`}><L en="View map pin" ar="عرض الموقع على الخريطة" /></a>
          </p>
        ) : null}
      </section>

      <section style={{ marginBlockEnd: 40 }}>
        <SectionHeading n={2} en="Submitted requirements" ar="المتطلبات المقدّمة" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {s.requirements.map((r) => {
            const rowFiles = files.filter((f) => f.doc_key === String(r.n) || (r.n === 20 && f.doc_key.startsWith('20-')));
            const showValue = r.valueEn && !['Required', 'Optional', 'Recommended'].includes(r.valueEn);
            return (
              <section key={r.n} style={{ paddingBlock: '16px', paddingInline: '22px 23px', background: 'var(--surface2)', borderInlineStart: `3px solid ${r.done ? 'var(--brand)' : r.optional ? 'var(--line)' : 'var(--accent-ink)'}`, borderRadius: 12 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 16, lineHeight: 1.45 }}><L en={r.en} ar={r.ar} /></span>
                  <span style={chip(r.done ? 'done' : r.optional ? 'muted' : 'pending')}>
                    <L en={r.done ? 'Provided' : r.optional ? 'Optional' : 'Not provided'} ar={r.done ? 'مقدّم' : r.optional ? 'اختياري' : 'غير مقدّم'} />
                  </span>
                </div>
                {showValue ? <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockStart: 4 }}><L en={r.valueEn} ar={r.valueAr} /></div> : null}
                <dl style={{ display: 'grid', gap: 10, margin: '12px 0 0' }}>
                  {r.fields.map((f) => (
                    <div key={f.key}>
                      <dt style={{ fontSize: 12.5, color: 'var(--muted)' }}><L en={f.en} ar={f.ar} /></dt>
                      <dd style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{s.answers[String(r.n)]?.[f.key] || '—'}</dd>
                    </div>
                  ))}
                </dl>
                {(r.receipts ?? []).map((c, index) => (
                  <p key={`${r.n}-${index}`} style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    <L en="Completed by" ar="أكمله" /> <bdi>{c.display_name}</bdi> · {stamp(c.completed_at)}
                  </p>
                ))}
                {r.n === 2 && s.approval ? (
                  <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                    <L en="Medical Director sign-off" ar="اعتمدها المدير الطبي" />: <bdi>{s.approval.display_name}</bdi> · {stamp(s.approval.approved_at)}
                  </p>
                ) : null}
                {rowFiles.map((f) => (
                  <p key={f.doc_key} style={{ margin: '10px 0 0' }}>
                    <a href={`/api/venue-documents/${id}/${f.doc_key}?revision=${record.revision}`} target="_blank" rel="noreferrer"><L en="Open document" ar="فتح المستند" /> · {f.file_name}</a>
                  </p>
                ))}
              </section>
            );
          })}
        </div>
      </section>

      {assessment ? (
        <details className="record-details" style={{ marginBlockEnd: 40 }}>
          <summary><L en="Assessment answers" ar="إجابات التقييم" /></summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            {DOMAINS.map((d, i) => {
              const option = d.options.find((o) => o.score === assessmentAnswers[i]);
              return (
                <div key={i} style={{ background: 'var(--bg)', padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
                  <span style={{ flex: '1 1 260px' }}><span style={{ color: 'var(--muted)', marginInlineEnd: 10 }}>{i + 1}</span><L en={d.en} ar={d.ar} /></span>
                  <span style={{ flex: '1 1 220px', color: 'var(--muted)' }}><L en={option?.en ?? '—'} ar={option?.ar ?? '—'} /></span>
                  <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{assessmentAnswers[i] ?? '—'}</span>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

      {canDecide ? (
        <form action={reviewVenuePackageAction.bind(null, id)} data-region="outcome" style={{ padding: 25, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 40 }}>
          <SectionHeading n={3} en="Record the outcome" ar="تسجيل النتيجة" />
          <input name="revision" type="hidden" value={record.revision} />
          <label style={{ display: 'grid', gap: 6, marginBlockEnd: 18 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en="Notes for the operator (required unless satisfied)" ar="ملاحظات للجهة المشغّلة (مطلوبة إلا عند الاستيفاء)" /></span>
            <textarea name="note" rows={4} style={{ ...fieldInput, minHeight: 96 }} />
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { key: 'satisfied', en: 'Requirements satisfied', ar: 'المتطلبات مستوفاة' },
              { key: 'revision', en: 'Request changes', ar: 'طلب تعديلات' },
              { key: 'incomplete', en: 'Incomplete', ar: 'غير مكتمل' },
            ].map((d) => (
              <button key={d.key} name="decision" value={d.key} style={{ height: 44, paddingInline: 20, border: d.key === 'satisfied' ? 0 : '1px solid var(--line)', borderRadius: 22, background: d.key === 'satisfied' ? 'var(--brand)' : 'var(--bg)', color: d.key === 'satisfied' ? 'var(--bg)' : 'var(--ink)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}>
                <L en={d.en} ar={d.ar} />
              </button>
            ))}
          </div>
        </form>
      ) : null}

      <details data-region="history" className="record-details" open={history.length > 1}>
        <summary><L en="Submission history" ar="سجل الطلبات" /></summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          {history.map((h) => {
            const o = h.decision ? VENUE_STATUS[venueStatusForDecision(h.decision)] : VENUE_STATUS.submitted;
            return (
              <Link key={h.revision} href={`/ministry/venues/${id}?revision=${h.revision}`} style={{ background: 'var(--bg)', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', color: 'var(--ink)' }}>
                <span><L en={`Submission ${h.revision}`} ar={`الطلب ${h.revision}`} /> · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{stamp(h.submitted_at)}</span></span>
                <span style={{ color: 'var(--muted)' }}><L en={o.en} ar={o.ar} /></span>
              </Link>
            );
          })}
        </div>
      </details>
    </MinistryShell>
  );
}
