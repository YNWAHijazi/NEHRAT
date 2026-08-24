'use client';

/**
 * Report a material change (Protocol 8.5). Aspect chips from the enumerated list; the
 * affected domains and consequences derive from the selection; where a selected aspect
 * can move the level, the reassessment warning renders with a route to the assessment.
 */

import { useMemo, useState } from 'react';
import { L } from '../../../../components/L';
import { reportMaterialChangeAction } from '../../../actions';

interface Aspect {
  key: string;
  en: string;
  ar: string;
  affectsEn: string;
  affectsAr: string;
  consequenceEn: string;
  consequenceAr: string;
  levelMayChange: boolean;
}

export function ChangeForm({ eventId, aspects }: { eventId: string; aspects: Aspect[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const impacts = useMemo(() => aspects.filter((a) => selected.includes(a.key)), [aspects, selected]);
  const levelMayChange = impacts.some((i) => i.levelMayChange);

  return (
    <form action={reportMaterialChangeAction.bind(null, eventId)}>
      <div data-region="aspects-card" style={{ padding: 28, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 20 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en="What changed" ar="ما الذي تغيّر" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlockEnd: 26 }}>
          {aspects.map((a) => {
            const on = selected.includes(a.key);
            return (
              <button
                key={a.key}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setSelected((prev) => (on ? prev.filter((k) => k !== a.key) : [...prev, a.key]))
                }
                style={{ height: 36, paddingInline: 15, border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', color: on ? 'var(--brand)' : 'var(--ink)', borderRadius: 18, fontSize: 14, cursor: 'pointer' }}
              >
                <L en={a.en} ar={a.ar} />
              </button>
            );
          })}
        </div>
        {selected.map((k) => (
          <input key={k} type="hidden" name="aspect" value={k} />
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en="Describe the change" ar="صف التغيير" />
            </span>
            <textarea
              name="description"
              rows={3}
              required
              style={{ width: '100%', padding: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15, lineHeight: 1.6, resize: 'vertical' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en="Date the change takes effect" ar="تاريخ سريان التغيير" />
            </span>
            <input
              name="effectiveDate"
              type="date"
              style={{ height: 44, paddingInline: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15 }}
            />
          </label>
        </div>
      </div>

      {impacts.length > 0 ? (
        <div style={{ marginBlockEnd: 20 }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 12 }}>
            <L en="What this change affects" ar="ما الذي يمسّه هذا التغيير" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {impacts.map((i) => (
              <div key={i.key} style={{ padding: '18px 22px', background: 'var(--surface)', border: '1px solid var(--line)', borderInlineStart: `3px solid ${i.levelMayChange ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBlockEnd: 4 }}>
                  <L en={i.en} ar={i.ar} />
                </div>
                {i.affectsEn ? (
                  <div style={{ fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.55 }}>
                    <L en={i.affectsEn} ar={i.affectsAr} />
                  </div>
                ) : null}
                {i.consequenceEn ? (
                  <div style={{ fontSize: '14.5px', color: 'var(--accent-ink)', lineHeight: 1.55, marginBlockStart: 6 }}>
                    <L en={i.consequenceEn} ar={i.consequenceAr} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {levelMayChange ? (
        <div style={{ padding: 32, border: '2px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, marginBlockEnd: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.45, marginBlockEnd: 12, maxWidth: '52ch' }}>
            <L
              en="This change can move your event level. The assessment may need to be completed again, and the filing deadline changes with the level."
              ar="قد ينقل هذا التغيير مستوى فعاليتكم. قد يلزم استكمال التقييم من جديد، وتتغيّر مهلة التقديم بتغيّر المستوى."
            />
          </div>
          <div style={{ fontSize: '14.5px', lineHeight: 1.65 }}>
            <L
              en="The Ministry may require a revised risk assessment, a revised compliance and submission form, or revised documents."
              ar="قد تطلب الوزارة تقييم مخاطر منقّحاً أو نموذج امتثال وتقديم منقّحاً أو مستندات منقّحة."
            />
          </div>
        </div>
      ) : null}

      <button
        type="submit"
        style={{ height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'none', borderRadius: 22, fontSize: '14.5px', cursor: 'pointer' }}
      >
        <L en="Notify the Ministry of the change" ar="إبلاغ الوزارة بالتغيير" />
      </button>
    </form>
  );
}
