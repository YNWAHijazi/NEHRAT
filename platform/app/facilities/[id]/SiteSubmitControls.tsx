'use client';

import { useState } from 'react';
import { L } from '../../../components/L';
import { SaveDraftButton } from '../../../components/record/SaveDraftButton';
import { UseMyDetails } from '../../../components/UseMyDetails';
import { fieldInput } from '../../../components/workspace-styles';
import { FACILITY_CONTENT } from '../../../lib/rules';

/**
 * The declaration and the one Submit button, as on the event and the venue: the declaration
 * and the representative count as remaining items until they are in place, so the button
 * never opens early; Save as draft sits beside it. The server re-checks all of it.
 */
export function SiteSubmitControls({ remaining, revision, me }: {
  remaining: number;
  /** Answering the Ministry: the revised registration archives the version it replaces. */
  revision: boolean;
  me: { name: string } | null;
}) {
  const d = FACILITY_CONTENT.site.declaration;
  const [declared, setDeclared] = useState(false);
  const [representative, setRepresentative] = useState(me?.name ?? '');
  const [position, setPosition] = useState('');
  const left = remaining + (declared ? 0 : 1) + (representative.trim() && position.trim() ? 0 : 1);
  const ready = left === 0;
  return (
    <>
      <h3 style={{ fontSize: 16, margin: '0 0 6px' }}><L en={d.titleEn} ar={d.titleAr} /></h3>
      <label style={{ display: 'flex', gap: 12, alignItems: 'start', padding: '16px 20px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 10, margin: '10px 0 16px', maxWidth: '80ch', fontSize: '14.5px', lineHeight: 1.6, cursor: 'pointer' }}>
        <input type="checkbox" name="confirm" value="yes" checked={declared} onChange={(e) => setDeclared(e.target.checked)} style={{ flex: 'none', width: 20, height: 20, marginBlockStart: 2, accentColor: 'var(--brand)' }} />
        <L en={d.en} ar={d.ar} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16, marginBlockEnd: 6 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en="Authorized representative" ar="الممثل المفوّض" /></span>
          <input name="representative" value={representative} onChange={(e) => setRepresentative(e.target.value)} required style={fieldInput} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en="Position" ar="الصفة" /></span>
          <input name="position" value={position} onChange={(e) => setPosition(e.target.value)} required style={fieldInput} />
        </label>
      </div>
      {me?.name && representative !== me.name ? <div style={{ marginBlockEnd: 6 }}><UseMyDetails onUse={() => setRepresentative(me.name)} /></div> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginBlockStart: 18 }}>
        <button type="submit" data-region="submit-registration" disabled={!ready}
          style={{ minHeight: 48, paddingInline: 26, border: 0, borderRadius: 24, background: ready ? 'var(--brand)' : 'var(--surface2)', color: ready ? 'var(--bg)' : 'var(--muted)', fontSize: 15, fontWeight: 500, cursor: ready ? 'pointer' : 'not-allowed' }}>
          {revision
            ? (ready ? <L en="Submit the revised registration to MOPH" ar="تقديم التسجيل المعدَّل إلى وزارة الصحة العامة" /> : <L en={`Submit the revised registration to MOPH — ${left} remaining`} ar={`تقديم التسجيل المعدَّل إلى وزارة الصحة العامة — ${left} متبقٍ`} />)
            : (ready ? <L en="Submit Facility/Site registration to MOPH" ar="تقديم تسجيل المنشأة/الموقع إلى وزارة الصحة العامة" /> : <L en={`Submit Facility/Site registration to MOPH — ${left} remaining`} ar={`تقديم تسجيل المنشأة/الموقع إلى وزارة الصحة العامة — ${left} متبقٍ`} />)}
        </button>
        <SaveDraftButton />
      </div>
      {!ready && remaining === 0 ? (
        <p data-region="submit-reason" style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--accent-ink)' }}>
          <L en="Confirm the declaration and name the representative and position to submit." ar="أكّدوا الإقرار وحدّدوا الممثل والصفة للتقديم." />
        </p>
      ) : null}
    </>
  );
}
