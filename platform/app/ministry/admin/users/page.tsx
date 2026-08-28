import { AdminTabs } from '../../../../components/AdminTabs';
import { L } from '../../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { administeredAccounts, ministryConfig } from '../../../../lib/queries';
import { addMinistryUserAction, changeUserRoleAction, reissueActivationAction, setUserSuspensionAction } from '../../../ministry-actions';
import {
  ACCOUNTS_CONTENT,
  ASSIGNABLE_ROLES,
  MINISTRY_CONTENT,
  accountOrigin,
  administrationBar,
  bilingualMap,
  consequencesOf,
  isPending,
  orderLaneActive,
  permissionMatrix,
} from '../../../../lib/rules';

/**
 * Users and roles. The permission matrix renders from the same data that
 * enforces it -- what this table says is what the server refuses. The Order
 * reviewer's access follows the lane: off suspends it, and the row says
 * suspended rather than leaving the account listed as active.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; token?: string; seg?: string; q?: string }>;
}) {
  const account = await requireMinistryPage('manageUsers');
  const { notice, error, token: issuedToken, seg, q } = await searchParams;
  const ACCOUNTS_CONSOLE = MINISTRY_CONTENT.adminConsole;
  const all = administeredAccounts(account.isDemo);

  // SEGMENTED BY TYPE, because "every account" is a list nobody reads. Ministry staff,
  // organizers, providers, directors and first-response units are five different
  // populations with different questions attached to them.
  const segmentOf = (role: string): string =>
    ['reviewer', 'inspector', 'ministry_admin', 'platform_owner', 'order'].includes(role)
      ? 'ministry'
      : ['organizer', 'ems', 'director', 'response'].includes(role)
        ? role
        : 'other';
  const needle = (q ?? '').trim().toLowerCase();
  const users = all.filter((u) => {
    if (seg && seg !== '' && segmentOf(u.role) !== seg) return false;
    if (needle === '') return true;
    return `${u.displayName} ${u.email ?? ''}`.toLowerCase().includes(needle);
  });
  const segments = bilingualMap(ACCOUNTS_CONSOLE.segments);
  const segmentCounts = new Map<string, number>();
  for (const u of all) segmentCounts.set(segmentOf(u.role), (segmentCounts.get(segmentOf(u.role)) ?? 0) + 1);
  const laneConfig = ministryConfig().get('orderLane');
  const laneActive = laneConfig ? laneConfig.value === 'on' : orderLaneActive();
  const matrix = permissionMatrix();
  const roleLabels = bilingualMap(MINISTRY_CONTENT.roleLabels);
  const matrixRoles = ['reviewer', 'inspector', 'ministry_admin', 'order', 'platform_owner'];

  // EVERY assignable role, from lib/rules. This console listed four, so an organizer,
  // a provider, a Director and a first-response unit could not be seen here at all.
  const assignable = ASSIGNABLE_ROLES;
  const A = ACCOUNTS_CONTENT;
  const origins = bilingualMap(A.origins);
  const originNotes = bilingualMap(A.originNotes);
  const bars = bilingualMap(A.bars);
  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }} consoleEn="Administration" consoleAr="الإدارة">
      <h1 data-sec-h1="" style={{ margin: '0 0 24px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en={A.titleEn} ar={A.titleAr} />
      </h1>
      <AdminTabs current="/ministry/admin/users" />
      <p style={{ margin: '0 0 18px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.65, maxWidth: '84ch' }}>
        <L en={A.introEn} ar={A.introAr} />
      </p>

      {/* Segment and search, as a GET form so a filtered view has a URL. */}
      <form method="get" data-region="user-filters" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', padding: '14px 18px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 18, maxWidth: 860 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            <L en={ACCOUNTS_CONSOLE.segmentsTitleEn} ar={ACCOUNTS_CONSOLE.segmentsTitleAr} />
          </span>
          <select name="seg" defaultValue={seg ?? ''} style={{ height: 36, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }}>
            <option value="">{`${ACCOUNTS_CONSOLE.anyEn} (${all.length})`}</option>
            {Object.entries(segments).map(([key, label]) => (
              <option key={key} value={key}>{`${label.en} (${segmentCounts.get(key) ?? 0})`}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 220 }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            <L en={ACCOUNTS_CONSOLE.userSearchEn} ar={ACCOUNTS_CONSOLE.userSearchAr} />
          </span>
          <input name="q" defaultValue={q ?? ''} style={{ height: 36, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        </label>
        <button type="submit" style={{ height: 36, paddingInline: 16, border: 0, borderRadius: 18, background: 'var(--brand)', color: 'var(--bg)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
          <L en={ACCOUNTS_CONSOLE.filterApplyEn} ar={ACCOUNTS_CONSOLE.filterApplyAr} />
        </button>
      </form>
      {notice ? (
        <div style={{ padding: '14px 20px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          {notice === 'invited' ? <L en="Account created. Hand the activation link below to the person it names — they set their own password." ar="أُنشئ الحساب. سلّموا رابط التفعيل أدناه إلى الشخص الذي يسمّيه — فهو يضع كلمة مروره بنفسه." /> : null}
          {notice === 'reissued' ? <L en="A new activation link was issued. The previous one no longer works." ar="صدر رابط تفعيل جديد. ولم يعد الرابط السابق يعمل." /> : null}
          {notice === 'role-changed' ? <L en="Role changed. It applies on the account's next request." ar="غُيّر الدور. ويسري مع طلب الحساب التالي." /> : null}
          {notice === 'suspended' ? <L en="Suspended. The account stops answering immediately; the record is intact." ar="أُوقف. يتوقف الحساب فوراً؛ ويبقى السجل سليماً." /> : null}
          {notice === 'reinstated' ? <L en="Reinstated." ar="أُعيد التفعيل." /> : null}
        </div>
      ) : null}
      {error ? (
        <div style={{ padding: '14px 20px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          {error === 'email-taken' ? (
            <L en="An account with that email already exists." ar="يوجد حساب بهذا البريد." />
          ) : error === 'already-active' ? (
            <L en="That account has already set a password. Its holder resets their own; an administrator does not issue one." ar="وضع هذا الحساب كلمة مرور سابقاً. ويعيد صاحبه تعيينها بنفسه؛ ولا يصدرها مسؤول." />
          ) : (
            <L en="A name, an email and a role are all required." ar="الاسم والبريد والدور مطلوبة جميعاً." />
          )}
        </div>
      ) : null}

      {issuedToken ? (
        <div data-region="issued-link" style={{ padding: '18px 22px', border: '2px solid var(--brand)', borderRadius: 12, marginBlockEnd: 20, maxWidth: 860 }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 6 }}>
            <L en={A.inviteLinkLabelEn} ar={A.inviteLinkLabelAr} />
          </div>
          <code dir="ltr" style={{ display: 'block', padding: '9px 12px', background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '12.5px', overflowWrap: 'anywhere', userSelect: 'all' }}>
            {`/activate/${issuedToken}`}
          </code>
          <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, marginBlockStart: 6, maxWidth: '80ch' }}>
            <L en={A.inviteLinkNoteEn} ar={A.inviteLinkNoteAr} />
          </div>
        </div>
      ) : null}

      <div data-region="users" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 32, maxWidth: 860 }}>
        {users.map((u) => {
          const laneOff = u.role === 'order' && !laneActive;
          const label = roleLabels[u.role] ?? { en: u.role, ar: u.role };
          const origin = accountOrigin({
            isDemo: u.isDemo,
            hasPassword: u.hasPassword,
            wasInvited: u.wasInvited,
            fromNomination: u.fromNomination,
            role: u.role,
          });
          const pending = isPending({ hasPassword: u.hasPassword, wasInvited: u.wasInvited });
          const holdings = consequencesOf(u.holdings);
          // The bar is a REASON, not a hidden control: the row says who holds it.
          const bar = administrationBar(
            { id: account.id, isDemo: account.isDemo },
            { id: u.id, role: u.role, isDemo: u.isDemo },
          );
          const edge = laneOff || u.suspended ? 'dashed var(--bad)' : pending ? 'dashed var(--accent)' : 'solid var(--line)';
          return (
            <div key={u.login} style={{ paddingBlock: '15px', paddingInlineStart: '20px', paddingInlineEnd: '21px', background: 'var(--surface2)', borderInlineStart: `3px ${edge}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ flex: 1, minWidth: 220 }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{u.displayName}</span>
                <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 2 }}>
                  <L en={label.en} ar={label.ar} />
                  {u.email ? <span dir="ltr"> · {u.email}</span> : null}
                </span>
                {/* WHERE THIS ACCOUNT CAME FROM. An account with no origin is a row
                    nobody can account for, and "who let this in" is not a question a
                    register should be unable to answer. Derived, never stored. */}
                <span data-region="origin" style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBlockStart: 4 }}>
                  <L en={origins[origin]?.en ?? origin} ar={origins[origin]?.ar ?? origin} />
                  <span> · <L en={ACCOUNTS_CONSOLE.createdEn} ar={ACCOUNTS_CONSOLE.createdAr} /> {u.createdAt}</span>
                  <span>
                    {' · '}
                    {u.lastSeen ? (
                      <L en={`${ACCOUNTS_CONSOLE.lastSeenEn} ${u.lastSeen}`} ar={`${ACCOUNTS_CONSOLE.lastSeenAr} ⁦${u.lastSeen}⁩`} />
                    ) : (
                      <L en={ACCOUNTS_CONSOLE.neverSeenEn} ar={ACCOUNTS_CONSOLE.neverSeenAr} />
                    )}
                  </span>
                </span>
                {originNotes[origin] ? (
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6, marginBlockStart: 4, maxWidth: '74ch' }}>
                    <L en={originNotes[origin]!.en} ar={originNotes[origin]!.ar} />
                  </span>
                ) : null}
              </span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flex: 'none' }}>
                {laneOff ? (
                  <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--bad-soft)', color: 'var(--bad)', fontSize: '12.5px' }}>
                    <L en="Suspended — the lane is off" ar="موقوف — المسار مطفأ" />
                  </span>
                ) : u.suspended ? (
                  <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--bad-soft)', color: 'var(--bad)', fontSize: '12.5px' }}>
                    <L en={A.suspendedChipEn} ar={A.suspendedChipAr} />
                  </span>
                ) : pending ? (
                  <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontSize: '12.5px' }}>
                    <L en={A.pendingChipEn} ar={A.pendingChipAr} />
                  </span>
                ) : (
                  <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: '12.5px' }}>
                    <L en={A.activeChipEn} ar={A.activeChipAr} />
                  </span>
                )}
              </span>

              {/* WHAT THIS ACCOUNT HOLDS, stated before anything is done to it. The
                  organizer's remove-a-provider control names the weight of the act
                  before the click; this is the same rule on the same grounds. */}
              <span data-region="holdings" style={{ flexBasis: '100%', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.7 }}>
                {holdings.length === 0 ? (
                  <L en={A.holdsNothingEn} ar={A.holdsNothingAr} />
                ) : (
                  holdings.map((c, i) => (
                    <span key={c.key}>
                      {i > 0 ? ' · ' : ''}
                      <L en={c.en} ar={c.ar} />
                    </span>
                  ))
                )}
              </span>

              {bar !== null ? (
                <span data-region="bar" style={{ flexBasis: '100%', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.65, maxWidth: '80ch' }}>
                  <L en={bars[bar]!.en} ar={bars[bar]!.ar} />
                </span>
              ) : (
                <span style={{ flexBasis: '100%', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <details>
                    <summary style={{ cursor: 'pointer', fontSize: '12.5px', color: 'var(--muted)', listStyle: 'none' }}>
                      <span style={{ textDecoration: 'underline' }}>
                        <L en={A.roleChangeTitleEn} ar={A.roleChangeTitleAr} />
                      </span>
                    </summary>
                    <div style={{ marginBlockStart: 8 }}>
                      <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.65, marginBlockEnd: 8, maxWidth: '74ch' }}>
                        <L en={A.roleChangeBodyEn} ar={A.roleChangeBodyAr} />
                      </div>
                      <form action={changeUserRoleAction.bind(null, u.login)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <select name="role" defaultValue={u.role} aria-label="Role" style={{ height: 30, paddingInline: 8, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12 }}>
                          {assignable.map((r) => (
                            <option key={r} value={r}>{roleLabels[r]?.en ?? r}</option>
                          ))}
                        </select>
                        <button type="submit" style={{ height: 30, paddingInline: 11, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 15, fontSize: 12, cursor: 'pointer' }}>
                          <L en="Change role" ar="تغيير الدور" />
                        </button>
                      </form>
                    </div>
                  </details>

                  <details>
                    <summary style={{ cursor: 'pointer', fontSize: '12.5px', color: u.suspended ? 'var(--brand)' : 'var(--bad)', listStyle: 'none' }}>
                      <span style={{ textDecoration: 'underline' }}>
                        {u.suspended ? <L en={A.restoreTitleEn} ar={A.restoreTitleAr} /> : <L en={A.suspendTitleEn} ar={A.suspendTitleAr} />}
                      </span>
                    </summary>
                    <div style={{ marginBlockStart: 8 }}>
                      <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.65, marginBlockEnd: 8, maxWidth: '74ch' }}>
                        {u.suspended ? <L en={A.restoreBodyEn} ar={A.restoreBodyAr} /> : <L en={A.suspendBodyEn} ar={A.suspendBodyAr} />}
                      </div>
                      <form action={setUserSuspensionAction.bind(null, u.login)}>
                        <input type="hidden" name="suspend" value={u.suspended ? '0' : '1'} />
                        <button type="submit" style={{ height: 30, paddingInline: 11, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 15, fontSize: 12, color: u.suspended ? 'var(--brand)' : 'var(--bad)', cursor: 'pointer' }}>
                          {u.suspended ? <L en="Restore" ar="إعادة تفعيل" /> : <L en="Suspend" ar="تعليق" />}
                        </button>
                      </form>
                    </div>
                  </details>

                  {/* A PENDING ACCOUNT IS NOT A DEAD END: the link is re-issuable, and
                      the row says what re-issuing costs. */}
                  {pending ? (
                    <form action={reissueActivationAction.bind(null, u.login)} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <button type="submit" style={{ height: 30, paddingInline: 11, border: '1px solid var(--accent)', background: 'var(--bg)', borderRadius: 15, fontSize: 12, color: 'var(--accent-ink)', cursor: 'pointer' }}>
                        <L en={A.reissueEn} ar={A.reissueAr} />
                      </button>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        <L en={A.reissueNoteEn} ar={A.reissueNoteAr} />
                      </span>
                    </form>
                  ) : null}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* CREATE AN ACCOUNT. The platform issues an activation link; the person sets
          their own password. No administrator sets or sees one. */}
      <details data-region="add-user" style={{ marginBlockEnd: 32, maxWidth: 860 }}>
        <summary style={{ cursor: 'pointer', fontSize: '13.5px', color: 'var(--muted)', listStyle: 'none' }}>
          <span style={{ textDecoration: 'underline' }}>
            <L en={A.inviteTitleEn} ar={A.inviteTitleAr} />
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
                <option key={r} value={r}>{roleLabels[r]?.en ?? r}</option>
              ))}
            </select>
          </label>
          <button type="submit" style={{ height: 34, paddingInline: 14, border: 0, borderRadius: 17, background: 'var(--brand)', color: 'var(--bg)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
            <L en="Create the account" ar="إنشاء الحساب" />
          </button>
          <span style={{ flexBasis: '100%', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
            <L en={A.inviteBodyEn} ar={A.inviteBodyAr} />
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
