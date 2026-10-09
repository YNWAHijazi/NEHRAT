import Link from 'next/link';
import { GovernmentBand, Header } from '../Header';
import { L } from '../L';
import type { Account } from '../../lib/auth';
import { unreadCountFor } from '../../lib/queries';

/**
 * Where a venue medical-team link lands now (Hosting Venue Registration, revised logic,
 * 8 October 2026): a hosting venue registration names no EMS agency and no Medical
 * Director -- each event at the venue names its own. Links already sent keep resolving
 * to this plain statement rather than to a dead page.
 */
export function VenuePartnersRetired({ account }: { account: Account | null }) {
  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={null} unreadCount={account ? unreadCountFor(account.id) : 0} showBack />
      <main data-pad="" data-region="venue-partners-retired" style={{ maxWidth: 760, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <h1 style={{ margin: '0 0 16px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
          <L en="This venue invitation is no longer active" ar="لم تعد دعوة الموقع هذه سارية" />
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 16, lineHeight: 1.7 }}>
          <L
            en="A hosting venue registration no longer names an EMS agency or an Event Medical Director. Each event held at the venue names its own, and you may be invited to that event directly."
            ar="لم يعد تسجيل موقع الاستضافة يسمّي جهة إسعاف أو مديراً طبياً للفعالية. تسمّي كل فعالية تُقام في الموقع الجهات الخاصة بها، وقد تُدعون إلى تلك الفعالية مباشرة."
          />
        </p>
        <Link href={account ? '/dashboard' : '/'} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, paddingInline: 22, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500 }}>
          {account ? <L en="Go to the dashboard" ar="الانتقال إلى لوحة المتابعة" /> : <L en="Go to the home page" ar="الانتقال إلى الصفحة الرئيسية" />}
        </Link>
      </main>
    </>
  );
}
