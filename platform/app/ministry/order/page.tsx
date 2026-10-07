import { InfoNote } from '../../../components/InfoNote';
import { L } from '../../../components/L';
import { MinistryShell } from '../../../components/MinistryShell';
import { notFound, redirect } from 'next/navigation';
import { currentAccount } from '../../../lib/auth';
import { attestationRecordsFor, orderLaneOn, orderLaneSubmissions } from '../../../lib/queries';
import { eventRecordRequirements, requirementSnapshotFor } from '../../../lib/record-facts';
import { ATTESTATIONS_CONTENT, attestationRows, can, type RequirementInstance } from '../../../lib/rules';
import { recordAttestationAction } from '../../ministry-actions';

/** The plan sections the Order's clinical item names: 3 to 9 and 11. */
const CLINICAL_SECTIONS = [3, 4, 5, 6, 7, 8, 9, 11];

/** One answered row of the filed plan, as a line: each field's label and value, or the row's state. */
function answerLine(inst: RequirementInstance, lang: 'en' | 'ar'): string {
  const parts = inst.fields
    .filter((f) => inst.values[f.key] !== undefined && inst.values[f.key] !== '' && inst.values[f.key] !== false)
    .map((f) => {
      const label = lang === 'en' ? f.labelEn : f.labelAr;
      const v = inst.values[f.key];
      return typeof v === 'boolean' ? label : `${label} — ${String(v)}`;
    });
  return parts.length > 0 ? parts.join(' · ') : lang === 'en' ? inst.stateEn : inst.stateAr;
}

const smallButton: React.CSSProperties = { height: 32, paddingInline: 13, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 16, fontSize: '12.5px', cursor: 'pointer' };

/**
 * The Order of Physicians lane. Configurable, non-determinative, off by default, and it
 * NEVER extends into the facility lane. With the lane off, the off state is the whole
 * screen. With it on, the Order sees the filed Level 3 submissions designated to it
 * (partner review, 2026-10-07): the Director's credential information, its two review
 * items to record with an audit line, and the clinical content of the plan as filed.
 * Its verification is distinct from the Ministry's outcome, which stays the Ministry's.
 */
export default async function OrderLanePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // TWO permissions admit here: the console's (a reviewer or administrator reading
  // the lane state) and the Order's own -- this page is the order role's landing
  // route, and gating on viewMinistry alone sent that role's sign-in to a 404 of
  // its own page.
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!can(account.role, 'viewMinistry') && !can(account.role, 'orderVerify')) notFound();
  const { error } = await searchParams;
  const active = orderLaneOn();
  const mayRecord = active && can(account.role, 'orderVerify');
  const submissions = active ? orderLaneSubmissions(account.isDemo) : [];
  const DV = ATTESTATIONS_CONTENT.directorVerification;
  const AP = ATTESTATIONS_CONTENT.panel;

  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }}>
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Order of Physicians lane" ar="مسار نقابة الأطباء" />
       <InfoNote><L
          en="The lane informs the Ministry; it never records an outcome and never reaches the facility side."
          ar="يُعلم المسار الوزارة؛ ولا يسجّل أي نتيجة ولا يصل إلى جانب المرافق."
        /></InfoNote>
