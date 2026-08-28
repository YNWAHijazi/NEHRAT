import { AdminTabs } from '../../../../components/AdminTabs';
import { L } from '../../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { BANDS, NEHRAT_TOOL_VERSION, POST_EVENT_REPORT, REASSESSMENT_WINDOW, filingDeadlineRule, type Level } from '../../../../lib/rules';

/**
 * Configuration and versioning -- the mass-gathering instrument's values, read
 * from the same data every screen derives from. Nothing here is a copy: these
 * ARE the values in force, and a new issue of the instrument is a version,
 * never an edit in place.
 */
export default async function ConfigurationPage() {
  const account = await requireMinistryPage('configureMassGathering');
  const rows: { en: string; ar: string; value: string }[] = [
    { en: 'Risk assessment tool version', ar: 'إصدار أداة تقييم المخاطر (NEHRAT)', value: NEHRAT_TOOL_VERSION },
    { en: 'Level bands', ar: 'نطاقات المستويات', value: BANDS.map((b) => `L${b.level}: ${b.minScore}–${b.maxScore}`).join(' · ') },
    { en: 'Filing lead times (days, by level)', ar: 'مهل التقديم (أيام، بحسب المستوى)', value: ([1, 2, 3] as Level[]).map((l) => { const r = filingDeadlineRule(l); return `L${l}: ${r.leadTimeDays}${r.conditional ? ' (conditional)' : ''}`; }).join(' · ') },
    { en: 'Post-event report window (days after the event ends)', ar: 'نافذة التقرير اللاحق (أيام بعد انتهاء الفعالية)', value: String(POST_EVENT_REPORT.windowDays) },
    { en: 'Venue classification validity (months)', ar: 'صلاحية تصنيف الموقع (أشهر)', value: String(REASSESSMENT_WINDOW.venueClassificationMonths) },
    { en: 'Venue reassessment window (days before expiry)', ar: 'نافذة إعادة تقييم الموقع (أيام قبل الانتهاء)', value: String(REASSESSMENT_WINDOW.opensDaysBeforeExpiry) },
  ];
  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }} consoleEn="Administration" consoleAr="الإدارة">
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Configuration and versioning" ar="الإعدادات والإصدارات" />
      </h1>
      <AdminTabs current="/ministry/admin/configuration" />
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '84ch', lineHeight: 1.6 }}>
        <L
          en="These are the values every screen derives from — thresholds, phases and timeframes as data, never code. Changing one is a new version of the instrument's data, reviewed and published; this console reads, it does not edit in place."
          ar="هذه هي القيم التي تستمد منها كل شاشة — العتبات والمراحل والمهل بيانات لا شيفرة. وتغيير إحداها إصدار جديد لبيانات الأداة، يُراجَع ويُنشَر؛ وهذه اللوحة تقرأ ولا تعدّل في المكان."
        />
      </p>
      <div data-region="config-values" style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', maxWidth: 900 }}>
        {rows.map((r) => (
          <div key={r.en} style={{ background: 'var(--bg)', padding: '15px 20px', display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '14.5px', color: 'var(--muted)' }}>
              <L en={r.en} ar={r.ar} />
            </span>
            <span style={{ fontSize: '14.5px', fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
          </div>
        ))}
      </div>
      <MinistryFooter steps={[
        { href: '/ministry/admin/cardiac', en: 'Cardiac-arrest configuration', ar: 'إعدادات الجاهزية لتوقف القلب', descEn: 'The ten powers and their publishable values.', descAr: 'الصلاحيات العشر وقيمها القابلة للنشر.' },
        { href: '/ministry/admin/registry', en: 'National registry', ar: 'السجل الوطني', descEn: 'Every record, demonstration rows excluded.', descAr: 'كل السجلات، مستثناةً صفوف العرض.' },
      ]} />
    </MinistryShell>
  );
}
