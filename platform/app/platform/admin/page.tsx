import { L } from '../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../components/MinistryShell';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { ministryConfig } from '../../../lib/queries';
import { ALL_FLAGS, featureEnabled, orderLaneActive } from '../../../lib/rules';
import { setOrderLaneAction } from '../../ministry-actions';

/**
 * Master admin -- above the Ministry, and holding no regulatory action. The
 * commercial capability flags render as governed states, not switches: the
 * Lebanon tenant ships with all of them off, and activation is a governance
 * decision recorded in the configuration data, not a console click. The one
 * live control is the Order of Physicians lane, whose off state suspends the
 * Order reviewer's access.
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

      <div data-region="flags" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 860, marginBlockEnd: 32 }}>
        {ALL_FLAGS.map((flag) => (
          <div key={flag} style={{ padding: '14px 20px', background: 'var(--surface2)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14.5px', fontVariantNumeric: 'tabular-nums' }}>{flag}</span>
            <span style={{ padding: '3px 10px', borderRadius: 999, background: featureEnabled(flag) ? 'var(--brand-soft)' : 'var(--surface2)', color: featureEnabled(flag) ? 'var(--brand)' : 'var(--muted)', fontSize: '12.5px', letterSpacing: '.04em' }}>
              {featureEnabled(flag) ? <L en="ON" ar="مشغّل" /> : <L en="OFF" ar="مطفأ" />}
            </span>
          </div>
        ))}
      </div>
      <p style={{ margin: '0 0 32px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '84ch' }}>
        <L
          en="These states are read from the configuration data. The reference console showed them as switches; activating one is a governance decision recorded in that data, and this screen reports it rather than performing it."
          ar="تُقرأ هذه الحالات من بيانات الإعداد. وقد أظهرتها اللوحة المرجعية كمفاتيح؛ لكن تفعيل إحداها قرار حوكمة يُسجَّل في تلك البيانات، وهذه الشاشة تعرضه ولا تنفّذه."
        />
      </p>

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
      <MinistryFooter steps={[{ href: '/platform/activity', en: 'Platform activity', ar: 'نشاط المنصة', descEn: 'Counts only.', descAr: 'أعداد فقط.' }]} />
    </MinistryShell>
  );
}
