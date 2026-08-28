import { notFound } from 'next/navigation';
import { GovernmentBand } from '../../../../../../components/Header';
import { L } from '../../../../../../components/L';
import { PrintButton } from '../../../../../../components/PrintButton';
import { requireMinistryPage } from '../../../../../../lib/ministry-auth';
import {
  assessmentAnswersForReview,
  attachmentsForReview,
  complianceForReview,
  determinationsFor,
  derivationForReview,
  planForReview,
  sharedDocumentsForReview,
  submissionForReview,
} from '../../../../../../lib/queries';
import {
  DOMAINS,
  MAJOR_INCIDENT_ITEMS,
  MINISTRY_CONTENT,
  PLAN_SECTIONS,
  catalogueEntry,
} from '../../../../../../lib/rules';

/**
 * THE WHOLE FILE AS ONE DOCUMENT.
 *
 * Everything submitted on one record, laid out to be read on paper: no navigation, no
 * controls, no colour a monochrome printer turns to wash. What the Ministry needs when
 * a submission has to leave the platform — for a file, for a meeting, for an authority
 * that does not have an account here.
 *
 * IT IS NOT THE CERTIFICATE. The certificate states the determination and its limits
 * on one page and is the organizer's to hand on. This is the whole submission, and it
 * is the Ministry's. Two documents because they answer to two different readers, and
 * merging them would give the organizer a document carrying the Ministry's internal
 * reading of their file.
 *
 * ATTACHMENTS ARE LISTED, NOT EMBEDDED. A route map is a page of its own; naming it
 * with its date and size is what a paper file can honestly carry, and the reader opens
 * the record itself to read one.
 */
