import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { getDb } from '../../../lib/db';
import { ACCOUNTS_CONTENT } from '../../../lib/rules';
import { setPasswordFromLinkAction } from '../../actions';

/**
 * Setting your own password on a single-use link.
 *
 * TWO THINGS ARRIVE HERE. An account an administrator created, whose holder has never
 * had a credential; and a password reset, for somebody who has one and cannot use it.
 * They are the same act -- prove you hold the link, choose a secret nobody else has
 * seen -- so they are one screen rather than two that drift.
 *
 * THIS ALSO RETIRES A DEAD END. requestPasswordResetAction has been writing rows to
 * password_resets since Slice 1, and NOTHING CONSUMED THEM: the reset card told a
 * locked-out user a link had been recorded, and there was no screen the link could
 * open. The copy promised something the build did not have.
 *
 * A DEAD LINK IS NOT AN ERROR TO DEBUG. Used, superseded, expired or invented all
 * answer the same way and say the same thing, because distinguishing them would tell
 * whoever is holding a guessed token which guesses are close.
 */
export default async function ActivatePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const A = ACCOUNTS_CONTENT;

  const row = getDb()
    .prepare(
      `SELECT a.display_name, a.email, p.kind
       FROM password_resets p JOIN accounts a ON a.id = p.account_id
       WHERE p.token = ? AND p.used_at IS NULL AND p.expires_at > now_stamp()
         AND a.suspended = 0`,
    )
    .get(token) as { display_name: string; email: string | null; kind: string } | undefined;

  const field: React.CSSProperties = {
    height: 46,
    paddingInline: 14,
    background: 'var(--bg)',
    border: '1px solid var(--line)',
    borderRadius: 8,
    fontSize: 15,
  };

  return (
    <>
      <GovernmentBand />
      <Header account={null} organization={null} unreadCount={0} showBack={false} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 620 }}>
          {!row ? (
            <div
              data-region="activation-dead"
              style={{ padding: '26px 30px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 16, fontSize: 16, lineHeight: 1.65 }}
            >
              <L en={A.activateDeadEn} ar={A.activateDeadAr} />
              <div style={{ marginBlockStart: 16 }}>
                <a href="/signin">
                  <L en="Return to sign in" ar="العودة إلى تسجيل الدخول" />
                </a>
              </div>
            </div>
          ) : (
            <>
              <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 34, fontWeight: 600, letterSpacing: '-.03em' }}>
                <L en={A.activateTitleEn} ar={A.activateTitleAr} />
              </h1>
              <p style={{ margin: '0 0 8px', fontSize: '16.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '62ch' }}>
                <L en={A.activateBodyEn} ar={A.activateBodyAr} />
              </p>
              <p style={{ margin: '0 0 28px', fontSize: '14.5px', color: 'var(--muted)' }}>
                {row.display_name}
                {row.email ? ` · ${row.email}` : ''}
              </p>

              {error === 'policy' ? (
                <div style={{ padding: '18px 24px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
                  <L en="That password does not meet the policy." ar="كلمة المرور هذه لا تستوفي السياسة." />
                </div>
              ) : null}
              {error === 'mismatch' ? (
                <div style={{ padding: '18px 24px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
                  <L en="The two passwords do not match." ar="كلمتا المرور غير متطابقتين." />
                </div>
              ) : null}

              <form action={setPasswordFromLinkAction.bind(null, token)} data-region="set-password">
                <div style={{ display: 'grid', gap: 16, marginBlockEnd: 22 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                      <L en="New password" ar="كلمة المرور الجديدة" />
                    </span>
                    <input name="password" type="password" required style={field} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                      <L en="Repeat the password" ar="أعيدوا كلمة المرور" />
                    </span>
                    <input name="confirm" type="password" required style={field} />
                  </label>
                </div>
                <button
                  type="submit"
                  style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
                >
                  <L en="Set the password and sign in" ar="تعيين كلمة المرور وتسجيل الدخول" />
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </>
  );
}
