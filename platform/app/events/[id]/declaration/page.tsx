import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { DeclarationForm } from './DeclarationForm';
import { reopenDeclarationAction, withdrawParticipationAction } from '../../../actions';
import { currentAccount } from '../../../../lib/auth';
import { invitationForEvent, materialChangesFor, nominationBriefing, nomineePlanSlice, roleProfileFor, unreadCountFor } from '../../../../lib/queries';
import { Briefing } from '../../../invitations/[token]/Briefing';
import { RespondForm } from '../../../invitations/[token]/RespondForm';
import { SharedDocuments } from '../SharedDocuments';
import { getDb } from '../../../../lib/db';
import { DECLARATION_ITEMS, ROLES_CONTENT, filingDeadline , emsDeclarationGate} from '../../../../lib/rules';

/**
 * The Level 3 EMS Readiness Declaration: ten items, signed by each participating
 * agency separately, blocked until all ten are confirmed. A draft is visible to the
 * agency alone; signing releases it into the organizer's package. The organizer
 * cannot file without it.
 */
export default async function DeclarationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const invitation = invitationForEvent(account.id, id, 'ems');
  // A material change reported AFTER the signature re-opens the question: the
  // declaration attests to the event as it was when signed.
  const changeAfterSigning =
    invitation && invitation.declaration === 'signed' && invitation.signedAt
      ? (materialChangesFor(invitation.organizerAccountId, id).find(
          (c) => c.reportedAt > (invitation.signedAt ?? ''),
        ) ?? null)
      : null;
  if (!invitation) notFound();
  // The rule, not this screen's own test (rule 10 and "no screen implements its own
  // gating"). The invitation screen consults the same gate for its accept wording.
  if (emsDeclarationGate(invitation.eventLevel).behaviour !== 'enabled') {
    redirect(`/events/${id}/participation`);
  }
  const { notice } = await searchParams;
  const unread = unreadCountFor(account.id);
  const content = ROLES_CONTENT.ems;
  const profile = roleProfileFor(account.id);
  const briefing = nominationBriefing(invitation.token);
  const confirmed = invitation.status === 'confirmed';
  const live = confirmed || invitation.status === 'nominated';
  const plan = confirmed ? nomineePlanSlice(id) : null;

  const fileBy = invitation.eventStart
    ? filingDeadline(3, new Date(`${invitation.eventStart}T12:00:00+03:00`)).date
    : null;
  // The Director's name for item 7, read from the event's confirmed nomination.
  const director = getDb()
    .prepare(`SELECT name_en, name_ar, email FROM invitations WHERE event_id = ? AND kind = 'director' AND status = 'confirmed'`)
    .get(id) as { name_en: string; name_ar: string; email: string } | undefined;

  return (
    <>
      <GovernmentBand />
      {/* Back always means the dashboard in a counterparty flow (partner ruling). */}
      <Header account={account} organization={null} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          {notice === 'accepted' || notice === 'registered' || notice === 'linked' ? (
            <div data-region="landing-notice" style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15, lineHeight: 1.65 }}>
              {notice === 'accepted' ? (
                <L en="Accepted. The organizer has been told." ar="تم القبول. وأُبلغ المنظّم." />
              ) : notice === 'registered' ? (
                <L en="Your account is set up. This event is now on your dashboard." ar="أُعدّ حسابكم. وهذه الفعالية الآن على لوحتكم." />
              ) : (
                <L en="This nomination is now linked to your account." ar="رُبط هذا الترشيح بحسابكم." />
              )}
            </div>
          ) : null}
          {notice === 'reopened' ? (
            <div style={{ padding: '18px 24px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              <L en="The declaration is a draft again. Review the ten items and sign when they hold." ar="عاد الإقرار مسودة. راجعوا البنود العشرة ووقّعوا عندما تصح." />
            </div>
          ) : null}

          {briefing ? (
            <Briefing
              briefing={briefing}
              token={invitation.token}
              kind="ems"
              level={invitation.eventLevel}
              namedEn={invitation.nameEn}
              namedAr={invitation.nameAr}
              confirmed={confirmed}
              plan={plan}
            />
          ) : null}

          <h2 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en="EMS Readiness Declaration" ar="إقرار جاهزية خدمات الطوارئ الطبية" />
          </h2>

          {invitation.status === 'nominated' ? (
            <RespondForm token={invitation.token} kind="ems" eventLevel={invitation.eventLevel} />
          ) : null}
          <p style={{ margin: '0 0 28px', fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: '72ch' }}>
            <L
              en={`Completed and signed by each participating agency separately.${fileBy ? ` The organizer files by ${fileBy} and cannot file without this.` : ''}`}
              ar={`تستكمله وتوقّعه كل جهة مشاركة على حدة.${fileBy ? ` يقدّم المنظّم بحلول ⁦${fileBy}⁩ ولا يمكنه التقديم من دونه.` : ''}`}
            />
          </p>

          {!live ? (
            <div style={{ padding: '20px 26px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 12, fontSize: 15, lineHeight: 1.65, maxWidth: '76ch' }}>
              <L en="Your part in this event is closed. Nothing more is needed from you." ar="أُغلق دوركم في هذه الفعالية. ولا يُطلب منكم شيء بعد الآن." />
            </div>
          ) : null}

          {confirmed ? (
          <>
          <div data-region="responsibility" style={{ padding: '27px 31px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20, maxWidth: '80ch' }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
              <L en="What your agency is accepting" ar="ما تقبله جهتكم" />
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.7 }}>
              <L en={content.responsibilitySentence.en} ar={content.responsibilitySentence.ar} />
            </div>
          </div>

          <div data-wide="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBlockEnd: 32 }}>
            <div style={{ padding: '25px 27px', background: 'var(--surface2)', borderRadius: 16 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
                <L en="Event Medical Director — for item 7" ar="المدير الطبي للفعالية — للبند 7" />
              </div>
              {director ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBlockEnd: 6 }}>
                    <L en={director.name_en} ar={director.name_ar} />
                  </div>
                  <div style={{ fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.6 }}>{director.email}</div>
                </>
              ) : (
                <div style={{ fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
                  <L en="The Director's nomination has not been accepted yet." ar="لم يُقبل ترشيح المدير الطبي بعد." />
                </div>
              )}
            </div>
            <div style={{ padding: '25px 27px', background: 'var(--surface2)', borderRadius: 16 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
                <L en="Major-incident and mass-casualty plan — for item 10" ar="خطة الحوادث الجسيمة وحوادث الإصابات الجماعية — للبند 10" />
              </div>
              <div style={{ fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.6, marginBlockEnd: 14 }}>
                <L en="From the organizer's submission" ar="من ملف المنظّم" />
              </div>
              <a href="#documents" style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: 14, display: 'inline-flex', alignItems: 'center' }}>
                <L en="Open the shared documents" ar="فتح المستندات المشتركة" />
              </a>
            </div>
          </div>

          {invitation.declaration === 'signed' && changeAfterSigning ? (
            <div data-region="declaration-reopen" style={{ padding: '16px 20px', background: 'var(--accent-soft)', borderRadius: 12, marginBlockEnd: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <span style={{ flex: 1, minWidth: 260, fontSize: '13.5px', color: 'var(--accent-ink)', lineHeight: 1.65 }}>
                <L
                  en={`The organizer reported a material change on ${changeAfterSigning.reportedAt.slice(0, 10)}, after you signed. Your declaration attests to the event as it was; re-open it to review the ten items against the changed event, then sign again.`}
                  ar={`أبلغ المنظّم عن تغيير جوهري في ⁦${changeAfterSigning.reportedAt.slice(0, 10)}⁩ بعد توقيعكم. إقراركم يشهد على الفعالية كما كانت؛ أعيدوا فتحه لمراجعة البنود العشرة على الفعالية المتغيّرة ثم وقّعوا من جديد.`}
                />
              </span>
              <form action={reopenDeclarationAction.bind(null, invitation.token)}>
                <button type="submit" style={{ height: 36, paddingInline: 16, border: '1px solid var(--accent)', background: 'var(--bg)', borderRadius: 18, fontSize: '13.5px', color: 'var(--accent-ink)', cursor: 'pointer' }}>
                  <L en="Re-open the declaration" ar="إعادة فتح الإقرار" />
                </button>
              </form>
            </div>
          ) : null}

          <DeclarationForm
            token={invitation.token}
            items={[...DECLARATION_ITEMS]}
            initialConfirmed={invitation.declarationItems}
            initialCertification={invitation.certification}
            signed={invitation.declaration === 'signed'}
            signedAt={invitation.signedAt}
            fileBy={fileBy}
            profileDefaults={{
              provider: profile['agencyName'] ?? invitation.nameEn,
              representative: profile['representative'] ?? '',
            }}
          />
          </>
          ) : null}

          {invitation.status === 'confirmed' ? (
            <details style={{ marginBlockStart: 28 }}>
              <summary style={{ cursor: 'pointer', fontSize: '13.5px', color: 'var(--muted)', listStyle: 'none' }}>
                <span style={{ textDecoration: 'underline' }}>
                  <L en="Withdraw from this event" ar="الانسحاب من هذه الفعالية" />
                </span>
              </summary>
              <form action={withdrawParticipationAction.bind(null, invitation.token)} style={{ marginBlockStart: 10, padding: '14px 18px', background: 'var(--accent-soft)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <span style={{ flex: 1, minWidth: 260, fontSize: '13px', color: 'var(--accent-ink)', lineHeight: 1.6 }}>
                  <L
                    en="If you withdraw, your declaration no longer counts and the organizer is told, with your reason as written. They may need to name another provider; for a filed submission this is a material change they must report."
                    ar="إذا انسحبتم، لم يعد إقراركم معتبَراً ويُبلَّغ المنظّم بسببكم كما كُتب. وقد يحتاج إلى تسمية مزوّد آخر؛ وللملف المقدَّم هذا تغيير جوهري عليه الإبلاغ عنه."
                  />
                </span>
                <input name="reason" required aria-label="Reason" style={{ flexBasis: '100%', height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '12.5px' }} />
                <button type="submit" style={{ flex: 'none', height: 34, paddingInline: 14, border: '1px solid var(--accent)', background: 'var(--bg)', borderRadius: 17, fontSize: '12.5px', color: 'var(--accent-ink)', cursor: 'pointer' }}>
                  <L en="Withdraw — a material change" ar="الانسحاب — تغيير جوهري" />
                </button>
              </form>
            </details>
          ) : null}

          {confirmed ? (
            <div style={{ marginBlockStart: 32 }}>
              <SharedDocuments eventId={id} token={invitation.token} />
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
