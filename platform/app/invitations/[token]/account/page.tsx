import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { currentAccount, rememberedSignInFields } from '../../../../lib/auth';
import { invitationByToken } from '../../../../lib/queries';
import { ROLES_CONTENT } from '../../../../lib/rules';

import {
  registerAgainstInvitationAction,
  signInAgainstInvitationAction,
} from '../../../actions';

/**
 * STAGE THREE: the account, after the answer and never as part of it.
 *
 * ACCEPTING MUST NEVER BE THE SAME CLICK AS BEING SIGNED IN (reviewer, 2026-08-28).
 * Before this, one submit recorded the response, created an account and started a
 * session -- so a party could not answer a nomination without choosing a password,
 * and could not DECLINE without registering with the platform in order to say no.
 *
 * The answer is already recorded by the time anyone arrives here. This screen offers
 * an account; it does not require one. A party who closes the page has still accepted,
 * and this link brings them back.
 *
 * TWO PATHS, because the second is the common one after the first event: a provider or
 * a physician nominated again already holds an account and must not be told to make
 * another. Signing in links this nomination to it.
 *
 * The role comes from the NOMINATION, never from anything typed here -- self-
 * registration against the invitation, not against the platform at large (rule 6).
 */
export default async function NominationAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const invitation = invitationByToken(token);
  if (!invitation) notFound();

  // A dead token registers nobody.
  if (invitation.status === 'withdrawn' || invitation.status === 'removed') {
    redirect(`/invitations/${token}`);
  }
  // There is no account to make against an unanswered nomination: making it first is
  // exactly the order the ruling forbids.
  if (invitation.status === 'nominated') redirect(`/invitations/${token}`);

  const account = await currentAccount();
  // Already linked, or already signed in: this screen has nothing to offer. A
  // counterparty's landing is the brief — /events/[id] itself has no surface for an
  // EMS account and 404s (rule 6). Anyone else (an organizer holding their own
  // nominee's link) goes to the event record as before.
  if (account) {
    redirect(
      account.role === 'ems' || account.role === 'director'
        ? `/events/${invitation.eventId}/brief`
        : `/events/${invitation.eventId}`,
    );
  }
  if (invitation.accountId !== null) redirect('/signin');

  const N = ROLES_CONTENT.nomination;
  const declined = invitation.status === 'declined';
  const remembered = await rememberedSignInFields();

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
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 720 }}>
          {/* The answer is recorded. Say so first: the account is a separate offer and
              the party must not think their response is still pending on it. */}
          <div
            data-region="answer-recorded"
            style={{ padding: '20px 26px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 28, fontSize: 15, lineHeight: 1.65 }}
          >
            {declined ? (
              <L
                en="Your response has been recorded and the organizer has been notified. You do not need an account, and nothing further is owed by you on this event."
                ar="سُجِّل ردّكم وأُبلغ المنظّم. ولا يلزمكم حساب، ولا شيء مستحق عليكم بعد الآن في هذه الفعالية."
              />
            ) : (
              <L en={N.stage3AcceptedEn} ar={N.stage3AcceptedAr} />
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
                <L en={N.stage3TitleEn} ar={N.stage3TitleAr} />
              </h1>
              <p style={{ margin: '0 0 8px', fontSize: '16.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '68ch' }}>
                <L en={N.stage3IntroEn} ar={N.stage3IntroAr} />
              </p>
              <p style={{ margin: '0 0 28px', fontSize: '13.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '68ch' }}>
                <L en={N.stage3LaterEn} ar={N.stage3LaterAr} />
              </p>

              {error === 'account' ? (
                <div style={{ padding: '18px 24px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
                  <L
                    en="The account details are incomplete or the password does not meet the policy."
                    ar="بيانات الحساب ناقصة أو كلمة المرور لا تستوفي السياسة."
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
              {error === 'role' ? (
                <div style={{ padding: '18px 24px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15, lineHeight: 1.65 }}>
                  <L
                    en="That account is held for a different role on the platform, so this nomination cannot be linked to it. Create an account here instead."
                    ar="هذا الحساب مخصص لدور آخر على المنصة، فلا يمكن ربط هذا الترشيح به. أنشئوا حساباً هنا بدلاً من ذلك."
                  />
                </div>
              ) : null}

              <form
                action={registerAgainstInvitationAction.bind(null, token)}
                data-region="create-account"
                style={{ padding: 33, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24 }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBlockEnd: 22 }}>
                  <Label en="Full name" ar="الاسم الكامل">
                    <input name="fullName" required style={field} />
                  </Label>
                  <Label en="Email" ar="البريد الإلكتروني">
                    <input name="email" type="email" required style={field} />
                  </Label>
                  <Label en="Password" ar="كلمة المرور">
                    <input name="password" type="password" required style={field} />
                  </Label>
                </div>
                <button
                  type="submit"
                  style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
                >
                  <L en={N.stage3CreateEn} ar={N.stage3CreateAr} />
                </button>
              </form>

              {/* The second path. A party nominated to a second event already holds an
                  account, and telling them to make another would fork their record. */}
              <div data-region="sign-in-instead" style={{ padding: 33, border: '1px solid var(--line)', borderRadius: 16 }}>
                <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>
                  <L en={N.stage3HaveAccountEn} ar={N.stage3HaveAccountAr} />
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
                  <L en={N.stage3SignInEn} ar={N.stage3SignInAr} />
                </p>
                <form action={signInAgainstInvitationAction.bind(null, token)}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBlockEnd: 22 }}>
                    <Label en="Email" ar="البريد الإلكتروني">
                      {/* The email survives a failed attempt; the password never does. */}
                      <input name="email" type="email" required defaultValue={remembered.email ?? ''} style={field} />
                    </Label>
                    <Label en="Password" ar="كلمة المرور">
                      <input name="password" type="password" required style={field} />
                    </Label>
                  </div>
                  <button
                    type="submit"
                    style={{ height: 44, paddingInline: 22, border: '1px solid var(--line)', borderRadius: 22, background: 'var(--bg)', fontSize: '14.5px', cursor: 'pointer' }}
                  >
                    <L en="Sign in and link this nomination" ar="تسجيل الدخول وربط هذا الترشيح" />
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
