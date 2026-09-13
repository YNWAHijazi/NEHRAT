'use client';

import { useEffect, useState } from 'react';
import { L } from '../../../../components/L';

export function InvitationLinkBlock({ token }: { token: string }) {
  const path = `/invitations/${token}`;
  const [url, setUrl] = useState(path);
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  useEffect(() => { setUrl(new URL(path, window.location.origin).href); }, [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setState('copied');
    } catch {
      setState('manual');
    }
  }

  return (
    <div data-invitation-link="" style={{ width: '100%', minWidth: 0, paddingBlockStart: 12, borderBlockStart: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={copy} style={{ padding: '10px 16px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 20, cursor: 'pointer', fontSize: 14 }}>
          <L en="Copy invitation link" ar="نسخ رابط الدعوة" />
        </button>
        <span role="status" style={{ fontSize: 13, color: 'var(--muted)' }}>
          {state === 'copied' ? <L en="Link copied" ar="نُسخ الرابط" /> : state === 'manual' ? <L en="Select and copy the link below." ar="حدّدوا الرابط أدناه وانسخوه." /> : <L en="Share with the invited party." ar="شاركوه مع الطرف المدعوّ." />}
        </span>
      </div>
      <details style={{ marginBlockStart: 8, fontSize: 13, color: 'var(--muted)' }} open={state === 'manual' ? true : undefined}>
        <summary style={{ cursor: 'pointer' }}><L en="View invitation link" ar="عرض رابط الدعوة" /></summary>
        <code dir="ltr" style={{ display: 'block', marginBlockStart: 8, overflowWrap: 'anywhere', userSelect: 'all' }}>{url}</code>
      </details>
    </div>
  );
}
