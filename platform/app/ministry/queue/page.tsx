import Link from 'next/link';
import { L } from '../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../components/MinistryShell';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { reviewQueue } from '../../../lib/queries';
import { MINISTRY_CONTENT } from '../../../lib/rules';

/**
 * The review queue. Outcomes render in their own colours; internal workflow
 * states render GREY -- visually distinguishable so they are never mistaken for
 * determinations.
 */
export default async function ReviewQueuePage() {
  const account = await requireMinistryPage('viewQueue');
  const rows = reviewQueue(account.isDemo);

  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }}>
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Review queue" ar="قائمة المراجعة" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '80ch', lineHeight: 1.6 }}>
        <L
          en="Grey chips are internal workflow states and are not determinations. A determination is one of the three outcomes, recorded on the submission itself."
          ar="الرقاقات الرمادية حالات عمل داخلية وليست نتائج. النتيجة هي إحدى النتائج الثلاث، وتُسجَّل على التقديم نفسه."
        />
      </p>

      <div data-region="queue" data-stack="" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1.6fr) .7fr 1fr 1fr 1.2fr .8fr', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {[
          { en: 'Submission', ar: 'التقديم' },
          { en: 'Level', ar: 'المستوى' },
          { en: 'Event date', ar: 'تاريخ الفعالية' },
          { en: 'Filed', ar: 'قُدّم' },
          { en: 'State', ar: 'الحالة' },
          { en: 'Reviewer', ar: 'المراجع' },
        ].map((h) => (
          <div key={h.en} data-th="" style={{ background: 'var(--surface2)', padding: '11px 16px', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <L en={h.en} ar={h.ar} />
          </div>
        ))}
        {rows.map((r) => {
          const outcome = r.outcome ? MINISTRY_CONTENT.outcomes.find((o) => o.key === r.outcome) : null;
          const internal = MINISTRY_CONTENT.internalStates[r.state];
          return [
            <Link key={`${r.eventId}-a`} href={`/ministry/submissions/${r.eventId}`} style={{ background: 'var(--bg)', padding: '14px 16px', borderInlineStart: `3px solid var(--l${r.level ?? 1})`, color: 'var(--ink)' }}>
              <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>
                <L en={r.nameEn} ar={r.nameAr} />
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3 }}>
                <L en={r.orgEn} ar={r.orgAr} />
                {r.mophReference ? <span style={{ fontVariantNumeric: 'tabular-nums' }}> · {r.mophReference}</span> : null}
              </div>
            </Link>,
            <div key={`${r.eventId}-b`} style={{ background: 'var(--bg)', padding: '14px 16px', fontSize: 14 }}>
              {r.level !== null ? (
                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, borderInlineStart: `2px solid var(--l${r.level})`, background: `var(--l${r.level}s)` }}>
                  <L en={`Level ${r.level}`} ar={`المستوى ${r.level}`} />
                </span>
              ) : (
                '—'
              )}
            </div>,
            <div key={`${r.eventId}-c`} style={{ background: 'var(--bg)', padding: '14px 16px', fontSize: 14, fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{r.eventDate ?? '—'}</div>,
            <div key={`${r.eventId}-d`} style={{ background: 'var(--bg)', padding: '14px 16px', fontSize: 14, fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{r.filedAt ?? '—'}</div>,
            <div key={`${r.eventId}-e`} style={{ background: 'var(--bg)', padding: '14px 16px', fontSize: '12.5px' }}>
              {outcome ? (
                <span style={{ display: 'inline-block', padding: '4px 9px', borderRadius: 4, background: r.outcome === 'satisfied' ? 'var(--brand-soft)' : 'var(--accent-soft)', color: r.outcome === 'satisfied' ? 'var(--brand)' : 'var(--accent-ink)', lineHeight: 1.4 }}>
                  <L en={outcome.en} ar={outcome.ar} />
                </span>
              ) : (
                // Internal workflow state: grey, quiet, not a determination.
                <span style={{ display: 'inline-block', padding: '4px 9px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--muted)' }}>
                  <L en={internal.en} ar={internal.ar} />
                </span>
              )}
            </div>,
            <div key={`${r.eventId}-f`} style={{ background: 'var(--bg)', padding: '14px 16px', fontSize: 14, color: 'var(--muted)' }}>{r.reviewer || '—'}</div>,
          ];
        })}
        {rows.length === 0 ? (
          <div style={{ background: 'var(--bg)', padding: '18px 16px', gridColumn: '1 / -1', fontSize: 14, color: 'var(--muted)' }}>
            <L en="Nothing is in the queue." ar="لا شيء في القائمة." />
          </div>
        ) : null}
      </div>

      <MinistryFooter
        steps={[
          { href: '/ministry', en: 'Dashboard', ar: 'اللوحة', descEn: 'Every count, derived from the records.', descAr: 'كل الأعداد مستمدة من السجلات.' },
          { href: '/ministry/changes', en: 'Changes and notifications', ar: 'التغييرات والإشعارات', descEn: 'Material changes and declined nominations.', descAr: 'التغييرات الجوهرية والترشيحات المعتذَر عنها.' },
        ]}
      />
    </MinistryShell>
  );
}
