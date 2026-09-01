import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../components/Header';
import { L } from '../../components/L';
import { currentAccount, organizationFor } from '../../lib/auth';
import { notificationsFor, unreadCountFor } from '../../lib/queries';
import { markNotificationReadAction } from '../actions';

/**
 * The inbox. Each row states what happened and opens the record it concerns -- the
 * notification is never the obligation: the record is where the obligation lives.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const organization = organizationFor(account.id);
  const { filter } = await searchParams;
  const all = notificationsFor(account.id);
  const unread = unreadCountFor(account.id);

  const active = filter === 'unread' || filter === 'action' || filter === 'information' ? filter : 'all';
  const rows =
    active === 'unread'
      ? all.filter((n) => !n.read)
      : active === 'action'
        ? all.filter((n) => n.kind === 'needs_action')
        : active === 'information'
          ? all.filter((n) => n.kind === 'for_information')
          : all;

  const filters = [
    { key: 'all', en: 'All', ar: 'الكل' },
    { key: 'unread', en: 'Unread', ar: 'غير المقروءة' },
    { key: 'action', en: 'Needs action', ar: 'تتطلب إجراءً' },
    { key: 'information', en: 'For information', ar: 'للاطلاع' },
  ] as const;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="Notifications" ar="الإشعارات" />
        </h1>
        <p style={{ margin: '0 0 32px', fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: '74ch' }}>
          <L
            en="Each row opens the record it concerns."
            ar="كل صف يفتح السجل الذي يخصّه."
          />
        </p>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBlockEnd: 20 }}>
          {filters.map((f) => (
            <Link
              key={f.key}
              href={f.key === 'all' ? '/notifications' : `/notifications?filter=${f.key}`}
              aria-current={active === f.key ? 'true' : undefined}
              style={{
                height: 34,
                paddingInline: 16,
                display: 'inline-flex',
                alignItems: 'center',
                border: `1px solid ${active === f.key ? 'var(--brand)' : 'var(--line)'}`,
                background: active === f.key ? 'var(--brand-soft)' : 'var(--bg)',
                color: active === f.key ? 'var(--brand)' : 'var(--ink)',
                borderRadius: 17,
                fontSize: '13.5px',
              }}
            >
              <L en={f.en} ar={f.ar} />
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 28, border: '1px dashed var(--line)', borderRadius: 12, maxWidth: '74ch' }}>
            <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)' }}>
              <L
                en="Nothing here. Notifications arrive when the Ministry acts on a submission, a named party answers, or a deadline approaches."
                ar="لا شيء هنا. تصل الإشعارات عندما تتصرف الوزارة في طلب، أو تجيب جهة مُسمّاة، أو يقترب موعد نهائي."
              />
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            {rows.map((n) => (
              <div
                key={n.id}
                style={{ background: n.read ? 'var(--bg)' : 'var(--surface)', padding: '18px 22px', display: 'flex', gap: 16, alignItems: 'start' }}
              >
                <span style={{ flex: 'none', width: 8, height: 8, borderRadius: '50%', background: n.read ? 'transparent' : 'var(--bad)', marginBlockStart: 7 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14.5px', fontWeight: n.read ? 400 : 600, lineHeight: 1.5, marginBlockEnd: 4 }}>
                    <L en={n.subjectEn} ar={n.subjectAr} />
                  </div>
                  <div style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--muted)', marginBlockEnd: 8 }}>
                    <L en={n.bodyEn} ar={n.bodyAr} />
                  </div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link href={n.recordRoute} style={{ fontSize: '13.5px', borderBlockEnd: '1px solid var(--brand)', paddingBlockEnd: 1 }}>
                      <L en="Open the record" ar="فتح السجل" />
                    </Link>
                    {!n.read ? (
                      <form
                        action={async () => {
                          'use server';
                          await markNotificationReadAction(n.id);
                        }}
                      >
                        <button type="submit" style={{ background: 'none', border: 0, padding: 0, fontSize: '13.5px', color: 'var(--muted)', cursor: 'pointer', borderBlockEnd: '1px solid var(--line)' }}>
                          <L en="Mark as read" ar="وضع علامة مقروء" />
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
                <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'end', gap: 6 }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{n.sentAt}</span>
                  <span
                    style={{
                      padding: '2px 9px',
                      borderRadius: 999,
                      fontSize: 11,
                      letterSpacing: '.04em',
                      textTransform: 'uppercase',
                      background: n.kind === 'needs_action' ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: n.kind === 'needs_action' ? 'var(--accent-ink)' : 'var(--muted)',
                    }}
                  >
                    {n.kind === 'needs_action' ? <L en="Needs action" ar="يتطلب إجراءً" /> : <L en="For information" ar="للاطلاع" />}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </>
  );
}
