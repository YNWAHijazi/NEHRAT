import { notFound } from 'next/navigation';
import { L } from '../../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import {
  addedMeasuresFor,
  determinationsFor,
  inspectionsFor,
  submissionForReview,
  derivationForReview,
} from '../../../../lib/queries';
import { MINISTRY_CONTENT, can, documentsForLevel, outcomeAvailability } from '../../../../lib/rules';
import {
  assignReviewAction,
  clearMeasureAction,
  outcomeBlockersFor,
  recordInspectionAction,
  recordOutcomeAction,
  requireMeasureAction,
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
  const inspections = inspectionsFor(id);
  const blockers = await outcomeBlockersFor(id);
  const outcomes = outcomeAvailability(blockers);
  const internal = MINISTRY_CONTENT.internalStates[review.state];
  const mayRecord = can(account.role, 'recordOutcome');
  const mayMeasure = can(account.role, 'requireMeasures');
  const mayInspect = can(account.role, 'scheduleInspection');
  const catalog = review.level ? documentsForLevel(review.level) : [];

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
              <span style={{ padding: '3px 9px', borderRadius: 3, borderInlineStart: `2px solid var(--l${review.level})`, background: `var(--l${review.level}s)`, fontSize: 13 }}>
                <L en={`Level ${review.level}`} ar={`المستوى ${review.level}`} />
              </span>
            ) : null}
            {/* Internal workflow state: grey, quiet, not a determination. */}
            <span data-region="review-state" style={{ padding: '3px 9px', borderRadius: 3, background: 'var(--surface2)', color: 'var(--muted)', fontSize: 13 }}>
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
      <div data-region="derivation" style={{ padding: '18px 24px', border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 24 }}>
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
              return (
                <div key={p.nameEn} style={{ padding: '14px 18px', border: '1px solid var(--line)', borderInlineStart: `3px ${p.declaration === 'signed' ? 'solid var(--brand)' : 'dashed var(--accent-ink)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14.5px' }}>
                    <L en={p.nameEn} ar={p.nameAr} />
                  </span>
                  <span style={{ display: 'flex', gap: 8, flex: 'none', alignItems: 'center' }}>
                    {review.level === 3 ? (
                      <span style={{ padding: '3px 9px', borderRadius: 4, background: chip.bg, color: chip.color, fontSize: '12.5px' }}>
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

          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Inspections" ar="التفتيشات" />
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '78ch' }}>
            <L
              en="Findings are not an outcome and never decide one. A blocking inspection without recorded findings gates only the satisfied outcome."
              ar="النتائج الميدانية ليست نتيجة قرار ولا تقرر واحدة. والتفتيش الحاجب دون نتائج مسجَّلة يحجب النتيجة المستوفاة فقط."
            />
          </p>
          <div data-region="inspections" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 28 }}>
            {inspections.map((i) => (
              <div key={i.id} style={{ padding: '16px 18px', border: '1px solid var(--line)', borderInlineStart: `3px ${i.state === 'recorded' ? 'solid var(--brand)' : i.state === 'none' ? 'dashed var(--bad)' : 'solid var(--accent)'}`, borderRadius: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: i.findings || mayInspect ? 10 : 0 }}>
                  <span style={{ fontSize: '14.5px', lineHeight: 1.5 }}>
                    <L en={i.titleEn} ar={i.titleAr} />
                    {i.blocking ? (
                      <span style={{ display: 'inline-block', marginInlineStart: 8, padding: '1px 7px', border: '1px solid var(--accent)', borderRadius: 3, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--accent-ink)' }}>
                        <L en="Blocking" ar="حاجب" />
                      </span>
                    ) : null}
                  </span>
                  <span style={{ padding: '3px 9px', borderRadius: 4, background: i.state === 'recorded' ? 'var(--brand-soft)' : i.state === 'none' ? 'var(--bad-soft)' : 'var(--accent-soft)', color: i.state === 'recorded' ? 'var(--brand)' : i.state === 'none' ? 'var(--bad)' : 'var(--accent-ink)', fontSize: '12.5px' }}>
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
                      <input name="date" type="date" defaultValue={i.date ?? ''} style={{ height: 36, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 220 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        <L en="Findings — recording them closes the item" ar="النتائج — تسجيلها يُقفل البند" />
                      </span>
                      <input name="findings" style={{ height: 36, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
                    </label>
                    <button type="submit" style={{ height: 36, paddingInline: 14, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 18, fontSize: 13, cursor: 'pointer' }}>
                      <L en="Save" ar="حفظ" />
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
          </div>

          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en={MINISTRY_CONTENT.additionalMeasures.en} ar={MINISTRY_CONTENT.additionalMeasures.ar} />
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '78ch' }}>
            <L en={MINISTRY_CONTENT.additionalMeasures.noteEn} ar={MINISTRY_CONTENT.additionalMeasures.noteAr} />
          </p>
          <div data-region="measures" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 16 }}>
            {measures.map((m) => {
              const doc = catalog.find((d) => d.key === m.catalogKey);
              return (
                <div key={m.id} style={{ padding: '14px 18px', border: '1px solid var(--line)', borderInlineStart: `3px solid ${m.clearedAt ? 'var(--brand)' : 'var(--accent)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14.5px', lineHeight: 1.5, flex: 1, minWidth: 240 }}>
                    <L en={doc?.en ?? m.catalogKey} ar={doc?.ar ?? m.catalogKey} />
                    {m.note ? <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3 }}>{m.note}</span> : null}
                  </span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 'none' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 4, background: m.clearedAt ? 'var(--brand-soft)' : 'var(--accent-soft)', color: m.clearedAt ? 'var(--brand)' : 'var(--accent-ink)', fontSize: '12.5px' }}>
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
                <select name="catalogKey" required style={{ height: 38, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }}>
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
                <input name="note" style={{ height: 38, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
              </label>
              <button type="submit" style={{ height: 38, paddingInline: 16, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: 13, cursor: 'pointer' }}>
                <L en="Require the measure" ar="طلب التدبير" />
              </button>
            </form>
          ) : null}
        </div>

        <div>
          {mayRecord ? (
            <div data-region="outcome" style={{ padding: 24, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 16 }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
                <L en="Record an outcome" ar="تسجيل نتيجة" />
              </h2>
              <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
                <L en="Three outcomes exist. Nothing else is a determination." ar="توجد ثلاث نتائج فقط. ما عداها ليس قراراً." />
              </p>
              <form action={recordOutcomeAction.bind(null, id)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 14 }}>
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
                <div data-region="limits" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {MINISTRY_CONTENT.outcomeLimits.map((l, i) => (
                    <div key={l.en} style={i === 0 ? { marginBlockEnd: 8 } : undefined}>
                      <L en={l.en} ar={l.ar} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Determination history" ar="سجل النتائج" />
          </h2>
          <div data-region="determinations" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {determinations.map((d, i) => {
              const def = MINISTRY_CONTENT.outcomes.find((o) => o.key === d.outcome);
              return (
                <div key={i} style={{ padding: '14px 18px', border: '1px solid var(--line)', borderInlineStart: `3px solid ${d.outcome === 'satisfied' ? 'var(--brand)' : 'var(--accent)'}`, borderRadius: 10 }}>
                  <div style={{ fontSize: '14.5px', lineHeight: 1.5 }}>
                    <L en={def?.en ?? d.outcome} ar={def?.ar ?? d.outcome} />
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, fontVariantNumeric: 'tabular-nums' }}>
                    {d.recordedAt} · {d.recordedBy}
                  </div>
                  {d.note ? <div style={{ fontSize: '13px', color: 'var(--muted)', marginBlockStart: 6, lineHeight: 1.6 }}>{d.note}</div> : null}
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
