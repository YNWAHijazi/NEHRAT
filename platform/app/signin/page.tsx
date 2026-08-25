import Link from 'next/link';
import { GovernmentBand, Header } from '../../components/Header';
import { L } from '../../components/L';
import {
  createAccountAction,
  demoSignInAction,
  requestPasswordResetAction,
  signInWithPasswordAction,
} from '../actions';

/**
 * The auth card, from the reference: three modes -- Sign in to the service, Create an
 * account, Reset your password -- with sign-in offering the other two as secondary
 * actions beneath the primary. Markup geometry and every string copied from
 * `Organizer Journey.dc.html`; the demonstration panel sits beside it.
 */

type Mode = 'signin' | 'signup' | 'reset';

const DEMO_LOGINS: { login: string; en: string; ar: string }[] = [
  { login: 'test_organizer', en: 'Organizer', ar: 'المنظّم' },
  { login: 'test_organizer_pending', en: 'Organizer — organization pending', ar: 'المنظّم — المؤسسة قيد التسجيل' },
  { login: 'test_ems', en: 'EMS provider', ar: 'مزوّد خدمات الطوارئ الطبية' },
  { login: 'test_director', en: 'Event Medical Director', ar: 'المدير الطبي للفعالية' },
  { login: 'test_response', en: 'First-response unit', ar: 'وحدة الاستجابة الأولية' },
  { login: 'test_moph', en: 'Ministry reviewer', ar: 'مراجع الوزارة' },
  { login: 'test_inspector', en: 'Ministry inspector', ar: 'مفتش الوزارة' },
  { login: 'test_moph_admin', en: 'Ministry administrator', ar: 'مدير النظام في الوزارة' },
  { login: 'test_owner', en: 'Platform owner', ar: 'مالك المنصة' },
];

/** Reference field geometry: 46px inputs, 8px radius. */
const inputStyle: React.CSSProperties = {
  height: 46,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
};

const fieldLabel: React.CSSProperties = { fontSize: 14, color: 'var(--muted)' };

const secondaryBtn: React.CSSProperties = {
  height: 40,
  paddingInline: 18,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  borderRadius: 20,
  fontSize: 14,
  display: 'inline-flex',
  alignItems: 'center',
  color: 'var(--ink)',
};

const modeChipBase: React.CSSProperties = {
  height: 34,
  paddingInline: 16,
  borderRadius: 18,
  fontSize: '13.5px',
  display: 'inline-flex',
  alignItems: 'center',
};

function modeChipStyle(active: boolean): React.CSSProperties {
  return {
    ...modeChipBase,
    border: `1px solid ${active ? 'var(--brand)' : 'var(--line)'}`,
    background: active ? 'var(--brand-soft)' : 'transparent',
    color: active ? 'var(--brand)' : 'var(--muted)',
  };
}

