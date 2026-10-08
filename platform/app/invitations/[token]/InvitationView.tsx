import { InfoNote } from '../../../components/InfoNote';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { RespondForm } from './RespondForm';
import type { Account } from '../../../lib/auth';
import { ROLES_CONTENT, type Level } from '../../../lib/rules';

/**
 * THE NOMINATION SCREEN, one for both services (owner, 8 October 2026: "EMS agencies
 * invited to venues look different than events. Make it the same interface, how they
 * accept and so on."). The event's /invitations/[token] and the venue's
 * /venue-invitations/[token] render this; each page reads its own invitation and
 * briefing and hands them in.
 *
 *   1. VIEW    -- the briefing: what the party is being asked to take on, readable on
 *                 the token before any response and without an account.
 *   2. RESPOND -- RespondForm: accept, decline with a reason, or ask a question. Also on
 *                 the token, also without an account.
 *   3. ACCOUNT -- [token]/account, AFTER choosing to accept and never as part of it.
 *
 * 'closed' is the venue's expired invitation or a venue no longer in preparation: the
 * link answers nothing and says so.
 */
export type InvitationViewStatus = 'nominated' | 'confirmed' | 'declined' | 'withdrawn' | 'removed' | 'closed';

const V = ROLES_CONTENT.nomination.venue;

