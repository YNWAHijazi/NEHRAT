import { InfoNote } from '../../../components/InfoNote';
import { accountContact } from '../../../lib/account-contact';
import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { RegisterVenueForm } from './RegisterVenueForm';
import { currentAccount, organizationFor } from '../../../lib/auth';
import { unreadCountFor } from '../../../lib/queries';
import { VENUE_REGISTRATION_FIELDS, VENUE_REASSESSMENT_TRIGGERS } from '../../../lib/rules';
import { BANDS, DOMAINS, DOMAIN_COUNT, MAX_SCORE_PER_DOMAIN, MINIMUM_CONDITIONS } from '../../../lib/rules/load';

/**
 * Register a recurring venue: the identity fields, then the annual assessment, on one page
 * (owner, 8 October 2026 -- the event's intake). A VN number is minted with the assessment's
 * first version and the operator lands on the venue record, its requirements already derived.
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
            <L en="Register a hosting venue" ar="تسجيل موقع مستضيف للفعاليات" />
          </h1>
          {/* The every-field-is-required banner left this screen (partner ruling,
              second sweep): the one optional field says so on its own label. */}


          <RegisterVenueForm me={accountContact(account.id)} fields={[...VENUE_REGISTRATION_FIELDS]} assessment={{ domains: [...DOMAINS], conditions: [...MINIMUM_CONDITIONS], bands: [...BANDS], maxScore: DOMAIN_COUNT * MAX_SCORE_PER_DOMAIN, triggers: [...VENUE_REASSESSMENT_TRIGGERS] }} />

          <div data-region="exempt-footnote"><InfoNote>
            <L
              en="A specific event held at this venue may still enter the process on its own criteria. Registering a venue does not exempt events held there."
              ar="قد تدخل فعالية بعينها تُقام في هذا الموقع في الآلية بحسب معاييرها الخاصة. تسجيل الموقع لا يعفي الفعاليات التي تُقام فيه."
            />
          </InfoNote></div>
        </div>

      </main>
    </>
  );
}
