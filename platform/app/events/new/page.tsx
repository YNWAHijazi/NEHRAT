import { redirect } from 'next/navigation';
import { accountContact } from '../../../lib/account-contact';
import { GovernmentBand, Header } from '../../../components/Header';
import { currentAccount, organizationFor } from '../../../lib/auth';
import { unreadCountFor } from '../../../lib/queries';
import { BANDS, DOMAINS, DOMAIN_COUNT, MAX_SCORE_PER_DOMAIN, MINIMUM_CONDITIONS } from '../../../lib/rules';
import { AssessmentForm } from './AssessmentForm';
import { siteOptions } from '../../../lib/event-site';

/**
 * Create an event. /events/new?site=SITE-nnnnnn ("Create event at this site", from a
 * Facility/Site record) opens the form linked to that site; a site the account may not
 * choose opens unlinked, and the server refuses it on save either way.
 */
export default async function NewEventPage({ searchParams }: { searchParams?: Promise<{ site?: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const site = String((await searchParams)?.site ?? '').trim().toUpperCase();
  const sites = siteOptions(account.isDemo);
  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" data-region="assessment" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <AssessmentForm domains={[...DOMAINS]} conditions={[...MINIMUM_CONDITIONS]} bands={[...BANDS]} maxScore={DOMAIN_COUNT * MAX_SCORE_PER_DOMAIN} organizerName={organization ? { en: organization.nameEn, ar: organization.nameAr } : null} sites={sites} initialSiteId={sites.some((o) => o.id === site) ? site : ''} representativeDefault={accountContact(account.id).name} />
      </main>
    </>
  );
}
