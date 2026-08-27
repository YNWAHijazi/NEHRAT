import { L } from '../../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { ministryConfig, ministryUsers } from '../../../../lib/queries';
import { addMinistryUserAction, changeUserRoleAction, setUserSuspensionAction } from '../../../ministry-actions';
import { MINISTRY_CONTENT, orderLaneActive, permissionMatrix } from '../../../../lib/rules';

/**
 * Users and roles. The permission matrix renders from the same data that
 * enforces it -- what this table says is what the server refuses. The Order
 * reviewer's access follows the lane: off suspends it, and the row says
 * suspended rather than leaving the account listed as active.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const account = await requireMinistryPage('manageUsers');
  const { notice, error } = await searchParams;
  const users = ministryUsers(account.isDemo);
  const laneConfig = ministryConfig().get('orderLane');
  const laneActive = laneConfig ? laneConfig.value === 'on' : orderLaneActive();
  const matrix = permissionMatrix();
  const roleLabels = MINISTRY_CONTENT.roleLabels as Record<string, { en: string; ar: string }>;
  const matrixRoles = ['reviewer', 'inspector', 'ministry_admin', 'order', 'platform_owner'];

  const assignable = ['reviewer', 'inspector', 'ministry_admin', 'order'];
  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }} consoleEn="Administration" consoleAr="الإدارة">
      <h1 data-sec-h1="" style={{ margin: '0 0 24px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Users and roles" ar="المستخدمون والأدوار" />
      </h1>
      {notice ? (
        <div style={{ padding: '14px 20px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          {notice === 'added' ? <L en="Account created. Credentials are issued out of band; the account signs in by email." ar="أُنشئ الحساب. تُصدر بيانات الدخول خارج المنصة؛ ويسجّل الحساب الدخول بالبريد." /> : null}
          {notice === 'role-changed' ? <L en="Role changed. It applies on the account's next request." ar="غُيّر الدور. ويسري مع طلب الحساب التالي." /> : null}
          {notice === 'suspended' ? <L en="Suspended. The account stops answering immediately; the record is intact." ar="أُوقف. يتوقف الحساب فوراً؛ ويبقى السجل سليماً." /> : null}
          {notice === 'reinstated' ? <L en="Reinstated." ar="أُعيد التفعيل." /> : null}
        </div>
      ) : null}
      {error ? (
        <div style={{ padding: '14px 20px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          {error === 'email-taken' ? <L en="An account with that email already exists." ar="يوجد حساب بهذا البريد." /> : <L en="Name, email and a Ministry role are all required." ar="الاسم والبريد ودور وزاري مطلوبة جميعاً." />}
        </div>
      ) : null}

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
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flex: 'none' }}>
              {suspended ? (
                <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--bad-soft)', color: 'var(--bad)', fontSize: '12.5px' }}>
                  <L en="Suspended — the lane is off" ar="موقوف — المسار مطفأ" />
                </span>
              ) : u.suspended ? (
                <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--bad-soft)', color: 'var(--bad)', fontSize: '12.5px' }}>
                  <L en="Suspended" ar="موقوف" />
                </span>
              ) : (
                <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: '12.5px' }}>
                  <L en="Active" ar="نشط" />
                </span>
              )}
            </span>
            {/* Role change and suspension. Never on your own row -- the console must
                not be able to lock itself out or promote itself -- and never on the
                platform owner, whose seat sits above this console. */}
            {u.login !== account.login && u.role !== 'platform_owner' ? (
              <span style={{ flexBasis: '100%', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <form action={changeUserRoleAction.bind(null, u.login)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <select name="role" defaultValue={u.role} aria-label="Role" style={{ height: 30, paddingInline: 8, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12 }}>
                    {assignable.map((r) => (
                      <option key={r} value={r}>{(roleLabels[r] ?? { en: r }).en}</option>
                    ))}
                  </select>
                  <button type="submit" style={{ height: 30, paddingInline: 11, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 15, fontSize: 12, cursor: 'pointer' }}>
                    <L en="Change role" ar="تغيير الدور" />
                  </button>
                </form>
                <form action={setUserSuspensionAction.bind(null, u.login)}>
                  <input type="hidden" name="suspend" value={u.suspended ? '0' : '1'} />
                  <button type="submit" style={{ height: 30, paddingInline: 11, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 15, fontSize: 12, color: u.suspended ? 'var(--brand)' : 'var(--bad)', cursor: 'pointer' }}>
                    {u.suspended ? <L en="Reinstate" ar="إعادة تفعيل" /> : <L en="Suspend" ar="إيقاف" />}
                  </button>
                </form>
              </span>
            ) : null}
            </div>
          );
        })}
      </div>

      {/* Add a Ministry account. Organizer-side accounts are made by registration and
          nomination, never here. */}
      <details data-region="add-user" style={{ marginBlockEnd: 32, maxWidth: 860 }}>
        <summary style={{ cursor: 'pointer', fontSize: '13.5px', color: 'var(--muted)', listStyle: 'none' }}>
          <span style={{ textDecoration: 'underline' }}>
            <L en="Add a Ministry account" ar="إضافة حساب وزاري" />
          </span>
        </summary>
        <form action={addMinistryUserAction} style={{ marginBlockStart: 12, padding: '16px 20px', background: 'var(--surface2)', borderRadius: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}><L en="Full name" ar="الاسم الكامل" /></span>
            <input name="name" required style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 180 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}><L en="Email" ar="البريد الإلكتروني" /></span>
            <input name="email" type="email" required style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}><L en="Role" ar="الدور" /></span>
            <select name="role" required style={{ height: 34, paddingInline: 8, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }}>
              {assignable.map((r) => (
                <option key={r} value={r}>{(roleLabels[r] ?? { en: r }).en}</option>
              ))}
            </select>
          </label>
          <button type="submit" style={{ height: 34, paddingInline: 14, border: 0, borderRadius: 17, background: 'var(--brand)', color: 'var(--bg)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
            <L en="Create the account" ar="إنشاء الحساب" />
          </button>
          <span style={{ flexBasis: '100%', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
            <L en="Credentials are issued out of band; the account signs in by email. Organizer-side accounts are made by registration and nomination, never here." ar="تُصدر بيانات الدخول خارج المنصة؛ ويسجّل الحساب الدخول بالبريد. أما حسابات جهة المنظّمين فتُنشأ بالتسجيل والترشيح، لا هنا." />
          </span>
        </form>
      </details>
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
