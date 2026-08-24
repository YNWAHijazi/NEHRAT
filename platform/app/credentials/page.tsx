import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../components/Header';
import { L } from '../../components/L';
import { SequenceFooter } from '../../components/SequenceFooter';
import { currentAccount } from '../../lib/auth';
import { unreadCountFor } from '../../lib/queries';
import { ROLES_CONTENT, orderLaneActive } from '../../lib/rules';

/**
 * Credential verification -- the Order of Physicians lane. Configurable,
 * non-determinative, and OFF BY DEFAULT (SPEC): with the lane inactive the screen
 * says so as a first-class answer, names no gap, and states that Ministry review is
 * unaffected. The record is the Order's; the physician sees it and cannot change it.
 */
export default async function CredentialsPage() {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (account.role !== 'director') redirect('/dashboard');
  const unread = unreadCountFor(account.id);
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

          <div data-region="non-determinative" style={{ padding: '22px 26px', border: '1px solid var(--line)', borderRadius: 12, fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)', maxWidth: '82ch' }}>
            <L en={content.credNonDeterminative.en} ar={content.credNonDeterminative.ar} />
          </div>
        </div>
        <SequenceFooter
          labelEn="Next in the sequence"
          labelAr="التالي في التسلسل"
          steps={[
            {
              href: '/profile',
              en: 'Physician profile',
              ar: 'الملف الطبي',
              descEn: 'What the Order verifies against, where the lane is active.',
              descAr: 'ما تتحقق النقابة على أساسه، حيث يكون المسار مفعّلاً.',
            },
            {
              href: '/dashboard',
              en: 'Dashboard',
              ar: 'اللوحة',
              descEn: 'Events you have been named in.',
              descAr: 'الفعاليات التي سُمّيتم فيها.',
            },
          ]}
        />
      </main>
    </>
  );
}
