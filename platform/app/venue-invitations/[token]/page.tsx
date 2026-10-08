import { notFound } from 'next/navigation';
import { currentAccount } from '../../../lib/auth';
import { venueInvitationState, venueNominationBriefing } from '../../../lib/venue/briefing';
import { ROLES_CONTENT } from '../../../lib/rules';
import { Briefing } from '../../invitations/[token]/Briefing';
import { InvitationView, type InvitationViewStatus } from '../../invitations/[token]/InvitationView';

/**
 * The page an invited EMS agency or Medical Director opens for a hosting venue -- the
 * SAME screen as an event nomination (owner, 8 October 2026): the briefing of what the
 * party is asked to do (the rows the record resolver names its role on at the venue's
 * level), the same three answers, then the same sign-in or create-account step.
 *
 * The link format is unchanged, so invitations already sent keep working. The token is
 * the credential (rule 6): it shows this one invitation and no other venue.
 */
export default async function VenueInvitation({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { token } = await params;
  const state = venueInvitationState(token);
  if (!state) notFound();
  const { inv } = state;
  const { notice, error } = await searchParams;
  const account = await currentAccount();
  const briefing = venueNominationBriefing(token);
  if (!briefing) notFound();
  // An unanswered invitation that can no longer be answered (expired, or the venue is no
  // longer in preparation) is closed; an accepted one stays accepted.
  const status: InvitationViewStatus =
    (inv.status === 'nominated' && !state.open) || (inv.status === 'confirmed' && state.archived) ? 'closed' : inv.status;
  const V = ROLES_CONTENT.nomination.venue;

  return (
    <InvitationView
      service="venue"
      token={token}
      kind={inv.kind}
      status={status}
      invitedAt={inv.invited_at}
      level={briefing.level}
      organizationNameEn={briefing.operatorNameEn ?? V.operatorFallbackEn}
      organizationNameAr={briefing.operatorNameAr ?? V.operatorFallbackAr}
      account={account}
      notice={notice}
      error={error}
      briefing={
        <Briefing
          service="venue"
          briefing={briefing}
          kind={inv.kind}
          level={briefing.level}
          namedEn={inv.name}
          namedAr={inv.name}
        />
      }
    />
  );
}
