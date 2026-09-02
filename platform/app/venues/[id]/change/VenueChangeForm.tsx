'use client';

/**
 * The change report, from the reference: five aspect chips, a description, the date the
 * change takes effect. Selecting any aspect surfaces the reassessment panel --
 * notifying the Ministry does not satisfy the reassessment.
 */

import { useState } from 'react';
import { L } from '../../../../components/L';
import { reportVenueChangeAction } from '../../../actions';

interface Aspect {
  key: string;
  en: string;
  ar: string;
}

export function VenueChangeForm({
  venueId,
  aspects,
}: {
  venueId: string;
  aspects: Aspect[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const any = selected.size > 0;
  const action = reportVenueChangeAction.bind(null, venueId);
  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <form action={action}>
      <div data-region="change-form" style={{ padding: 29, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en="What changed" ar="ما الذي تغيّر" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlockEnd: 26 }}>
          {aspects.map((a) => {
            const on = selected.has(a.key);
            return (
              <button
                key={a.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(a.key)}
                style={{ height: 36, paddingInline: 15, border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', color: on ? 'var(--brand)' : 'var(--ink)', borderRadius: 18, fontSize: 14, cursor: 'pointer' }}
              >
                <L en={a.en} ar={a.ar} />
              </button>
            );
          })}
        </div>
        {[...selected].map((key) => (
          <input key={key} type="hidden" name="aspect" value={key} />
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
              type="text"
              required
              style={{ height: 44, paddingInline: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 22, fontSize: 15 }}
            />
          </label>
        </div>
      </div>

      {/* The what-this-change-affects cards (domain numbers, threshold figures) left
          this screen (partner ruling, second sweep): they taught the scoring model,
          and the consequence that matters to the operator is the panel below. */}
      {any ? (
        <div data-region="reassessment-panel" style={{ padding: 32, border: '2px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, marginBlockEnd: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.45, marginBlockEnd: 12, maxWidth: '60ch' }}>
            <L
              en="A new assessment is required before this change takes effect."
              ar="يلزم تقييم جديد قبل أن يسري هذا التغيير."
            />
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.65, marginBlockEnd: 18 }}>
            <L
              en="Do not implement the change before the new assessment is recorded, and do not wait for the annual renewal. The current classification stands until then; reporting the change does not replace the reassessment."
              ar="لا تطبّقوا التغيير قبل تسجيل التقييم الجديد، ولا تنتظروا التجديد السنوي. ويبقى التصنيف الحالي سارياً حتى ذلك الحين؛ والإبلاغ عن التغيير لا يحل محل إعادة التقييم."
            />
          </div>
          <div style={{ fontSize: '13.5px', color: 'var(--accent-ink)', lineHeight: 1.6, maxWidth: '64ch' }}>
            <L
              en="Report the change below first; the reassessment then opens from the venue record."
              ar="أبلغوا عن التغيير أدناه أولاً؛ ثم تُفتح إعادة التقييم من سجل الموقع."
            />
          </div>
        </div>
      ) : null}

      <div data-region="revision-footnote" style={{ padding: '23px 27px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 20, fontSize: 15, lineHeight: 1.65, color: 'var(--muted)' }}>
        <L
          en="The Ministry may require a revised risk assessment, a revised compliance form, or revised documentation."
          ar="قد تطلب الوزارة تقييماً منقّحاً أو نموذج امتثال منقّحاً أو مستندات منقّحة."
        />
      </div>
      <button
        type="submit"
        disabled={!any}
        style={{ height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'none', borderRadius: 22, fontSize: '14.5px', cursor: any ? 'pointer' : 'not-allowed', color: any ? 'var(--ink)' : 'var(--muted)' }}
      >
        <L en="Notify the Ministry of the change" ar="إبلاغ الوزارة بالتغيير" />
      </button>
      {!any ? (
        <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
          <L en="Select what changed to notify the Ministry." ar="حدّدوا ما الذي تغيّر لإبلاغ الوزارة." />
        </p>
      ) : null}
    </form>
  );
}
