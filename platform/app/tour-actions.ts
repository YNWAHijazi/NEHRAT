'use server';
import { currentAccount } from '../lib/auth';
import { getDb } from '../lib/db';

/** Record that the account has seen the tour, including when it is skipped. */
export async function acknowledgeTour(): Promise<boolean> {
  const account = await currentAccount();
  if (!account) return false;
  getDb().prepare('UPDATE accounts SET tour_pending = 0 WHERE id = ?').run(account.id);
  return true;
}
