import { redirect } from 'next/navigation';
import { currentAccount } from '../lib/auth';

/**
 * The public landing page is Slice 0 and not yet built. Until it lands, the root
 * routes by session: signed in to the dashboard, signed out to sign-in.
 */
export default async function RootPage() {
  const account = await currentAccount();
  redirect(account ? '/dashboard' : '/signin');
}
