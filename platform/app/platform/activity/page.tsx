import { L } from '../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../components/MinistryShell';
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
    { n: counts.frReports, en: 'First-response dataset reports', ar: 'تقارير بيانات استجابة أولية' },
  ];
  return (
    <MinistryShell account={account} consoleEn="Platform owner" consoleAr="مالك المنصة">
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Platform activity" ar="نشاط المنصة" />
      </h1>
      <p data-region="scope" style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '86ch', lineHeight: 1.65 }}>
        <L en={MINISTRY_CONTENT.activityScope.en} ar={MINISTRY_CONTENT.activityScope.ar} />
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
      <MinistryFooter steps={[{ href: '/platform/admin', en: 'Master admin', ar: 'الإدارة العليا', descEn: 'Capability flags and the Order lane.', descAr: 'مفاتيح القدرات ومسار النقابة.' }]} />
    </MinistryShell>
  );
}
