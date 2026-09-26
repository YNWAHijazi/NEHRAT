import { getDb } from '../../../lib/db';
import { attachDocumentAction } from '../../actions';
import { UploadInput } from '../../../components/UploadInput';
import { acceptAttribute } from '../../../lib/rules/uploads';
/**
 * THE DIRECTOR'S ONE PAGE (partner ruling, counterparty pass 2026-09-02): the event's
 * facts at the top with View more, then only what the Director actually fills — the
 * three governance sections that write into the organizer's plan, and the route to
 * the post-event report when one is owed. The requirement cards that looked like
 * buttons and the certified-about-you panel are gone; the full requirement rows the
 * matrix names stay readable under View more, where every counterparty reads theirs.
 */

import Link from 'next/link';
import { InfoNote } from '../../../components/InfoNote';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import type { Account } from '../../../lib/auth';
import type { InvitationDetail, NominationBriefing, NomineePlanSlice } from '../../../lib/queries';
import { ROLES_CONTENT } from '../../../lib/rules';
import { saveGovernanceAction } from '../../actions';
import { Briefing } from '../../invitations/[token]/Briefing';
import { RespondForm } from '../../invitations/[token]/RespondForm';

export function DirectorEventView({
  account,
  invitation,
  unread,
  governance,
  reportSigned,
  briefing,
  plan,
  notice,
}: {
  account: Account;
  invitation: InvitationDetail;
  unread: number;
  governance: Record<string, string>;
  reportSigned: { organizer: boolean; director: boolean } | null;
  briefing: NominationBriefing | null;
  plan: NomineePlanSlice | null;
  notice?: string | undefined;
}) {
  const content = ROLES_CONTENT.director;
  const hasMap = Boolean(getDb().prepare("SELECT 1 FROM event_attachments WHERE event_id = ? AND doc_key = 'deploymentMap' AND length(bytes) > 0").get(invitation.eventId));
  const confirmed = invitation.status === 'confirmed';
  const live = confirmed || invitation.status === 'nominated';

  const stateOf = (key: string): { en: string; ar: string; bg: string; color: string } => {
    const v = governance[key]?.trim() ?? '';
    if (v.length > 120) return { en: 'Written', ar: 'مكتوب', bg: 'var(--brand-soft)', color: 'var(--brand)' };
    if (v.length > 0) return { en: 'Started', ar: 'بُدئ', bg: 'var(--accent-soft)', color: 'var(--accent-ink)' };
    return { en: 'Not written', ar: 'غير مكتوب', bg: 'var(--bad-soft)', color: 'var(--bad)' };
  };

  return (
    <>
      <GovernmentBand />
      {/* Back always means the dashboard in a counterparty flow (partner ruling). */}
      <Header account={account} organization={null} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 940 }}>
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
          {notice === 'saved' ? (
            <div style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              <L en="Saved. Your text now shows in the organizer's plan." ar="حُفظ. ويظهر نصكم الآن في خطة المنظّم." />
            </div>
          ) : null}

          {briefing ? (
            <Briefing
              briefing={briefing}
              token={invitation.token}
              kind="director"
              level={invitation.eventLevel}
              namedEn={invitation.nameEn}
              namedAr={invitation.nameAr}
              confirmed={confirmed}
              plan={plan}
            />
          ) : null}

          <h2 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en="What you are responsible for" ar="ما أنتم مسؤولون عنه" />
          </h2>

          {invitation.status === 'nominated' ? (
            <>
              <p style={{ margin: '0 0 20px', fontSize: 16, lineHeight: 1.65, maxWidth: '70ch' }}>
                <L en={content.accepting.en} ar={content.accepting.ar} />
              </p>
              <RespondForm token={invitation.token} kind="director" eventLevel={invitation.eventLevel} />
            </>
          ) : null}

          {confirmed ? (
            <>
              {invitation.eventLevel === 3 ? <Link data-region="director-plan" href={`/events/${invitation.eventId}/plan`} style={{ display: 'inline-flex', padding: '13px 22px', background: 'var(--brand)', color: 'var(--bg)', borderRadius: 24, marginBlockEnd: 20 }}><L en="Prepare the medical plan" ar="إعداد الخطة الطبية" /></Link> : null}
              {invitation.eventLevel === 3 ? <section style={{ padding: 20, border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 24 }}><h3><L en="Medical deployment map" ar="خريطة الانتشار الطبي" /></h3>{hasMap ? <a href={`/api/documents/${invitation.eventId}/deploymentMap`} target="_blank" rel="noreferrer"><L en="View uploaded map" ar="عرض الخريطة المرفوعة" /></a> : null}<form action={attachDocumentAction.bind(null, invitation.eventId)}><input type="hidden" name="docKey" value="deploymentMap" /><input type="hidden" name="returnTo" value={`/events/${invitation.eventId}/plan`} /><UploadInput name="file" required accept={acceptAttribute()} /><button type="submit"><L en="Upload map" ar="رفع الخريطة" /></button></form></section> : null}
              <form action={saveGovernanceAction.bind(null, invitation.eventId)}>
                <div data-region="gov-sections" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBlockEnd: 24 }}>
                  {content.govSections.map((g) => {
                    const s = stateOf(g.key);
                    return (
                      <div key={g.key} style={{ paddingBlock: '29px', paddingInlineStart: '32px', paddingInlineEnd: '33px', background: 'var(--surface2)', borderInlineStart: `3px solid ${s.color}`, borderRadius: 16 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 12 }}>
                          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', flex: 1, minWidth: 0 }}>
                            <L en={g.en} ar={g.ar} />
                            <InfoNote><L en={g.askEn} ar={g.askAr} />{' '}<L en={`Included in: ${g.intoEn}`} ar={`يُدرج في: ${g.intoAr}`} /></InfoNote>
                          </h3>
                          <span style={{ flex: 'none', padding: '4px 10px', borderRadius: 999, background: s.bg, color: s.color, fontSize: 13 }}>
                            <L en={s.en} ar={s.ar} />
                          </span>
                        </div>
                        <textarea
                          name={g.key}
                          rows={4}
                          defaultValue={governance[g.key] ?? ''}
                          style={{ width: '100%', padding: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15, lineHeight: 1.7, resize: 'vertical' }}
                        />
                      </div>
                    );
                  })}
                </div>
                <button type="submit" style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer', marginBlockEnd: 32 }}>
                  <L en="Save" ar="حفظ" />
                </button>
              </form>

              {/* The report is the Director's other signature. The row states where it
                  stands and opens it; the report page carries the figures and the act. */}
              <div data-region="report-row" style={{ paddingBlock: '21px', paddingInlineStart: '24px', paddingInlineEnd: '25px', background: 'var(--surface2)', borderInlineStart: `3px solid ${reportSigned?.director ? 'var(--brand)' : 'var(--accent)'}`, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>
                    <L en="Post-event medical report" ar="التقرير الطبي لما بعد الفعالية" />
                  </div>
                  <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 4 }}>
                    {reportSigned?.director ? (
                      <L en="Signed." ar="وُقّع." />
                    ) : reportSigned ? (
                      <L en="The organizer's figures are in; your signature is the second of two." ar="أرقام المنظّم مدخلة؛ وتوقيعكم هو الثاني من اثنين." />
                    ) : (
                      <L en="Opens after the event; the organizer enters the figures and you sign." ar="يُفتح بعد الفعالية؛ يُدخل المنظّم الأرقام وتوقّعون." />
                    )}
                  </div>
                </div>
                <Link href={`/events/${invitation.eventId}/report`} style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: 14, display: 'inline-flex', alignItems: 'center', flex: 'none' }}>
                  <L en="Open the post-event report" ar="فتح التقرير اللاحق" />
                </Link>
              </div>
            </>
          ) : null}

          {!live ? (
            <div style={{ padding: '20px 26px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 12, fontSize: 15, lineHeight: 1.65, maxWidth: '76ch' }}>
              <L en="Your part in this event is closed. Nothing more is needed from you." ar="أُغلق دوركم في هذه الفعالية. ولا يُطلب منكم شيء بعد الآن." />
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
