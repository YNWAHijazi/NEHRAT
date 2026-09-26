import { InfoNote } from '../../components/InfoNote';
import { PasswordHint } from '../../components/PasswordHint';
import Link from 'next/link';
import { rememberedSignInFields } from '../../lib/auth';
import { demonstrationAccountsExist } from '../../lib/queries';
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

/**
 * The demonstration logins, each stating WHAT IT CAN AND CANNOT DO at the point of
 * sign-in rather than in a document nobody has open.
 *
 * The reviewer focuses on submissions. The administrator also records outcomes;
 * the owner holds administration access but does not record outcomes or attestations.
 */
type DemoLogin = {
  login: string;
  en: string;
  ar: string;
  canEn: string;
  canAr: string;
  cannotEn: string;
  cannotAr: string;
  primary?: true;
};

const DEMO_LOGINS: DemoLogin[] = [
  {
    login: 'test_organizer', en: 'Organizer', ar: 'المنظّم',
    canEn: 'Create events, venues and facilities; assess, attach, name providers and file.',
    canAr: 'إنشاء الفعاليات والمواقع والمنشآت؛ والتقييم والإرفاق وتسمية المزوّدين والتقديم.',
    cannotEn: 'Record any outcome, or see another organizer\u2019s records.',
    cannotAr: 'تسجيل أي نتيجة، أو الاطلاع على سجلات منظّم آخر.',
  },
  {
    login: 'test_organizer_pending', en: 'Organizer — new account', ar: 'المنظّم — حساب جديد',
    canEn: 'Create events, complete requirements and submit.',
    canAr: 'إنشاء الفعاليات واستكمال المتطلبات والتقديم.',
    cannotEn: 'See another organizer’s records.',
    cannotAr: 'الاطلاع على سجلات منظّم آخر.',
  },
  {
    login: 'test_ems', en: 'EMS provider', ar: 'مزوّد خدمات الطوارئ الطبية',
    canEn: 'Answer a nomination and supply operational detail; sign the readiness declaration at Level 3.',
    canAr: 'الرد على التسمية وتقديم التفاصيل التشغيلية؛ وتوقيع إقرار الجاهزية في المستوى 3.',
    cannotEn: 'See any event it was not named in.',
    cannotAr: 'الاطلاع على أي فعالية لم يُسمَّ فيها.',
  },
  {
    login: 'test_director', en: 'Event Medical Director', ar: 'المدير الطبي للفعالية',
    canEn: 'Write the governance text and co-sign the post-event report, on Level 3 events it is named in.',
    canAr: 'كتابة نص الحوكمة والمشاركة في توقيع التقرير اللاحق، في فعاليات المستوى 3 المُسمّى فيها.',
    cannotEn: 'See any event it was not named in.',
    cannotAr: 'الاطلاع على أي فعالية لم يُسمَّ فيها.',
  },
  {
    login: 'test_moph', en: 'Ministry reviewer', ar: 'مراجع الوزارة', primary: true,
    canEn: 'Record any of the three outcomes, assign, require additional measures, answer enquiries, schedule inspections and record findings.',
    canAr: 'تسجيل أي من النتائج الثلاث، والإسناد، واشتراط تدابير إضافية، والرد على الاستفسارات، وجدولة التفتيش وتسجيل نتائجه.',
    cannotEn: 'Change configuration or manage users.',
    cannotAr: 'تغيير الإعدادات أو إدارة المستخدمين.',
  },
    {
    login: 'test_moph_admin', en: 'Ministry administrator', ar: 'مدير النظام في الوزارة',
    canEn: 'Manage users and records, configure requirements, review submissions and record outcomes.',
    canAr: 'إدارة المستخدمين والسجلات، وضبط المتطلبات، ومراجعة التقديمات وتسجيل النتائج.',
    cannotEn: 'Access platform-owner controls.',
    cannotAr: 'الوصول إلى أدوات مالك المنصة.',
  },
  {
    login: 'test_owner', en: 'Platform owner', ar: 'مالك المنصة',
    canEn: 'Manage users, inspect records and view platform activity counts.',
    canAr: 'إدارة المستخدمين، والاطلاع على السجلات وأعداد نشاط المنصة.',
    cannotEn: 'Record Ministry outcomes or attestations, or configure cardiac policy.',
    cannotAr: 'تسجيل نتائج الوزارة أو التصديقات، أو ضبط سياسة توقف القلب.',
  },
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
    en: 'Check the password requirements below and try again.',
    ar: 'راجعوا متطلبات كلمة المرور أدناه وحاولوا مجدداً.',
  },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; notice?: string; error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const mode: Mode =
    params.mode === 'signup' ? 'signup' : params.mode === 'reset' ? 'reset' : 'signin';
  const error = params.error ? ERROR_STRINGS[params.error] : undefined;
  // What the visitor typed on a failed attempt, so nothing is retyped. Never a password.
  const typed = await rememberedSignInFields();

  const action =
    mode === 'signup'
      ? createAccountAction
      : mode === 'reset'
        ? requestPasswordResetAction
        : signInWithPasswordAction;

  return (
    <>
      <GovernmentBand />
      <Header account={null} organization={null} unreadCount={0} showBack />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div data-wide="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
          <div data-region="credential-card" style={{ padding: 35, background: 'var(--surface2)', borderRadius: 16 }}>
            {/* Mode chips: the reference shows sign-in as active for both signin and reset. */}
            <div style={{ display: 'flex', gap: 6, marginBlockEnd: 22 }}>
              <Link href={`/signin?next=${encodeURIComponent(params.next ?? '')}`} aria-pressed={mode !== 'signup'} style={modeChipStyle(mode !== 'signup')}>
                <L en="Sign in" ar="تسجيل الدخول" />
              </Link>
              <Link href={`/signin?mode=signup&next=${encodeURIComponent(params.next ?? '')}`} aria-pressed={mode === 'signup'} style={modeChipStyle(mode === 'signup')}>
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
            {/* "An individual account gives access to the platform" left (partner
                ruling, second sweep): it narrated the card it sat on. The organization
                gate stays — it is the one thing a new arrival cannot guess. */}
            {mode === 'signup' ? (
            <div className="secondary-help"><InfoNote><L
                en="An organization is registered separately and must be recorded by the Ministry before anything can be filed."
                ar="تُسجَّل المؤسسة بشكل منفصل ويجب أن تسجّلها الوزارة قبل إمكانية تقديم أي ملف."
              /></InfoNote></div>
            ) : null}

            {params.notice === 'reset-unavailable' ? <p role="alert"><L en="Password recovery email is unavailable. Contact support for help." ar="بريد استعادة كلمة المرور غير متاح. تواصلوا مع الدعم للمساعدة." /> <Link href="/help"><L en="Contact support" ar="التواصل مع الدعم" /></Link></p> : null}
            {params.notice === 'reset-sent' ? (
              <div style={{ padding: '14px 18px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.6 }}>
                <L
                  en="If this address has an active account, check your inbox for a reset link."
                  ar="إذا كان لهذا العنوان حساب نشط، تحقّقوا من بريدكم للحصول على رابط إعادة التعيين."
                />
              </div>
            ) : null}
            {error ? (
              <div style={{ padding: '14px 18px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.6 }}>
                <L en={error.en} ar={error.ar} />
              </div>
            ) : null}

            {params.error?.startsWith('otp-') ? <p role="alert"><L en={params.error==='otp-limited'?'Please wait before requesting another code.':'Verification email is unavailable. Please try again later.'} ar={params.error==='otp-limited'?'انتظروا قبل طلب رمز آخر.':'بريد التحقق غير متاح. حاولوا لاحقاً.'}/></p>:null}
            {params.error==='phone'?<p role="alert"><L en="Use a phone number with a country code, starting with +." ar="أدخلوا رقم الهاتف مع رمز البلد، بدءاً بعلامة +."/></p>:null}
            <form action={action}>
              <input type="hidden" name="next" value={params.next ?? ''} />
              {mode === 'signup' ? <label style={{display:'block',marginBlockEnd:16}}><L en="Phone number (with country code)" ar="رقم الهاتف مع رمز البلد"/><input name="phone" type="tel" autoComplete="tel" placeholder="+961..." style={inputStyle}/></label>:null}
              {mode === 'signup' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBlockEnd: 16 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={fieldLabel}>
                      <L en="Full name" ar="الاسم الكامل" />
                    </span>
                    <input name="name" type="text" required defaultValue={typed.name ?? ''} style={inputStyle} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={fieldLabel}>
                      <L en="Organization you are joining or creating" ar="المؤسسة التي تنضمون إليها أو تنشئونها" />
                    </span>
                    <input name="organization" type="text" defaultValue={typed.organization ?? ''} style={inputStyle} />
                  </label>
                </div>
              ) : null}

              {mode === 'reset' ? (
                <div style={{ padding: '19px 21px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)' }}>
                  <L
                    en="Enter your account email. The reset link works once and expires after one hour."
                    ar="أدخلوا البريد الإلكتروني لحسابكم. يُستخدم رابط إعادة التعيين مرة واحدة وتنتهي صلاحيته بعد ساعة."
                  />
                </div>
              ) : null}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlockEnd: 16 }}>
                <span style={fieldLabel}>
                  <L en="Email" ar="البريد الإلكتروني" />
                </span>
                <input name="email" type="email" required defaultValue={typed.email ?? ''} autoFocus={Boolean(error) && !typed.email} style={inputStyle} />
              </label>

              {mode !== 'reset' ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlockEnd: 24 }}>
                  <span style={fieldLabel}>
                    <L en="Password" ar="كلمة المرور" />
                  </span>
                  <input name="password" type="password" required autoFocus={Boolean(error) && Boolean(typed.email)} style={inputStyle} />
                  {mode === 'signup' ? <PasswordHint /> : null}
                </label>
              ) : null}

              <button
                type="submit"
                style={{ height: 48, width: '100%', border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
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
                <Link href={`/signin?mode=signup&next=${encodeURIComponent(params.next ?? '')}`} style={secondaryBtn}>
                  <L en="Create an account" ar="إنشاء حساب" />
                </Link>
                <Link href="/signin?mode=reset" style={secondaryBtn}>
                  <L en="Reset your password" ar="إعادة تعيين كلمة المرور" />
                </Link>
              </div>
            ) : null}
            {mode === 'reset' ? (
              <div style={{ marginBlockStart: 16 }}>
                <Link href={`/signin?next=${encodeURIComponent(params.next ?? '')}`} style={secondaryBtn}>
                  <L en="Back to sign in" ar="العودة إلى تسجيل الدخول" />
                </Link>
              </div>
            ) : null}
            {mode === 'signup' ? (
              <div className="secondary-help"><InfoNote><L
                  en="Create your account, then complete your organization details or continue to your chosen service."
                  ar="أنشئوا حسابكم، ثم أكملوا بيانات المؤسسة أو تابعوا إلى الخدمة المختارة."
                /></InfoNote></div>
            ) : null}
          </div>

          {/* Derived from the record, not from the environment. The panel used to be
              gated on NODE_ENV, borrowing the guard that forces the SEEDER off in a
              deployed environment -- but non-negotiable 8 says demonstration ACCOUNTS
              exist in production and only the seeder is forced off. A deployed instance
              provisioned with them offered no way in. Accounts present, panel shown. */}
          {demonstrationAccountsExist() ? (
          <div style={{ padding: 35, background: 'var(--surface2)', borderRadius: 16 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
              <L en="Demonstration accounts" ar="حسابات العرض التوضيحي" />
            </h2>
            <InfoNote>
              <L
                en="Try each role using example records."
                ar="جرّبوا كل دور باستخدام سجلات تجريبية."
              />
            </InfoNote>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DEMO_LOGINS.map((demo) => (
                <form key={demo.login} action={demoSignInAction}>
                  <input type="hidden" name="login" value={demo.login} />
                  <button
                    type="submit"
                    style={{
                      width: '100%',
                      textAlign: 'start',
                      padding: '14px 16px',
                      background: 'var(--bg)',
                      border: `1px solid ${demo.primary ? 'var(--brand)' : 'var(--line)'}`,
                      borderRadius: 10,
                      fontSize: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <L en={demo.en} ar={demo.ar} />
                        {demo.primary ? (
                          <span style={{ flex: 'none', padding: '1px 8px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 11 }}>
                            <L en="Start here for the Ministry" ar="ابدأوا من هنا لمسار الوزارة" />
                          </span>
                        ) : null}
                      </span>
                      <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', fontSize: '12.5px' }}>{demo.login}</span>
                    </span>
                    {/* What it can and cannot do, at the point of sign-in. */}
                    <span style={{ fontSize: '12.5px', lineHeight: 1.55, color: 'var(--muted)', display: 'block' }}>
                      <L en={`Can: ${demo.canEn}`} ar={`يستطيع: ${demo.canAr}`} />
                    </span>
                    <span style={{ fontSize: '12.5px', lineHeight: 1.55, color: 'var(--accent-ink)', display: 'block' }}>
                      <L en={`Cannot: ${demo.cannotEn}`} ar={`لا يستطيع: ${demo.cannotAr}`} />
                    </span>
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
