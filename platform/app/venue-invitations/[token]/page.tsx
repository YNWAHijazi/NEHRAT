import { currentAccount } from '../../../lib/auth';
import { VenuePartnersRetired } from '../../../components/venue/VenuePartnersRetired';

/**
 * A hosting venue's medical-team invitation (retired 8 October 2026). The link format is
 * unchanged so invitations already sent resolve to a plain statement, not a dead page.
 */
export default async function VenueInvitation() {
  return <VenuePartnersRetired account={await currentAccount()} />;
}
