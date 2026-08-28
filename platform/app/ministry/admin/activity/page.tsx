import Link from 'next/link';
import { AdminTabs } from '../../../../components/AdminTabs';
import { L } from '../../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { ministryActivity, unreachablePowers } from '../../../../lib/queries';
import { MINISTRY_CONTENT, bilingualMap } from '../../../../lib/rules';

/**
 * ACTIVITY — the audit trail as a surface, rather than as fragments on each record.
 *
 * Every fact here already existed, each on the record it belongs to, and there was
 * nowhere to read them together: an overseeing profile asking what happened on this
 * platform last week had to open records one at a time and hope.
 *
 * ASSEMBLED BY UNION, not from a written-to audit table. An audit table is a second
 * copy of the truth that can disagree with the first, and it records only what
 * somebody remembered to write to it. These rows ARE the records — a determination
 * appears here because it is in the determinations table, not because a line was
 * logged beside it.
 *
 * IT ALSO CARRIES THE REACHABILITY CHECK, because this is the screen for facts about
 * the platform rather than about a record. A power assigned in the matrix and held by
 * no active account is advertised on screens that then refuse everyone.
 */
export default async function AdminActivityPage() {
  const account = await requireMinistryPage('viewRegistry');
  const A = MINISTRY_CONTENT.adminConsole;
  const kinds = bilingualMap(A.kinds);
  const rows = ministryActivity(account.isDemo);
  const unreachable = unreachablePowers(account.isDemo);

  return (
    <MinistryShell
      account={account}
      back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }}
      consoleEn="Master administration"
      consoleAr="الإدارة العامة"
    >
      <h1 data-sec-h1="" style={{ margin: '0 0 20px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en={A.titleEn} ar={A.titleAr} />
      </h1>
      <AdminTabs current="/ministry/admin/activity" />

      {/* POWERS NOBODY REACHABLE HOLDS. On this screen because it is a fact about the
          platform, and because the administrator is the only profile that can act on
          it — by issuing an account for the role that holds the power. */}
      <div data-region="unreachable-powers" style={{ padding: '18px 22px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 28 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 600, letterSpacing: '-.02em' }}>
          <L en={A.unreachableTitleEn} ar={A.unreachableTitleAr} />
        </h2>
        <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.65, maxWidth: '80ch' }}>
          <L en={A.unreachableBodyEn} ar={A.unreachableBodyAr} />
        </p>
        {unreachable.length === 0 ? (
          <div style={{ fontSize: '13.5px', color: 'var(--brand)' }}>
            <L en={A.unreachableNoneEn} ar={A.unreachableNoneAr} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {unreachable.map((p) => (
              <div key={p.action} style={{ paddingBlock: '10px', paddingInlineStart: '14px', background: 'var(--bg)', borderInlineStart: '3px solid var(--bad)', borderRadius: 8, fontSize: '13.5px' }}>
                <L en={p.en} ar={p.ar} />
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBlockStart: 2 }}>
                  {p.roles.join(', ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, letterSpacing: '-.025em' }}>
        <L en={A.activityTitleEn} ar={A.activityTitleAr} />
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.65, maxWidth: '84ch' }}>
        <L en={A.activityIntroEn} ar={A.activityIntroAr} />
      </p>

      <div data-region="activity" style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ background: 'var(--bg)', padding: '14px 18px', fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en={A.activityNoneEn} ar={A.activityNoneAr} />
          </div>
        ) : null}
        {rows.map((r, i) => {
          const kind = kinds[r.kind];
          return (
            <div key={`${r.at}-${r.kind}-${i}`} style={{ background: 'var(--bg)', padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'baseline' }}>
              <span style={{ flex: '0 0 132px', fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{r.at}</span>
              <span style={{ flex: '0 0 168px', fontSize: '13px' }}>
                <L en={kind?.en ?? r.kind} ar={kind?.ar ?? r.kind} />
              </span>
              <span style={{ flex: 1, minWidth: 200, fontSize: '13.5px' }}>
                {r.href ? (
                  <Link href={r.href} style={{ color: 'var(--ink)' }}>
                    {r.subject}
                  </Link>
                ) : (
                  r.subject
                )}
                {r.detail ? <span style={{ color: 'var(--muted)' }}> · {r.detail}</span> : null}
              </span>
              <span style={{ flex: '0 0 auto', fontSize: '12.5px', color: 'var(--muted)' }}>{r.actor}</span>
            </div>
          );
        })}
      </div>

      <MinistryFooter
        steps={[
          { href: '/ministry/admin/users', en: 'Users', ar: 'المستخدمون', descEn: 'Who is on the platform and what they hold.', descAr: 'من على المنصة وما يحمله.' },
        ]}
      />
    </MinistryShell>
  );
}
