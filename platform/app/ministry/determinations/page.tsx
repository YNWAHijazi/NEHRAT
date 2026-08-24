import Link from 'next/link';
import { L } from '../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../components/MinistryShell';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { getDb } from '../../../lib/db';
import { MINISTRY_CONTENT } from '../../../lib/rules';

/**
 * Determinations and designations: every recorded outcome across the event
 * lane, and every covered-facility designation from the cardiac lane -- two
 * registers on one screen, never merged.
 */
export default async function DeterminationsPage() {
  const account = await requireMinistryPage('viewMinistry');
  const flag = account.isDemo ? 1 : 0;
  const db = getDb();
  const determinations = db
    .prepare(
      `SELECT d.event_id, d.outcome, d.recorded_by, d.recorded_at, e.name_en, e.name_ar, s.moph_reference
       FROM determinations d JOIN events e ON e.id = d.event_id
       LEFT JOIN submissions s ON s.event_id = e.id
       WHERE e.is_demo = ? ORDER BY d.recorded_at DESC, d.id DESC`,
    )
    .all(flag) as unknown as { event_id: string; outcome: string; recorded_by: string; recorded_at: string; name_en: string; name_ar: string; moph_reference: string | null }[];
  const designations = db
    .prepare(`SELECT name_en, name_ar, category, municipality, designated_by, designated_at FROM facility_designations WHERE is_demo = ? ORDER BY designated_at DESC`)
    .all(flag) as unknown as { name_en: string; name_ar: string; category: string; municipality: string; designated_by: string; designated_at: string }[];

  return (
    <MinistryShell account={account}>
      <h1 data-sec-h1="" style={{ margin: '0 0 24px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Determinations and designations" ar="البت والتحديد" />
      </h1>
      <div data-split="" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Recorded outcomes — mass-gathering instrument" ar="النتائج المسجَّلة — إطار الفعاليات الجماهيرية" />
          </h2>
          <div data-region="outcome-register" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {determinations.map((d, i) => {
              const def = MINISTRY_CONTENT.outcomes.find((o) => o.key === d.outcome);
              return (
                <Link key={i} href={`/ministry/submissions/${d.event_id}`} style={{ padding: '14px 18px', border: '1px solid var(--line)', borderInlineStart: `3px solid ${d.outcome === 'satisfied' ? 'var(--brand)' : 'var(--accent)'}`, borderRadius: 10, color: 'var(--ink)' }}>
                  <div style={{ fontSize: '14.5px', lineHeight: 1.5 }}>
                    <L en={`${d.name_en} — ${def?.en ?? d.outcome}`} ar={`${d.name_ar} — ${def?.ar ?? d.outcome}`} />
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, fontVariantNumeric: 'tabular-nums' }}>
                    {d.moph_reference ? `${d.moph_reference} · ` : ''}{d.recorded_at.slice(0, 10)} · {d.recorded_by}
                  </div>
                </Link>
              );
            })}
            {determinations.length === 0 ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en="No determinations recorded." ar="لا نتائج مسجَّلة." />
              </div>
            ) : null}
          </div>
        </div>
        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Covered-facility designations — cardiac lane" ar="تحديدات المرافق المشمولة — مسار توقف القلب" />
          </h2>
          <div data-region="designation-register" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {designations.map((d, i) => (
              <div key={i} style={{ padding: '14px 18px', border: '1px solid var(--line)', borderInlineStart: '3px solid var(--brand)', borderRadius: 10 }}>
                <div style={{ fontSize: '14.5px', lineHeight: 1.5 }}>
                  <L en={d.name_en} ar={d.name_ar} />
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {d.category}{d.municipality ? ` · ${d.municipality}` : ''} · {d.designated_at.slice(0, 10)} · {d.designated_by}
                </div>
              </div>
            ))}
            {designations.length === 0 ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en="No designations recorded." ar="لا تحديدات مسجَّلة." />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <MinistryFooter steps={[{ href: '/ministry/facilities/arrests', en: 'Reported arrest locations', ar: 'مواقع الحوادث المبلَّغة', descEn: 'Where a covered-facility designation is made.', descAr: 'حيث يُتخذ تحديد المرفق المشمول.' }]} />
    </MinistryShell>
  );
}
