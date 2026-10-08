'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../L';
import { saveDirtyIn } from './autosave';

/**
 * Save as draft, beside Submit (owner, 8 October 2026). Answers already save when a step
 * is left; this saves whatever is still open on screen and returns to the dashboard, so
 * the person knows the record is kept and nothing has gone to the Ministry. A refused
 * save keeps them on the page with the reason on the form.
 */
export function SaveDraftButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const save = async () => {
    setPending(true);
    const ok = await saveDirtyIn(document);
    setPending(false);
    if (ok) router.push('/dashboard?notice=draft-saved');
  };
  return (
    <button type="button" data-region="save-draft" onClick={() => { void save(); }} disabled={pending}
      style={{ minHeight: 48, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 24, fontSize: 15, cursor: 'pointer', color: 'var(--ink)' }}>
      {pending ? <L en="Saving…" ar="جارٍ الحفظ…" /> : <L en="Save as draft" ar="الحفظ كمسودة" />}
    </button>
  );
}
