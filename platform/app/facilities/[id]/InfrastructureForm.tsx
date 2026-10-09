'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../components/L';
import { OptionText } from '../../../components/OptionText';
import { UploadInput } from '../../../components/UploadInput';
import { registerAutosave } from '../../../components/record/autosave';
import { autosaveSiteInfrastructureAction, saveSiteInfrastructureAction } from '../../site-actions';
import { FACILITY_CONTENT } from '../../../lib/rules';
import { acceptHint } from '../../../lib/rules/uploads';

const input: React.CSSProperties = { width: '100%', minHeight: 44, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 15 };

/**
 * BASIC SITE INFRASTRUCTURE (latest revision, 9 October 2026, section 3): kept simple and
 * reusable -- the layout map, halls and zones, emergency vehicle access, patient access and
 * extraction, an optional first-aid room and anything else. Nothing here is required and
 * nothing here blocks the registration. Saved with its button (the layout map travels with
 * it), and on the step path's Next when an answer changed (components/record/autosave.ts).
 * Events held at the site read the same answers (lib/site-infrastructure.ts).
 */
export function InfrastructureForm({ facilityId, initial, layoutMap, editable }: {
  facilityId: string;
  initial: Record<string, string>;
  layoutMap: { id: number; fileName: string; uploadedAt: string } | null;
  editable: boolean;
}) {
  const content = FACILITY_CONTENT.site.infrastructure;
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(initial);
  const root = useRef<HTMLDivElement>(null);
  const valuesRef = useRef(values); valuesRef.current = values;
  const savedRef = useRef(JSON.stringify(initial));
  useEffect(() => {
    if (!root.current || !editable) return;
    return registerAutosave(root.current, async () => {
      if (JSON.stringify(valuesRef.current) === savedRef.current) return true;
      const data = new FormData();
      for (const [k, v] of Object.entries(valuesRef.current)) data.set(k, v);
      await autosaveSiteInfrastructureAction(facilityId, data);
      savedRef.current = JSON.stringify(valuesRef.current);
      router.refresh();
      return true;
    });
  }, [facilityId, editable, router]);
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const hint = acceptHint();

  return (
    <div ref={root} data-region="site-infrastructure">
      <p style={{ margin: '0 0 18px', fontSize: '14.5px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '72ch' }}>
        <L en={content.introEn} ar={content.introAr} />
      </p>
      <form action={saveSiteInfrastructureAction.bind(null, facilityId)} style={{ display: 'grid', gap: 18 }}>
        <div data-region="layout-map" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span id={`layout-map-label-${facilityId}`} style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en={content.layoutMap.en} ar={content.layoutMap.ar} /></span>
          {layoutMap ? (
            <span style={{ fontSize: '14.5px' }}>
              <a href={`/api/facility-documents/${facilityId}/${layoutMap.id}`} target="_blank" rel="noreferrer" data-region="layout-map-file">{layoutMap.fileName}</a>
              <span style={{ color: 'var(--muted)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}> · {layoutMap.uploadedAt.slice(0, 10)}</span>
            </span>
          ) : null}
          {editable ? (
            <>
              <UploadInput name="layoutMap" aria-labelledby={`layout-map-label-${facilityId}`} />
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}><L en={hint.en} ar={hint.ar} /></span>
            </>
          ) : !layoutMap ? <span style={{ fontSize: '14.5px' }}>—</span> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 18 }}>
          {content.fields.map((f) => {
            const field = f as { key: string; kind: string; en: string; ar: string; options?: { value: string; en: string; ar: string }[]; showWhen?: string };
            if (field.showWhen && values[field.showWhen] !== 'yes') return null;
            const label = (
              <span style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.45 }}>
                <L en={`${field.en} (optional)`} ar={`${field.ar} (اختياري)`} />
              </span>
            );
            if (field.kind === 'choice') {
              return (
                <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {label}
                  <select name={field.key} value={values[field.key] ?? ''} disabled={!editable} onChange={(e) => set(field.key, e.target.value)} style={{ ...input, paddingInlineEnd: 34 }}>
                    <option value=""></option>
                    {(field.options ?? []).map((o) => <option key={o.value} value={o.value}><OptionText en={o.en} ar={o.ar} /></option>)}
                  </select>
                </label>
              );
            }
            return (
              <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {label}
                {field.kind === 'textarea' ? (
                  <textarea name={field.key} value={values[field.key] ?? ''} readOnly={!editable} onChange={(e) => set(field.key, e.target.value)} rows={3} style={{ ...input, lineHeight: 1.55, resize: 'vertical' }} />
                ) : (
                  <input name={field.key} value={values[field.key] ?? ''} readOnly={!editable} onChange={(e) => set(field.key, e.target.value)} style={input} />
                )}
              </label>
            );
          })}
        </div>
        {editable ? (
          <button type="submit" data-region="save-infrastructure" style={{ justifySelf: 'start', minHeight: 44, padding: '10px 22px', border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}>
            <L en="Save the site infrastructure" ar="حفظ البنية الأساسية للموقع" />
          </button>
        ) : null}
      </form>
    </div>
  );
}
