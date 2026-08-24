/**
 * The invitation, sent from inside the requirement that needs the party (SPEC 5c):
 * organization name, contact email, send. The invited party self-registers against the
 * unguessable token; the organizer never creates an account on their behalf.
 */

import { L } from '../../../../components/L';
import { inviteParticipantAction } from '../../../actions';

const inputStyle: React.CSSProperties = {
  height: 40,
  paddingInline: 12,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

export function InviteForm({ eventId, kind }: { eventId: string; kind: 'ems' | 'director' }) {
  return (
    <form
      action={inviteParticipantAction.bind(null, eventId)}
      style={{ padding: '18px 22px', border: '1px dashed var(--line)', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}
    >
      <input type="hidden" name="kind" value={kind} />
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 200 }}>
        <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
          {kind === 'ems' ? (
            <L en="Organization name" ar="اسم الجهة" />
          ) : (
            <L en="Physician name" ar="اسم الطبيب" />
          )}
        </span>
        <input name="name" required style={inputStyle} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 200 }}>
        <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
          <L en="Contact email" ar="البريد الإلكتروني للتواصل" />
        </span>
        <input name="email" type="email" required style={inputStyle} />
      </label>
      <button
        type="submit"
        style={{ height: 40, paddingInline: 18, border: 0, borderRadius: 20, background: 'var(--brand)', color: 'var(--bg)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
      >
        {kind === 'ems' ? <L en="Invite a provider" ar="دعوة مزوّد" /> : <L en="Nominate the Director" ar="ترشيح المدير" />}
      </button>
      <p style={{ flexBasis: '100%', margin: '6px 0 0', fontSize: '12.5px', lineHeight: 1.6, color: 'var(--muted)' }}>
        <L
          en="The invitation link carries an unguessable token. The invited party creates their own account against it; accepting links them to this event."
          ar="يحمل رابط الدعوة رمزاً لا يمكن تخمينه. تنشئ الجهة المدعوة حسابها الخاص من خلاله؛ وبقبولها ترتبط بهذه الفعالية."
        />
      </p>
    </form>
  );
}
