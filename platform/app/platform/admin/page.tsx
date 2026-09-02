import { L } from '../../../components/L';
import { MinistryShell } from '../../../components/MinistryShell';
import { FlagsPanel } from '../../../components/FlagsPanel';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { ministryConfig } from '../../../lib/queries';
import { orderLaneActive } from '../../../lib/rules';
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
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '84ch', lineHeight: 1.6 }}>
        <L
          en="Capability, not content: these capabilities exist because the platform is licensed, and they ship off. Nothing commercial renders in this tenant while they are."
          ar="قدرة لا محتوى: توجد هذه القدرات لأن المنصة مرخَّصة، وتُشحن مطفأة. ولا يظهر أي محتوى تجاري في هذا المستأجر ما دامت كذلك."
        />
      </p>

      {/* The four administration tabs, granted to the owner by the partner ruling —
          the same screens the master administrator sees, not copies of them. */}
      <div data-region="owner-admin-links" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBlockEnd: 28 }}>
        {[
          ['/ministry/admin/configuration', 'Configuration', 'الإعدادات'],
          ['/ministry/admin/activity', 'Activity', 'النشاط'],
          ['/ministry/admin/users', 'Users and roles', 'المستخدمون والأدوار'],
          ['/ministry/admin/records', 'Records', 'السجلات'],
        ].map(([href, en, ar]) => (
          <a key={href} href={href} style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
            <L en={en!} ar={ar!} />
          </a>
        ))}
      </div>
      <FlagsPanel />
      
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
        <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.65 }}>
          <L
            en="Authorised external reviewer access, scoped to assigned Level 3 items, non-determinative, never the facility lane. Turning it off suspends the Order reviewer account under Users and roles rather than leaving it listed as active."
            ar="وصول مراجع خارجي مُخوَّل، محصور بالبنود المسندة في المستوى 3، غير حاسم، ولا يصل مسار المرافق أبداً. وإطفاؤه يوقف حساب مراجع النقابة في المستخدمين والأدوار بدل تركه مدرجاً كنشط."
          />
        </p>
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
