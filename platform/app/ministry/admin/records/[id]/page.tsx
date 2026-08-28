import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminTabs } from '../../../../../components/AdminTabs';
import { DocumentViewer } from '../../../../../components/DocumentViewer';
import { L } from '../../../../../components/L';
import { MinistryShell } from '../../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../../lib/ministry-auth';
import {
  assessmentAnswersForReview,
  attachmentsForReview,
  determinationsFor,
  derivationForReview,
  complianceForReview,
  notificationsForEvent,
  planForReview,
  sharedDocumentsForReview,
  submissionForReview,
} from '../../../../../lib/queries';
import {
  DOMAINS,
  MAJOR_INCIDENT_ITEMS,
  MINISTRY_CONTENT,
  PLAN_SECTIONS,
  PLAN_DOC_KEY,
  bilingualMap,
  catalogueEntry,
  humanSize,
} from '../../../../../lib/rules';

/**
 * THE COMPLETE FILE — everything submitted on one record, in one place.
 *
 * Not a summary and not a link farm. Every assessment answer, every attachment
 * readable in place, every declaration, the plan, the counterparty lane, the full
 * determination history and every notification the platform sent. The reviewer's
 * screen shows what a reviewer needs to decide; this shows what was submitted, which
 * is a different and larger thing, and it was previously spread across five surfaces
 * belonging to three roles.
 *
 * NOTHING SUMMARISED, NOTHING BEHIND ANOTHER ROLE'S SCREEN. That is the instruction
 * and it is also the point: an overseeing profile that has to sign in as somebody
 * else to see something is not overseeing.
 */
