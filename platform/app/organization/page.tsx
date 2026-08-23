import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../components/Header';
import { L } from '../../components/L';
import { SequenceFooter } from '../../components/SequenceFooter';
import { currentAccount, organizationFor } from '../../lib/auth';
import { unreadCountFor } from '../../lib/queries';
import { registerOrganizationAction } from '../actions';

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
};

/**
 * The organization record. Registration blocks filing, not starting (non-negotiable #9):
 * this screen says plainly what continues meanwhile and what waits.
 */
export default async function OrganizationPage() {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 720 }}>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Organization" ar="المؤسسة" />
          </h1>
          <p style={{ margin: '0 0 36px', fontSize: 16, lineHeight: 1.65, color: 'var(--muted)' }}>
            <L
              en="The organization is recorded by the Ministry. You may create events, complete assessments, gather requirements and draft the plan while recording is pending; only submission waits for it."
              ar="تسجّل الوزارة المؤسسة. يمكنكم إنشاء الفعاليات وإكمال التقييمات وتجميع المتطلبات وصياغة الخطة أثناء انتظار التسجيل؛ التقديم وحده ينتظره."
            />
          </p>

          {organization ? (
            <div style={{ padding: '26px 30px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 36 }}>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 3 }}>
                    <L en="Name" ar="الاسم" />
                  </div>
                  <div style={{ fontSize: '15.5px', fontWeight: 500 }}>
                    <L en={organization.nameEn} ar={organization.nameAr} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 3 }}>
                    <L en="Registration" ar="التسجيل" />
                  </div>
                  {organization.status === 'recorded' ? (
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 4, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: '13.5px' }}>
                      <L en="Recorded by the Ministry" ar="مسجّلة لدى الوزارة" />
                    </span>
                  ) : (
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontSize: '13.5px' }}>
                      <L en="Pending Ministry recording" ar="بانتظار تسجيل الوزارة" />
                    </span>
                  )}
                </div>
              </div>
              {organization.status === 'pending' ? (
                <p style={{ margin: '18px 0 0', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--muted)' }}>
                  <L
                    en="You are notified when the Ministry records the organization. Submission opens then."
                    ar="تُبلَّغون عندما تسجّل الوزارة المؤسسة. ويُفتح التقديم حينها."
                  />
                </p>
              ) : null}
            </div>
          ) : (
            <form action={registerOrganizationAction} style={{ padding: '26px 30px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 36 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBlockEnd: 20 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                    <L en="Organization name (English)" ar="اسم المؤسسة (بالإنكليزية)" />
                  </span>
                  <input name="nameEn" required style={inputStyle} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                    <L en="Organization name (Arabic)" ar="اسم المؤسسة (بالعربية)" />
                  </span>
                  <input name="nameAr" dir="rtl" required style={inputStyle} />
                </label>
              </div>
              <button type="submit" style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}>
                <L en="File the organization for recording" ar="تقديم المؤسسة للتسجيل" />
              </button>
              <p style={{ margin: '14px 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>
                <L en="Fee: None." ar="الرسم: لا يوجد." />
              </p>
            </form>
          )}
        </div>

        <SequenceFooter
          labelEn="Where this screen leads"
          labelAr="إلى أين تقود هذه الشاشة"
          steps={[
            {
              href: '/dashboard',
              en: 'Dashboard',
              ar: 'اللوحة',
              descEn: 'Every record on this account, and what each one owes.',
              descAr: 'كل سجل على هذا الحساب وما يستحق على كل منها.',
              primary: true,
            },
            {
              href: '/events/new',
              en: 'Certify an event',
              ar: 'اعتماد فعالية',
              descEn: 'Create the event and complete the assessment; this continues while recording is pending.',
              descAr: 'أنشئوا الفعالية وأكملوا التقييم؛ يستمر ذلك أثناء انتظار التسجيل.',
            },
          ]}
        />
      </main>
    </>
  );
}