export default async function AdminRecordReportPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireMinistryPage('viewRegistry');
  const { id } = await params;
  const review = submissionForReview(account.isDemo, id);
  if (!review) notFound();

  const level = (review.level ?? 1) as 1 | 2 | 3;
  const derivation = derivationForReview(id);
  const assessment = assessmentAnswersForReview(id);
  const compliance = complianceForReview(id, level);
  const attachments = attachmentsForReview(id);
  const counterparty = sharedDocumentsForReview(id);
  const plan = planForReview(id);
  const determinations = determinationsFor(id);
  const outcomes = MINISTRY_CONTENT.outcomes;

  const h2: React.CSSProperties = { margin: '26px 0 8px', fontSize: 16, fontWeight: 600, borderBlockEnd: '1px solid var(--line)', paddingBlockEnd: 4 };
  const line: React.CSSProperties = { fontSize: '12.5px', lineHeight: 1.65, paddingBlock: 3 };

  return (
    <>
      <GovernmentBand />
      <main data-pad="" data-region="certificate" style={{ maxWidth: 860, marginInline: 'auto', padding: '40px 32px 100px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBlockEnd: 4 }}>
          {review.orgEn} · {review.mophReference ?? id}
          {review.filedAt ? ` · filed ${review.filedAt}` : ''}
        </div>
        <h1 data-sec-h1="" style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 600, letterSpacing: '-.03em' }}>
          <L en={review.nameEn} ar={review.nameAr} />
        </h1>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBlockEnd: 8 }}>
          <L en={`Level ${level}`} ar={`المستوى ${level}`} />
          {derivation && derivation.complete ? (
            <span>
              {' · '}
              <L
                en={`score ${derivation.scoreTotal}/18, minimum conditions ${derivation.minimumConditionLevel ?? '—'}, governed by ${derivation.governedBy === 'score' ? 'the assessment score' : 'a minimum condition'}`}
                ar={`النتيجة ⁦${derivation.scoreTotal}/18⁩، شروط الحد الأدنى ⁦${derivation.minimumConditionLevel ?? '—'}⁩`}
              />
            </span>
          ) : null}
        </div>

        <h2 style={h2}>
          <L en="Assessment answers" ar="إجابات التقييم" />
        </h2>
        {!assessment ? (
          <div style={line}>
            <L en="No stored assessment answers." ar="لا إجابات تقييم مخزنة." />
          </div>
        ) : (
          DOMAINS.map((d, i) => {
            const score = assessment.answers[i];
            const chosen = typeof score === 'number' ? d.options.find((o) => o.score === score) : undefined;
            return (
              <div key={d.number} style={line}>
                <strong>{d.number}.</strong> <L en={d.en} ar={d.ar} /> — {typeof score === 'number' ? `${score}/2` : '—'}
                {chosen ? (
                  <span style={{ color: 'var(--muted)' }}>
                    {' · '}
                    <L en={chosen.en} ar={chosen.ar} />
                  </span>
                ) : null}
              </div>
            );
          })
        )}

        <h2 style={h2}>
          <L en="Compliance declarations" ar="إقرارات الامتثال" />
        </h2>
        {!compliance ? (
          <div style={line}>
            <L en="No compliance form." ar="لا نموذج امتثال." />
          </div>
        ) : (
          <>
            {compliance.declarations.map((d) => (
              <div key={d.en} style={line}>
                {d.declared ? '☑' : '☐'} <L en={d.en} ar={d.ar} />
              </div>
            ))}
            <div style={{ ...line, marginBlockStart: 6 }}>
              <L en="Certified by" ar="صدّق عليه" />: {compliance.representative || '—'} · {compliance.position || '—'} · {compliance.telephone || '—'}
            </div>
          </>
        )}

        <h2 style={h2}>
          <L en="Attached documents" ar="المستندات المرفقة" />
        </h2>
        {attachments.length === 0 ? (
          <div style={line}>
            <L en="Nothing attached." ar="لا مرفقات." />
          </div>
        ) : (
          attachments.map((a) => {
            const doc = catalogueEntry(a.docKey);
            return (
              <div key={a.docKey} style={line}>
                <L en={doc?.en ?? a.docKey} ar={doc?.ar ?? a.docKey} /> — {a.fileName} · {a.attachedAt}
              </div>
            );
          })
        )}

        <h2 style={h2}>
          <L en="Counterparty documents" ar="مستندات الأطراف المُسمّاة" />
        </h2>
        {counterparty.length === 0 ? (
          <div style={line}>
            <L en="None." ar="لا شيء." />
          </div>
        ) : (
          counterparty.map((c) => (
            <div key={c.id} style={line}>
              <L en={c.nameEn} ar={c.nameAr} /> — <L en={c.partyEn} ar={c.partyAr} /> · {c.fileName ?? '—'}
            </div>
          ))
        )}

        <h2 style={h2}>
          <L en="Event health and medical plan" ar="خطة التأهب الصحي والطبي للفعالية" />
        </h2>
        {!plan ? (
          <div style={line}>
            <L en="No plan." ar="لا خطة." />
          </div>
        ) : (
          <>
            {PLAN_SECTIONS.map((sec) => {
              const text = (plan.sections[String(sec.n)]?.text ?? '').trim();
              return (
                <div key={sec.n} style={line}>
                  <strong>{sec.n}.</strong> <L en={sec.en} ar={sec.ar} />
                  {text !== '' ? (
                    <div style={{ marginInlineStart: 18, color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>{text}</div>
                  ) : null}
                </div>
              );
            })}
            {MAJOR_INCIDENT_ITEMS.map((mi) => (
              <div key={`mi-${mi.n}`} style={line}>
                {plan.majorIncident[String(mi.n)]?.covered ? '☑' : '☐'}{' '}
                <L en={`Major incident ${mi.n}. ${mi.en}`} ar={`حادث جسيم ${mi.n}. ${mi.ar}`} />
              </div>
            ))}
          </>
        )}

        <h2 style={h2}>
          <L en="Determination history" ar="سجل النتائج" />
        </h2>
        {determinations.length === 0 ? (
          <div style={line}>
            <L en="No determination has been recorded." ar="لم تُسجَّل أي نتيجة." />
          </div>
        ) : (
          determinations.map((d) => (
            <div key={d.id} style={line}>
              <L
                en={outcomes.find((o) => o.key === d.outcome)?.en ?? d.outcome}
                ar={outcomes.find((o) => o.key === d.outcome)?.ar ?? d.outcome}
              />
              {' — '}
              {d.recordedAt} · {d.recordedBy}
              {d.superseded ? (
                <span>
                  {' · '}
                  <L en="replaced" ar="استُبدلت" />
                </span>
              ) : null}
              {d.note ? <div style={{ marginInlineStart: 18, color: 'var(--muted)' }}>{d.note}</div> : null}
              {d.revisionReason ? (
                <div style={{ marginInlineStart: 18, color: 'var(--muted)' }}>
                  <L en="Reason" ar="السبب" />: {d.revisionReason}
                </div>
              ) : null}
            </div>
          ))
        )}

        <div style={{ marginBlockStart: 28, padding: '14px 18px', border: '1px solid var(--ink)', borderRadius: 8, fontSize: '12px', lineHeight: 1.65 }}>
          <L en={MINISTRY_CONTENT.certificate.limitsEn} ar={MINISTRY_CONTENT.certificate.limitsAr} />
        </div>

        <div data-region="certificate-controls" style={{ display: 'flex', gap: 12, marginBlockStart: 28, flexWrap: 'wrap' }}>
          <PrintButton en={MINISTRY_CONTENT.adminConsole.printFileEn} ar={MINISTRY_CONTENT.adminConsole.printFileAr} />
          <a
            href={`/ministry/admin/records/${id}`}
            style={{ height: 44, paddingInline: 20, border: '1px solid var(--line)', borderRadius: 22, fontSize: 14, display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}
          >
            <L en="Back to the record" ar="العودة إلى السجل" />
          </a>
        </div>
      </main>
    </>
  );
}
