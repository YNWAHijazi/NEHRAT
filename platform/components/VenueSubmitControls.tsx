'use client';

import { useState } from 'react';
import { L } from './L';
import { SaveDraftButton } from './record/SaveDraftButton';
import { VENUE_DECLARATION } from '../lib/rules/venue-workflow';

/**
 * The declaration and the one Submit button. The declaration counts as a remaining
 * item until it is ticked, so the button never opens before everything is in place
 * -- the event's submit form behaves the same way. The server re-checks both.
 */
export function VenueSubmitControls({ remaining }: { remaining: number }) {
  const [declared, setDeclared] = useState(false);
  const left = remaining + (declared ? 0 : 1);
  const ready = left === 0;
  return (
    <>
      <label style={{ display: 'flex', gap: 12, alignItems: 'start', padding: '16px 20px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 22, maxWidth: '80ch', fontSize: '14.5px', lineHeight: 1.6 }}>
        <input type="checkbox" name="confirm" value="yes" required checked={declared} onChange={(e) => setDeclared(e.target.checked)} style={{ marginBlockStart: 4 }} />
        <L en={VENUE_DECLARATION.en} ar={VENUE_DECLARATION.ar} />
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
      <button
        type="submit"
        disabled={!ready}
        style={{
          height: 48,
          paddingInline: 26,
          border: 0,
          borderRadius: 24,
          background: ready ? 'var(--brand)' : 'var(--surface2)',
          color: ready ? 'var(--bg)' : 'var(--muted)',
          fontSize: 15,
          fontWeight: 500,
          cursor: ready ? 'pointer' : 'not-allowed',
        }}
      >
        {ready
          ? <L en="Submit to the Ministry" ar="التقديم إلى الوزارة" />
          : <L en={`Submit to the Ministry — ${left} remaining`} ar={`التقديم إلى الوزارة — ${left} متبقٍ`} />}
      </button>
      <SaveDraftButton />
      </div>
      {!declared && remaining === 0 ? (
        <p style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--accent-ink)' }}>
          <L en="Confirm the declaration above to submit." ar="أكّدوا الإقرار أعلاه للتقديم." />
        </p>
      ) : null}
    </>
  );
}
