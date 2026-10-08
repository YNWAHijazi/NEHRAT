import { notFound, redirect } from 'next/navigation';
import { currentAccount, rememberedSignInFields } from '../../../../lib/auth';
import { invitationByToken, accountMayTakeNomination } from '../../../../lib/queries';
import { AccountView } from './AccountView';

import {
  registerAgainstInvitationAction,
  signInAgainstInvitationAction,
  respondToInvitationAction,
} from '../../../actions';

/** Complete acceptance through account creation or sign-in; a token alone is insufficient. */
export default async function NominationAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const invitation = invitationByToken(token);
  if (!invitation) notFound();

  // A dead token registers nobody.
  if (invitation.status === 'withdrawn' || invitation.status === 'removed') {
    redirect(`/invitations/${token}`);
  }
  // Pending invitations remain pending until the account flow completes.


  const account = await currentAccount();
  // Already linked, or already signed in: this screen has nothing to offer. A
  // counterparty lands on its one page for the event — the Director's event page,
  // or the provider's task page. Anyone else (an organizer holding their own
  // nominee's link) goes to the event record as before.
  const expectedRole = invitation.kind === 'ems' ? 'ems' : 'director';
  if (account?.role === expectedRole && invitation.accountId === account.id && invitation.status === 'confirmed') {
    redirect(account.role === 'ems' ? `/events/${invitation.eventId}/participation` : `/events/${invitation.eventId}`);
  }
  if (invitation.accountId !== null && invitation.accountId !== account?.id) redirect('/signin');

  const remembered = await rememberedSignInFields();
  // Signed in under the right role but a different address: say so, rather than offer a button that refuses.
  const mayTake = Boolean(account && account.role === expectedRole && accountMayTakeNomination(account.id, token));
  const wrongAccount = Boolean(account && account.role === expectedRole && !mayTake);

  return (
    <AccountView
      service="event"
      email={invitation.email}
      declined={invitation.status === 'declined'}
      error={error}
      mayTake={mayTake}
      wrongAccount={wrongAccount}
      rememberedEmail={remembered.email}
      accept={respondToInvitationAction.bind(null, token)}
      register={registerAgainstInvitationAction.bind(null, token)}
      signIn={signInAgainstInvitationAction.bind(null, token)}
    />
  );
}
