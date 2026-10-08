import { notFound, redirect } from 'next/navigation';
import { currentAccount, rememberedSignInFields } from '../../../../lib/auth';
import { venueInvitationState } from '../../../../lib/venue/briefing';
import { venueAccountMayTake } from '../../../../lib/venue/collaboration';
import { AccountView } from '../../../invitations/[token]/account/AccountView';
import {
  createVenuePartnerAccountAction,
  respondVenueInvitationAction,
  signInVenuePartnerAction,
} from '../../../venues/team-actions';

/**
 * Stage three of a venue nomination -- the SAME screen as an event's (owner, 8 October
 * 2026): create an account under the invited email, or sign in to one that exists, and
 * the acceptance completes. A token alone never accepts.
 */
export default async function VenueNominationAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const state = venueInvitationState(token);
  if (!state) notFound();
  const { inv } = state;

  // A dead token registers nobody: withdrawn, expired, or a venue no longer in preparation.
  if (inv.status === 'withdrawn' || (inv.status === 'nominated' && !state.open) || state.archived) {
    redirect(`/venue-invitations/${token}`);
  }

  const account = await currentAccount();
  // Already linked and accepted: the partner's one page for the venue.
  if (account?.role === inv.kind && inv.account_id === account.id && inv.status === 'confirmed') {
    redirect(`/venue-team/${inv.venue_id}`);
  }
  if (inv.account_id !== null && inv.account_id !== account?.id) redirect('/signin');

  const remembered = await rememberedSignInFields();
  const mayTake = Boolean(account && account.role === inv.kind && venueAccountMayTake(account.id, token));
  const wrongAccount = Boolean(account && account.role === inv.kind && !mayTake);

  return (
    <AccountView
      service="venue"
      email={inv.email}
      declined={inv.status === 'declined'}
      error={error}
      mayTake={mayTake && inv.status === 'nominated'}
      wrongAccount={wrongAccount}
      rememberedEmail={remembered.email}
      accept={respondVenueInvitationAction.bind(null, token)}
      register={createVenuePartnerAccountAction.bind(null, token)}
      signIn={signInVenuePartnerAction.bind(null, token)}
    />
  );
}
