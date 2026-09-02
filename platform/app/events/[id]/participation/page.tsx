import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { currentAccount } from '../../../../lib/auth';
import { invitationForEvent, unreadCountFor } from '../../../../lib/queries';
import { ROLES_CONTENT } from '../../../../lib/rules';
import { saveOpsDetailAction, withdrawParticipationAction } from '../../../actions';
import { DeclineBlock } from './DeclineBlock';

/**
 * Event participation -- Level 2. Operational detail for the organizer's plan; no
 * declaration exists at this level (SPEC), so none is shown, greyed or otherwise.
 * The route exists only for the account the invitation names (rule 6).
 */
export default async function ParticipationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const invitation = invitationForEvent(account.id, id, 'ems');
  if (!invitation) notFound();
  if (invitation.eventLevel === 3) redirect(`/events/${id}/declaration`);
  const { notice } = await searchParams;
  const unread = unreadCountFor(account.id);
  const content = ROLES_CONTENT.ems;

  return (
    <>
      <GovernmentBand />
      {/* Back goes to the event summary, the screen this requirement belongs to.
          /events/[id] itself has no EMS surface. A closed nomination has no brief
          either, so its back path is the generic Dashboard pill. */}
      <Header
        account={account}
        organization={null}
        unreadCount={unread}
        showBack={true}
        {...(invitation.status === 'nominated' || invitation.status === 'confirmed'
          ? { back: { href: `/events/${id}/brief`, en: 'Event summary', ar: 'ملخص الفعالية' } }
          : {})}
      />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          {notice === 'sent' ? (
            <div style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              <L en="Participation confirmed. The operational detail has been sent to the organizer." ar="تأكدت المشاركة. وأُرسلت التفاصيل التشغيلية إلى المنظّم." />
            </div>
          ) : null}
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
            <L
              en={`${invitation.eventNameEn} · ${invitation.organizationNameEn} · ${invitation.eventStart ?? ''}`}
              ar={`${invitation.eventNameAr} · ${invitation.organizationNameAr} · ⁦${invitation.eventStart ?? ''}⁩`}
            />
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L
              en={`Event participation — Level ${invitation.eventLevel ?? ''}`}
              ar={`المشاركة في الفعالية — المستوى ${invitation.eventLevel ?? ''}`}
            />
          </h1>

          <div data-region="l2-intro" style={{ padding: '24px 28px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 16, marginBlockEnd: 32, maxWidth: '76ch' }}>
            <div style={{ fontSize: 16, lineHeight: 1.65 }}>
              <L en={content.level2Intro.en} ar={content.level2Intro.ar} />
            </div>
          </div>

          {invitation.status === 'confirmed' ? (
            <details style={{ marginBlockEnd: 24 }}>
              <summary style={{ cursor: 'pointer', fontSize: '13.5px', color: 'var(--muted)', listStyle: 'none' }}>
                <span style={{ textDecoration: 'underline' }}>
                  <L en="Withdraw from this event" ar="الانسحاب من هذه الفعالية" />
                </span>
              </summary>
              <form action={withdrawParticipationAction.bind(null, invitation.token)} style={{ marginBlockStart: 10, padding: '14px 18px', background: 'var(--accent-soft)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <span style={{ flex: 1, minWidth: 260, fontSize: '13px', color: 'var(--accent-ink)', lineHeight: 1.6 }}>
                  <L
                    en="If you withdraw, the organizer is told, with your reason as written, and may need to name another provider. For a filed submission this is a material change they must report."
                    ar="إذا انسحبتم، يُبلَّغ المنظّم بسببكم كما كُتب، وقد يحتاج إلى تسمية مزوّد آخر. وللملف المقدَّم هذا تغيير جوهري عليه الإبلاغ عنه."
                  />
                </span>
                <input name="reason" required aria-label="Reason" style={{ flexBasis: '100%', height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '12.5px' }} />
                <button type="submit" style={{ flex: 'none', height: 34, paddingInline: 14, border: '1px solid var(--accent)', background: 'var(--bg)', borderRadius: 17, fontSize: '12.5px', color: 'var(--accent-ink)', cursor: 'pointer' }}>
                  <L en="Withdraw — a material change" ar="الانسحاب — تغيير جوهري" />
                </button>
              </form>
            </details>
          ) : null}

          <form action={saveOpsDetailAction.bind(null, invitation.token)}>
            <div data-region="ops-detail" style={{ padding: 33, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 16 }}>
                <L en="Operational detail for the organizer" ar="التفاصيل التشغيلية للمنظّم" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16 }}>
                {content.level2Fields.map((f) => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.4 }}>
                      <L en={f.en} ar={f.ar} />
                    </span>
                    <input name={f.key} defaultValue={invitation.opsDetail[f.key] ?? ''} style={{ height: 44, paddingInline: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 22, fontSize: 15 }} />
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <button type="submit" style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                <L en="Confirm participation and send to the organizer" ar="تأكيد المشاركة وإرسالها إلى المنظّم" />
              </button>
            </div>
          </form>

          <DeclineBlock token={invitation.token} />
        </div>
      </main>
    </>
  );
}
