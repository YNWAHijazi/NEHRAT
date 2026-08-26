'use client';

/**
 * The three responses (accept / decline / request modification) with the reason
 * required for the second and third, and the account block for a holder who is not
 * yet signed in -- self-registration against the invitation, never against the
 * platform at large (rule 6).
 */

import { useState } from 'react';
import { L } from '../../../components/L';
import { respondToInvitationAction } from '../../actions';
import { ROLES_CONTENT, emsDeclarationGate, type Level } from '../../../lib/rules';

const inputStyle: React.CSSProperties = {
  height: 46,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
};

export function RespondForm({
  token,
  kind,
  signedIn,
  eventLevel,
}: {
  token: string;
  kind: 'ems' | 'director';
  signedIn: boolean;
  eventLevel: Level | null;
}) {
  const content = ROLES_CONTENT.ems;
  // Accept promised "the declaration opens" at every level. It opens only at Level 3.
  const declarationOpens = emsDeclarationGate(eventLevel).behaviour === 'enabled';
  const accept = content.nominationResponses.find((r) => r.key === 'accept');
  const acceptCopy = {
    en: accept?.descNoDeclarationEn ?? accept?.descEn ?? '',
    ar: accept?.descNoDeclarationAr ?? accept?.descAr ?? '',
  };
  const [picked, setPicked] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const responses = kind === 'ems' ? content.nominationResponses : content.nominationResponses.filter((r) => r.key !== 'modification');
  const needsReason = picked === 'decline' || picked === 'modification';

  return (
    <form action={respondToInvitationAction.bind(null, token)}>
      <div data-region="respond" style={{ padding: '28px 32px', border: '1px solid var(--line)', borderRadius: 16, marginBlockEnd: 20 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en="Respond to the nomination" ar="الردّ على الترشيح" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 18 }}>
          {responses.map((r) => {
            const on = picked === r.key;
            return (
              <button
                key={r.key}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(r.key)}
                style={{ textAlign: 'start', display: 'flex', gap: 14, alignItems: 'start', padding: '18px 22px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', borderRadius: 12, cursor: 'pointer' }}
              >
                <span style={{ flex: 'none', width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${on ? 'var(--brand)' : 'var(--muted)'}`, background: on ? 'var(--brand)' : 'transparent', marginBlockStart: 3 }} />
                <span>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>
                    <L en={r.en} ar={r.ar} />
                  </span>
                  <span style={{ display: 'block', fontSize: 14, lineHeight: 1.6, color: 'var(--muted)', marginBlockStart: 4 }}>
                    {r.key === 'accept' && !declarationOpens ? (
                      <L en={acceptCopy.en} ar={acceptCopy.ar} />
                    ) : (
                      <L en={r.descEn} ar={r.descAr} />
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {picked ? <input type="hidden" name="response" value={picked} /> : null}
        {needsReason ? (
          <div style={{ marginBlockEnd: 18 }}>
            <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockEnd: 6 }}>
              <L en={content.reasonRequired.en} ar={content.reasonRequired.ar} />
            </div>
            <textarea name="reason" rows={3} required style={{ width: '100%', padding: 12, background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 8, fontSize: 15, lineHeight: 1.6, resize: 'vertical' }} />
          </div>
        ) : null}
        <div style={{ fontSize: '13.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '74ch' }}>
          <L en={content.notACommitment.en} ar={content.notACommitment.ar} />
        </div>
      </div>

      {picked === 'decline' && !declineOpen ? (
        <div style={{ padding: '28px 32px', border: '2px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 16, marginBlockEnd: 20, maxWidth: '76ch' }}>
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.5, marginBlockEnd: 12 }}>
            <L en={content.declineWarning.titleEn} ar={content.declineWarning.titleAr} />
          </div>
          <div style={{ fontSize: 16, lineHeight: 1.7, marginBlockEnd: 20 }}>
            <L en={content.declineWarning.bodyEn} ar={content.declineWarning.bodyAr} />
          </div>
          <button
            type="button"
            onClick={() => setDeclineOpen(true)}
            style={{ height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--bad)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}
          >
            <L en="I understand — continue to decline" ar="فهمت — المتابعة للاعتذار" />
          </button>
        </div>
      ) : null}

      {!signedIn && picked ? (
        <div data-region="account-setup" style={{ padding: 32, border: '1px solid var(--line)', borderRadius: 16, marginBlockEnd: 20 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Set up your account" ar="إعداد حسابكم" />
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>
            {kind === 'ems' ? (
              <L
                en="An individual account gives access to the platform. Your agency profile is completed once and reused across every event. Fee: None."
                ar="يمنح الحساب الفردي الوصول إلى المنصة. يُستكمل ملف جهتكم مرة واحدة ويُعاد استخدامه في كل فعالية. الرسم: لا يوجد."
              />
            ) : (
              <L
                en="Your physician profile is completed once and reused across every event you direct. Fee: None."
                ar="يُستكمل ملفكم الطبي مرة واحدة ويُعاد استخدامه في كل فعالية تديرونها. الرسم: لا يوجد."
              />
            )}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                <L en="Full name" ar="الاسم الكامل" />
              </span>
              <input name="fullName" style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                <L en="Email" ar="البريد الإلكتروني" />
              </span>
              <input name="email" type="email" style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                <L en="Password" ar="كلمة المرور" />
              </span>
              <input name="password" type="password" style={inputStyle} />
            </label>
          </div>
        </div>
      ) : null}

      {picked === 'accept' || picked === 'modification' || (picked === 'decline' && declineOpen) ? (
        <button
          type="submit"
          style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: picked === 'decline' ? 'var(--bad)' : 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
        >
          {picked === 'accept' ? (
            kind === 'ems' ? (
              <L en="Accept and continue to the provider profile" ar="القبول والمتابعة إلى ملف المزوّد" />
            ) : (
              <L en="Accept and continue to your profile" ar="القبول والمتابعة إلى ملفكم" />
            )
          ) : picked === 'decline' ? (
            <L en="Decline and notify the organizer" ar="الاعتذار وإبلاغ المنظّم" />
          ) : (
            <L en="Send the modification request" ar="إرسال طلب التعديل" />
          )}
        </button>
      ) : null}
    </form>
  );
}
