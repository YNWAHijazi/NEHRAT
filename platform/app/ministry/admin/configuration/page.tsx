import { AdminTabs } from '../../../../components/AdminTabs';
import Link from 'next/link';
import { L } from '../../../../components/L';
import { MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { BANDS, NEHRAT_TOOL_VERSION, POST_EVENT_REPORT, REASSESSMENT_WINDOW, can, filingDeadlineRule, type Level } from '../../../../lib/rules';

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
      {/* The two configuration surfaces that are not tabs, reachable from here
          since the sequence footers were cut (partner ruling, second sweep). */}
      <div data-region="config-links" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlockEnd: 20 }}>
        {/* Absent for the owner, not greyed (partner ruling, 2026-09-03): the
            owner's job is licensing capability, not configuring the Ministry's
            instrument, so configureCardiac never applies to that role and the
            way in does not exist for it. */}
        {can(account.role, 'configureCardiac') ? (
          <Link href="/ministry/admin/cardiac" style={{ height: 34, paddingInline: 14, border: '1px solid var(--line)', borderRadius: 17, fontSize: 13, display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
            <L en="Cardiac-arrest configuration" ar="إعدادات الجاهزية لتوقف القلب" />
          </Link>
        ) : null}
        <Link href="/ministry/admin/registry" style={{ height: 34, paddingInline: 14, border: '1px solid var(--line)', borderRadius: 17, fontSize: 13, display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
          <L en="National registry" ar="السجل الوطني" />
        </Link>
      </div>
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

    </MinistryShell>
  );
}
