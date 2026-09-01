import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../components/Header';
import { L } from '../../components/L';
import { currentAccount } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { saveCredentialAction } from '../actions';
import { unreadCountFor } from '../../lib/queries';
import { ROLES_CONTENT, orderLaneActive } from '../../lib/rules';

/**
 * Credential verification -- the Order of Physicians lane. Configurable,
 * non-determinative, and OFF BY DEFAULT (SPEC): with the lane inactive the screen
 * says so as a first-class answer, names no gap, and states that Ministry review is
 * unaffected. The record is the Order's; the physician sees it and cannot change it.
 */
export default async function CredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (account.role !== 'director') redirect('/dashboard');
  const { notice } = await searchParams;
  const unread = unreadCountFor(account.id);
  const licence = (getDb()
    .prepare(`SELECT credential_licence FROM accounts WHERE id = ?`)
    .get(account.id) as { credential_licence: string | null }).credential_licence ?? '';
  const content = ROLES_CONTENT.director;
  const laneActive = orderLaneActive();

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={null} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Credential verification" ar="التحقق من المؤهلات" />
          </h1>
          <p style={{ margin: '0 0 32px', fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: '76ch' }}>
            <L en={content.credIntro.en} ar={content.credIntro.ar} />
          </p>

          {!laneActive ? (
            <div data-region="lane-off" style={{ padding: '32px 36px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, marginBlockEnd: 24 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 12 }}>
                <L en="Lane not active" ar="المسار غير مفعّل" />
              </div>
              <p style={{ margin: 0, fontSize: '15.5px', lineHeight: 1.75, maxWidth: '70ch' }}>
                <L en={content.credLaneOff.en} ar={content.credLaneOff.ar} />
              </p>
            </div>
          ) : null}

          {/* The record itself, self-maintained: what the Order verifies against
              when the lane is on. Verification is the Order's; the record is yours. */}
          <form data-region="credential-record" action={saveCredentialAction} style={{ padding: '20px 24px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 24, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end', maxWidth: '82ch' }}>
            {notice === 'saved' ? (
              <span style={{ flexBasis: '100%', fontSize: '13px', color: 'var(--brand)' }}>
                <L en="Saved." ar="حُفظ." />
              </span>
            ) : null}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 220 }}>
              <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                <L en="Order of Physicians licence number" ar="رقم الإجازة في نقابة الأطباء" />
              </span>
              <input name="licence" defaultValue={licence} style={{ height: 40, paddingInline: 12, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 14, fontVariantNumeric: 'tabular-nums' }} />
            </label>
            <button type="submit" style={{ height: 40, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 20, fontSize: 14, cursor: 'pointer' }}>
              <L en="Save the record" ar="حفظ السجل" />
            </button>
            <span style={{ flexBasis: '100%', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              <L en="This record is yours to maintain. Verification is the Order's, where its lane is active, and never decides an outcome." ar="هذا السجل عليكم صيانته. والتحقق للنقابة، حيث يكون مسارها مفعّلاً، ولا يقرر نتيجة أبداً." />
            </span>
          </form>

          <div data-region="non-determinative" style={{ padding: '23px 27px', background: 'var(--surface2)', borderRadius: 12, fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)', maxWidth: '82ch' }}>
            <L en={content.credNonDeterminative.en} ar={content.credNonDeterminative.ar} />
          </div>
        </div>
      </main>
    </>
  );
}
