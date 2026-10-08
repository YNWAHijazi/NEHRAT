import { notFound } from 'next/navigation';
import { currentAccount } from '../../../lib/auth';
import { invitationByToken, nominationBriefing } from '../../../lib/queries';
import { Briefing } from './Briefing';
import { InvitationView } from './InvitationView';

/**
 * The nomination, IN THREE STAGES (reviewer ruling, 2026-08-28).
 *
 *   1. VIEW    -- the Briefing: what the party is being asked to take on,
 *                 readable on the token before any response and without an account.
 *   2. RESPOND -- the RespondForm: accept, decline with a reason, or ask the
 *                 organizer a question. Also on the token, also without an account.
 *   3. ACCOUNT -- /invitations/[token]/account, AFTER accepting and never as part of
 *                 it. Create one, or sign in to one that already exists.
 *
 * What this replaces: five facts and a decision, where the submit button responded to
 * the nomination and created an account in the same click. Accepting was therefore the
 * same act as being signed in, and declining required registering with the platform in
 * order to say no.
 *
 * The token is the credential (rule 6): unguessable, never sequential, and it shows
 * this one nomination -- no event the holder was not named in, and not the organizer's
 * submission for the one they were.
 *
 * The screen itself is InvitationView, shared with the hosting venue's nomination
 * (/venue-invitations/[token]) so the two cannot drift apart again.
 */
export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { token } = await params;
  const invitation = invitationByToken(token);
  if (!invitation) notFound();
  const { notice, error } = await searchParams;
  const account = await currentAccount();
  const briefing = nominationBriefing(token);

  return (
    <InvitationView
      service="event"
      token={token}
      kind={invitation.kind}
      status={invitation.status}
      invitedAt={invitation.invitedAt}
      level={invitation.eventLevel}
      organizationNameEn={invitation.organizationNameEn}
      organizationNameAr={invitation.organizationNameAr}
      account={account}
      notice={notice}
      error={error}
      briefing={
        briefing ? (
          <Briefing
            briefing={briefing}
            token={token}
            kind={invitation.kind}
            level={invitation.eventLevel}
            namedEn={invitation.nameEn}
            namedAr={invitation.nameAr}
          />
        ) : null
      }
    />
  );
}