export default async function AdminRecordFilePage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireMinistryPage('viewRegistry');
  const { id } = await params;
  const review = submissionForReview(account.isDemo, id);
  if (!review) notFound();

  const derivation = derivationForReview(id);
  const assessment = assessmentAnswersForReview(id);
  const attachments = attachmentsForReview(id);
  const counterparty = sharedDocumentsForReview(id);
  const plan = planForReview(id);
  const determinations = determinationsFor(id);
  const submission = complianceForReview(id, (review.level ?? 1) as 1 | 2 | 3);
  const notifications = notificationsForEvent(id);
  const A = MINISTRY_CONTENT.adminConsole;
  const AA = MINISTRY_CONTENT.assessmentAnswers;
  const outcomes = MINISTRY_CONTENT.outcomes;

  const h2: React.CSSProperties = { margin: '32px 0 12px', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em' };
  const listBox: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)',
    borderRadius: 10, overflow: 'hidden',
  };
  const rowBox: React.CSSProperties = { background: 'var(--bg)', padding: '12px 16px' };

  return (
    <MinistryShell
      account={account}
      back={{ href: '/ministry/admin/records', en: 'Records', ar: 'السجلات' }}
      consoleEn="Master administration"
      consoleAr="الإدارة العامة"
    >
      <AdminTabs current="/ministry/admin/records" />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 8 }}>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
          {review.orgEn} · {review.mophReference ?? id}
          {review.filedAt ? ` · filed ${review.filedAt}` : ''}
        </div>
        <Link
          href={`/ministry/admin/records/${id}/report`}
          style={{ height: 36, paddingInline: 16, border: '1px solid var(--line)', borderRadius: 18, fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}
        >
          <L en={A.printFileEn} ar={A.printFileAr} />
        </Link>
      </div>
      <h1 data-sec-h1="" style={{ margin: '0 0 24px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en={review.nameEn} ar={review.nameAr} />
      </h1>

      {/* HOW THE LEVEL WAS DETERMINED — both results and which governed. */}
      <div data-region="file-derivation" style={{ padding: '18px 22px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 8 }}>
        {derivation && derivation.complete ? (
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: '13.5px' }}>
            <span>
              <L en="Assessment score" ar="نتيجة التقييم" />: {derivation.scoreTotal} / 18
            </span>
            <span>
              <L en="Minimum conditions" ar="الحد الأدنى للشروط" />:{' '}
              {derivation.minimumConditionLevel ?? '—'}
            </span>
            <span style={{ fontWeight: 600, color: `var(--l${derivation.finalLevel})` }}>
              <L en="Final level" ar="المستوى النهائي" />: {derivation.finalLevel}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en="No stored assessment answers on this record." ar="لا إجابات تقييم مخزنة على هذا السجل." />
          </div>
        )}
      </div>

      {/* EVERY ASSESSMENT ANSWER. */}
      <h2 style={h2}>
        <L en={AA.titleEn} ar={AA.titleAr} />
      </h2>
      <div data-region="file-answers" style={listBox}>
        {!assessment ? (
          <div style={{ ...rowBox, color: 'var(--muted)', fontSize: '13.5px' }}>
            <L en={AA.noneEn} ar={AA.noneAr} />
          </div>
        ) : (
          DOMAINS.map((d, i) => {
            const score = assessment.answers[i];
            const chosen = typeof score === 'number' ? d.options.find((o) => o.score === score) : undefined;
            return (
              <div key={d.number} style={rowBox}>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13.5px' }}>
                    {d.number}. <L en={d.en} ar={d.ar} />
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {typeof score === 'number' ? `${score} / 2` : <L en={AA.unsetEn} ar={AA.unsetAr} />}
                  </span>
                </div>
                {chosen ? (
                  <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, lineHeight: 1.6 }}>
                    <L en={chosen.en} ar={chosen.ar} />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* EVERY DECLARATION, as ticked. */}
      <h2 style={h2}>
        <L en="Compliance declarations" ar="إقرارات الامتثال" />
      </h2>
      <div data-region="file-declarations" style={listBox}>
        {!submission ? (
          <div style={{ ...rowBox, color: 'var(--muted)', fontSize: '13.5px' }}>
            <L en="No compliance form on this record." ar="لا نموذج امتثال على هذا السجل." />
          </div>
        ) : (
          <>
            {submission.declarations.map((d) => (
              <div key={d.en} style={{ ...rowBox, display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13.5px', flex: 1, minWidth: 240 }}>
                  <L en={d.en} ar={d.ar} />
                </span>
                <span style={{ fontSize: 12, color: d.declared ? 'var(--brand)' : 'var(--muted)' }}>
                  {d.declared ? <L en="Declared" ar="مُقَرّ به" /> : <L en="Not declared" ar="غير مُقَرّ به" />}
                </span>
              </div>
            ))}
            <div style={{ ...rowBox, fontSize: '12.5px', color: 'var(--muted)' }}>
              <L en="Certified by" ar="صدّق عليه" />: {submission.representative || '—'} · {submission.position || '—'} · {submission.telephone || '—'}
            </div>
          </>
        )}
      </div>

      {/* EVERY ATTACHMENT, READABLE IN PLACE. */}
      <h2 style={h2}>
        <L en="Attached documents" ar="المستندات المرفقة" />
      </h2>
      <div data-region="file-attachments" style={listBox}>
        {attachments.length === 0 ? (
          <div style={{ ...rowBox, color: 'var(--muted)', fontSize: '13.5px' }}>
            <L en="Nothing attached." ar="لا مرفقات." />
          </div>
        ) : null}
        {attachments.map((a) => {
          const doc = catalogueEntry(a.docKey);
          return (
            <div key={a.docKey} style={rowBox}>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13.5px' }}>{doc ? <L en={doc.en} ar={doc.ar} /> : a.docKey}</span>
                <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {a.fileName} · {a.attachedAt}
                  {a.hasFile && a.byteSize !== null ? ` · ${humanSize(a.byteSize)}` : ''}
                </span>
              </div>
              <DocumentViewer
                href={`/api/documents/${id}/${encodeURIComponent(a.docKey)}`}
                hasFile={a.hasFile}
                contentType={a.contentType}
                label={doc ? doc.en : a.docKey}
              />
            </div>
          );
        })}
      </div>

      {/* THE COUNTERPARTY LANE. */}
      <h2 style={h2}>
        <L en={MINISTRY_CONTENT.counterpartyDocuments.titleEn} ar={MINISTRY_CONTENT.counterpartyDocuments.titleAr} />
      </h2>
      <div data-region="file-counterparty" style={listBox}>
        {counterparty.length === 0 ? (
          <div style={{ ...rowBox, color: 'var(--muted)', fontSize: '13.5px' }}>
            <L
              en={MINISTRY_CONTENT.counterpartyDocuments.noneEn}
              ar={MINISTRY_CONTENT.counterpartyDocuments.noneAr}
            />
          </div>
        ) : null}
        {counterparty.map((c) => {
          const state = bilingualMap(MINISTRY_CONTENT.counterpartyDocuments.states)[c.source];
          return (
            <div key={c.id} style={rowBox}>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13.5px' }}>
                  <L en={c.nameEn} ar={c.nameAr} />
                  <span style={{ color: 'var(--muted)' }}> · <L en={c.partyEn} ar={c.partyAr} /></span>
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  <L en={state?.en ?? c.source} ar={state?.ar ?? c.source} />
                </span>
              </div>
              {c.fileName ? (
                <DocumentViewer
                  href={`/api/shared-documents/${c.id}`}
                  hasFile={c.hasFile}
                  contentType={c.contentType}
                  label={c.nameEn}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* THE PLAN, in full. */}
      <h2 style={h2}>
        <L en="Event health and medical plan" ar="خطة التأهب الصحي والطبي للفعالية" />
      </h2>
      <div data-region="file-plan" style={listBox}>
        {!plan ? (
          <div style={{ ...rowBox, color: 'var(--muted)', fontSize: '13.5px' }}>
            <L en="No plan on this record." ar="لا خطة على هذا السجل." />
          </div>
        ) : (
          <>
            {PLAN_SECTIONS.map((sec) => {
              const stored = plan.sections[String(sec.n)];
              const text = (stored?.text ?? '').trim();
              return (
                <div key={sec.n} style={rowBox}>
                  <div style={{ fontSize: '13.5px' }}>
                    {sec.n}. <L en={sec.en} ar={sec.ar} />
                  </div>
                  {text !== '' ? (
                    <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{text}</div>
                  ) : null}
                </div>
              );
            })}
            {MAJOR_INCIDENT_ITEMS.map((mi) => (
              <div key={`mi-${mi.n}`} style={{ ...rowBox, display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px' }}>
                  <L en={`Major incident ${mi.n}. ${mi.en}`} ar={`حادث جسيم ${mi.n}. ${mi.ar}`} />
                </span>
                <span style={{ fontSize: 12, color: plan.majorIncident[String(mi.n)]?.covered ? 'var(--brand)' : 'var(--muted)' }}>
                  {plan.majorIncident[String(mi.n)]?.covered ? (
                    <L en="Addressed" ar="مُعالَج" />
                  ) : (
                    <L en="Not addressed" ar="غير مُعالَج" />
                  )}
                </span>
              </div>
            ))}
            {plan.attachedFile ? (
              <div style={rowBox}>
                <div style={{ fontSize: '13px' }}>{plan.attachedFile}</div>
                <DocumentViewer
                  href={`/api/documents/${id}/${PLAN_DOC_KEY}`}
                  hasFile={plan.attachedHasFile}
                  contentType={null}
                  label="the attached plan"
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* THE FULL DETERMINATION HISTORY. */}
      <h2 style={h2}>
        <L en="Determination history" ar="سجل النتائج" />
      </h2>
      <div data-region="file-determinations" style={listBox}>
        {determinations.length === 0 ? (
          <div style={{ ...rowBox, color: 'var(--muted)', fontSize: '13.5px' }}>
            <L en="No determination has been recorded." ar="لم تُسجَّل أي نتيجة." />
          </div>
        ) : null}
        {determinations.map((d) => (
          <div key={d.id} style={rowBox}>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px' }}>
                <L
                  en={outcomes.find((o) => o.key === d.outcome)?.en ?? d.outcome}
                  ar={outcomes.find((o) => o.key === d.outcome)?.ar ?? d.outcome}
                />
              </span>
              <span style={{ fontSize: 12, color: d.superseded ? 'var(--muted)' : 'var(--brand)' }}>
                {d.superseded ? (
                  <L en={MINISTRY_CONTENT.determination.supersededChipEn} ar={MINISTRY_CONTENT.determination.supersededChipAr} />
                ) : (
                  <L en={MINISTRY_CONTENT.determination.standsChipEn} ar={MINISTRY_CONTENT.determination.standsChipAr} />
                )}
              </span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3, fontVariantNumeric: 'tabular-nums' }}>
              {d.recordedAt} · {d.recordedBy}
            </div>
            {d.note ? <div style={{ fontSize: '12.5px', marginBlockStart: 4, lineHeight: 1.6 }}>{d.note}</div> : null}
            {d.revisionReason ? (
              <div style={{ fontSize: '12.5px', marginBlockStart: 4, lineHeight: 1.6 }}>
                <L en="Reason for the revision" ar="سبب التعديل" />: {d.revisionReason}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* EVERY NOTIFICATION SENT. What the organizer was actually told, and when. */}
      <h2 style={h2}>
        <L en="Notifications sent" ar="الإشعارات المُرسلة" />
      </h2>
      <div data-region="file-notifications" style={{ ...listBox, marginBlockEnd: 40 }}>
        {notifications.length === 0 ? (
          <div style={{ ...rowBox, color: 'var(--muted)', fontSize: '13.5px' }}>
            <L en="Nothing has been sent on this record." ar="لم يُرسل شيء على هذا السجل." />
          </div>
        ) : null}
        {notifications.map((n) => (
          <div key={n.id} style={rowBox}>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px' }}>
                <L en={n.titleEn} ar={n.titleAr} />
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{n.createdAt}</span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, lineHeight: 1.65 }}>
              <L en={n.bodyEn} ar={n.bodyAr} />
            </div>
          </div>
        ))}
      </div>
    </MinistryShell>
  );
}