export function InvitationView({
  service,
  token,
  kind,
  status,
  invitedAt,
  level,
  organizationNameEn,
  organizationNameAr,
  account,
  notice,
  error,
  briefing,
}: {
  service: 'event' | 'venue';
  token: string;
  kind: 'ems' | 'director';
  status: InvitationViewStatus;
  invitedAt: string;
  level: Level | null;
  organizationNameEn: string;
  organizationNameAr: string;
  account: Account | null;
  notice: string | undefined;
  error: string | undefined;
  /** The briefing, already rendered; shown only while the nomination is live. */
  briefing: React.ReactNode;
}) {
  const content = ROLES_CONTENT;
  const venue = service === 'venue';
  const isDirector = kind === 'director';
  const base = venue ? '/venue-invitations' : '/invitations';
  // A declined, withdrawn, removed or closed nomination: the banner says so, and the
  // facts and document links are not re-served to a party no longer in it.
  const live = status === 'nominated' || status === 'confirmed';
  const band: React.CSSProperties = { padding: '26px 30px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24, fontSize: 16, lineHeight: 1.65 };
  const muted = status === 'withdrawn' || status === 'removed' || status === 'closed';

  return (
    <>
      <GovernmentBand />
      {/* A signed-in counterparty gets the Dashboard pill like everyone else; only
          the anonymous token view has nowhere to go back to. */}
      <Header account={account} organization={null} unreadCount={0} showBack={account !== null} />
      <main data-pad="" data-service={service} style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          {status === 'withdrawn' ? (
            <div style={band}>
              {venue ? (
                <L en={V.withdrawnEn} ar={V.withdrawnAr} />
              ) : (
                <L
                  en="The organizer withdrew this nomination before it was answered. This link no longer accepts a response, and nothing is needed from you."
                  ar="سحب المنظّم هذا الترشيح قبل الإجابة عليه. لم يعد هذا الرابط يقبل رداً، ولا يُطلب منكم شيء."
                />
              )}
            </div>
          ) : null}
          {status === 'removed' ? (
            <div style={band}>
              <L
                en="The organizer has removed your participation in this event. Nothing more is needed from you."
                ar="أزال المنظّم مشاركتكم في هذه الفعالية. ولا يُطلب منكم شيء بعد الآن."
              />
            </div>
          ) : null}
          {status === 'closed' ? (
            <div role="status" data-region="invitation-closed" style={band}>
              <L en={V.closedEn} ar={V.closedAr} />
            </div>
          ) : null}
          {status === 'declined' || notice === 'declined' ? (
            <div style={band}>
              {venue ? (
                <L en={V.declinedEn} ar={V.declinedAr} />
              ) : (
                <L
                  en="This nomination has been declined. The organizer has been told, with the reason as written."
                  ar="اعتُذر عن هذا الترشيح. وأُبلغ المنظّم بالسبب كما كُتب."
                />
              )}
            </div>
          ) : null}
          {notice === 'modification' ? (
            <div style={{ padding: '20px 26px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              {venue ? (
                <L en={V.modificationSentEn} ar={V.modificationSentAr} />
              ) : (
                <L en="Your modification request has been sent to the organizer. The nomination remains open." ar="أُرسل طلب التعديل إلى المنظّم. ويبقى الترشيح قائماً." />
              )}
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
            <span data-region="nomination-state" style={{ padding: '4px 11px', borderRadius: 999, background: status === 'confirmed' ? 'var(--brand-soft)' : muted ? 'var(--surface2)' : 'var(--accent-soft)', color: status === 'confirmed' ? 'var(--brand)' : muted ? 'var(--muted)' : 'var(--accent-ink)', fontSize: '12.5px' }}>
              {status === 'confirmed' ? (
                <L en="Nomination — accepted" ar="ترشيح — مقبول" />
              ) : status === 'declined' ? (
                <L en="Nomination — declined" ar="ترشيح — معتذَر عنه" />
              ) : status === 'withdrawn' ? (
                venue ? <L en={V.withdrawnChipEn} ar={V.withdrawnChipAr} /> : <L en="Nomination — withdrawn by the organizer" ar="ترشيح — سحبه المنظّم" />
              ) : status === 'removed' ? (
                <L en="Participation — removed by the organizer" ar="مشاركة — أزالها المنظّم" />
              ) : status === 'closed' ? (
                <L en={V.closedChipEn} ar={V.closedChipAr} />
              ) : (
                <L en="Nomination — awaiting your response" ar="ترشيح — بانتظار ردّكم" />
              )}
            </span>
            <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              <L en={`Sent ${invitedAt.slice(0, 10)}`} ar={`أُرسل في ⁦${invitedAt.slice(0, 10)}⁩`} />
            </span>
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 32px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em', maxWidth: '26ch' }}>
            {isDirector ? (
              venue ? <L en={V.directorHeadingEn} ar={V.directorHeadingAr} /> : <L en="You have been nominated as Event Medical Director" ar="رُشِّحتم مديراً طبياً للفعالية" />
            ) : venue ? (
              <L en={V.headingEn.replace('{org}', organizationNameEn)} ar={V.headingAr.replace('{org}', organizationNameAr)} />
            ) : (
              <L
                en={`${organizationNameEn} has named your organization in an event`}
                ar={`سمّت ${organizationNameAr} مؤسستكم في فعالية`}
              />
            )}
          </h1>
          {isDirector ? (
            <div className="secondary-help"><InfoNote>{venue ? <L en={V.directorIntroEn} ar={V.directorIntroAr} /> : <L en={content.director.inviteIntro.en} ar={content.director.inviteIntro.ar} />}</InfoNote></div>
          ) : null}

          {live ? briefing : null}

          {/* Details, then the choice (partner ruling, counterparty pass): the
              Director's personal-responsibility sentence stays directly above the
              answer -- it is what accepting MEANS, not narration -- compact, with the
              requirement rows themselves behind the briefing's View more. */}
          {isDirector && live && status === 'nominated' ? (
            <div data-region="accepting" style={{ marginBlockEnd: 16, maxWidth: '70ch' }}>
              <p style={{ margin: 0, fontSize: '15.5px', lineHeight: 1.65 }}>
                {venue ? <L en={V.directorAcceptingEn} ar={V.directorAcceptingAr} /> : <L en={content.director.accepting.en} ar={content.director.accepting.ar} />}
              </p>
            </div>
          ) : null}

          {status === 'nominated' ? (
            <RespondForm token={token} kind={kind} eventLevel={level} service={service} />
          ) : null}
          {status === 'confirmed' && account ? (
            <div style={{ padding: '22px 26px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, fontSize: 15 }}>
              <a href="/dashboard">
                <L en="Accepted. Open your dashboard." ar="تم القبول. افتحوا لوحتكم." />
              </a>
            </div>
          ) : null}
          {/* ACCEPTED, NOT YET SIGNED IN -- it must not be a dead end: the answer stands,
              and the route to the working screens is named. */}
          {status === 'confirmed' && !account ? (
            <div data-region="accepted-no-account" style={{ padding: '22px 26px', border: '2px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, fontSize: 15, lineHeight: 1.65 }}>
              <div style={{ marginBlockEnd: 12 }}>
                {venue ? (
                  <L en={V.acceptedEn} ar={V.acceptedAr} />
                ) : (
                  <>
                    <L en={content.nomination.stage3AcceptedEn} ar={content.nomination.stage3AcceptedAr} />{' '}
                    <L en={content.nomination.stage3IntroEn} ar={content.nomination.stage3IntroAr} />
                  </>
                )}
              </div>
              <a
                href={`${base}/${token}/account`}
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
