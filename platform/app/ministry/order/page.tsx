import { L } from '../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../components/MinistryShell';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { ministryConfig } from '../../../lib/queries';
import { orderLaneActive } from '../../../lib/rules';

/**
 * The Order of Physicians lane, seen from the Ministry side. Configurable,
 * non-determinative, off by default, and it NEVER extends into the facility
 * lane. With the lane off, the off state is the whole screen.
 */
export default async function OrderLanePage() {
  const account = await requireMinistryPage('viewMinistry');
  const config = ministryConfig().get('orderLane');
  const active = config ? config.value === 'on' : orderLaneActive();

  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }}>
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Order of Physicians lane" ar="مسار نقابة الأطباء" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '82ch', lineHeight: 1.6 }}>
        <L
          en="A configurable, non-determinative lane. It informs the Ministry; it never records an outcome, and it never extends into the facility side. While the lane is on, its attestations gate only the satisfied outcome — the other two outcomes remain available to the reviewer at all times."
          ar="مسار قابل للإعداد وغير حاسم. يُعلم الوزارة ولا يسجّل أي نتيجة، ولا يمتد إلى جانب المنشآت. وعند تشغيله، تحجب تصديقاته النتيجة المستوفاة فقط — وتبقى النتيجتان الأخريان متاحتين للمراجع في كل وقت."
        />
      </p>
      {!active ? (
        <div data-region="lane-off" style={{ padding: '28px 32px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, maxWidth: '86ch' }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 10 }}>
            <L en="Lane not active" ar="المسار غير مفعّل" />
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75 }}>
            <L
              en="The lane is off — its default. No verification is performed, no Order reviewer holds access, and no record appears here. Turning it on is a capability decision under Master admin; turning it off again suspends any active Order reviewer's access rather than leaving them listed as active."
              ar="المسار مطفأ — وهذا وضعه الافتراضي. لا يُجرى أي تحقق، ولا يملك أي مراجع من النقابة وصولاً، ولا يظهر أي سجل هنا. وتفعيله قرار قدرات ضمن الإدارة العليا؛ وإطفاؤه مجدداً يوقف وصول أي مراجع نشط بدل تركه مدرجاً كنشط."
            />
          </p>
        </div>
      ) : (
        <div data-region="lane-on" style={{ padding: '24px 28px', border: '1px solid var(--brand)', borderRadius: 16, maxWidth: '86ch', fontSize: 15, lineHeight: 1.7 }}>
          <L
            en="The lane is active. Assigned Level 3 items reach the Order reviewer, scoped to the assessment, the level, medical staffing, clinical governance and credentials — never the organizer's commercial details, and never the facility lane."
            ar="المسار مفعّل. تصل البنود المسندة من المستوى 3 إلى مراجع النقابة، محصورة بالتقييم والمستوى والملاك الطبي والحوكمة السريرية والمؤهلات — لا التفاصيل التجارية للمنظّم أبداً، ولا مسار المرافق أبداً."
          />
        </div>
      )}
      <MinistryFooter steps={[
        { href: '/ministry/admin/users', en: 'Users and roles', ar: 'المستخدمون والأدوار', descEn: "Where the Order reviewer's suspension shows.", descAr: 'حيث يظهر إيقاف مراجع النقابة.' },
        { href: '/ministry/queue', en: 'Review queue', ar: 'قائمة المراجعة', descEn: 'Outcome authority stays here, lane on or off.', descAr: 'تبقى سلطة النتائج هنا، سواء فُعّل المسار أم لا.' },
      ]} />
    </MinistryShell>
  );
}
