import { L } from '../../../components/L';
import { MinistryShell } from '../../../components/MinistryShell';
import { notFound, redirect } from 'next/navigation';
import { currentAccount } from '../../../lib/auth';
import { ministryConfig } from '../../../lib/queries';
import { can, orderLaneActive } from '../../../lib/rules';

/**
 * The Order of Physicians lane, seen from the Ministry side. Configurable,
 * non-determinative, off by default, and it NEVER extends into the facility
 * lane. With the lane off, the off state is the whole screen.
 */
export default async function OrderLanePage() {
  // TWO permissions admit here: the console's (a reviewer or administrator reading
  // the lane state) and the Order's own -- this page is the order role's landing
  // route, and gating on viewMinistry alone sent that role's sign-in to a 404 of
  // its own page.
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!can(account.role, 'viewMinistry') && !can(account.role, 'orderVerify')) notFound();
  const config = ministryConfig().get('orderLane');
  const active = config ? config.value === 'on' : orderLaneActive();

  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }}>
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Order of Physicians lane" ar="مسار نقابة الأطباء" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '82ch', lineHeight: 1.6 }}>
        <L
          en="The lane informs the Ministry; it never records an outcome and never reaches the facility side."
          ar="يُعلم المسار الوزارة؛ ولا يسجّل أي نتيجة ولا يصل إلى جانب المرافق."
        />
      </p>
      {!active ? (
        <div data-region="lane-off" style={{ padding: '28px 32px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, maxWidth: '86ch' }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 10 }}>
            <L en="Lane not active" ar="المسار غير مفعّل" />
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75 }}>
            <L
              en="The lane is off — its default. No verification is performed, no Order reviewer holds access, and no record appears here. It is turned on under Master admin."
              ar="المسار مطفأ — وهذا وضعه الافتراضي. لا يُجرى أي تحقق، ولا يملك أي مراجع من النقابة وصولاً، ولا يظهر أي سجل هنا. ويُشغَّل ضمن الإدارة العليا."
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
    </MinistryShell>
  );
}
