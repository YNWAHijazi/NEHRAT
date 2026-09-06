import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { RegisterVenueForm } from './RegisterVenueForm';
import { currentAccount, organizationFor } from '../../../lib/auth';
import { unreadCountFor } from '../../../lib/queries';
import { VENUE_REGISTRATION_FIELDS } from '../../../lib/rules';

/**
 * Register a recurring venue: the identity fields and Submit (partner ruling,
 * 2026-09-05). The screen no longer gates registration on the capacity and
 * regularly-hosts answers -- an operator who came here to register is registered,
 * a VN number is minted, and the annual assessment opens. The two answers are
 * still captured, because the assessment derives from them; they simply stop
 * being a door.
 */
export default async function RegisterVenuePage() {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Register a recurring venue" ar="تسجيل موقع فعاليات دوري" />
          </h1>
          {/* The every-field-is-required banner left this screen (partner ruling,
              second sweep): the one optional field says so on its own label. */}


          <RegisterVenueForm fields={[...VENUE_REGISTRATION_FIELDS]} />

          <div data-region="exempt-footnote" style={{ padding: '23px 27px', background: 'var(--surface2)', borderRadius: 12, marginBlockStart: 20, fontSize: 15, lineHeight: 1.65, color: 'var(--muted)' }}>
            <L
              en="A specific event held at this venue may still enter the process on its own criteria. Registering a venue does not exempt events held there."
              ar="قد تدخل فعالية بعينها تُقام في هذا الموقع في الآلية بحسب معاييرها الخاصة. تسجيل الموقع لا يعفي الفعاليات التي تُقام فيه."
            />
          </div>
        </div>

      </main>
    </>
  );
}
