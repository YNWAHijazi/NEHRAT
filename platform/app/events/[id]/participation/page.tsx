import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { RecordRequirements } from '../../../../components/record/RecordRequirements';
import { currentAccount } from '../../../../lib/auth';
import { invitationForEvent, nominationBriefing, nomineePlanSlice, unreadCountFor } from '../../../../lib/queries';
import { eventRecordView } from '../../../../lib/record-view';
import { withdrawParticipationAction } from '../../../actions';
import { Briefing } from '../../../invitations/[token]/Briefing';
import { RespondForm } from '../../../invitations/[token]/RespondForm';
import { SharedDocuments } from '../SharedDocuments';

/**
 * THE EMS PROVIDER'S ONE PAGE for a Level 1 or 2 event (partner ruling, counterparty
 * pass 2026-09-02: "Event details, then the operational detail fields, then the
 * signature. One page."). Event facts at the top with View more; an unanswered
 * nomination answers here; a confirmed one supplies the operational detail; the
 * shared-document requests sit beneath, because answering them is also supplying.
 * Back is the Dashboard — there is one level of depth. No declaration exists at
 * this level (SPEC), so none is shown, greyed or otherwise. The route exists only
 * for the account the invitation names (rule 6).
 */
export default async function ParticipationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; upload?: string; doc?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const invitation = invitationForEvent(account.id, id, 'ems');
  if (!invitation) notFound();
  const { notice, upload, doc } = await searchParams;
  if (invitation.eventLevel === 3) {
    redirect(`/events/${id}/declaration${notice ? `?notice=${encodeURIComponent(notice)}` : ''}`);
  }
  const unread = unreadCountFor(account.id);
  const briefing = nominationBriefing(invitation.token);
  const confirmed = invitation.status === 'confirmed';
  const plan = confirmed ? nomineePlanSlice(id) : null;
  const view = confirmed ? eventRecordView(invitation.organizerAccountId, id) : null;

  return (
    <>
      <GovernmentBand />
      {/* Back always means the dashboard in a counterparty flow (partner ruling). */}
      <Header account={account} organization={null} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          {notice === 'sent' ? (
            <div style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              <L en="Your arrangements have been shared with the organizer." ar="تمت مشاركة ترتيباتكم مع المنظّم." />
            </div>
          ) : null}
          {notice === 'accepted' || notice === 'registered' || notice === 'linked' ? (
            <div data-region="landing-notice" style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15, lineHeight: 1.65 }}>
              {notice === 'accepted' ? (
                <L en="Accepted. The organizer has been told." ar="تم القبول. وأُبلغ المنظّم." />
              ) : notice === 'registered' ? (
                <L en="Your account is set up. This event is now on your dashboard." ar="أُعدّ حسابكم. وهذه الفعالية الآن على لوحتكم." />
              ) : (
                <L en="This nomination is now linked to your account." ar="رُبط هذا الترشيح بحسابكم." />
              )}
            </div>
          ) : null}

          {briefing ? (
            <Briefing
              briefing={briefing}
              token={invitation.token}
              kind="ems"
              level={invitation.eventLevel}
              namedEn={invitation.nameEn}
              namedAr={invitation.nameAr}
              confirmed={confirmed}
              plan={plan}
            />
          ) : null}

          <h2 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L
              en={`Event participation — Level ${invitation.eventLevel ?? ''}`}
              ar={`المشاركة في الفعالية — المستوى ${invitation.eventLevel ?? ''}`}
            />
          </h2>

          {invitation.status === 'nominated' ? (
            <RespondForm token={invitation.token} kind="ems" eventLevel={invitation.eventLevel} />
          ) : null}

          {confirmed && view ? (
            <>
              <div data-region="l2-intro" style={{ padding: '20px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 16, marginBlockEnd: 28, maxWidth: '76ch' }}>
                <div style={{ fontSize: 15, lineHeight: 1.65 }}>
                  <L en="The rows below are the event's record, shared with the organizer. Record the arrangements your agency provides on the rows that name an EMS agency; the first saved answer counts once and the organizer sees it immediately." ar="الصفوف أدناه هي سجل الفعالية، مشترك مع المنظّم. سجّلوا الترتيبات التي توفّرها جهتكم في الصفوف التي تسمّي جهة إسعاف؛ تُحتسب أول إجابة محفوظة مرة واحدة ويراها المنظّم فوراً." />
                </div>
              </div>

              <div data-region="ems-record">
                <RecordRequirements record={view.record} viewerRole="ems" viewerConfirmed contentTypes={view.contentTypes} refusal={upload && doc ? { key: doc, reason: upload } : null} derived={view.derived} governance={view.governance} facility={view.facility} />
              </div>

              <div style={{ marginBlockStart: 28 }}><SharedDocuments eventId={id} token={invitation.token} /></div>

              {confirmed ? (
                <details style={{ marginBlockEnd: 24 }}>
                  <summary style={{ cursor: 'pointer', fontSize: '13.5px', color: 'var(--muted)', listStyle: 'none' }}>
                    <span style={{ textDecoration: 'underline' }}>
                      <L en="Withdraw from this event" ar="الانسحاب من هذه الفعالية" />
                    </span>
                  </summary>
                  <form action={withdrawParticipationAction.bind(null, invitation.token)} style={{ marginBlockStart: 10, padding: '14px 18px', background: 'var(--accent-soft)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <span style={{ flex: 1, minWidth: 260, fontSize: '13px', color: 'var(--accent-ink)', lineHeight: 1.6 }}>
                      <L
                        en="Your reason will be sent to the organizer. They may need another EMS agency. If the application was submitted, they must report this change to the Ministry."
                        ar="سيُرسل سببكم إلى المنظّم. وقد يحتاج إلى جهة إسعاف أخرى. إذا قُدّم الطلب، فعليه إبلاغ الوزارة بالتغيير."
                      />
                    </span>
                    <input name="reason" required aria-label="Reason" style={{ flexBasis: '100%', height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '12.5px' }} />
                    <button type="submit" style={{ flex: 'none', height: 34, paddingInline: 14, border: '1px solid var(--accent)', background: 'var(--bg)', borderRadius: 17, fontSize: '12.5px', color: 'var(--accent-ink)', cursor: 'pointer' }}>
                      <L en="Withdraw from this event" ar="الانسحاب من الفعالية" />
                    </button>
                  </form>
                </details>
              ) : null}
            </>
          ) : invitation.status === 'nominated' ? null : (
            <div style={{ padding: '20px 26px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 12, fontSize: 15, lineHeight: 1.65, maxWidth: '76ch' }}>
              <L en="Your part in this event is closed. Nothing more is needed from you." ar="أُغلق دوركم في هذه الفعالية. ولا يُطلب منكم شيء بعد الآن." />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
