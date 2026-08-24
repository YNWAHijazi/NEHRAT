'use client';

/**
 * Declining participation, with the material-change consequence stated before the
 * action -- the reason is required and returns to the organizer as written.
 */

import { useState } from 'react';
import { L } from '../../../../components/L';
import { respondToInvitationAction } from '../../../actions';
import { ROLES_CONTENT } from '../../../../lib/rules';

export function DeclineBlock({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const content = ROLES_CONTENT.ems;
  return (
    <div style={{ marginBlockStart: 24 }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ height: 44, paddingInline: 20, border: '1px solid var(--line)', background: 'none', borderRadius: 22, fontSize: '14.5px', cursor: 'pointer' }}
        >
          <L en="Decline participation" ar="الاعتذار عن المشاركة" />
        </button>
      ) : (
        <form action={respondToInvitationAction.bind(null, token)} data-region="decline" style={{ padding: '28px 32px', border: '2px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 16, maxWidth: '76ch' }}>
          <input type="hidden" name="response" value="decline" />
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.5, marginBlockEnd: 12 }}>
            <L en={content.declineWarning.titleEn} ar={content.declineWarning.titleAr} />
          </div>
          <div style={{ fontSize: 16, lineHeight: 1.7, marginBlockEnd: 20 }}>
            <L en={content.declineWarning.bodyEn} ar={content.declineWarning.bodyAr} />
          </div>
          <div style={{ marginBlockEnd: 18 }}>
            <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockEnd: 6 }}>
              <L en={content.reasonRequired.en} ar={content.reasonRequired.ar} />
            </div>
            <textarea name="reason" rows={3} required style={{ width: '100%', padding: 12, background: 'var(--bg)', border: '1px solid var(--bad)', borderRadius: 8, fontSize: 15, lineHeight: 1.6, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button type="submit" style={{ height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--bad)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}>
              <L en="Decline and notify the organizer" ar="الاعتذار وإبلاغ المنظّم" />
            </button>
            <button type="button" onClick={() => setOpen(false)} style={{ height: 44, paddingInline: 20, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', cursor: 'pointer' }}>
              <L en="Go back" ar="العودة" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
