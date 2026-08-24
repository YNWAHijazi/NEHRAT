'use client';

/**
 * The change report, from the reference: five aspect chips, a description, the date the
 * change takes effect. Selecting any aspect surfaces what it affects and the
 * reassessment panel -- notifying the Ministry does not satisfy the reassessment.
 */

import { useState } from 'react';
import Link from 'next/link';
import { L } from '../../../../components/L';
import { reportVenueChangeAction } from '../../../actions';

interface Aspect {
  key: string;
  en: string;
  ar: string;
  affectsEn: string;
  affectsAr: string;
  consequenceEn: string;
  consequenceAr: string;
}

export function VenueChangeForm({
  venueId,
  validThrough,
  level,
  aspects,
}: {
  venueId: string;
  validThrough: string | null;
  level: number | null;
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
      <div data-region="change-form" style={{ padding: 28, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 20 }}>
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
              style={{ height: 44, paddingInline: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15 }}
            />
          </label>
        </div>
      </div>

      {any ? (
        <div>
          <div style={{ marginBlockEnd: 20 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 12 }}>
              <L en="What this change affects" ar="ما الذي يمسّه هذا التغيير" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aspects
                .filter((a) => selected.has(a.key))
                .map((a) => (
                  <div key={a.key} style={{ padding: '18px 22px', background: 'var(--surface)', border: '1px solid var(--line)', borderInlineStart: '3px solid var(--accent-ink)', borderRadius: 12 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBlockEnd: 4 }}>
                      <L en={a.en} ar={a.ar} />
                    </div>
                    <div style={{ fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.55 }}>
                      <L en={a.affectsEn} ar={a.affectsAr} />
                    </div>
                    {a.consequenceEn ? (
                      <div style={{ fontSize: '14.5px', color: 'var(--accent-ink)', lineHeight: 1.55, marginBlockStart: 6 }}>
                        <L en={a.consequenceEn} ar={a.consequenceAr} />
                      </div>
                    ) : null}
                  </div>
                ))}
            </div>
          </div>

          <div data-region="reassessment-panel" style={{ padding: 32, border: '2px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, marginBlockEnd: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.45, marginBlockEnd: 12, maxWidth: '60ch' }}>
              <L
                en="A new assessment is required before this change takes effect, and the venue's level may change as a result."
                ar="يلزم تقييم جديد قبل أن يسري هذا التغيير، وقد يتغيّر مستوى الموقع نتيجة لذلك."
              />
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.65, marginBlockEnd: 18 }}>
              <L
                en={`Do not implement the change before the new assessment is recorded. It cannot wait for the annual renewal on ${validThrough ?? '—'}.`}
                ar={`لا تطبّقوا التغيير قبل تسجيل التقييم الجديد. ولا يمكن تأخيره إلى التجديد السنوي في ⁦${validThrough ?? '—'}⁩.`}
              />
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.65, marginBlockEnd: 18 }}>
              <L
                en={`The venue is currently classified at Level ${level ?? '—'}. A new classification carries its own effective and expiry dates. The existing classification stands until the new assessment is recorded, and notifying the Ministry does not satisfy the reassessment requirement.`}
                ar={`الموقع مصنَّف حالياً في المستوى ${level ?? '—'}. ويحمل التصنيف الجديد تاريخي سريان وانتهاء خاصين به. ويبقى التصنيف الحالي سارياً إلى أن يُسجَّل التقييم الجديد، وإبلاغ الوزارة لا يستوفي موجب إعادة التقييم.`}
              />
            </div>
            <Link
              href={`/venues/${venueId}/assessment`}
              style={{ display: 'inline-flex', alignItems: 'center', height: 48, paddingInline: 26, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500 }}
            >
              <L en="Start the reassessment" ar="بدء إعادة التقييم" />
            </Link>
          </div>
        </div>
      ) : null}

      <div data-region="revision-footnote" style={{ padding: '22px 26px', border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 20, fontSize: 15, lineHeight: 1.65, color: 'var(--muted)' }}>
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
