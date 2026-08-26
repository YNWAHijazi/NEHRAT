import { notFound } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { RespondForm } from './RespondForm';
import { currentAccount } from '../../../lib/auth';
import { invitationByToken } from '../../../lib/queries';
import { ROLES_CONTENT } from '../../../lib/rules';

/**
 * The nomination screen. The token is the credential (rule 6): an unguessable link,
 * never a sequential id, and the holder sees this one nomination -- no event they
 * were not named in. Accepting links or creates the account; declining requires a
 * reason and is a material change the organizer must report.
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
  const content = ROLES_CONTENT;
  const isDirector = invitation.kind === 'director';

  const facts = [
    { en: isDirector ? 'Nominated by' : 'Invited by', ar: isDirector ? 'الترشيح من' : 'الدعوة من', vEn: invitation.organizationNameEn, vAr: invitation.organizationNameAr },
    { en: 'Event', ar: 'الفعالية', vEn: invitation.eventNameEn, vAr: invitation.eventNameAr },
    { en: 'Event level', ar: 'مستوى الفعالية', vEn: invitation.eventLevel ? `Level ${invitation.eventLevel}` : '—', vAr: invitation.eventLevel ? `المستوى ${invitation.eventLevel}` : '—' },
    { en: 'Event date', ar: 'تاريخ الفعالية', vEn: invitation.eventStart ?? '—', vAr: invitation.eventStart ? `⁦${invitation.eventStart}⁩` : '—' },
    { en: 'Named as', ar: 'المُسمّى', vEn: invitation.nameEn, vAr: invitation.nameAr },
  ];

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={null} unreadCount={0} showBack={false} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          {invitation.status === 'declined' || notice === 'declined' ? (
            <div style={{ padding: '26px 30px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 14, marginBlockEnd: 24, fontSize: 16, lineHeight: 1.65 }}>
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
            <span style={{ padding: '4px 11px', borderRadius: 4, background: invitation.status === 'confirmed' ? 'var(--brand-soft)' : 'var(--accent-soft)', color: invitation.status === 'confirmed' ? 'var(--brand)' : 'var(--accent-ink)', fontSize: '12.5px' }}>
              {invitation.status === 'confirmed' ? (
                <L en="Nomination — accepted" ar="ترشيح — مقبول" />
              ) : invitation.status === 'declined' ? (
                <L en="Nomination — declined" ar="ترشيح — معتذَر عنه" />
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

          <div data-region="invite-facts" style={{ padding: 32, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, marginBlockEnd: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
              {facts.map((f) => (
                <div key={f.en} style={{ background: 'var(--bg)', padding: '16px 18px' }}>
                  <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 6 }}>
                    <L en={f.en} ar={f.ar} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>
                    <L en={f.vEn} ar={f.vAr} />
                  </div>
                </div>
              ))}
            </div>
            {!isDirector && invitation.eventLevel === 3 ? (
              <div style={{ marginBlockStart: 26 }}>
                <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
                  <L en="In full" ar="بالتفصيل" />
                </div>
                <div style={{ fontSize: 17, lineHeight: 1.6, maxWidth: '66ch' }}>
                  <L
                    en="Complete and sign the EMS Readiness Declaration for this event, and confirm your agency's role in the major-incident and mass-casualty plan. The organizer cannot file the Level 3 package without it."
                    ar="استكمال وتوقيع إقرار جاهزية خدمات الطوارئ الطبية لهذه الفعالية، وتأكيد دور جهتكم في خطة الاستجابة للحوادث الجسيمة وحوادث الإصابات الجماعية. لا يمكن للمنظّم تقديم حزمة المستوى 3 من دونه."
                  />
                </div>
              </div>
            ) : null}
          </div>

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
            <RespondForm token={token} kind={invitation.kind} signedIn={account !== null} eventLevel={invitation.eventLevel} />
          ) : null}
          {invitation.status === 'confirmed' && account ? (
            <div style={{ padding: '22px 26px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, fontSize: 15 }}>
              <a href="/dashboard">
                <L en="Accepted. Open your dashboard." ar="تم القبول. افتحوا لوحتكم." />
              </a>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
