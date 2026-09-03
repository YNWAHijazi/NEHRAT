import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { currentAccount, organizationFor } from '../../../lib/auth';
import { unreadCountFor } from '../../../lib/queries';
import { BANDS, DOMAINS, DOMAIN_COUNT, MAX_SCORE_PER_DOMAIN, MINIMUM_CONDITIONS } from '../../../lib/rules';
import { AssessmentForm } from './AssessmentForm';

export default async function NewEventPage() {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" data-region="assessment" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <AssessmentForm domains={[...DOMAINS]} conditions={[...MINIMUM_CONDITIONS]} bands={[...BANDS]} maxScore={DOMAIN_COUNT * MAX_SCORE_PER_DOMAIN} />
      </main>
    </>
  );
}
