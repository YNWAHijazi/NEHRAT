import { L } from '../../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { getDb } from '../../../../lib/db';

/**
 * The national registry: record identifiers and reference numbers across all
 * three record kinds. Demonstration rows are excluded from the real registry
 * by the same isolation rule as everywhere else.
 */
export default async function RegistryPage() {
  const account = await requireMinistryPage('viewRegistry');
  const flag = account.isDemo ? 1 : 0;
  const db = getDb();
  const events = db
    .prepare(`SELECT e.id, e.name_en, e.name_ar, s.moph_reference FROM events e LEFT JOIN submissions s ON s.event_id = e.id WHERE e.is_demo = ? ORDER BY e.id`)
    .all(flag) as unknown as { id: string; name_en: string; name_ar: string; moph_reference: string | null }[];
  const venues = db
    .prepare(`SELECT id, name_en, name_ar, moph_reference FROM venues WHERE is_demo = ? ORDER BY id`)
    .all(flag) as unknown as { id: string; name_en: string; name_ar: string; moph_reference: string | null }[];
  const facilities = db
    .prepare(`SELECT id, name_en, name_ar FROM facilities WHERE is_demo = ? ORDER BY id`)
    .all(flag) as unknown as { id: string; name_en: string; name_ar: string }[];

  const section = (titleEn: string, titleAr: string, rows: { id: string; name_en: string; name_ar: string; moph_reference?: string | null }[]) => (
    <div style={{ marginBlockEnd: 28 }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
        <L en={titleEn} ar={titleAr} />
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
        {rows.map((r) => (
          <div key={r.id} style={{ background: 'var(--bg)', padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: 14 }}>
            <span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{r.id}</span> · <L en={r.name_en} ar={r.name_ar} />
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{r.moph_reference ?? '—'}</span>
          </div>
        ))}
        {rows.length === 0 ? (
          <div style={{ background: 'var(--bg)', padding: '12px 18px', fontSize: 14, color: 'var(--muted)' }}>
            <L en="No records." ar="لا سجلات." />
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <MinistryShell account={account} consoleEn="Administration" consoleAr="الإدارة">
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="National registry" ar="السجل الوطني" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '82ch', lineHeight: 1.6 }}>
        <L
          en="Record identifier at creation; Ministry reference number at submission. Public lookup answers four fields only and is rate-limited with a second factor — this register is the authenticated side."
          ar="معرّف السجل عند الإنشاء؛ والرقم المرجعي للوزارة عند التقديم. ويجيب البحث العام عن أربعة حقول فقط وبقيود — وهذا السجل هو الجانب الموثَّق."
        />
      </p>
      {section('Events', 'الفعاليات', events)}
      {section('Recurring venues', 'مواقع الفعاليات المتكررة', venues)}
      {section('Covered facilities', 'المرافق المشمولة', facilities)}
      <MinistryFooter steps={[{ href: '/ministry/admin/configuration', en: 'Configuration and versioning', ar: 'الإعدادات والإصدارات', descEn: 'The values the registry derives from.', descAr: 'القيم التي يُستمد منها السجل.' }]} />
    </MinistryShell>
  );
}
