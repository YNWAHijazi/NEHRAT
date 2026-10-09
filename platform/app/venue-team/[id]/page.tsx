import { redirect } from 'next/navigation';
import { currentAccount } from '../../../lib/auth';
import { VenuePartnersRetired } from '../../../components/venue/VenuePartnersRetired';

/** A medical partner's venue page (retired 8 October 2026): venues take no medical partners. */
export default async function VenueMedicalWork() {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  return <VenuePartnersRetired account={account} />;
}
