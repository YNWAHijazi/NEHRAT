import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { SequenceFooter } from '../../../../components/SequenceFooter';
import { currentAccount } from '../../../../lib/auth';
import { invitationForEvent, unreadCountFor } from '../../../../lib/queries';
import { ROLES_CONTENT } from '../../../../lib/rules';
import { saveOpsDetailAction } from '../../../actions';
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
      <Header account={account} organization={null} unreadCount={unread} showBack={true} />
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
            <L en="Event participation — Level 2" ar="المشاركة في الفعالية — المستوى 2" />
          </h1>

          <div data-region="l2-intro" style={{ padding: '24px 28px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 14, marginBlockEnd: 32, maxWidth: '76ch' }}>
            <div style={{ fontSize: 16, lineHeight: 1.65 }}>
              <L en={content.level2Intro.en} ar={content.level2Intro.ar} />
            </div>
          </div>

          <form action={saveOpsDetailAction.bind(null, invitation.token)}>
            <div data-region="ops-detail" style={{ padding: 32, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, marginBlockEnd: 20 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 16 }}>
                <L en="Operational detail for the organizer" ar="التفاصيل التشغيلية للمنظّم" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16 }}>
                {content.level2Fields.map((f) => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.4 }}>
                      <L en={f.en} ar={f.ar} />
                    </span>
                    <input name={f.key} defaultValue={invitation.opsDetail[f.key] ?? ''} style={{ height: 44, paddingInline: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15 }} />
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <button type="submit" style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                <L en="Confirm participation and send to the organizer" ar="تأكيد المشاركة وإرسالها إلى المنظّم" />
              </button>
            </div>
          </form>

          <DeclineBlock token={invitation.token} />
        </div>
        <SequenceFooter
          labelEn="Next in the sequence"
          labelAr="التالي في التسلسل"
          steps={[
            {
              href: `/events/${id}/documents`,
              en: 'Shared documents',
              ar: 'المستندات المشتركة',
              descEn: 'One list, visible to your organization and to the organizer.',
              descAr: 'قائمة واحدة تظهر لمؤسستكم وللمنظّم.',
            },
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
