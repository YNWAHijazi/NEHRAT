import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { SequenceFooter } from '../../../../components/SequenceFooter';
import { ReturnReportBlock } from './ReturnReportBlock';
import { currentAccount } from '../../../../lib/auth';
import { invitationForEvent, postEventReportFor, unreadCountFor } from '../../../../lib/queries';
import { beirutToday } from '../../../../lib/clock';
import { POST_EVENT_CERTIFICATION_STATEMENT, POST_EVENT_ACTIVITY_FIELDS, POST_EVENT_REPORT, POST_EVENT_SIGNIFICANT, ROLES_CONTENT, postEventReportWindow } from '../../../../lib/rules';
import { signPostEventReportAction } from '../../../actions';

/**
 * The Director's side of the post-event medical report: the organizer's figures,
 * read-only, and the second signature. At Level 3 the report carries two signatures
 * and is not complete with the organizer's alone.
 */
export default async function DirectorReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const invitation = invitationForEvent(account.id, id, 'director');
  if (!invitation) notFound();
  const { notice } = await searchParams;
  const unread = unreadCountFor(account.id);
  const content = ROLES_CONTENT.director;
  const report = postEventReportFor(invitation.organizerAccountId, id);
  const today = beirutToday();
  // The shared rule, not this screen's own arithmetic -- the two disagreed by a day
  // until the rule was corrected, and a screen that computes its own deadline is how
  // that disagreement survived. No screen implements its own gating.
  const due = invitation.eventEnd
    ? postEventReportWindow(new Date(`${invitation.eventEnd}T12:00:00+03:00`)).due.date
    : null;
  const overdueDays = due && today > due ? Math.round((Date.parse(today) - Date.parse(due)) / 86400000) : 0;
  const directorSigned = Boolean(report?.directorSignedAt);
  const organizerSigned = Boolean(report?.organizerSignedAt);

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={null} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 940 }}>
          {notice === 'signed' ? (
            <div style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              {directorSigned && organizerSigned ? (
                <L en="Signed. The report now carries both signatures." ar="وُقّع. ويحمل التقرير الآن التوقيعين." />
              ) : (
                <L
                  en="Signed. The organizer has not yet signed; the report is complete when both signatures are recorded."
                  ar="وُقّع. لم يوقّع المنظّم بعد؛ ويكتمل التقرير بتسجيل التوقيعين معاً."
                />
              )}
            </div>
          ) : null}
          {notice === 'returned' ? (
            <div style={{ padding: '18px 24px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              <L en="Returned to the organizer with your reason." ar="أُعيد إلى المنظّم مع السبب." />
            </div>
          ) : null}
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
            <L
              en={`${invitation.eventNameEn} · ${invitation.organizationNameEn} · event end date ${invitation.eventEnd ?? ''} · Level 3`}
              ar={`${invitation.eventNameAr} · ${invitation.organizationNameAr} · تاريخ انتهاء الفعالية ⁦${invitation.eventEnd ?? ''}⁩ · المستوى 3`}
            />
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Post-event medical report" ar="التقرير الطبي لما بعد الفعالية" />
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: '76ch' }}>
            <L en={content.reportIntro.en} ar={content.reportIntro.ar} />
          </p>

          {due ? (
            <div data-region="due" style={{ padding: '26px 30px', border: `2px solid ${directorSigned ? 'var(--brand)' : 'var(--bad)'}`, background: directorSigned ? 'var(--brand-soft)' : 'var(--bad-soft)', borderRadius: 16, marginBlockEnd: 20 }}>
              <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.5, marginBlockEnd: 10 }}>
                {/* Order-independent co-signature (reviewer ruling): either party may sign
                    first; complete only when BOTH have; and no claim that the other
                    is waiting when it isn't. */}
                {directorSigned && organizerSigned ? (
                  <L en="The report is complete. Both signatures are recorded." ar="اكتمل التقرير. وسُجّل التوقيعان." />
                ) : directorSigned ? (
                  <L en="You have signed. The organizer's signature completes the report." ar="وقّعتم. وتوقيع المنظّم يُكمل التقرير." />
                ) : !report ? (
                  <L en="The organizer has not prepared the report yet. Your signature becomes available once the figures exist." ar="لم يُعِدّ المنظّم التقرير بعد. يصبح توقيعكم متاحاً متى وُجدت الأرقام." />
                ) : overdueDays > 0 ? (
                  <L en={`This report is ${overdueDays} days overdue and is waiting on your signature.`} ar={`تأخر هذا التقرير ${overdueDays} أيام وهو بانتظار توقيعكم.`} />
                ) : (
                  <L en="This report is waiting on your signature." ar="هذا التقرير بانتظار توقيعكم." />
                )}
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.7 }}>
                <L
                  en={`Due ${due}, ${POST_EVENT_REPORT.windowDays} calendar days after the event. Either signature may come first; the report is complete when both are recorded. ${organizerSigned ? 'The organizer has signed.' : 'The organizer has not yet signed.'}`}
                  ar={`مستحق في ⁦${due}⁩، ${POST_EVENT_REPORT.windowDays} أيام تقويمية بعد الفعالية. لأيٍّ من التوقيعين أن يسبق؛ ويكتمل التقرير بتسجيلهما معاً. ${organizerSigned ? 'وقّع المنظّم.' : 'لم يوقّع المنظّم بعد.'}`}
                />
              </div>
            </div>
          ) : null}

          {report ? (
            <div data-region="figures" style={{ padding: '29px 33px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 16 }}>
                <L en="The report as prepared — entered by the organizer" ar="التقرير كما أُعدّ — أدخله المنظّم" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBlockEnd: 20 }}>
                {POST_EVENT_ACTIVITY_FIELDS.map((f) => (
                  <div key={f.key} style={{ background: 'var(--bg)', padding: '16px 18px' }}>
                    <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {report.activity[f.key] ?? '—'}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, lineHeight: 1.4 }}>
                      <L en={f.en} ar={f.ar} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
                <L en="Significant events recorded" ar="الوقائع الجسيمة المسجّلة" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBlockEnd: 20 }}>
                {POST_EVENT_SIGNIFICANT.map((s) => {
                  const on = Boolean(report.significant[s.key]);
                  return (
                    <div key={s.key} style={{ background: 'var(--bg)', padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: 14 }}>
                      <span>
                        <L en={s.en} ar={s.ar} />
                      </span>
                      <span style={{ color: on ? 'var(--bad)' : 'var(--muted)' }}>
                        {on ? <L en="Yes" ar="نعم" /> : <L en="No" ar="لا" />}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
                <L en={content.reportReadOnly.en} ar={content.reportReadOnly.ar} />
              </div>
            </div>
          ) : (
            <div style={{ padding: '26px 30px', border: '1px dashed var(--line)', borderRadius: 16, marginBlockEnd: 20, fontSize: 15, color: 'var(--muted)', lineHeight: 1.65 }}>
              <L en="The organizer has not started the report yet. Your signature becomes available once it is prepared." ar="لم يبدأ المنظّم التقرير بعد. يصبح توقيعكم متاحاً بعد إعداده." />
            </div>
          )}

          {report ? (
            <div data-region="signatures" style={{ padding: '29px 33px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 16 }}>
                <L en="Signatures" ar="التواقيع" />
              </div>
              {POST_EVENT_CERTIFICATION_STATEMENT ? (
                <div data-region="certification-statement" style={{ paddingBlock: '15px', paddingInlineStart: '18px', paddingInlineEnd: '19px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 10, marginBlockEnd: 16, fontSize: '14.5px', lineHeight: 1.65, maxWidth: '78ch' }}>
                  <L en={POST_EVENT_CERTIFICATION_STATEMENT.en} ar={POST_EVENT_CERTIFICATION_STATEMENT.ar} />
                </div>
              ) : null}
              <div style={{ display: 'contents' }}>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBlockEnd: 22 }}>
                <div style={{ paddingBlock: '17px', paddingInlineStart: '20px', paddingInlineEnd: '21px', background: 'var(--surface2)', borderInlineStart: `3px ${organizerSigned ? 'solid var(--brand)' : 'dashed var(--muted)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>
                    <L en="Organizer representative" ar="ممثل المنظّم" />
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: organizerSigned ? 'var(--brand-soft)' : 'var(--surface2)', color: organizerSigned ? 'var(--brand)' : 'var(--muted)', fontSize: 13 }}>
                    {organizerSigned ? <L en="Signed" ar="وُقّع" /> : <L en="Not yet signed" ar="لم يُوقَّع بعد" />}
                  </span>
                </div>
                <div style={{ paddingBlock: '17px', paddingInlineStart: '20px', paddingInlineEnd: '21px', background: 'var(--surface2)', borderInlineStart: `3px ${directorSigned ? 'solid var(--brand)' : 'dashed var(--bad)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>
                    <L en="Event Medical Director" ar="المدير الطبي للفعالية" />
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: directorSigned ? 'var(--brand-soft)' : 'var(--bad-soft)', color: directorSigned ? 'var(--brand)' : 'var(--bad)', fontSize: 13 }}>
                    {directorSigned ? <L en="Signed" ar="وُقّع" /> : <L en="Awaiting your signature" ar="بانتظار توقيعكم" />}
                  </span>
                </div>
              </div>
              {!directorSigned ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                  <form action={signPostEventReportAction.bind(null, id)}>
                    <button type="submit" style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                      <L en="Review complete — sign the report" ar="اكتملت المراجعة — توقيع التقرير" />
                    </button>
                  </form>
                  <ReturnReportBlock eventId={id} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <SequenceFooter
          labelEn="Next in the sequence"
          labelAr="التالي في التسلسل"
          steps={[
            {
              href: '/dashboard',
              en: 'Dashboard',
              ar: 'اللوحة',
              descEn: 'Events you have been named in.',
              descAr: 'الفعاليات التي سُمّيتم فيها.',
            },
          ]}
        />
      </main>
    </>
  );
}
