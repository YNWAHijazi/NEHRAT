import { InfoNote } from '../../../../components/InfoNote';
import { PasswordHint } from '../../../../components/PasswordHint';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { ROLES_CONTENT } from '../../../../lib/rules';

type FormAction = (formData: FormData) => void | Promise<void>;

/**
 * Stage three of a nomination, one screen for both services (owner, 8 October 2026):
 * complete acceptance by creating an account under the invited email, or by signing in
 * to one that already exists. The event's /invitations/[token]/account and the venue's
 * /venue-invitations/[token]/account render this with their own three actions.
 */
export function AccountView({
  service,
  email,
  declined,
  error,
  mayTake,
  wrongAccount,
  rememberedEmail,
  accept,
  register,
  signIn,
}: {
  service: 'event' | 'venue';
  email: string;
  declined: boolean;
  error: string | undefined;
  /** Signed in under the invited role and address: one click accepts. */
  mayTake: boolean;
  /** Signed in under the invited role but another address: say so, rather than offer a button that refuses. */
  wrongAccount: boolean;
  rememberedEmail: string | undefined;
  accept: FormAction;
  register: FormAction;
  signIn: FormAction;
}) {
  const N = ROLES_CONTENT.nomination;
  const V = N.venue;
  const venue = service === 'venue';

  const field: React.CSSProperties = {
    height: 46,
    paddingInline: 14,
    background: 'var(--bg)',
    border: '1px solid var(--line)',
    borderRadius: 8,
    fontSize: 15,
  };

  const Label = ({ en, ar, children }: { en: string; ar: string; children: React.ReactNode }) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
        <L en={en} ar={ar} />
      </span>
      {children}
    </label>
  );

  return (
    <>
      <GovernmentBand />
      <Header account={null} organization={null} unreadCount={0} showBack={false} />
      <main data-pad="" data-service={service} style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 720 }}>
          {/* Be explicit that registration is required before acceptance completes. */}
          <div
            data-region="answer-recorded"
            style={{ padding: '20px 26px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 28, fontSize: 15, lineHeight: 1.65 }}
          >
            {declined ? (
              venue ? (
                <L en={V.accountDeclinedEn} ar={V.accountDeclinedAr} />
              ) : (
                <L
                  en="Invitation declined. The organizer has been notified."
                  ar="رُفضت الدعوة وأُبلغ المنظّم."
                />
              )
            ) : (
              <L en="An account is required to complete acceptance." ar="يلزم حساب لاستكمال قبول الدعوة." />
            )}
          </div>

          {declined ? (
            <div style={{ fontSize: 15, lineHeight: 1.7 }}>
              <a href="/signin">
                <L en="Return to sign in" ar="العودة إلى تسجيل الدخول" />
              </a>
            </div>
          ) : (
            <>
              <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 34, fontWeight: 600, letterSpacing: '-.03em' }}>
                <L en="Complete your acceptance" ar="استكمال قبول الدعوة" />
               <InfoNote><L en="Create an account or sign in to accept this invitation and access your tasks." ar="أنشئوا حساباً أو سجّلوا الدخول لقبول هذه الدعوة والوصول إلى مهامكم." /></InfoNote>
              </h1>

              {error === 'account' ? (
                <div style={{ padding: '18px 24px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
                  <L
                    en="Check your name, email, phone number and the password requirements below."
                    ar="تحقّقوا من الاسم والبريد ورقم الهاتف ومتطلبات كلمة المرور أدناه."
                  />
                </div>
              ) : null}
              {error === 'email-taken' ? (
                <div style={{ padding: '18px 24px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15, lineHeight: 1.65 }}>
                  <L
                    en="An account with that email already exists. Sign in below and this nomination is linked to it."
                    ar="يوجد حساب بهذا البريد. سجّلوا الدخول أدناه ويُربط هذا الترشيح به."
                  />
                </div>
              ) : null}
              {error === 'credentials' ? (
                <div style={{ padding: '18px 24px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
                  <L en="That email and password do not match an account." ar="لا يطابق هذا البريد وكلمة المرور أي حساب." />
                </div>
              ) : null}
              {error === 'invited-email' || wrongAccount ? (
                <div role="alert" data-region="invited-email" style={{ padding: '18px 24px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15, lineHeight: 1.65 }}>
                  {venue ? (
                    <L en={V.invitedEmailEn.replace('{email}', email)} ar={V.invitedEmailAr.replace('{email}', `⁦${email}⁩`)} />
                  ) : (
                    <L
                      en={`This invitation was sent to ${email}. Create the account below or sign in with that address. If your organization uses another address, ask the organizer to invite that address instead.`}
                      ar={`أُرسلت هذه الدعوة إلى ⁦${email}⁩. أنشئوا الحساب أدناه أو سجّلوا الدخول بهذا العنوان. إذا كانت جهتكم تستخدم عنواناً آخر، اطلبوا من المنظّم دعوة ذلك العنوان.`}
                    />
                  )}
                </div>
              ) : null}
              {error === 'role' ? (
                <div style={{ padding: '18px 24px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15, lineHeight: 1.65 }}>
                  <L
                    en="That account is held for a different role on the platform, so this nomination cannot be linked to it. Create an account here instead."
                    ar="هذا الحساب مخصص لدور آخر على المنصة، فلا يمكن ربط هذا الترشيح به. أنشئوا حساباً هنا بدلاً من ذلك."
                  />
                </div>
              ) : null}

              {mayTake ? (
                <form action={accept} style={{ marginBlockEnd: 24 }}>
                  <input type="hidden" name="response" value="accept" />
                  <button type="submit" style={{ padding: '12px 20px', border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)' }}>
                    <L en="Accept with my account" ar="قبول الدعوة بحسابي" />
                  </button>
                </form>
              ) : null}

              <form
                action={register}
                data-region="create-account"
                style={{ padding: 33, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24 }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBlockEnd: 22 }}>
                  <Label en="Phone number (with country code)" ar="رقم الهاتف مع رمز البلد"><input name="phone" type="tel" autoComplete="tel" placeholder="+961..." style={field}/></Label>
                  <Label en="Full name" ar="الاسم الكامل">
                    <input name="fullName" required style={field} />
                  </Label>
                  <Label en="Email (the invited address)" ar="البريد الإلكتروني (العنوان المدعوّ)">
                    {/* Read-only: the account is created under the address the organizer named. */}
                    <input name="email" type="email" readOnly value={email} style={{ ...field, background: 'var(--surface2)', color: 'var(--muted)' }} />
                  </Label>
                  <Label en="Password" ar="كلمة المرور">
                    <input name="password" type="password" required style={field} />
                    <PasswordHint />
                  </Label>
                </div>
                <button
                  type="submit"
                  style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
                >
                  <L en="Create account and accept" ar="إنشاء الحساب وقبول الدعوة" />
                </button>
              </form>

              {/* The second path. A party nominated a second time already holds an
                  account, and telling them to make another would fork their record. */}
              <div data-region="sign-in-instead" style={{ padding: 33, border: '1px solid var(--line)', borderRadius: 16 }}>
                <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>
                  <L en={N.stage3HaveAccountEn} ar={N.stage3HaveAccountAr} />
                 <InfoNote><L en={N.stage3SignInEn} ar={N.stage3SignInAr} /></InfoNote>
                </h2>

                <form action={signIn}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBlockEnd: 22 }}>
                    <Label en="Email" ar="البريد الإلكتروني">
                      {/* The email survives a failed attempt; the password never does. */}
                      <input name="email" type="email" required defaultValue={rememberedEmail ?? email} style={field} />
                    </Label>
                    <Label en="Password" ar="كلمة المرور">
                      <input name="password" type="password" required style={field} />
                    </Label>
                  </div>
                  <button
                    type="submit"
                    style={{ height: 44, paddingInline: 22, border: '1px solid var(--line)', borderRadius: 22, background: 'var(--bg)', fontSize: '14.5px', cursor: 'pointer' }}
                  >
                    <L en="Sign in and accept" ar="تسجيل الدخول وقبول الدعوة" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
