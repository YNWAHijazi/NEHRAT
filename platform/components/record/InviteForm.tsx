import { InfoNote } from '../InfoNote';
/**
 * The invitation, sent from inside the requirement that needs the party (SPEC 5c):
 * organization name, contact email, send. The invited party self-registers against the
 * unguessable token; the organizer never creates an account on their behalf.
 */

import { L } from '../L';
import { inviteParticipantAction } from '../../app/actions';
import { inviteVenuePartnerAction } from '../../app/venues/team-actions';
import { fieldInput } from '../workspace-styles';

export function InviteForm({ eventId, kind, service = 'event' }: { eventId: string; kind: 'ems' | 'director'; service?: 'event' | 'venue' }) {
  return (
    <form
      action={(service === 'venue' ? inviteVenuePartnerAction : inviteParticipantAction).bind(null, eventId)}
      data-region="invite"
      style={{ padding: '16px 18px', border: '1px dashed var(--line)', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}
    >
      <input type="hidden" name="kind" value={kind} />
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 200 }}>
        <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
          {kind === 'ems' ? <L en="Agency name" ar="اسم الجهة" /> : <L en="Physician name" ar="اسم الطبيب" />}
        </span>
        <input name="name" required style={fieldInput} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 200 }}>
        <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en="Contact email" ar="البريد الإلكتروني للتواصل" /></span>
        <input name="email" type="email" required style={fieldInput} />
      </label>
      <button type="submit" style={{ minHeight: 44, paddingInline: 18, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
        {kind === 'ems' ? <L en="Invite the EMS agency" ar="دعوة جهة الإسعاف" /> : <L en="Invite the Medical Director" ar="دعوة المدير الطبي" />}
      </button>
      <div className="secondary-help"><InfoNote><L en="Create the invitation, then share its link with the named party. They accept it with their own account." ar="أنشئوا الدعوة، ثم شاركوا رابطها مع الجهة المُسمّاة. تقبلها بحسابها الخاص." /></InfoNote></div>
    </form>
  );
}
