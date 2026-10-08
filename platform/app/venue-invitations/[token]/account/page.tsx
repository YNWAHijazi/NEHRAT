import { currentAccount } from '../../../../lib/auth';
import { VenuePartnersRetired } from '../../../../components/venue/VenuePartnersRetired';

/** Stage three of a venue nomination (retired 8 October 2026): nothing to accept. */
export default async function VenueNominationAccountPage() {
  return <VenuePartnersRetired account={await currentAccount()} />;
}
