import { notFound } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { RespondForm } from './RespondForm';
import { currentAccount } from '../../../lib/auth';
import { invitationByToken, nominationBriefing } from '../../../lib/queries';
import { Briefing } from './Briefing';
import { ROLES_CONTENT } from '../../../lib/rules';

/**
 * The nomination, IN THREE STAGES (reviewer ruling, 2026-08-28).
 *
 *   1. VIEW    -- this page's Briefing: what the party is being asked to take on,
 *                 readable on the token before any response and without an account.
 *   2. RESPOND -- this page's RespondForm: accept, decline with a reason, or ask the
 *                 organizer a question. Also on the token, also without an account.
 *   3. ACCOUNT -- /invitations/[token]/account, AFTER accepting and never as part of
 *                 it. Create one, or sign in to one that already exists.
 *
 * What this replaces: five facts and a decision, where the submit button responded to
 * the nomination and created an account in the same click. Accepting was therefore the
 * same act as being signed in, and declining required registering with the platform in
 * order to say no.
 *
 * The token is the credential (rule 6): unguessable, never sequential, and it shows
 * this one nomination -- no event the holder was not named in, and not the organizer's
 * submission for the one they were.
 */
export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { token } = await params;
  const invitation = invitationByToken(token);
  if (!invitation) notFound();
  const { notice, error } = await searchParams;
  const account = await currentAccount();
  const briefing = nominationBriefing(token);
  const content = ROLES_CONTENT;
  const isDirector = invitation.kind === 'director';


  return (
    <>
      <GovernmentBand />
      {/* A signed-in counterparty gets the Dashboard pill like everyone else; only
          the anonymous token view has nowhere to go back to. */}
      <Header account={account} organization={null} unreadCount={0} showBack={account !== null} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          {invitation.status === 'withdrawn' ? (
            <div style={{ padding: '26px 30px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24, fontSize: 16, lineHeight: 1.65 }}>
              <L
                en="This nomination has been withdrawn by the organizer. It was withdrawn before it was answered, so nothing is owed by anyone: this link no longer accepts a response or a registration."
                ar="سحب المنظّم هذا الترشيح. وقد سُحب قبل الإجابة عليه، فلا شيء مستحق على أحد: لم يعد هذا الرابط يقبل رداً أو تسجيلاً."
              />
            </div>
          ) : null}
          {invitation.status === 'removed' ? (
            <div style={{ padding: '26px 30px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24, fontSize: 16, lineHeight: 1.65 }}>
              <L
                en="The organizer has removed this confirmed participation — a material change on their submission, which they report to the Ministry. Your record of this event is closed and nothing further is owed on it."
                ar="أزال المنظّم هذه المشاركة المؤكَّدة — وهو تغيير جوهري في تقديمه يبلّغ الوزارة به. أُغلق سجلكم لهذه الفعالية ولا شيء مستحق عليه بعد الآن."
              />
            </div>
          ) : null}
          {invitation.status === 'declined' || notice === 'declined' ? (
            <div style={{ padding: '26px 30px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24, fontSize: 16, lineHeight: 1.65 }}>
              <L
                en="This nomination has been declined. The organizer has been notified — declining is a material change the organizer must report to the Ministry."
                ar="اعتُذر عن هذا الترشيح. وأُبلغ المنظّم — فالاعتذار تغيير جوهري على المنظّم إبلاغ الوزارة به."
              />
            </div>
          ) : null}
          {notice === 'modification' ? (
            <div style={{ padding: '20px 26px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              <L en="Your modification request has been sent to the organizer. The nomination remains open." ar="أُرسل طلب التعديل إلى المنظّم. ويبقى الترشيح قائماً." />
            </div>
          ) : null}
          {error === 'reason' ? (
            <div style={{ padding: '18px 24px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              <L en="A reason is required for that response." ar="السبب مطلوب لهذا الرد." />
            </div>
          ) : null}
          {error === 'account' || error === 'email-taken' ? (
            <div style={{ padding: '18px 24px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              {error === 'email-taken' ? (
                <L en="An account with that email already exists. Sign in first, then respond." ar="يوجد حساب بهذا البريد. سجّلوا الدخول أولاً ثم ردّوا." />
              ) : (
                <L en="The account details are incomplete or the password does not meet the policy." ar="بيانات الحساب ناقصة أو كلمة المرور لا تستوفي السياسة." />
              )}
            </div>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBlockEnd: 14 }}>
            <span style={{ padding: '4px 11px', borderRadius: 999, background: invitation.status === 'confirmed' ? 'var(--brand-soft)' : invitation.status === 'withdrawn' || invitation.status === 'removed' ? 'var(--surface2)' : 'var(--accent-soft)', color: invitation.status === 'confirmed' ? 'var(--brand)' : invitation.status === 'withdrawn' || invitation.status === 'removed' ? 'var(--muted)' : 'var(--accent-ink)', fontSize: '12.5px' }}>
              {invitation.status === 'confirmed' ? (
                <L en="Nomination — accepted" ar="ترشيح — مقبول" />
              ) : invitation.status === 'declined' ? (
                <L en="Nomination — declined" ar="ترشيح — معتذَر عنه" />
              ) : invitation.status === 'withdrawn' ? (
                <L en="Nomination — withdrawn by the organizer" ar="ترشيح — سحبه المنظّم" />
              ) : invitation.status === 'removed' ? (
                <L en="Participation — removed by the organizer" ar="مشاركة — أزالها المنظّم" />
              ) : (
                <L en="Nomination — awaiting your response" ar="ترشيح — بانتظار ردّكم" />
              )}
            </span>
            <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              <L en={`Sent ${invitation.invitedAt.slice(0, 10)}`} ar={`أُرسل في ⁦${invitation.invitedAt.slice(0, 10)}⁩`} />
            </span>
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 32px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em', maxWidth: '26ch' }}>
            {isDirector ? (
              <L en="You have been nominated as Event Medical Director" ar="رُشِّحتم مديراً طبياً للفعالية" />
            ) : (
              <L
                en={`${invitation.organizationNameEn} has named your organization in an event`}
                ar={`سمّت ${invitation.organizationNameAr} مؤسستكم في فعالية`}
              />
            )}
          </h1>
          {isDirector ? (
            <p style={{ margin: '0 0 32px', fontSize: '16.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '70ch' }}>
              <L en={content.director.inviteIntro.en} ar={content.director.inviteIntro.ar} />
            </p>
          ) : null}

          {briefing ? (
            <Briefing
              briefing={briefing}
              token={token}
              kind={invitation.kind}
              level={invitation.eventLevel}
              namedEn={invitation.nameEn}
              namedAr={invitation.nameAr}
            />
          ) : null}

          {isDirector ? (
            <div data-region="accepting" style={{ padding: '32px 36px', border: '2px solid var(--brand)', borderRadius: 16, marginBlockEnd: 20 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--brand)', marginBlockEnd: 14 }}>
                <L en="What you would be accepting" ar="ما ستقبلونه" />
              </div>
              <p style={{ margin: '0 0 24px', fontSize: 19, lineHeight: 1.65, maxWidth: '66ch' }}>
                <L en={content.director.accepting.en} ar={content.director.accepting.ar} />
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {content.director.alsoAccepting.map((a) => (
                  <div key={a.en} style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
                    <span style={{ flex: 'none', width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', marginBlockStart: 9 }} />
                    <span style={{ fontSize: '15.5px', lineHeight: 1.65 }}>
                      <L en={a.en} ar={a.ar} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {invitation.status === 'nominated' ? (
            <RespondForm token={token} kind={invitation.kind} eventLevel={invitation.eventLevel} />
          ) : null}
          {invitation.status === 'confirmed' && account ? (
            <div style={{ padding: '22px 26px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, fontSize: 15 }}>
              <a href="/dashboard">
                <L en="Accepted. Open your dashboard." ar="تم القبول. افتحوا لوحتكم." />
              </a>
            </div>
          ) : null}
          {/* ACCEPTED, NOT YET REGISTERED -- a real state now that accepting no longer
              creates an account. It must not be a dead end: the answer stands, and the
              route to the working screens is named. */}
          {invitation.status === 'confirmed' && !account ? (
            <div data-region="accepted-no-account" style={{ padding: '22px 26px', border: '2px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, fontSize: 15, lineHeight: 1.65 }}>
              <div style={{ marginBlockEnd: 12 }}>
                <L en={content.nomination.stage3AcceptedEn} ar={content.nomination.stage3AcceptedAr} />{' '}
                <L en={content.nomination.stage3IntroEn} ar={content.nomination.stage3IntroAr} />
              </div>
              <a
                href={`/invitations/${token}/account`}
                style={{ display: 'inline-flex', alignItems: 'center', height: 44, paddingInline: 22, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500 }}
              >
                <L en={content.nomination.stage3CreateEn} ar={content.nomination.stage3CreateAr} />
              </a>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