</h1>

      {!active ? (
        <div data-region="lane-off" style={{ padding: '28px 32px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, maxWidth: '86ch' }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 10 }}>
            <L en="Lane not active" ar="المسار غير مفعّل" />
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75 }}>
            <L
              en="Order of Physicians review is off. The platform owner can enable it in settings."
              ar="مراجعة نقابة الأطباء غير مفعّلة. يمكن لمالك المنصة تفعيلها من الإعدادات."
            />
          </p>
        </div>
      ) : (
        <>
          <div data-region="lane-on" style={{ padding: '24px 28px', border: '1px solid var(--brand)', borderRadius: 16, maxWidth: '86ch', fontSize: 15, lineHeight: 1.7, marginBlockEnd: 28 }}>
            <L
              en="Review your assigned Level 3 medical items here. You can see the assessment, event level, medical staff, clinical roles and licences. Business details and facility records are not shared."
              ar="راجعوا هنا البنود الطبية المسندة إليكم للمستوى 3. يمكنكم عرض التقييم ومستوى الفعالية والطاقم الطبي والأدوار السريرية والتراخيص. لا تُشارك البيانات التجارية أو سجلات المنشآت."
            />
          </div>
          {error === 'deficiency-reason' ? (
            <div role="alert" style={{ padding: '14px 18px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 12, marginBlockEnd: 20, fontSize: '14px' }}>
              <L en="A reason is required to record a deficiency." ar="يلزم ذكر السبب لتسجيل النقص." />
            </div>
          ) : null}
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}><L en={DV.laneTitleEn} ar={DV.laneTitleAr} /></h2>
          <p style={{ margin: '0 0 18px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '80ch' }}><L en={DV.readOnlyEn} ar={DV.readOnlyAr} /></p>
          {submissions.length === 0 ? (
            <p data-region="order-empty" style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}><L en={DV.laneEmptyEn} ar={DV.laneEmptyAr} /></p>
          ) : null}
          {submissions.map((s) => {
            const items = attestationRows(3, attestationRecordsFor(s.eventId), true).filter((t) => t.authority === 'order');
            // The plan as frozen at filing; a submission filed before the frozen record existed is read live, and says so.
            const frozen = requirementSnapshotFor('event', s.eventId);
            const plan = frozen?.plan ?? eventRecordRequirements(s.accountId, s.eventId)?.plan ?? [];
            const clinical = plan.filter((sec) => CLINICAL_SECTIONS.includes(sec.n));
            return (
              <section key={s.eventId} id={`event-${s.eventId}`} data-region="order-submission" data-event={s.eventId} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: '22px 26px', marginBlockEnd: 20 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}><L en={s.nameEn} ar={s.nameAr} /></h3>
                  <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    <L en={`${s.mophReference ?? s.eventId} · Level 3 · filed ${s.filedAt ?? ''}`} ar={`${s.mophReference ?? s.eventId} · المستوى 3 · قُدّم في ⁦${s.filedAt ?? ''}⁩`} />
                  </span>
                </div>
                <div data-region="order-director" style={{ fontSize: '14.5px', lineHeight: 1.6, marginBlockEnd: 16 }}>
                  <span style={{ display: 'block', fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 4 }}><L en={DV.directorEn} ar={DV.directorAr} /></span>
                  {s.director ? (
                    <L
                      en={`${s.director.nameEn} · ${DV.licenceEn}: ${s.director.licence ?? DV.licenceMissingEn}${s.director.phone ? ` · ${s.director.phone}` : ''}${s.director.acceptedAt ? ` · ${DV.acceptedEn} ${s.director.acceptedAt}` : ''}`}
                      ar={`${s.director.nameAr} · ${DV.licenceAr}: ${s.director.licence ?? DV.licenceMissingAr}${s.director.phone ? ` · ⁦${s.director.phone}⁩` : ''}${s.director.acceptedAt ? ` · ${DV.acceptedAr} ⁦${s.director.acceptedAt}⁩` : ''}`}
                    />
                  ) : <L en={DV.noDirectorEn} ar={DV.noDirectorAr} />}
                </div>
                <div data-region="order-items" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 16 }}>
                  {items.map((t) => {
                    const st = ATTESTATIONS_CONTENT.states[t.state];
                    const done = t.state === 'complete';
                    return (
                      <div key={t.key} data-att-item={t.key} data-att-state={t.state} style={{ paddingBlock: 14, paddingInline: 16, background: 'var(--surface2)', borderInlineStart: `3px solid ${done ? 'var(--brand)' : 'var(--accent-ink)'}`, borderRadius: 10 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 6 }}>
                          <span style={{ fontSize: 14, lineHeight: 1.45, flex: 1, minWidth: 220 }}><L en={t.en} ar={t.ar} /></span>
                          <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: done ? 'var(--brand-soft)' : 'var(--accent-soft)', color: done ? 'var(--brand)' : 'var(--accent-ink)', fontSize: '12.5px' }}><L en={st.en} ar={st.ar} /></span>
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5 }}>
                          <L en={done ? `${AP.attestedByEn} ${t.attestedBy ?? ''} · ${t.attestedAt ?? ''}` : AP.notYetEn} ar={done ? `${AP.attestedByAr} ${t.attestedBy ?? ''} · ${t.attestedAt ? `⁦${t.attestedAt}⁩` : ''}` : AP.notYetAr} />
                        </div>
                        {!done && (t.reasonEn || t.reasonAr) ? (
                          <div style={{ marginBlockStart: 8, padding: '10px 12px', background: 'var(--accent-soft)', borderRadius: 8, fontSize: '12.5px', lineHeight: 1.55, color: 'var(--accent-ink)' }}>
                            <span style={{ display: 'block', fontWeight: 500, marginBlockEnd: 3 }}><L en={AP.pendingBecauseEn} ar={AP.pendingBecauseAr} /></span>
                            <L en={t.reasonEn ?? t.reasonAr ?? ''} ar={t.reasonAr ?? t.reasonEn ?? ''} />
                          </div>
                        ) : null}
                        {mayRecord ? (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBlockStart: 10 }}>
                            {!done ? (
                              <form action={recordAttestationAction.bind(null, s.eventId)}>
                                <input type="hidden" name="itemKey" value={t.key} />
                                <input type="hidden" name="kind" value="attest" />
                                <input type="hidden" name="returnTo" value="order" />
                                <button type="submit" style={smallButton}><L en={AP.attestEn} ar={AP.attestAr} /></button>
                              </form>
                            ) : null}
                            <form action={recordAttestationAction.bind(null, s.eventId)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <input type="hidden" name="itemKey" value={t.key} />
                              <input type="hidden" name="kind" value="deficiency" />
                              <input type="hidden" name="returnTo" value="order" />
                              <input name="reason" required aria-label="Deficiency" style={{ height: 32, paddingInline: 10, minWidth: 220, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '12.5px' }} />
                              <button type="submit" style={smallButton}><L en={done ? AP.deficiencyReopenEn : AP.deficiencyEn} ar={done ? AP.deficiencyReopenAr : AP.deficiencyAr} /></button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <details data-region="order-plan" className="record-details">
                  <summary><L en={DV.planEn} ar={DV.planAr} /></summary>
                  {!frozen && clinical.length > 0 ? <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: 'var(--muted)' }}><L en={DV.planLiveEn} ar={DV.planLiveAr} /></p> : null}
                  {clinical.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}><L en={DV.planMissingEn} ar={DV.planMissingAr} /></p>
                  ) : clinical.map((sec) => (
                    <div key={sec.key} style={{ paddingBlock: 12, borderBlockEnd: '1px solid var(--line)', fontSize: 14, lineHeight: 1.6 }}>
                      <div style={{ fontWeight: 600 }}><L en={`${sec.n}. ${sec.en}`} ar={`${sec.n}. ${sec.ar}`} /></div>
                      {sec.text ? <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{sec.text}</p> : null}
                      {sec.linked.map((inst) => (
                        <div key={inst.key} style={{ marginBlockStart: 4, color: 'var(--muted)' }}>
                          <L en={`${inst.labelEn}: ${answerLine(inst, 'en')}`} ar={`${inst.labelAr}: ${answerLine(inst, 'ar')}`} />
                        </div>
                      ))}
                    </div>
                  ))}
                </details>
              </section>
            );
          })}
        </>
      )}
    </MinistryShell>
  );
}
