import { InfoNote } from '../../../components/InfoNote';
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
       <InfoNote><L
          en="The lane informs the Ministry; it never records an outcome and never reaches the facility side."
          ar="يُعلم المسار الوزارة؛ ولا يسجّل أي نتيجة ولا يصل إلى جانب المرافق."
        /></InfoNote>
</h1>

      {!active ? (
        <div data-region="lane-off" style={{ padding: '28px 32px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, maxWidth: '86ch' }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 10 }}>
            <L en="Lane not active" ar="المسار غير مفعّل" />
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75 }}>
            <L
              en="Order of Physicians review is off. The platform owner can enable it in settings."
              ar="مراجعة نقابة الأطباء غير مفعّلة. يمكن لمالك المنصة تفعيلها من الإعدادات."
            />
          </p>
        </div>
      ) : (
        <div data-region="lane-on" style={{ padding: '24px 28px', border: '1px solid var(--brand)', borderRadius: 16, maxWidth: '86ch', fontSize: 15, lineHeight: 1.7 }}>
          <L
            en="Review your assigned Level 3 medical items here. You can see the assessment, event level, medical staff, clinical roles and licences. Business details and facility records are not shared."
            ar="راجعوا هنا البنود الطبية المسندة إليكم للمستوى 3. يمكنكم عرض التقييم ومستوى الفعالية والطاقم الطبي والأدوار السريرية والتراخيص. لا تُشارك البيانات التجارية أو سجلات المنشآت."
          />
        </div>
      )}
    </MinistryShell>
  );
}
