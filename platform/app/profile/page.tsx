import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../components/Header';
import { L } from '../../components/L';
import { currentAccount } from '../../lib/auth';
import { roleProfileFor, unreadCountFor } from '../../lib/queries';
import { ROLES_CONTENT } from '../../lib/rules';
import { saveRoleProfileAction } from '../actions';

/**
 * The role profile: the agency's or the physician's, completed once and reused
 * across every event. An organizer's profile is its organization screen.
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (account.role === 'organizer') redirect('/organization');
  if (account.role !== 'ems' && account.role !== 'director') redirect('/dashboard');
  const { notice } = await searchParams;
  const unread = unreadCountFor(account.id);
  const profile = roleProfileFor(account.id);
  const isEms = account.role === 'ems';
  const fields = isEms ? ROLES_CONTENT.ems.profileFields : ROLES_CONTENT.director.profileFields;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={null} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          {notice === 'accepted' ? (
            <div style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              <L en="Nomination accepted. Complete your profile — it is reused across every event." ar="قُبل الترشيح. استكملوا ملفكم — يُعاد استخدامه في كل فعالية." />
            </div>
          ) : null}
          {notice === 'saved' ? (
            <div style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              <L en="Profile saved." ar="حُفظ الملف." />
            </div>
          ) : null}
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            {isEms ? <L en="Agency profile" ar="ملف الجهة" /> : <L en="Physician profile" ar="الملف الطبي" />}
          </h1>
          <p style={{ margin: '0 0 32px', fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: '72ch' }}>
            <L en={ROLES_CONTENT.ems.profileReuse.en} ar={ROLES_CONTENT.ems.profileReuse.ar} />
          </p>

          <form action={saveRoleProfileAction}>
            <div data-region="profile-form" style={{ padding: 33, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16 }}>
                {fields.map((f) => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                      <L en={f.en} ar={f.ar} />
                    </span>
                    <input name={f.key} defaultValue={profile[f.key] ?? ''} style={{ height: 44, paddingInline: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 22, fontSize: 15 }} />
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" style={{ height: 46, paddingInline: 24, border: 0, borderRadius: 23, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
              <L en="Save the profile" ar="حفظ الملف" />
            </button>
          </form>

          {isEms ? (
            <div data-region="shared-note" style={{ marginBlockStart: 20, padding: '23px 27px', background: 'var(--surface2)', borderRadius: 12, fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '80ch' }}>
              <L en={ROLES_CONTENT.ems.profileSharedNote.en} ar={ROLES_CONTENT.ems.profileSharedNote.ar} />
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
