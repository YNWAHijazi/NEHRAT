import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { RegisterFacilityForm } from './RegisterFacilityForm';
import { currentAccount, organizationFor } from '../../../lib/auth';
import { publishedFacilityValues, unreadCountFor } from '../../../lib/queries';

/**
 * Register a facility: steps 1-3 of the six. Step 2 is a determination, not a form,
 * and for the categories awaiting a Ministry value it ends the journey -- no Continue
 * button exists there (ROADMAP 2d; rule 10's absent behaviour).
 */
export default async function RegisterFacilityPage() {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 12 }}>
          <L en="Cardiac-arrest readiness · new facility registration" ar="الجاهزية لتوقف القلب · تسجيل منشأة جديدة" />
        </div>
        <h1 data-sec-h1="" style={{ margin: '0 0 32px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="Register a facility" ar="تسجيل منشأة" />
        </h1>
        {/* The six-steps overview sentence left this screen (partner ruling, second
            sweep): the step rail below already shows the steps, and the category
            step explains itself when reached. */}
        <RegisterFacilityForm published={publishedFacilityValues()} />
      </main>
    </>
  );
}
