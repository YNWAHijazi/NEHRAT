import { L } from '../../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { ministryConfig, ministryUsers } from '../../../../lib/queries';
import { MINISTRY_CONTENT, orderLaneActive, permissionMatrix } from '../../../../lib/rules';

/**
 * Users and roles. The permission matrix renders from the same data that
 * enforces it -- what this table says is what the server refuses. The Order
 * reviewer's access follows the lane: off suspends it, and the row says
 * suspended rather than leaving the account listed as active.
 */
export default async function UsersPage() {
  const account = await requireMinistryPage('manageUsers');
  const users = ministryUsers(account.isDemo);
  const laneConfig = ministryConfig().get('orderLane');
  const laneActive = laneConfig ? laneConfig.value === 'on' : orderLaneActive();
  const matrix = permissionMatrix();
  const roleLabels = MINISTRY_CONTENT.roleLabels as Record<string, { en: string; ar: string }>;
  const matrixRoles = ['reviewer', 'inspector', 'ministry_admin', 'order', 'platform_owner'];

  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }} consoleEn="Administration" consoleAr="الإدارة">
      <h1 data-sec-h1="" style={{ margin: '0 0 24px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Users and roles" ar="المستخدمون والأدوار" />
      </h1>

      <div data-region="users" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 32, maxWidth: 860 }}>
        {users.map((u) => {
          const suspended = u.role === 'order' && !laneActive;
          const label = roleLabels[u.role] ?? { en: u.role, ar: u.role };
          return (
            <div key={u.login} style={{ paddingBlock: '15px', paddingInlineStart: '20px', paddingInlineEnd: '21px', background: 'var(--surface2)', borderInlineStart: `3px ${suspended ? 'dashed var(--bad)' : 'solid var(--line)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <span style={{ fontSize: 15, fontWeight: 500 }}>{u.displayName}</span>
              <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 2 }}>
                <L en={label.en} ar={label.ar} />
              </span>
            </span>
            {suspended ? (
              <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--bad-soft)', color: 'var(--bad)', fontSize: '12.5px' }}>
                <L en="Suspended — the lane is off" ar="موقوف — المسار مطفأ" />
              </span>
            ) : (
              <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: '12.5px' }}>
                <L en="Active" ar="نشط" />
              </span>
            )}
            </div>
          );
        })}
      </div>
      {!laneActive ? (
        <div data-region="order-suspension" style={{ padding: '15px 19px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 32, fontSize: '13.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '80ch' }}>
          <L en={MINISTRY_CONTENT.orderSuspension.en} ar={MINISTRY_CONTENT.orderSuspension.ar} />
        </div>
      ) : null}

      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
        <L en="The permission matrix, as enforced" ar="مصفوفة الصلاحيات كما تُطبَّق" />
      </h2>
      <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '84ch' }}>
        <L
          en="Rendered from the same data the server enforces. An administrator configures and never determines; an inspector records corrective actions and none of the three outcomes; the platform owner performs no regulatory action."
          ar="تُعرض من البيانات نفسها التي يطبّقها الخادم. فالمسؤول الإداري يُعدّ ولا يبتّ؛ والمفتش يسجّل الإجراءات التصحيحية ولا يسجّل أياً من النتائج الثلاث؛ ومالك المنصة لا يقوم بأي عمل تنظيمي."
        />
      </p>
      <div style={{ overflowX: 'auto' }}>
        <div data-region="matrix" data-stack="" style={{ display: 'grid', gridTemplateColumns: `minmax(260px,1.6fr) repeat(${matrixRoles.length}, minmax(90px,1fr))`, gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', minWidth: 760 }}>
          <div data-th="" style={{ background: 'var(--surface2)', padding: '11px 16px', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <L en="Action" ar="العمل" />
          </div>
          {matrixRoles.map((r) => (
            <div key={r} data-th="" style={{ background: 'var(--surface2)', padding: '11px 12px', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)', lineHeight: 1.4 }}>
              <L en={roleLabels[r]?.en ?? r} ar={roleLabels[r]?.ar ?? r} />
            </div>
          ))}
          {matrix.map((row) => [
            <div key={`${row.action.key}-a`} style={{ background: 'var(--bg)', padding: '11px 16px', fontSize: '13.5px', lineHeight: 1.45 }}>
              <L en={row.action.en} ar={row.action.ar} />
            </div>,
            ...matrixRoles.map((r) => (
              <div key={`${row.action.key}-${r}`} style={{ background: 'var(--bg)', padding: '11px 12px', fontSize: 13, textAlign: 'center', color: row.roles[r] ? 'var(--brand)' : 'var(--line)' }}>
                {row.roles[r] ? '●' : '—'}
              </div>
            )),
          ])}
        </div>
      </div>
      <MinistryFooter steps={[
        { href: '/ministry/order', en: 'Order of Physicians lane', ar: 'مسار نقابة الأطباء', descEn: 'The lane whose state governs the Order account.', descAr: 'المسار الذي تحكم حالته حساب النقابة.' },
      ]} />
    </MinistryShell>
  );
}
