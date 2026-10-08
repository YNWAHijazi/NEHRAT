import { L } from '../L';
import { InvitationLinkBlock } from './InvitationLinkBlock';
import { InviteForm } from './InviteForm';
import { removeProviderAction, withdrawNominationAction } from '../../app/actions';
import { withdrawVenuePartnerAction } from '../../app/venues/team-actions';
import type { RecordParty } from '../../lib/record-facts';
import type { RecordService } from '../../lib/rules';

const STATES = {
  nominated: ['Invitation sent — waiting for a reply', 'أُرسلت الدعوة — بانتظار الرد'],
  confirmed: ['Accepted', 'قُبلت'],
  declined: ['Declined', 'رُفضت'],
  withdrawn: ['Withdrawn', 'سُحبت'],
  removed: ['Removed', 'أُزيل'],
} as const;

/**
 * The named parties on a row: invited, accepted or declined, visible (brief item 13).
 * Contacts are entered once, on the invitation; the accepted account's details are
 * reused. The organizer invites and withdraws here; everyone else reads.
 */
export function PartyBlock({ kind, id, parties, invite, canInvite, declarations }: {
  kind: RecordService; id: string; parties: readonly RecordParty[]; invite: 'ems' | 'director'; canInvite: boolean;
  /** Level 3 EMS: show each agency's signature state. */
  declarations?: boolean;
}) {
  const active = parties.filter((p) => p.kind === invite && (p.status === 'nominated' || p.status === 'confirmed'));
  const past = parties.filter((p) => p.kind === invite && p.status === 'declined');
  const single = invite === 'director';
  return (
    <div data-region={`party-${invite}`} style={{ marginBlockEnd: 14 }}>
      {active.map((p) => (
        <div key={`${p.kind}-${p.email}-${p.invitedAt}`} data-party={p.status} style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, marginBlockEnd: 8, display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14.5px', fontWeight: 500 }}>{p.name}</span>
          <span style={{ fontSize: 13, color: p.status === 'confirmed' ? 'var(--success)' : 'var(--accent-ink)' }}>
            <L en={STATES[p.status][0]} ar={STATES[p.status][1]} />
            {declarations && p.status === 'confirmed' ? <> · <L en={p.declarationSigned ? 'Declaration signed' : 'Declaration not yet signed'} ar={p.declarationSigned ? 'الإقرار موقَّع' : 'الإقرار غير موقَّع بعد'} /></> : null}
          </span>
          {kind === 'event' && canInvite && p.status === 'nominated' ? (
            <div style={{ flexBasis: '100%' }}>
              <InvitationLinkBlock token={p.token} />
              <form action={withdrawNominationAction.bind(null, id)} style={{ marginBlockStart: 8 }}>
                <input type="hidden" name="token" value={p.token} />
                <button type="submit" style={{ border: 0, background: 'transparent', color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0, minHeight: 32 }}><L en="Withdraw the invitation" ar="سحب الدعوة" /></button>
              </form>
            </div>
          ) : null}
          {kind === 'event' && canInvite && p.status === 'confirmed' ? (
            <details style={{ flexBasis: '100%', fontSize: 13, color: 'var(--muted)' }}>
              <summary style={{ cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center' }}><L en="Remove this party" ar="إزالة هذا الطرف" /></summary>
              <form action={removeProviderAction.bind(null, id)} style={{ marginBlockStart: 8 }}>
                <input type="hidden" name="token" value={p.token} />
                <p style={{ margin: '0 0 8px', lineHeight: 1.5 }}><L en="Removing an accepted party is a material change. If the event is filed, the Ministry must be told." ar="إزالة طرف مقبول تغيير جوهري. إذا كانت الفعالية مقدَّمة، يجب إبلاغ الوزارة." /></p>
                <button type="submit" style={{ minHeight: 36, paddingInline: 14, border: '1px solid var(--bad)', background: 'var(--bg)', color: 'var(--bad)', borderRadius: 18, fontSize: 13, cursor: 'pointer' }}><L en="Remove" ar="إزالة" /></button>
              </form>
            </details>
          ) : null}
          {kind === 'venue' && canInvite && p.status === 'nominated' ? (
            <div style={{ flexBasis: '100%' }}>
              <InvitationLinkBlock token={p.token} path={`/venue-invitations/${p.token}`} />
            </div>
          ) : null}
          {kind === 'venue' && canInvite ? (
            <form action={withdrawVenuePartnerAction.bind(null, id, p.token)} style={{ flexBasis: '100%' }}>
              <button type="submit" style={{ border: 0, background: 'transparent', color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0, minHeight: 32 }}><L en="Withdraw the invitation" ar="سحب الدعوة" /></button>
            </form>
          ) : null}
        </div>
      ))}
      {past.map((p) => (
        <div key={`${p.kind}-${p.email}-${p.invitedAt}`} style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 6 }}>{p.name} — <L en={STATES[p.status][0]} ar={STATES[p.status][1]} /></div>
      ))}
      {canInvite && (!single || active.length === 0) ? <InviteForm eventId={id} kind={invite} service={kind} /> : null}
    </div>
  );
}
