import { AdminTabs } from '../../../../components/AdminTabs';
import Link from 'next/link';
import { L } from '../../../../components/L';
import { MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { BANDS, DEFERRED, MINISTRY_CONTENT, NEHRAT_TOOL_VERSION, POST_EVENT_REPORT, REASSESSMENT_WINDOW, can, filingDeadlineRule, type Level } from '../../../../lib/rules';

/**
 * Configuration and versioning -- the mass-gathering instrument's values, read
 * from the same data every screen derives from. Nothing here is a copy: these
 * ARE the values in force, and a new issue of the instrument is a version,
 * never an edit in place.
 */
export default async function ConfigurationPage() {
  const account = await requireMinistryPage('configureMassGathering');
  const AC = MINISTRY_CONTENT.adminConsole;
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
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '84ch', lineHeight: 1.6 }}>
        <L
          en="The values in force. A change is a new version, reviewed and published; this console reads, it does not edit in place."
          ar="القيم السارية. والتغيير إصدار جديد يُراجَع ويُنشَر؛ وهذه اللوحة تقرأ ولا تعدّل في المكان."
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

      {/* No capability switches here, deliberately (partner ruling, 2026-09-02):
          the platform capabilities are the owner's, held behind manageFlags, which
          no Ministry role carries. Absent entirely, not greyed -- for the Ministry
          administrator they never apply. The two AED registry capabilities that
          once sat in that list are Ministry powers and live under Cardiac-arrest
          configuration, linked above. */}
      {/* WHAT IS DELIBERATELY NOT BUILT. On the Configuration tab because this screen
          answers "what is set and what is unset", and a capability nobody built is the
          same kind of fact as a value nobody published -- both are decisions the
          Ministry can read and change. */}
      <div data-region="deferred" style={{ marginBlockStart: 40 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em' }}>
          <L en={AC.deferredTitleEn} ar={AC.deferredTitleAr} />
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.65, maxWidth: '84ch' }}>
          <L en={AC.deferredBodyEn} ar={AC.deferredBodyAr} />
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DEFERRED.map((item) => (
            <div key={item.key} style={{ padding: '16px 20px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--muted)', borderRadius: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 500, marginBlockEnd: 8 }}>
                <L en={item.en} ar={item.ar} />
              </div>
              <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                <L en={AC.deferredReasonEn} ar={AC.deferredReasonAr} />
              </div>
              <p style={{ margin: '2px 0 10px', fontSize: '13px', lineHeight: 1.7, maxWidth: '84ch' }}>
                <L en={item.reasonEn} ar={item.reasonAr} />
              </p>
              <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                <L en={AC.deferredConditionEn} ar={AC.deferredConditionAr} />
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '13px', lineHeight: 1.7, maxWidth: '84ch' }}>
                <L en={item.conditionEn} ar={item.conditionAr} />
              </p>
            </div>
          ))}
        </div>
      </div>

    </MinistryShell>
  );
}