const ERROR_STRINGS: Record<string, { en: string; ar: string }> = {
  credentials: {
    en: 'The email address or password is not recognized.',
    ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  },
  'name-required': { en: 'The full name is required.', ar: 'الاسم الكامل مطلوب.' },
  'email-required': { en: 'The email address is required.', ar: 'البريد الإلكتروني مطلوب.' },
  'email-taken': {
    en: 'An account already exists for this email address. Sign in, or reset the password.',
    ar: 'يوجد حساب مسجَّل بهذا البريد الإلكتروني. سجّلوا الدخول أو أعيدوا تعيين كلمة المرور.',
  },
  'password-policy': {
    en: 'The password does not meet the required length of 8 characters.',
    ar: 'كلمة المرور لا تستوفي الطول المطلوب البالغ 8 أحرف.',
  },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; notice?: string; error?: string }>;
}) {
  const params = await searchParams;
  const mode: Mode =
    params.mode === 'signup' ? 'signup' : params.mode === 'reset' ? 'reset' : 'signin';
  const error = params.error ? ERROR_STRINGS[params.error] : undefined;

  const action =
    mode === 'signup'
      ? createAccountAction
      : mode === 'reset'
        ? requestPasswordResetAction
        : signInWithPasswordAction;

  return (
    <>
      <GovernmentBand />
      <Header account={null} organization={null} unreadCount={0} showBack={false} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div data-wide="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
          <div style={{ padding: 34, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }}>
            {/* Mode chips: the reference shows sign-in as active for both signin and reset. */}
            <div style={{ display: 'flex', gap: 6, marginBlockEnd: 22 }}>
              <Link href="/signin" aria-pressed={mode !== 'signup'} style={modeChipStyle(mode !== 'signup')}>
                <L en="Sign in" ar="تسجيل الدخول" />
              </Link>
              <Link href="/signin?mode=signup" aria-pressed={mode === 'signup'} style={modeChipStyle(mode === 'signup')}>
                <L en="Create an account" ar="إنشاء حساب" />
              </Link>
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
              {mode === 'signup' ? (
                <L en="Create an account" ar="إنشاء حساب" />
              ) : mode === 'reset' ? (
                <L en="Reset your password" ar="إعادة تعيين كلمة المرور" />
              ) : (
                <L en="Sign in to the service" ar="تسجيل الدخول إلى الخدمة" />
              )}
            </h1>
            <p style={{ margin: '0 0 26px', fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>
              <L
                en="An individual account gives access to the platform. An organization is registered separately and must be recorded by the Ministry before anything can be filed."
                ar="يمنح الحساب الفردي الوصول إلى المنصة. تُسجَّل المؤسسة بشكل منفصل ويجب أن تسجّلها الوزارة قبل إمكانية تقديم أي ملف."
              />
            </p>

            {params.notice === 'reset-sent' ? (
              <div style={{ padding: '14px 18px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.6 }}>
                <L
                  en="If an account exists for that address, a reset link has been issued to it."
                  ar="إذا وُجد حساب بهذا العنوان، فقد صدر إليه رابط إعادة تعيين."
                />
              </div>
            ) : null}
            {error ? (
              <div style={{ padding: '14px 18px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.6 }}>
                <L en={error.en} ar={error.ar} />
              </div>
            ) : null}

            <form action={action}>
              {mode === 'signup' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBlockEnd: 16 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={fieldLabel}>
                      <L en="Full name" ar="الاسم الكامل" />
                    </span>
                    <input name="name" type="text" required style={inputStyle} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={fieldLabel}>
                      <L en="Organization you are joining or creating" ar="المؤسسة التي تنضمون إليها أو تنشئونها" />
                    </span>
                    <input name="organization" type="text" style={inputStyle} />
                  </label>
                </div>
              ) : null}

              {mode === 'reset' ? (
                <div style={{ padding: '18px 20px', border: '1px solid var(--line)', borderRadius: 10, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)' }}>
                  <L
                    en="Enter the email address on the account. A reset link is sent to it, expires after one hour, and can be used once."
                    ar="أدخلوا البريد الإلكتروني المسجَّل على الحساب. ويُرسل إليه رابط إعادة التعيين، تنتهي صلاحيته بعد ساعة ويُستخدم مرة واحدة."
                  />
                </div>
              ) : null}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlockEnd: 16 }}>
                <span style={fieldLabel}>
                  <L en="Email" ar="البريد الإلكتروني" />
                </span>
                <input name="email" type="email" required style={inputStyle} />
              </label>

              {mode !== 'reset' ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlockEnd: 24 }}>
                  <span style={fieldLabel}>
                    <L en="Password" ar="كلمة المرور" />
                  </span>
                  <input name="password" type="password" required style={inputStyle} />
                </label>
              ) : null}

              <button
                type="submit"
                style={{ height: 48, width: '100%', border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
              >
                {mode === 'signup' ? (
                  <L en="Create the account" ar="إنشاء الحساب" />
                ) : mode === 'reset' ? (
                  <L en="Send the reset link" ar="إرسال رابط إعادة التعيين" />
                ) : (
                  <L en="Sign in" ar="تسجيل الدخول" />
                )}
              </button>
            </form>

            {mode === 'signin' ? (
              <div style={{ marginBlockStart: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <Link href="/signin?mode=signup" style={secondaryBtn}>
                  <L en="Create an account" ar="إنشاء حساب" />
                </Link>
                <Link href="/signin?mode=reset" style={secondaryBtn}>
                  <L en="Reset your password" ar="إعادة تعيين كلمة المرور" />
                </Link>
              </div>
            ) : null}
            {mode === 'reset' ? (
              <div style={{ marginBlockStart: 16 }}>
                <Link href="/signin" style={secondaryBtn}>
                  <L en="Back to sign in" ar="العودة إلى تسجيل الدخول" />
                </Link>
              </div>
            ) : null}
            {mode === 'signup' ? (
              <p style={{ margin: '16px 0 0', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
                <L
                  en="After creating the account you continue to the organization registration form."
                  ar="بعد إنشاء الحساب تنتقلون إلى نموذج تسجيل المؤسسة."
                />
              </p>
            ) : null}
          </div>

          {/* Reviewer ruling: the demonstration panel exists only in a review build --
              the same guard that forces the seeder off in production (lib/db.ts).
              A production sign-in shows no demonstration accounts. */}
          {process.env.NODE_ENV !== 'production' ? (
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
            {params.notice === 'role-later-slice' ? (
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
          ) : null}        </div>
      </main>
    </>
  );
}
