import { InfoNote } from '../../../components/InfoNote';
import { getDb } from '../../../lib/db';
import { emailConfigured } from '../../../lib/email';
import { L } from '../../../components/L';
import { MinistryShell } from '../../../components/MinistryShell';
import { FlagsPanel } from '../../../components/FlagsPanel';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { ministryConfig } from '../../../lib/queries';
import { DEFERRED, orderLaneActive } from '../../../lib/rules';
import { setOrderLaneAction } from '../../ministry-actions';

/**
 * Master admin -- above the Ministry, and holding no regulatory action. The
 * capability list carries no control (partner ruling, 2026-09-02): each row
 * opens the capability's own page, where the toggle sits above its
 * configuration and cannot be enabled without it. The Lebanon tenant ships
 * with every capability off. The one control on this screen is the Order of
 * Physicians lane, whose off state suspends the Order reviewer's access.
 */
export default async function MasterAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await requireMinistryPage('manageFlags');
  const { notice } = await searchParams;
  const totals = ['accounts', 'events', 'venues', 'facilities'].map((table) =>
    (getDb().prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE is_demo = ?`).get(account.isDemo ? 1 : 0) as { n: number }).n);
  const mailStats = getDb().prepare(`SELECT status, COUNT(*) AS n FROM email_deliveries WHERE is_demo = ? GROUP BY status`).all(account.isDemo ? 1 : 0) as unknown as { status: string; n: number }[];

  const laneConfig = ministryConfig().get('orderLane');
  const laneActive = laneConfig ? laneConfig.value === 'on' : orderLaneActive();

  return (
    <MinistryShell account={account} consoleEn="Platform owner" consoleAr="مالك المنصة">
      {notice === 'lane' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The lane state has been recorded. Users and roles reflects it immediately." ar="سُجّلت حالة المسار. ويعكسها المستخدمون والأدوار فوراً." />
        </div>
      ) : null}
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Master admin" ar="الإدارة العليا" />
       <InfoNote><L
          en="Manage users, records, activity and optional services."
          ar="إدارة المستخدمين والسجلات والنشاط والخدمات الاختيارية."
        /></InfoNote>
</h1>


      {/* The four administration tabs, granted to the owner by the partner ruling —
          the same screens the master administrator sees, not copies of them. */}
      <div data-region="owner-admin-links" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBlockEnd: 28 }}>
        {[
          ['/ministry/admin/configuration', 'Configuration', 'الإعدادات'],
          ['/ministry/admin/activity', 'Activity', 'النشاط'],
          ['/ministry/admin/users', 'Users and roles', 'المستخدمون والأدوار'],
          ['/ministry/admin/records', 'Records', 'السجلات'],
          ['/ministry/reports', 'Post-event reports', 'تقارير ما بعد الفعاليات'],
        ].map(([href, en, ar]) => (
          <a key={href} href={href} style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
            <L en={en!} ar={ar!} />
          </a>
        ))}
      </div>
      <div data-region="owner-overview" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBlockEnd: 24 }}>
        {[
          { en: 'Users', ar: 'المستخدمون', href: '/ministry/admin/users' },
          { en: 'Events', ar: 'الفعاليات', href: '/ministry/admin/records' },
          { en: 'Venues', ar: 'المواقع', href: '/ministry/admin/records' },
          { en: 'Facilities', ar: 'المرافق', href: '/ministry/admin/records' },
        ].map((item, index) => <a key={item.en} href={item.href} style={{ padding: 20, background: 'var(--surface2)', borderRadius: 12, color: 'var(--ink)' }}>
          <div style={{ fontSize: 28 }}>{totals[index]}</div><L en={item.en} ar={item.ar} />
        </a>)}
      </div>
      <section data-region="email-status" style={{ padding: 20, border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 24 }}>
        <h2 style={{ marginBlockStart: 0, fontSize: 18 }}><L en="Invitation email" ar="بريد الدعوات" /></h2>
        {emailConfigured() ? <L en="Sender configured" ar="المرسِل مُعدّ" /> : <L en="Sender not configured yet" ar="لم يُعدّ المرسِل بعد" />}
        <p><L en={`Sent: ${mailStats.find((r) => r.status === 'sent')?.n ?? 0} · Failed: ${mailStats.find((r) => r.status === 'failed')?.n ?? 0}`} ar={`أُرسلت: ${mailStats.find((r) => r.status === 'sent')?.n ?? 0} · تعذّر إرسالها: ${mailStats.find((r) => r.status === 'failed')?.n ?? 0}`} /></p>
      </section>
      <FlagsPanel />
      <details data-region="deferred" style={{ marginBlockEnd: 24, maxWidth: 860 }}>
        <summary style={{ cursor: 'pointer', fontSize: 14 }}><L en="Planned capabilities" ar="القدرات المخطّط لها" /></summary>
        {DEFERRED.map((item) => <div key={item.key} style={{ paddingBlock: 12 }}>
          <L en={item.en} ar={item.ar} />
          <InfoNote><L en={item.reasonEn} ar={item.reasonAr} />{' '}<L en={item.conditionEn} ar={item.conditionAr} /></InfoNote>
        </div>)}
      </details>

      <div data-region="order-lane" style={{ padding: '20px 24px', border: `1px solid ${laneActive ? 'var(--brand)' : 'var(--line)'}`, borderRadius: 12, maxWidth: 860 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            <L en="Order of Physicians lane" ar="مسار نقابة الأطباء" />
          </span>
          <form action={setOrderLaneAction} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {laneActive ? null : <input type="hidden" name="active" value="on" />}
            <button type="submit" style={{ height: 34, paddingInline: 14, border: laneActive ? '1px solid var(--line)' : 0, borderRadius: 17, background: laneActive ? 'var(--bg)' : 'var(--brand)', color: laneActive ? 'var(--ink)' : 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {laneActive ? <L en="Turn the lane off" ar="إطفاء المسار" /> : <L en="Turn the lane on" ar="تشغيل المسار" />}
            </button>
          </form>
        </div>
        <InfoNote>
          <L
            en="Order of Physicians reviewers can check assigned Level 3 items. They cannot record Ministry decisions or access facility records. Turning this off blocks their review access."
            ar="يمكن لمراجعي نقابة الأطباء فحص بنود المستوى 3 المسندة إليهم. لا يمكنهم تسجيل قرارات الوزارة أو الوصول إلى سجلات المنشآت. إيقاف الخيار يمنع وصولهم للمراجعة."
          />
        </InfoNote>
      </div>
      {/* No sequence footers (partner ruling, second sweep) — a quiet link instead. */}
      <div style={{ marginBlockStart: 28 }}>
        <a href="/platform/activity" style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
          <L en="Platform activity" ar="نشاط المنصة" />
        </a>
      </div>
    </MinistryShell>
  );
}
