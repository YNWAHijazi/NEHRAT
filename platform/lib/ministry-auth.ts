/**
 * The console's page gate. Refusal is indistinguishable from non-existence
 * (404), matching how every other surface refuses -- a role must not be able to
 * map which Ministry routes exist above its permission.
 */

import { notFound, redirect } from 'next/navigation';
import { currentAccount, type Account } from './auth';
import { can, type MinistryAction } from './rules';

export async function requireMinistryPage(action: MinistryAction): Promise<Account> {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!can(account.role, action)) notFound();
  return account;
}
