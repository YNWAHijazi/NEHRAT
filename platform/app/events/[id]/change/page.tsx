import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { ChangeForm } from './ChangeForm';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { eventFor, materialChangesFor, unreadCountFor } from '../../../../lib/queries';
import { MATERIAL_CHANGE_ASPECTS } from '../../../../lib/rules';

/**
 * Report a material change. A state gate guards the route itself: before the submission
 * is filed there is nothing on file to change, so the record's action renders disabled
 * with "Available once the submission is filed" -- and this route sends the visitor back.
 */
export default async function ChangePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const { notice } = await searchParams;
  const event = eventFor(account.id, id);
  if (!event) notFound();
  if (!event.filed) redirect(`/events/${id}`);

  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const changes = materialChangesFor(account.id, id);
  const aspectByKey = Object.fromEntries(MATERIAL_CHANGE_ASPECTS.map((a) => [a.key, a]));

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} back={{ href: `/events/${id}`, en: 'Event record', ar: 'سجل الفعالية' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
            <L en={`${event.nameEn} · ${event.startDate ?? ''}`} ar={`${event.nameAr} · ⁦${event.startDate ?? ''}⁩`} />
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Report a material change" ar="الإبلاغ عن تغيير جوهري" />
          </h1>
          <p style={{ margin: '0 0 36px', fontSize: 16, color: 'var(--muted)', lineHeight: 1.6, maxWidth: '74ch' }}>
            <L
              en="Notify the Ministry without undue delay of a change affecting the assessment or the medical plan."
              ar="أبلغوا الوزارة دون تأخير غير مبرر بأي تغيير يؤثر في التقييم أو في الخطة الطبية."
            />
          </p>

          {notice === 'reported' ? (
            <div style={{ padding: '18px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 28, fontSize: '14.5px', lineHeight: 1.6 }}>
              <L
                en="The change has been notified to the Ministry. It appears in the record's history below; the Ministry may require revised documents."
                ar="أُبلغت الوزارة بالتغيير. ويظهر في سجل التغييرات أدناه؛ وقد تطلب الوزارة مستندات منقّحة."
              />
            </div>
          ) : null}

          <ChangeForm eventId={id} aspects={[...MATERIAL_CHANGE_ASPECTS]} />

          {changes.length > 0 ? (
            <div style={{ marginBlockStart: 44 }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
                <L en="Changes reported on this event" ar="التغييرات المبلَّغ عنها في هذه الفعالية" />
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                {changes.map((c) => (
                  <div key={c.id} style={{ background: 'var(--bg)', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', marginBlockEnd: 6 }}>
                      <span style={{ fontSize: '14.5px', fontWeight: 500 }}>
                        {c.aspects.map((k, i) => {
                          const a = aspectByKey[k];
                          return a ? (
                            <span key={k}>
                              {i > 0 ? ' · ' : ''}
                              <L en={a.en} ar={a.ar} />
                            </span>
                          ) : null;
                        })}
                      </span>
                      <span style={{ fontSize: 14, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{c.reportedAt.slice(0, 10)}</span>
                    </div>
                    <div style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6 }}>{c.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

      </main>
    </>
  );
}
