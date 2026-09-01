import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../components/Header';
import { L } from '../../components/L';
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
export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const { name: prefillName } = await searchParams;

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
            <div style={{ padding: '27px 31px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 36 }}>
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
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: '13.5px' }}>
                      <L en="Recorded by the Ministry" ar="مسجّلة لدى الوزارة" />
                    </span>
                  ) : organization.status === 'returned' ? (
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: 'var(--bad-soft)', color: 'var(--bad)', fontSize: '13.5px' }}>
                      <L en="Returned by the Ministry — yours to correct" ar="أعادتها الوزارة — تصحيحها عليكم" />
                    </span>
                  ) : (
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontSize: '13.5px' }}>
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
              {organization.status === 'returned' && organization.returnReason ? (
                <div style={{ margin: '18px 0 0', padding: '14px 18px', background: 'var(--bad-soft)', borderRadius: 10, fontSize: '13.5px', lineHeight: 1.65 }}>
                  <span style={{ display: 'block', fontWeight: 500, marginBlockEnd: 4, color: 'var(--bad)' }}>
                    <L en="The Ministry's reason, as written" ar="سبب الوزارة، كما كُتب" />
                  </span>
                  {organization.returnReason}
                </div>
              ) : null}
              {/* Editable while pending or returned: the same form, prefilled, and
                  re-submitting sets it pending again. Once recorded it is the
                  Ministry's record -- corrections go through the Ministry. */}
              {organization.status === 'pending' || organization.status === 'returned' ? (
                <form action={registerOrganizationAction} style={{ marginBlockStart: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                      <L en="Organization name (English)" ar="اسم المؤسسة (بالإنكليزية)" />
                    </span>
                    <input name="nameEn" required defaultValue={organization.nameEn} style={inputStyle} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                      <L en="Organization name (Arabic)" ar="اسم المؤسسة (بالعربية)" />
                    </span>
                    <input name="nameAr" dir="rtl" required defaultValue={organization.nameAr} style={inputStyle} />
                  </label>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <button type="submit" style={{ height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: 14, cursor: 'pointer' }}>
                      {organization.status === 'returned' ? (
                        <L en="Re-submit for recording" ar="إعادة التقديم للتسجيل" />
                      ) : (
                        <L en="Save the corrected details" ar="حفظ البيانات المصحَّحة" />
                      )}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          ) : (
            <form action={registerOrganizationAction} style={{ padding: '27px 31px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 36 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBlockEnd: 20 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                    <L en="Organization name (English)" ar="اسم المؤسسة (بالإنكليزية)" />
                  </span>
                  <input name="nameEn" required defaultValue={prefillName ?? ''} style={inputStyle} />
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

      </main>
    </>
  );
}
