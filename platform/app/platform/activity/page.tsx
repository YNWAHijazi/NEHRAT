import { L } from '../../../components/L';
import { MinistryShell } from '../../../components/MinistryShell';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { platformCounts } from '../../../lib/queries';
import { MINISTRY_CONTENT } from '../../../lib/rules';

/**
 * Platform activity: COUNTS ONLY. No organizer, account, event or patient is
 * named, and nothing filters to one organization's behaviour. The narrow
 * reading of an undecided question (SPEC 2c); it stays narrow until the
 * Ministry rules.
 */
export default async function PlatformActivityPage() {
  const account = await requireMinistryPage('viewPlatformActivity');
  const counts = platformCounts(account.isDemo);
  const rows: { n: number; en: string; ar: string }[] = [
    { n: counts.organizations, en: 'Organizations', ar: 'مؤسسات' },
    { n: counts.events, en: 'Event records', ar: 'سجلات فعاليات' },
    { n: counts.submissions, en: 'Submissions filed', ar: 'تقديمات مقدَّمة' },
    { n: counts.determinations, en: 'Determinations recorded', ar: 'نتائج مسجَّلة' },
    { n: counts.invitations, en: 'Nominations sent', ar: 'ترشيحات مُرسلة' },
    { n: counts.venues, en: 'Recurring venues', ar: 'مواقع متكررة' },
    { n: counts.facilities, en: 'Covered facilities', ar: 'مرافق مشمولة' },
    { n: counts.devices, en: 'Registered defibrillators', ar: 'أجهزة مسجّلة' },
    { n: counts.incidents, en: 'Facility incident reports', ar: 'تقارير حوادث مرافق' },
    { n: counts.frReports, en: 'Agency cardiac-arrest reports', ar: 'تقارير توقف القلب من الجهات' },
  ];
  return (
    <MinistryShell account={account} back={{ href: '/platform/admin', en: 'Master admin', ar: 'الإدارة العليا' }} consoleEn="Platform owner" consoleAr="مالك المنصة">
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Platform activity" ar="نشاط المنصة" />
      </h1>
      <p data-region="scope" style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--muted)', maxWidth: '86ch', lineHeight: 1.65 }}>
        <L en={MINISTRY_CONTENT.activityScope.en} ar={MINISTRY_CONTENT.activityScope.ar} />
      </p>
      <p data-region="demo-exclusion" style={{ margin: '0 0 24px', fontSize: '12.5px', color: 'var(--muted)', maxWidth: '86ch', lineHeight: 1.6 }}>
        <L
          en="Demonstration rows are excluded from every figure here, in every session: these are national volumes, never example data."
          ar="تُستبعد السجلات التوضيحية من كل رقم هنا، وفي كل جلسة: هذه أحجام وطنية، لا بيانات أمثلة."
        />
      </p>
      <div data-region="counts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', maxWidth: 1000 }}>
        {rows.map((r) => (
          <div key={r.en} style={{ background: 'var(--bg)', padding: '20px 22px' }}>
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-.03em' }}>{r.n}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockStart: 4 }}>
              <L en={r.en} ar={r.ar} />
            </div>
          </div>
        ))}
      </div>
      {/* No sequence footers (partner ruling, second sweep) — a quiet link instead. */}
      <div style={{ marginBlockStart: 28 }}>
        <a href="/platform/admin" style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
          <L en="Master admin" ar="الإدارة العليا" />
        </a>
      </div>
    </MinistryShell>
  );
}
