import { notFound } from 'next/navigation';
import { getDb } from '../../../../lib/db';
import { L } from '../../../../components/L';
import { DocumentViewer } from '../../../../components/DocumentViewer';
import { PLAN_DOC_KEY, humanSize } from '../../../../lib/rules/uploads';
import { MinistryFooter, MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import {
  addedMeasuresFor,
  attachmentsForReview,
  attestationRecordsFor,
  submissionVersionsFor,
  planForReview,
  determinationsFor,
  inspectionsFor,
  submissionForReview,
  derivationForReview,
  assessmentAnswersForReview,
  sharedDocumentsForReview,
  inspectorCandidates,
} from '../../../../lib/queries';
import {
  ATTESTATIONS_CONTENT,
  DOMAINS,
  MAJOR_INCIDENT_ITEMS,
  bilingualMap,
  MINISTRY_CONTENT,
  PLAN_SECTIONS,
  NEHRAT_TOOL_VERSION,
  attestationEmptyBody,
  attestationRows,
  attestationSummary,
  attestationsApplyAt,
  can,
  catalogueEntry,
  documentsForLevel,
  outcomeAvailability,
  type Level,
} from '../../../../lib/rules';
import {
  assignReviewAction,
  clearMeasureAction,
  createInspectionAction,
  outcomeBlockersFor,
  setInspectionBlockingAction,
  recordAttestationAction,
  recordInspectionAction,
  recordOutcomeAction,
  requireMeasureAction,
  reviseOutcomeAction,
} from '../../../ministry-actions';

/**
 * Submission review -- where the only regulatory determinations are recorded,
 * and only by a reviewer. 'Requirements satisfied' is DISABLED WITH EVERY
 * OUTSTANDING ITEM NAMED while any blocking measure or inspection is open; the
 * other two outcomes stay available. Internal state is grey and is not a
 * determination. An inspector sees this screen, schedules and records
 * inspections, and has no outcome control at all -- absent, not greyed.
 */
export default async function SubmissionReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const account = await requireMinistryPage('viewSubmission');
  const { id } = await params;
  const review = submissionForReview(account.isDemo, id);
  const derivation = derivationForReview(id);
  if (!review) notFound();
  const { notice, error } = await searchParams;

  const determinations = determinationsFor(id);
  const measures = addedMeasuresFor(id);
  // The attestation gate: applicable at the levels the data names; [] below them,
  // where the screen shows the explicit empty state rather than nothing.
  const attRows =
    review.level !== null && attestationsApplyAt(review.level as Level)
      ? attestationRows(review.level as Level, attestationRecordsFor(id))
      : [];
  const attSummary = attRows.length > 0 ? attestationSummary(attRows) : null;
  const AP = ATTESTATIONS_CONTENT.panel;
  const mayAttest = can(account.role, 'recordAttestation');
  // The plan AS SUBMITTED, readable in place. For a slice this screen carried no plan
  // at all -- the reviewer recorded outcomes about a document they could not see.
  const plan = planForReview(id);
  const RP = MINISTRY_CONTENT.reviewPlan;
  const AA = MINISTRY_CONTENT.assessmentAnswers;
  const SI = MINISTRY_CONTENT.scheduleInspection;
  const DT = MINISTRY_CONTENT.determination;
  const standing = determinations.find((d) => !d.superseded) ?? null;
  const CD = MINISTRY_CONTENT.counterpartyDocuments;
  // The confirmed director, read directly: the review query's providers are the EMS
  // lane, and invitationForEvent is scoped to the counterparty's own account.
  const attachments = attachmentsForReview(id);
  const assessment = assessmentAnswersForReview(id);
  const counterpartyDocs = sharedDocumentsForReview(id);
  const conductors = inspectorCandidates(account.isDemo);
  const versions = submissionVersionsFor(id);
  const director = getDb()
    .prepare(
      `SELECT name_en, name_ar FROM invitations WHERE event_id = ? AND kind = 'director' AND status = 'confirmed' LIMIT 1`,
    )
    .get(id) as { name_en: string; name_ar: string } | undefined;
  const sectionAddressed = (n: number): boolean => {
    const sec = plan?.sections[String(n)];
    return plan?.mode === 'attach' ? sec?.covered === true : Boolean(sec?.text && sec.text.trim() !== '');
  };
  const inspections = inspectionsFor(id);
  const blockers = await outcomeBlockersFor(id);
  const outcomes = outcomeAvailability(blockers);
  const internal = MINISTRY_CONTENT.internalStates[review.state];
  const mayRecord = can(account.role, 'recordOutcome');
  const mayMeasure = can(account.role, 'requireMeasures');
  const mayInspect = can(account.role, 'scheduleInspection');
  const catalog = review.level ? documentsForLevel(review.level) : [];

  /**
   * Who holds an action this account does not. The control being ABSENT is correct
   * (non-negotiable 10); the silence was not -- an empty panel with an implied
   * action reads as a missing feature rather than a withheld one.
   */
  const OwnerNote = ({ panel }: { panel: 'determinations' | 'inspections' | 'attestations' | 'measures' }) => {
    const note = bilingualMap(MINISTRY_CONTENT.panelOwners)[panel]!;
    return (
      <div
        data-region={`owner-${panel}`}
        style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, marginBlockStart: 10, fontSize: '12.5px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '80ch' }}
      >
        <L en={note.en} ar={note.ar} />
      </div>
    );
  };

  const STATUS_CHIP: Record<string, { en: string; ar: string; bg: string; color: string }> = {
    nominated: { en: 'Nominated — unanswered', ar: 'مُسمّى — دون إجابة', bg: 'var(--accent-soft)', color: 'var(--accent-ink)' },
    confirmed: { en: 'Confirmed', ar: 'مؤكَّد', bg: 'var(--brand-soft)', color: 'var(--brand)' },
    declined: { en: 'Declined', ar: 'معتذِر', bg: 'var(--bad-soft)', color: 'var(--bad)' },
    withdrawn: { en: 'Withdrawn by the organizer', ar: 'سحبه المنظّم', bg: 'var(--surface)', color: 'var(--muted)' },
    removed: { en: 'Removed by the organizer', ar: 'أزاله المنظّم', bg: 'var(--surface)', color: 'var(--muted)' },
  };
  const DECL_CHIP: Record<string, { en: string; ar: string; bg: string; color: string }> = {
    none: { en: 'No declaration', ar: 'لا إقرار', bg: 'var(--surface2)', color: 'var(--muted)' },
    draft: { en: 'Draft — not signed', ar: 'مسودة — غير موقّعة', bg: 'var(--accent-soft)', color: 'var(--accent-ink)' },
    signed: { en: 'Signed', ar: 'موقّع', bg: 'var(--brand-soft)', color: 'var(--brand)' },
  };

  return (
    <MinistryShell account={account} back={{ href: '/ministry/queue', en: 'Review queue', ar: 'قائمة المراجعة' }}>
      {notice === 'recorded' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The outcome has been recorded and the organizer notified. The reference number does not change." ar="سُجّلت النتيجة وأُبلغ المنظّم. ولا يتغير الرقم المرجعي." />
        </div>
      ) : null}
      {notice === 'measure' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The additional measure has been recorded. It gates only the satisfied outcome." ar="سُجّل التدبير الإضافي. وهو يحجب النتيجة المستوفاة فقط." />
        </div>
      ) : null}
      {error === 'gated' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="That outcome is blocked while items are outstanding. The other two remain available." ar="هذه النتيجة محجوبة ما دامت بنود قائمة. والنتيجتان الأخريان متاحتان." />
        </div>
      ) : null}

      <div data-region="review-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 28 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 8 }}>
            <L en={`${review.orgEn}${review.mophReference ? ` · ${review.mophReference}` : ''}${review.filedAt ? ` · filed ${review.filedAt}` : ''}${review.version > 1 ? ` · revised submission, version ${review.version}` : ''}`} ar={`${review.orgAr}${review.mophReference ? ` · ${review.mophReference}` : ''}${review.filedAt ? ` · قُدّم في ⁦${review.filedAt}⁩` : ''}${review.version > 1 ? ` · تقديم معدَّل، النسخة ${review.version}` : ''}`} />
          </div>
          <h1 data-sec-h1="" style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
            <L en={review.nameEn} ar={review.nameAr} />
          </h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlockStart: 10 }}>
            {review.level !== null ? (
              <span style={{ padding: '3px 9px', borderRadius: 13, borderInlineStart: `2px solid var(--l${review.level})`, background: `var(--l${review.level}s)`, fontSize: 13 }}>
                <L en={`Level ${review.level}`} ar={`المستوى ${review.level}`} />
              </span>
            ) : null}
            {/* Internal workflow state: grey, quiet, not a determination. */}
            <span data-region="review-state" style={{ padding: '3px 9px', borderRadius: 13, background: 'var(--surface2)', color: 'var(--muted)', fontSize: 13 }}>
              <L en={internal.en} ar={internal.ar} />
              {review.reviewer ? ` · ${review.reviewer}` : null}
            </span>
          </div>
        </div>
        {can(account.role, 'assignReview') && review.state !== 'progress' ? (
          <form action={assignReviewAction.bind(null, id)}>
            <input type="hidden" name="state" value="progress" />
            <button type="submit" style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: '13.5px', cursor: 'pointer' }}>
              <L en="Take this submission" ar="تولّي هذا التقديم" />
            </button>
          </form>
        ) : null}
      </div>

      {/* Non-negotiable 1: the reviewer sees BOTH results and which governed --
          never a bare level chip. A seeded submission without stored answers says so. */}
      <div data-region="derivation" style={{ padding: '19px 25px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 24 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 12 }}>
          <L en="How the level was determined" ar="كيف تحدد المستوى" />
        </div>
        {derivation && derivation.complete ? (
          <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBlockEnd: 3 }}>
                <L en="Assessment score" ar="نتيجة التقييم" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {derivation.scoreTotal} / 18
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                <L en={`Score band: Level ${derivation.scoreBandLevel}`} ar={`نطاق النتيجة: المستوى ${derivation.scoreBandLevel}`} />
              </div>
            </div>
            <div style={{ maxWidth: '40ch' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBlockEnd: 3 }}>
                <L en="Minimum conditions" ar="الحد الأدنى للشروط" />
              </div>
              {derivation.minimumConditionLevel !== null ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>
                    <L en={`Level ${derivation.minimumConditionLevel}`} ar={`المستوى ${derivation.minimumConditionLevel}`} />
                  </div>
                  {derivation.triggeredConditions.map((c) => (
                    <div key={c.key} style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5 }}>
                      <L en={c.en} ar={c.ar} />
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--muted)' }}>
                  <L en="None triggered" ar="لم يتحقق أي شرط" />
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBlockEnd: 3 }}>
                <L en="Final level — the higher of the two" ar="المستوى النهائي — الأعلى من الاثنين" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: `var(--l${derivation.finalLevel})` }}>
                <L en={`Level ${derivation.finalLevel}`} ar={`المستوى ${derivation.finalLevel}`} />
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                {derivation.governedBy === 'minimumCondition' ? (
                  <L en="Governed by a minimum condition" ar="محكوم بشرط من الحد الأدنى" />
                ) : derivation.governedBy === 'both' ? (
                  <L en="The score and a minimum condition give the same level" ar="النتيجة وشرط الحد الأدنى يعطيان المستوى نفسه" />
                ) : (
                  <L en="Governed by the assessment score" ar="محكوم بنتيجة التقييم" />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
            <L
              en="This demonstration record carries a seeded level without stored assessment answers, so no derivation can be shown. A real submission shows the score, the minimum conditions and which governed."
              ar="يحمل هذا السجل التوضيحي مستوى مُهيّأ دون إجابات تقييم مخزنة، فلا يمكن عرض الاستنتاج. أما التقديم الحقيقي فيعرض النتيجة وشروط الحد الأدنى وأيهما حكم."
            />
          </div>
        )}
      </div>

      <div data-split="" style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 20, alignItems: 'start' }}>
        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Named EMS providers" ar="مزوّدو الإسعاف المُسمّون" />
          </h2>
          <div data-region="providers" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 28 }}>
            {review.providers.map((p) => {
              const chip = DECL_CHIP[p.declaration] ?? DECL_CHIP['none']!;
              // Every state, DISTINCT: a declined or removed party must not render
              // like a confirmed one -- the reviewer reads who actually stands.
              const st = STATUS_CHIP[p.status] ?? STATUS_CHIP['nominated']!;
              const closed = p.status === 'withdrawn' || p.status === 'removed' || p.status === 'declined';
              return (
                <div key={p.nameEn} style={{ paddingBlock: '15px', paddingInlineStart: '18px', paddingInlineEnd: '19px', background: 'var(--surface2)', borderInlineStart: `3px ${closed ? 'dashed var(--line)' : p.declaration === 'signed' ? 'solid var(--brand)' : 'dashed var(--accent-ink)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14.5px', color: closed ? 'var(--muted)' : 'var(--ink)' }}>
                    <L en={p.nameEn} ar={p.nameAr} />
                  </span>
                  <span style={{ display: 'flex', gap: 8, flex: 'none', alignItems: 'center' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 999, background: st.bg, color: st.color, fontSize: '12.5px' }}>
                      <L en={st.en} ar={st.ar} />
                    </span>
                    {review.level === 3 && !closed ? (
                      <span style={{ padding: '3px 9px', borderRadius: 999, background: chip.bg, color: chip.color, fontSize: '12.5px' }}>
                        <L en={chip.en} ar={chip.ar} />
                        {p.signedAt ? <span style={{ fontVariantNumeric: 'tabular-nums' }}> · {p.signedAt}</span> : null}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
            {review.providers.length === 0 ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en="No providers named." ar="لا مزوّدين مُسمّين." />
              </div>
            ) : null}
          </div>

          {/* What was ATTACHED -- THE FILE, not the name. The storage decision is
              taken: the reviewer opens the route map here. Rows seeded before the
              ruling carry no bytes and say so, rather than offering a dead link. */}
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Attached documents" ar="المستندات المرفقة" />
          </h2>
          <div data-region="review-attachments" style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden', marginBlockEnd: 28 }}>
            {attachments.map((a) => {
              const doc = catalogueEntry(a.docKey);
              return (
                <div key={a.docKey} style={{ background: 'var(--bg)', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
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
            {attachments.length === 0 ? (
              <div style={{ background: 'var(--bg)', padding: '12px 16px', fontSize: '13.5px', color: 'var(--muted)' }}>
                <L en="Nothing attached." ar="لا مرفقات." />
              </div>
            ) : null}
          </div>

          {/* The filing history: each archived version, readable at a glance. */}
          {versions.length > 0 ? (
            <div data-region="review-versions" style={{ marginBlockEnd: 28 }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
                <L en="Filing history" ar="سجل التقديمات" />
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                {versions.map((v) => (
                  <div key={v.version} style={{ background: 'var(--bg)', padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '13.5px' }}>
                      <L en={`Version ${v.version} — superseded`} ar={`النسخة ${v.version} — استُبدلت`} />
                      <span style={{ color: 'var(--muted)' }}> · {v.representative}</span>
                    </span>
                    <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{v.archivedAt}</span>
                  </div>
                ))}
                <div style={{ background: 'var(--bg)', padding: '12px 16px', fontSize: '13.5px' }}>
                  <L en={`Version ${review.version} — current${review.filedAt ? `, filed ${review.filedAt}` : ''}`} ar={`النسخة ${review.version} — الحالية${review.filedAt ? `، قُدّمت في ⁦${review.filedAt}⁩` : ''}`} />
                </div>
              </div>
            </div>
          ) : null}

          {/* THE OTHER DOCUMENT LANE. The organizer's attachments are above; these
              are the ones exchanged with each named party -- including the ones
              REQUESTED and never supplied, which the organizer's own list cannot
              show and which a determination can turn on. */}
          <div data-region="counterparty-documents" style={{ marginBlockEnd: 28 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
              <L en={CD.titleEn} ar={CD.titleAr} />
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.55, maxWidth: '70ch' }}>
              <L en={CD.introEn} ar={CD.introAr} />
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' }}>
              {counterpartyDocs.map((c) => {
                const state = bilingualMap(CD.states)[c.source];
                const outstanding = c.source === 'requested' || c.source === 'missing';
                return (
                  <div key={c.id} style={{ background: 'var(--bg)', padding: '12px 16px', borderInlineStart: `3px solid ${outstanding ? 'var(--bad)' : 'var(--brand)'}` }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '13.5px', flex: 1, minWidth: 220 }}>
                        <L en={c.nameEn} ar={c.nameAr} />
                        <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3 }}>
                          <L en={c.partyEn} ar={c.partyAr} />
                        </span>
                      </span>
                      <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: outstanding ? 'var(--bad-soft)' : 'var(--brand-soft)', color: outstanding ? 'var(--bad)' : 'var(--brand)', fontSize: 12 }}>
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
              {counterpartyDocs.length === 0 ? (
                <div style={{ background: 'var(--bg)', padding: '12px 16px', fontSize: '13.5px', color: 'var(--muted)' }}>
                  <L en={CD.noneEn} ar={CD.noneAr} />
                </div>
              ) : null}
            </div>
          </div>

          {/* THE NINE ANSWERS BEHIND THE LEVEL. The derivation strip above reports
              the score, the conditions and which governed; this reports what the
              organizer actually declared. A reviewer checking whether a level is
              right needs the inputs, not only the conclusion -- the same reason
              the Ministry now opens documents rather than reading their names. */}
          <div data-region="assessment-answers" style={{ marginBlockEnd: 28 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 8px' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
                <L en={AA.titleEn} ar={AA.titleAr} />
              </h2>
              {assessment ? (
                <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                  <L en={`${AA.versionLabelEn} ${assessment.toolVersion}`} ar={`${AA.versionLabelAr} ${assessment.toolVersion}`} />
                </span>
              ) : null}
            </div>
            <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.55, maxWidth: '70ch' }}>
              <L en={AA.introEn} ar={AA.introAr} />
            </p>
            {!assessment ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en={AA.noneEn} ar={AA.noneAr} />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden', marginBlockEnd: 16 }}>
                  {DOMAINS.map((d, i) => {
                    const score = assessment.answers[i];
                    const chosen = typeof score === 'number' ? d.options.find((o) => o.score === score) : undefined;
                    return (
                      <div key={d.number} style={{ background: 'var(--bg)', padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ display: 'flex', gap: 12, alignItems: 'baseline', flex: 1, minWidth: 220 }}>
                            <span style={{ flex: 'none', fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 18 }}>{d.number}</span>
                            <span style={{ fontSize: '13.5px', lineHeight: 1.45 }}>
                              <L en={d.en} ar={d.ar} />
                            </span>
                          </span>
                          <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: 'var(--surface2)', color: 'var(--muted)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                            {typeof score === 'number' ? `${score} / 2` : <L en={AA.unsetEn} ar={AA.unsetAr} />}
                          </span>
                        </div>
                        {chosen ? (
                          <div style={{ marginBlockStart: 6, marginInlineStart: 30, fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '78ch' }}>
                            <L en={chosen.en} ar={chosen.ar} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
                  <L en={AA.inputsLabelEn} ar={AA.inputsLabelAr} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                  {Object.entries(AA.inputs).map(([key, label]) => {
                    const raw = (assessment.inputs as unknown as Record<string, unknown>)[key];
                    const value =
                      raw === null || raw === undefined
                        ? null
                        : Array.isArray(raw)
                          ? raw.join(', ')
                          : typeof raw === 'boolean'
                            ? null
                            : String(raw);
                    return (
                      <div key={key} style={{ background: 'var(--bg)', padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '13.5px' }}>
                          <L en={label.en} ar={label.ar} />
                        </span>
                        <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {typeof raw === 'boolean' ? (
                            <L en={raw ? AA.yesEn : AA.noEn} ar={raw ? AA.yesAr : AA.noAr} />
                          ) : value === null || value === '' ? (
                            <L en={AA.unsetEn} ar={AA.unsetAr} />
                          ) : (
                            value
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* The plan the outcome concerns -- the OTHER panel the same Slice 6
              exception hid. Read-only; nothing the Ministry can edit. */}
          <div data-region="review-plan" style={{ marginBlockEnd: 28 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 8px' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
                <L en={RP.titleEn} ar={RP.titleAr} />
              </h2>
              {plan ? (
                <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                  {plan.mode === 'write' ? (
                    <L
                      en={RP.versionWrittenEn.replace('{v}', String(plan.version)).replace('{n}', String(PLAN_SECTIONS.length))}
                      ar={RP.versionWrittenAr.replace('{v}', String(plan.version)).replace('{n}', String(PLAN_SECTIONS.length))}
                    />
                  ) : (
                    <L
                      en={RP.versionAttachedEn.replace('{v}', String(plan.version))}
                      ar={RP.versionAttachedAr.replace('{v}', String(plan.version))}
                    />
                  )}
                </span>
              ) : null}
            </div>
            <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.55, maxWidth: '70ch' }}>
              <L en={RP.introEn} ar={RP.introAr} />
            </p>
            {!plan ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en={RP.noPlanEn} ar={RP.noPlanAr} />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden', marginBlockEnd: 16 }}>
                  {PLAN_SECTIONS.map((sec) => {
                    const done = sectionAddressed(sec.n);
                    const st = done ? RP.states.done : RP.states.open;
                    const color = done ? 'var(--brand)' : 'var(--bad)';
                    const text = plan.mode === 'write' ? (plan.sections[String(sec.n)]?.text ?? '').trim() : '';
                    return (
                      <div key={sec.n} style={{ background: 'var(--bg)', padding: '12px 16px', borderInlineStart: `3px solid ${color}` }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ display: 'flex', gap: 12, alignItems: 'baseline', flex: 1, minWidth: 220 }}>
                            <span style={{ flex: 'none', fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 18 }}>{sec.n}</span>
                            <span style={{ fontSize: '13.5px', lineHeight: 1.45 }}>
                              <L en={sec.en} ar={sec.ar} />
                            </span>
                          </span>
                          <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: done ? 'var(--brand-soft)' : 'var(--bad-soft)', color, fontSize: 12 }}>
                            <L en={st.en} ar={st.ar} />
                          </span>
                        </div>
                        {text !== '' ? (
                          <div style={{ marginBlockStart: 6, marginInlineStart: 30, fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '78ch', whiteSpace: 'pre-wrap' }}>{text}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {plan.mode === 'attach' && plan.attachedFile ? (
                  <div style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, marginBlockEnd: 16 }}>
                    <div style={{ fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}>{plan.attachedFile}</div>
                    <DocumentViewer
                      href={`/api/documents/${id}/${PLAN_DOC_KEY}`}
                      hasFile={plan.attachedHasFile}
                      contentType={null}
                      label="the attached plan"
                    />
                  </div>
                ) : null}
                {review.level === 3 && director ? (
                  <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, marginBlockEnd: 16, fontSize: '12.5px', lineHeight: 1.6, maxWidth: '78ch' }}>
                    <L
                      en={RP.l3StripEn.replace('{director}', director.name_en)}
                      ar={RP.l3StripAr.replace('{director}', director.name_ar)}
                    />
                  </div>
                ) : null}
                <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
                  <L en={RP.miLabelEn} ar={RP.miLabelAr} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                  {MAJOR_INCIDENT_ITEMS.map((mi) => {
                    const covered = plan.majorIncident[String(mi.n)]?.covered === true;
                    const color = covered ? 'var(--brand)' : 'var(--bad)';
                    const st = covered ? RP.states.done : RP.states.open;
                    return (
                      <div key={mi.n} style={{ background: 'var(--bg)', padding: '12px 16px', borderInlineStart: `3px solid ${color}`, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ display: 'flex', gap: 12, alignItems: 'baseline', flex: 1, minWidth: 220 }}>
                          <span style={{ flex: 'none', fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 18 }}>{mi.n}</span>
                          <span style={{ fontSize: '13.5px', lineHeight: 1.45 }}>
                            <L en={mi.en} ar={mi.ar} />
                          </span>
                        </span>
                        <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: covered ? 'var(--brand-soft)' : 'var(--bad-soft)', color, fontSize: 12 }}>
                          <L en={st.en} ar={st.ar} />
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginBlockStart: 12, fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>
                  <L en={RP.orderNoteEn} ar={RP.orderNoteAr} />
                </div>
              </>
            )}
          </div>

          {/* The attestation gate -- the panel a Slice 6 exception claimed was a
              summary of organizer content. It is a blocking gate, per the reference. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 8px' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
              <L en={AP.titleEn} ar={AP.titleAr} />
            </h2>
            <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
              <L en={`${AP.versionLabelEn} ${NEHRAT_TOOL_VERSION}`} ar={`${AP.versionLabelAr} ${NEHRAT_TOOL_VERSION}`} />
            </span>
          </div>
          <p data-region="att-intro" style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.55, maxWidth: '70ch' }}>
            <L en={AP.notAnOutcomeEn} ar={AP.notAnOutcomeAr} />
          </p>
          {attRows.length === 0 && review.level !== null ? (
            <div data-region="attestations-empty" style={{ borderRadius: 12, overflow: 'hidden', background: 'var(--surface2)', marginBlockEnd: 28 }}>
              <div style={{ padding: '11px 20px', background: 'var(--surface)', fontSize: 12, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                <L en={ATTESTATIONS_CONTENT.emptyState.eyebrowEn} ar={ATTESTATIONS_CONTENT.emptyState.eyebrowAr} />
              </div>
              <div style={{ padding: '30px 28px', maxWidth: '78ch' }}>
                <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.5, marginBlockEnd: 10 }}>
                  <L en={ATTESTATIONS_CONTENT.emptyState.headEn} ar={ATTESTATIONS_CONTENT.emptyState.headAr} />
                </div>
                <p style={{ margin: '0 0 20px', fontSize: 15, lineHeight: 1.75, color: 'var(--muted)' }}>
                  <L en={attestationEmptyBody(review.level as Level).en} ar={attestationEmptyBody(review.level as Level).ar} />
                </p>
                <div style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                  <L en={ATTESTATIONS_CONTENT.emptyState.footEn} ar={ATTESTATIONS_CONTENT.emptyState.footAr} />
                </div>
              </div>
            </div>
          ) : null}
          {attRows.length > 0 ? (
            <div data-region="attestations" data-action-panel="attestations" style={{ marginBlockEnd: 28 }}>
              {!mayAttest ? <OwnerNote panel="attestations" /> : null}
              {attSummary ? (
                <div data-region="att-summary" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, marginBlockEnd: 14, fontSize: 13, lineHeight: 1.5 }}>
                  <L en={attSummary.en} ar={attSummary.ar} />
                </div>
              ) : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attRows.map((t) => {
                  const st = ATTESTATIONS_CONTENT.states[t.state];
                  const auth = ATTESTATIONS_CONTENT.authorities[t.authority];
                  const color = t.state === 'complete' ? 'var(--brand)' : 'var(--accent-ink)';
                  return (
                    <div key={t.key} data-att-item={t.key} style={{ paddingBlock: '15px', paddingInlineStart: '16px', paddingInlineEnd: '17px', background: 'var(--surface2)', borderInlineStart: `3px ${t.authority === 'order' ? 'dashed' : 'solid'} ${color}`, borderRadius: 10 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 6 }}>
                        <span style={{ fontSize: 14, lineHeight: 1.45, flex: 1, minWidth: 220 }}>
                          <L en={t.en} ar={t.ar} />
                        </span>
                        <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: t.state === 'complete' ? 'var(--brand-soft)' : 'var(--accent-soft)', color, fontSize: '12.5px' }}>
                          <L en={st.en} ar={st.ar} />
                        </span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5 }}>
                        <L
                          en={`${auth.en} · ${t.state === 'complete' ? `${AP.attestedByEn} ${t.attestedBy ?? ''} · ${t.attestedAt ?? ''}` : AP.notYetEn}`}
                          ar={`${auth.ar} · ${t.state === 'complete' ? `${AP.attestedByAr} ${t.attestedBy ?? ''} · ${t.attestedAt ?? ''}` : AP.notYetAr}`}
                        />
                      </div>
                      {t.state === 'pending' && (t.reasonEn || t.reasonAr) ? (
                        <div style={{ marginBlockStart: 8, padding: '10px 12px', background: 'var(--accent-soft)', borderRadius: 8, fontSize: '12.5px', lineHeight: 1.55, color: 'var(--accent-ink)' }}>
                          <span style={{ display: 'block', fontWeight: 500, marginBlockEnd: 3 }}>
                            <L en={AP.pendingBecauseEn} ar={AP.pendingBecauseAr} />
                          </span>
                          <L en={t.reasonEn ?? t.reasonAr ?? ''} ar={t.reasonAr ?? t.reasonEn ?? ''} />
                        </div>
                      ) : null}
                      {t.laneFallback ? (
                        <div style={{ marginBlockStart: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, maxWidth: '78ch' }}>
                          <L en={AP.orderFallbackEn} ar={AP.orderFallbackAr} />
                        </div>
                      ) : null}
                      {t.state === 'pending' && t.recordableBy === 'order' ? (
                        <div style={{ marginBlockStart: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, maxWidth: '78ch' }}>
                          <L en={AP.orderHeldEn} ar={AP.orderHeldAr} />
                        </div>
                      ) : null}
                      {/* The recorder's controls. Attest only while pending; the
                          deficiency control in EITHER state -- a deficiency found after
                          attestation returns the item to pending. */}
                      {mayAttest && t.recorder === 'reviewer' ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBlockStart: 10 }}>
                          {t.state === 'pending' ? (
                            <form action={recordAttestationAction.bind(null, id)}>
                              <input type="hidden" name="itemKey" value={t.key} />
                              <input type="hidden" name="kind" value="attest" />
                              <button type="submit" style={{ height: 32, paddingInline: 13, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 16, fontSize: '12.5px', cursor: 'pointer' }}>
                                <L en={AP.attestEn} ar={AP.attestAr} />
                              </button>
                            </form>
                          ) : null}
                          <form action={recordAttestationAction.bind(null, id)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <input type="hidden" name="itemKey" value={t.key} />
                            <input type="hidden" name="kind" value="deficiency" />
                            <input
                              name="reason"
                              required
                              aria-label="Deficiency"
                              style={{ height: 32, paddingInline: 10, minWidth: 220, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '12.5px' }}
                            />
                            <button type="submit" style={{ height: 32, paddingInline: 13, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 16, fontSize: '12.5px', cursor: 'pointer' }}>
                              {t.state === 'pending' ? (
                                <L en={AP.deficiencyEn} ar={AP.deficiencyAr} />
                              ) : (
                                <L en={AP.deficiencyReopenEn} ar={AP.deficiencyReopenAr} />
                              )}
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginBlockStart: 12, fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>
                <L en={AP.footnoteEn} ar={AP.footnoteAr} />
              </div>
            </div>
          ) : null}

          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Inspections" ar="التفتيشات" />
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '78ch' }}>
            <L
              en="Findings are not an outcome and never decide one. A blocking inspection without recorded findings gates only the satisfied outcome."
              ar="النتائج الميدانية ليست نتيجة قرار ولا تقرر واحدة. والتفتيش الحاجب دون نتائج مسجَّلة يحجب النتيجة المستوفاة فقط."
            />
          </p>
          <div data-region="inspections" data-action-panel="inspections" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 28 }}>
            {inspections.map((i) => (
              <div key={i.id} style={{ paddingBlock: '17px', paddingInlineStart: '18px', paddingInlineEnd: '19px', background: 'var(--surface2)', borderInlineStart: `3px ${i.state === 'recorded' ? 'solid var(--brand)' : i.state === 'none' ? 'dashed var(--bad)' : 'solid var(--accent)'}`, borderRadius: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: i.findings || mayInspect ? 10 : 0 }}>
                  <span style={{ fontSize: '14.5px', lineHeight: 1.5 }}>
                    <L en={i.titleEn} ar={i.titleAr} />
                    {i.blocking ? (
                      <span style={{ display: 'inline-block', marginInlineStart: 8, padding: '1px 7px', border: '1px solid var(--accent)', borderRadius: 999, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--accent-ink)' }}>
                        <L en="Blocking" ar="حاجب" />
                      </span>
                    ) : null}
                  </span>
                  <span style={{ padding: '3px 9px', borderRadius: 999, background: i.state === 'recorded' ? 'var(--brand-soft)' : i.state === 'none' ? 'var(--bad-soft)' : 'var(--accent-soft)', color: i.state === 'recorded' ? 'var(--brand)' : i.state === 'none' ? 'var(--bad)' : 'var(--accent-ink)', fontSize: '12.5px' }}>
                    {i.state === 'recorded' ? (
                      <L en="Findings recorded" ar="سُجّلت النتائج" />
                    ) : i.state === 'scheduled' ? (
                      <L en="Scheduled" ar="مجدول" />
                    ) : i.state === 'conducted' ? (
                      <L en="Conducted — findings not recorded" ar="أُجري — لم تُسجَّل النتائج" />
                    ) : (
                      <L en="Not scheduled" ar="غير مجدول" />
                    )}
                  </span>
                </div>
                {i.findings ? (
                  <div style={{ fontSize: '13.5px', lineHeight: 1.65, color: 'var(--muted)' }}>{i.findings}</div>
                ) : null}
                {mayInspect && i.state !== 'recorded' ? (
                  <form action={recordInspectionAction.bind(null, i.id)} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlockStart: 10, alignItems: 'end' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        <L en="Date" ar="التاريخ" />
                      </span>
                      <input name="date" type="date" defaultValue={i.date ?? ''} style={{ height: 36, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 18, fontSize: 13 }} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 220 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        <L en="Findings — recording them closes the item" ar="النتائج — تسجيلها يُقفل البند" />
                      </span>
                      <input name="findings" style={{ height: 36, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 18, fontSize: 13 }} />
                    </label>
                    <button type="submit" style={{ height: 36, paddingInline: 14, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 18, fontSize: 13, cursor: 'pointer' }}>
                      <L en="Save" ar="حفظ" />
                    </button>
                  </form>
                ) : null}
                {mayInspect && i.state !== 'recorded' ? (
                  <form action={setInspectionBlockingAction.bind(null, i.id)} style={{ marginBlockStart: 8 }}>
                    <input type="hidden" name="blocking" value={i.blocking ? '0' : '1'} />
                    <button type="submit" style={{ height: 30, paddingInline: 12, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 15, fontSize: 12, color: i.blocking ? 'var(--muted)' : 'var(--accent-ink)', cursor: 'pointer' }}>
                      {i.blocking ? (
                        <L en="Stop blocking the satisfied outcome" ar="إيقاف حجب نتيجة الاستيفاء" />
                      ) : (
                        <L en="Make it block the satisfied outcome" ar="جعله يحجب نتيجة الاستيفاء" />
                      )}
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
            {inspections.length === 0 ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en="No inspections on this submission." ar="لا تفتيشات على هذا التقديم." />
              </div>
            ) : null}
            {/* NOTHING HERE IS WAITING ON YOU -- and my own dead-end guard caught
                both cases. Moving the scheduling control out of this panel into its
                own left the list with no control and no owner for the one role that
                CAN act. That happens twice: an inspector on a submission with no
                inspections, and an inspector on one where every inspection already
                has its findings recorded, so no per-row control remains either. The
                list still carries a per-row action, so it stays an action panel; it
                just has to say something when no row is waiting on the reader. */}
            {mayInspect && inspections.every((i) => i.state === 'recorded') ? (
              // data-region="owner-*" deliberately: this line satisfies the panel
              // contract the same way an owner note does, by naming where the action
              // is. The owner here is the reader themselves, one panel down.
              <div data-region="owner-inspections-empty" style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)', lineHeight: 1.65, maxWidth: '78ch' }}>
                {inspections.length === 0 ? (
                  <L en={SI.noneYetEn} ar={SI.noneYetAr} />
                ) : (
                  <L en={SI.allRecordedEn} ar={SI.allRecordedAr} />
                )}
              </div>
            ) : null}
            {!mayInspect ? <OwnerNote panel="inspections" /> : null}
          </div>

          {/* SCHEDULING, as a peer of Require additional measures and directly above
              it, on the reviewer's instruction. It used to be a disclosure at the
              foot of the inspection list with three inputs and no way to say WHO
              CONDUCTS IT -- the inspector was silently whoever clicked Schedule, so
              an inspection could only ever be assigned to the person arranging it. */}
          <div data-action-panel="scheduleInspection" style={{ display: 'contents' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
              <L en={SI.en} ar={SI.ar} />
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '78ch' }}>
              <L en={SI.noteEn} ar={SI.noteAr} />
            </p>
            {!mayInspect ? (
              <div style={{ marginBlockEnd: 28 }}>
                <OwnerNote panel="inspections" />
              </div>
            ) : conductors.length === 0 ? (
              // NOT AN EMPTY FORM. With nobody able to conduct one, a scheduling
              // control would take a submission and produce an inspection assigned to
              // nobody -- so the reason is stated instead (non-negotiable 10).
              <div data-region="no-conductors" style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)', lineHeight: 1.65, marginBlockEnd: 28, maxWidth: '78ch' }}>
                <L en={SI.noCandidatesEn} ar={SI.noCandidatesAr} />
              </div>
            ) : (
              <form
                action={createInspectionAction.bind(null, id)}
                data-region="schedule-inspection"
                style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end', padding: '16px 20px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 28 }}
              >
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    <L en={SI.whatEn} ar={SI.whatAr} />
                  </span>
                  <input name="titleEn" required style={{ height: 38, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    <L en={SI.whatArLabelEn} ar={SI.whatArLabelAr} />
                  </span>
                  <input name="titleAr" dir="rtl" required style={{ height: 38, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 190 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    <L en={SI.whoEn} ar={SI.whoAr} />
                  </span>
                  <select name="inspector" required defaultValue={conductors[0]?.displayName} style={{ height: 38, paddingInline: 8, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }}>
                    {conductors.map((c) => (
                      <option key={c.displayName} value={c.displayName}>
                        {c.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    <L en={SI.whenEn} ar={SI.whenAr} />
                  </span>
                  <input name="date" type="date" style={{ height: 38, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, fontVariantNumeric: 'tabular-nums' }} />
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', height: 38, flexBasis: '100%' }}>
                  <input type="checkbox" name="blocking" value="1" />
                  <span style={{ fontSize: '12.5px' }}>
                    <L en={SI.blockingEn} ar={SI.blockingAr} />
                  </span>
                </label>
                <div style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, flex: 1, minWidth: 260, maxWidth: '70ch' }}>
                    <L en={SI.whoNoteEn} ar={SI.whoNoteAr} />
                    {' '}
                    <L en={SI.whenUnsetEn} ar={SI.whenUnsetAr} />
                  </span>
                  <button type="submit" style={{ height: 38, paddingInline: 16, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: 13, cursor: 'pointer', flex: 'none' }}>
                    <L en={SI.submitEn} ar={SI.submitAr} />
                  </button>
                </div>
              </form>
            )}
          </div>

          <div data-action-panel="measures" style={{ display: 'contents' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en={MINISTRY_CONTENT.additionalMeasures.en} ar={MINISTRY_CONTENT.additionalMeasures.ar} />
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '78ch' }}>
            <L en={MINISTRY_CONTENT.additionalMeasures.noteEn} ar={MINISTRY_CONTENT.additionalMeasures.noteAr} />
          </p>
          <div data-region="measures" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 16 }}>
            {!mayMeasure ? <OwnerNote panel="measures" /> : null}
            {measures.map((m) => {
              const doc = catalog.find((d) => d.key === m.catalogKey);
              return (
                <div key={m.id} style={{ paddingBlock: '15px', paddingInlineStart: '18px', paddingInlineEnd: '19px', background: 'var(--surface2)', borderInlineStart: `3px solid ${m.clearedAt ? 'var(--brand)' : 'var(--accent)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14.5px', lineHeight: 1.5, flex: 1, minWidth: 240 }}>
                    <L en={doc?.en ?? m.catalogKey} ar={doc?.ar ?? m.catalogKey} />
                    {m.note ? <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3 }}>{m.note}</span> : null}
                  </span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 'none' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 999, background: m.clearedAt ? 'var(--brand-soft)' : 'var(--accent-soft)', color: m.clearedAt ? 'var(--brand)' : 'var(--accent-ink)', fontSize: '12.5px' }}>
                      {m.clearedAt ? <L en={`Cleared ${m.clearedAt}`} ar={`أُقفل ⁦${m.clearedAt}⁩`} /> : <L en="Outstanding" ar="قائم" />}
                    </span>
                    {mayMeasure && !m.clearedAt ? (
                      <form action={clearMeasureAction.bind(null, id, m.id)}>
                        <button type="submit" style={{ height: 32, paddingInline: 12, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 16, fontSize: '12.5px', cursor: 'pointer' }}>
                          <L en="Mark cleared" ar="اعتباره مُقفلاً" />
                        </button>
                      </form>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
          {mayMeasure ? (
            <form action={requireMeasureAction.bind(null, id)} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end', marginBlockEnd: 28 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 260, flex: 1 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  <L en="From the requirement catalogue — nothing outside it attaches" ar="من كتالوغ المتطلبات — لا يُرفق شيء من خارجه" />
                </span>
                <select name="catalogKey" required style={{ height: 38, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 19, fontSize: 13 }}>
                  <option value="">—</option>
                  {catalog.map((d) => (
                    <option key={d.key} value={d.key}>{d.en}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  <L en="Note (a note, not a requirement)" ar="ملاحظة (ملاحظة لا متطلب)" />
                </span>
                <input name="note" style={{ height: 38, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 19, fontSize: 13 }} />
              </label>
              <button type="submit" style={{ height: 38, paddingInline: 16, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: 13, cursor: 'pointer' }}>
                <L en="Require the measure" ar="طلب التدبير" />
              </button>
            </form>
          ) : null}
          </div>
        </div>

        <div data-action-panel="determinations">
          {!mayRecord ? <OwnerNote panel="determinations" /> : null}

          {/* WHAT STANDS, once anything does. The three radios used to remain live
              after a determination was recorded, so a regulatory act could be
              replaced by a stray click with nothing saying it had. Recording is
              offered once; changing it is the separate act below. */}
          {standing ? (
            <div data-region="standing-determination" style={{ padding: 25, background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 16 }}>
              <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
                <L en={DT.standingTitleEn} ar={DT.standingTitleAr} />
              </h2>
              <div style={{ fontSize: 17, lineHeight: 1.5, fontWeight: 500, marginBlockEnd: 6 }}>
                <L
                  en={MINISTRY_CONTENT.outcomes.find((o) => o.key === standing.outcome)?.en ?? standing.outcome}
                  ar={MINISTRY_CONTENT.outcomes.find((o) => o.key === standing.outcome)?.ar ?? standing.outcome}
                />
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                <L
                  en={DT.recordedByEn.replace('{who}', standing.recordedBy).replace('{when}', standing.recordedAt)}
                  ar={DT.recordedByAr.replace('{who}', standing.recordedBy).replace('{when}', standing.recordedAt)}
                />
              </div>
              {standing.note ? (
                <div style={{ marginBlockStart: 10 }}>
                  <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 4 }}>
                    <L en={DT.noteLabelEn} ar={DT.noteLabelAr} />
                  </div>
                  <div style={{ fontSize: '13.5px', lineHeight: 1.65, maxWidth: '74ch' }}>{standing.note}</div>
                </div>
              ) : null}

              {mayRecord ? (
                <details data-region="revise-determination" style={{ marginBlockStart: 18 }}>
                  <summary style={{ cursor: 'pointer', fontSize: '13px', color: 'var(--accent-ink)' }}>
                    <L en={DT.reviseTitleEn} ar={DT.reviseTitleAr} />
                  </summary>
                  <div style={{ marginBlockStart: 12 }}>
                    <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.65, maxWidth: '74ch' }}>
                      <L en={DT.reviseBodyEn} ar={DT.reviseBodyAr} />
                    </p>
                    <form action={reviseOutcomeAction.bind(null, id)}>
                      <div data-region="outcome-options" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 14 }}>
                        {outcomes.map((o) => (
                          <label key={o.key} style={{ display: 'flex', gap: 12, alignItems: 'start', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, cursor: o.available ? 'pointer' : 'not-allowed', opacity: o.available ? 1 : 0.55 }}>
                            <input type="radio" name="outcome" value={o.key} required disabled={!o.available} style={{ marginBlockStart: 3 }} />
                            <span style={{ fontSize: '14px', lineHeight: 1.5 }}>
                              <L en={o.en} ar={o.ar} />
                              {/* DISABLED WITH THE REASON, here as in the recording
                                  panel: a revision is gated by exactly the same
                                  blockers, and an option greyed with no reason is
                                  the thing non-negotiable 10 forbids. */}
                              {!o.available ? (
                                <span style={{ display: 'block', marginBlockStart: 4, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                                  <L en={`Unavailable — ${o.blockers.length} outstanding`} ar={`غير متاح — ${o.blockers.length} قائم`} />
                                  {o.blockers.map((b) => (
                                    <span key={b.en} style={{ display: 'block' }}>
                                      <L en={b.en} ar={b.ar} />
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        ))}
                      </div>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlockEnd: 12 }}>
                        <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                          <L en={DT.reasonLabelEn} ar={DT.reasonLabelAr} />
                        </span>
                        <textarea name="reason" rows={3} required style={{ padding: 10, background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 8, fontSize: 13, lineHeight: 1.6, resize: 'vertical' }} />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlockEnd: 12 }}>
                        <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                          <L en={DT.noteLabelEn} ar={DT.noteLabelAr} />
                        </span>
                        <input name="note" style={{ height: 38, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 19, fontSize: 13 }} />
                      </label>
                      <button type="submit" style={{ height: 40, paddingInline: 18, border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--accent-ink)', borderRadius: 20, fontSize: 13, cursor: 'pointer' }}>
                        <L en={DT.reviseSubmitEn} ar={DT.reviseSubmitAr} />
                      </button>
                    </form>
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}

          {mayRecord && !standing ? (
            <div data-region="outcome" style={{ padding: 25, background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 16 }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
                <L en="Record an outcome" ar="تسجيل نتيجة" />
              </h2>
              <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
                <L en="Three outcomes exist. Nothing else is a determination." ar="توجد ثلاث نتائج فقط. ما عداها ليس قراراً." />
              </p>
              <form action={recordOutcomeAction.bind(null, id)}>
                <div data-region="outcome-options" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 14 }}>
                  {outcomes.map((o) => (
                    <label key={o.key} style={{ display: 'flex', gap: 12, alignItems: 'start', padding: '14px 16px', border: `1px solid ${o.available ? 'var(--line)' : 'var(--line)'}`, background: o.available ? 'var(--bg)' : 'var(--surface2)', borderRadius: 10, cursor: o.available ? 'pointer' : 'not-allowed' }}>
                      <input type="radio" name="outcome" value={o.key} disabled={!o.available} style={{ marginBlockStart: 4 }} />
                      <span>
                        <span style={{ display: 'block', fontSize: '14.5px', lineHeight: 1.5, color: o.available ? 'var(--ink)' : 'var(--muted)' }}>
                          <L en={o.en} ar={o.ar} />
                        </span>
                        {!o.available ? (
                          <span style={{ display: 'block', marginBlockStart: 8 }}>
                            <span style={{ display: 'block', fontSize: '11.5px', letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 4 }}>
                              <L en={`Unavailable — ${o.blockers.length} outstanding`} ar={`غير متاح — ${o.blockers.length} قائم`} />
                            </span>
                            {o.blockers.map((b) => (
                              <span key={b.en} style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.55 }}>
                                <L en={b.en} ar={b.ar} />
                              </span>
                            ))}
                            <span style={{ display: 'block', marginBlockStart: 8, fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
                              <L en="Everything must be complete before a clearance is shown. The other two outcomes stay available." ar="يجب أن يكتمل كل شيء قبل إظهار الاستيفاء. وتبقى النتيجتان الأخريان متاحتين." />
                            </span>
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBlockEnd: 14 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    <L en="Note to the organizer, sent as written" ar="ملاحظة إلى المنظّم، تُرسل كما هي" />
                  </span>
                  <textarea name="note" rows={3} style={{ padding: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, lineHeight: 1.6, resize: 'vertical' }} />
                </label>
                <button type="submit" style={{ height: 42, paddingInline: 20, border: 0, borderRadius: 21, background: 'var(--brand)', color: 'var(--bg)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  <L en="Record the outcome" ar="تسجيل النتيجة" />
                </button>
              </form>
              <div style={{ marginBlockStart: 16, paddingBlockStart: 14, borderBlockStart: '1px solid var(--line)' }}>
              </div>
            </div>
          ) : null}

          {/* WHAT THE MINISTRY'S REVIEW IS AND IS NOT. Outside the recording panel,
              because it was inside it: once a determination was recorded the panel
              disappeared and took these two sentences with it -- and they matter most
              AFTER a determination exists, when somebody is deciding what it means. */}
          <div data-region="limits" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBlockEnd: 20 }}>
            {MINISTRY_CONTENT.outcomeLimits.map((l, i) => (
              <div key={l.en} style={i === 0 ? { marginBlockEnd: 8 } : undefined}>
                <L en={l.en} ar={l.ar} />
              </div>
            ))}
          </div>

          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Determination history" ar="سجل النتائج" />
          </h2>
          <div data-region="determinations" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* BOTH, and which is which. A revision does not remove what it
                replaced: the organizer was notified of the earlier determination and
                may have acted on it, so it stays on the record marked as replaced. */}
            {determinations.map((d) => {
              const def = MINISTRY_CONTENT.outcomes.find((o) => o.key === d.outcome);
              return (
                <div key={d.id} style={{ paddingBlock: '15px', paddingInlineStart: '18px', paddingInlineEnd: '19px', background: 'var(--surface2)', borderInlineStart: `3px ${d.superseded ? 'dashed var(--muted)' : `solid ${d.outcome === 'satisfied' ? 'var(--brand)' : 'var(--accent)'}`}`, borderRadius: 10, opacity: d.superseded ? 0.75 : 1 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '14.5px', lineHeight: 1.5 }}>
                      <L en={def?.en ?? d.outcome} ar={def?.ar ?? d.outcome} />
                    </span>
                    <span style={{ flex: 'none', padding: '2px 9px', borderRadius: 999, background: d.superseded ? 'var(--surface2)' : 'var(--brand-soft)', color: d.superseded ? 'var(--muted)' : 'var(--brand)', fontSize: 12 }}>
                      <L
                        en={d.superseded ? DT.supersededChipEn : DT.standsChipEn}
                        ar={d.superseded ? DT.supersededChipAr : DT.standsChipAr}
                      />
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, fontVariantNumeric: 'tabular-nums' }}>
                    {d.recordedAt} · {d.recordedBy}
                  </div>
                  {d.note ? <div style={{ fontSize: '13px', color: 'var(--muted)', marginBlockStart: 6, lineHeight: 1.6 }}>{d.note}</div> : null}
                  {d.revisionReason ? (
                    <div style={{ marginBlockStart: 8 }}>
                      <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                        <L en={DT.revisionReasonLabelEn} ar={DT.revisionReasonLabelAr} />
                      </div>
                      <div style={{ fontSize: '13px', lineHeight: 1.65, marginBlockStart: 3 }}>{d.revisionReason}</div>
                    </div>
                  ) : null}
                  {d.superseded ? (
                    <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 6 }}>
                      <L en={DT.replacedNoteEn} ar={DT.replacedNoteAr} />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {determinations.length === 0 ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en="No determination has been recorded." ar="لم تُسجَّل أي نتيجة." />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <MinistryFooter
        steps={[
          { href: '/ministry/queue', en: 'Review queue', ar: 'قائمة المراجعة', descEn: 'Back to the filed submissions.', descAr: 'العودة إلى التقديمات.' },
          { href: '/ministry/enquiries', en: 'Enquiries', ar: 'الاستفسارات', descEn: 'Questions against a determination.', descAr: 'أسئلة على نتيجة.' },
        ]}
      />
    </MinistryShell>
  );
}
