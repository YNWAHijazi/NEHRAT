import { MinistryServices } from './MinistryServices';
/**
 * The Ministry console's chrome: the government band, the console header naming
 * the signed-in role, and the content column. Navigation is the dashboard's
 * counters and its quiet link row -- the sequence footers left in the second
 * simplification sweep, and the prototype's tab strip is a reviewer's index
 * and is not built.
 */

import { GovernmentBand, Header } from './Header';
import { unreadCountFor } from '../lib/queries';
import type { Account } from '../lib/auth';

export function MinistryShell({
  account,
  children,
  consoleEn = 'Review console',
  consoleAr = 'لوحة المراجعة',
  back,
}: {
  account: Account;
  children: React.ReactNode;
  consoleEn?: string;
  consoleAr?: string;
  /** Back pill named after its destination; absent only on the console's own dashboard. */
  back?: { href: string; en: string; ar: string };
}) {
  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={null} unreadCount={unreadCountFor(account.id)}
        showBack={!!back} {...(back ? { back } : {})} subtitle={{ en: consoleEn, ar: consoleAr }} wide />
      <main data-pad="" style={{ maxWidth: 1320, marginInline: 'auto', padding: '32px 32px 90px' }}>
        <MinistryServices />
        {children}
      </main>
    </>
  );
}

