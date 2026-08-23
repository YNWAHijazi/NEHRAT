import { GovernmentBand, Header } from '../../components/Header';
import { L } from '../../components/L';
import { createAccountAction, demoSignInAction } from '../actions';

const DEMO_LOGINS: { login: string; en: string; ar: string }[] = [
  { login: 'test_organizer', en: 'Organizer', ar: 'المنظّم' },
  { login: 'test_ems', en: 'EMS provider', ar: 'مزوّد خدمات الطوارئ الطبية' },
  { login: 'test_director', en: 'Event Medical Director', ar: 'المدير الطبي للفعالية' },
  { login: 'test_response', en: 'First-response unit', ar: 'وحدة الاستجابة الأولية' },
  { login: 'test_moph', en: 'Ministry reviewer', ar: 'مراجع الوزارة' },
  { login: 'test_moph_admin', en: 'Ministry administrator', ar: 'مدير النظام في الوزارة' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: '14.5px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12.5px',
  fontWeight: 500,
  marginBlockEnd: 6,
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;

  return (
    <>
      <GovernmentBand />
      <Header account={null} organization={null} unreadCount={0} showBack={false} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div data-wide="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
          <div style={{ padding: 34, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }}>
            <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
              <L en="Create an account" ar="إنشاء حساب" />
            </h1>
            <p style={{ margin: '0 0 26px', fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>
              <L
                en="An individual account gives access to the platform. An organization is registered separately and must be recorded by the Ministry before anything can be filed."
                ar="يمنح الحساب الفردي الوصول إلى المنصة. تُسجَّل المؤسسة بشكل منفصل ويجب أن تسجّلها الوزارة قبل إمكانية تقديم أي ملف."
              />
            </p>
            <form action={createAccountAction}>
              <div style={{ marginBlockEnd: 18 }}>
                <label htmlFor="name" style={labelStyle}>
                  <L en="Full name" ar="الاسم الكامل" />
                </label>
                <input id="name" name="name" required style={inputStyle} />
              </div>
              <button
                type="submit"
                style={{
                  height: 48,
                  paddingInline: 26,
                  border: 0,
                  borderRadius: 24,
                  background: 'var(--brand)',
                  color: 'var(--bg)',
                  fontSize: '14.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <L en="Create the account" ar="إنشاء الحساب" />
              </button>
              <p style={{ margin: '14px 0 0', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
                <L en="Fee: None." ar="الرسم: لا يوجد." />
              </p>
            </form>
          </div>

          <div style={{ padding: 34, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
              <L en="Demonstration accounts" ar="حسابات العرض التوضيحي" />
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
              <L
                en="Each opens a role's dashboard populated with example records, so the platform can be walked without creating records. These records are examples and never appear in a real account."
                ar="يفتح كل حساب لوحة دوره مزوّدة بسجلات نموذجية، بحيث يمكن استعراض المنصة دون إنشاء سجلات. هذه السجلات أمثلة ولا تظهر أبداً في حساب حقيقي."
              />
            </p>
            {notice === 'role-later-slice' ? (
              <p
                data-dev-only=""
                style={{ margin: '0 0 16px', padding: '10px 14px', fontSize: '12.5px', lineHeight: 1.6, color: 'var(--muted)', border: '1px dashed var(--line)', borderRadius: 8 }}
              >
                Build note: only the organizer surface exists in this review build. The other role dashboards arrive in later slices.
              </p>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DEMO_LOGINS.map((demo) => (
                <form key={demo.login} action={demoSignInAction}>
                  <input type="hidden" name="login" value={demo.login} />
                  <button
                    type="submit"
                    style={{
                      width: '100%',
                      textAlign: 'start',
                      padding: '12px 16px',
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      borderRadius: 10,
                      fontSize: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <span>
                      <L en={demo.en} ar={demo.ar} />
                    </span>
                    <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{demo.login}</span>
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
