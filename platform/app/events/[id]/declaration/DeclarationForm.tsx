'use client';

/**
 * The ten items and the certification. Signing is DISABLED WITH THE REASON while any
 * item is unconfirmed -- the count named beside the control (rule 10) -- and the
 * server enforces the same gate. A draft is visible to the agency only.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../../components/L';
import { missingCertificationFields } from '../../../../lib/rules';
import { SourceDivergence } from '../../../../components/SourceDivergence';
import { DECLARATION_ITEM_DIVERGENCES } from '../../../../lib/rules';
import { saveDeclarationDraftAction, signDeclarationAction } from '../../../actions';
import { ROLES_CONTENT, declarationGate, type DeclarationItem } from '../../../../lib/rules';

const inputStyle: React.CSSProperties = {
  height: 44,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
};

export function DeclarationForm({
  token,
  items,
  initialConfirmed,
  initialCertification,
  signed,
  signedAt,
  fileBy,
  profileDefaults,
}: {
  token: string;
  items: DeclarationItem[];
  initialConfirmed: boolean[];
  initialCertification: Record<string, string>;
  signed: boolean;
  signedAt: string | null;
  fileBy: string | null;
  profileDefaults: { provider: string; representative: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const content = ROLES_CONTENT.ems;
  const [confirmed, setConfirmed] = useState<boolean[]>(
    items.map((_, i) => initialConfirmed[i] ?? false),
  );
  const [cert, setCert] = useState<Record<string, string>>({
    provider: initialCertification['provider'] ?? profileDefaults.provider,
    representative: initialCertification['representative'] ?? profileDefaults.representative,
    position: initialCertification['position'] ?? '',
    phone: initialCertification['phone'] ?? '',
    date: initialCertification['date'] ?? '',
  });
  const [saved, setSaved] = useState(false);
  const gate = useMemo(() => declarationGate(confirmed), [confirmed]);
  // THE CERTIFICATION BLOCK. Signing used to check the ten items and nothing else, so
  // a declaration signed with an empty Date was released to the organizer. Every
  // field is required; the missing ones are NAMED rather than counted.
  const missingCert = useMemo(() => missingCertificationFields('ems', cert), [cert]);
  const maySign = gate.canSign && missingCert.length === 0;

  const persist = (sign: boolean) => {
    setSaved(false);
    startTransition(async () => {
      const payload = { items: confirmed, certification: cert };
      const result = sign
        ? await signDeclarationAction(token, payload)
        : await saveDeclarationDraftAction(token, payload);
      if ('ok' in result) {
        if (sign) router.refresh();
        else setSaved(true);
      }
    });
  };

  return (
    <div>
      <div data-region="items" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 32 }}>
        {items.map((item, i) => {
          const on = Boolean(confirmed[i]);
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              disabled={signed}
              onClick={() => setConfirmed((prev) => prev.map((v, j) => (j === i ? !v : v)))}
              style={{ textAlign: 'start', display: 'flex', gap: 16, alignItems: 'start', padding: '18px 22px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--surface)', borderRadius: 12, cursor: signed ? 'default' : 'pointer' }}
            >
              <span style={{ flex: 'none', width: 18, height: 18, border: `1.5px solid ${on ? 'var(--brand)' : 'var(--muted)'}`, borderRadius: 3, background: on ? 'var(--brand)' : 'transparent', marginBlockStart: 3 }} />
              <span style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', flex: 'none', minWidth: 18 }}>{i + 1}</span>
              <span style={{ fontSize: 16, lineHeight: 1.55 }}>
                <L en={item.en} ar={item.ar} />
                {DECLARATION_ITEM_DIVERGENCES.filter((d) => d.index === i).map((d) => (
                  <SourceDivergence key={d.index} en={d.en} ar={d.ar} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div data-region="certification" style={{ padding: 33, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 16 }}>
          <L en="EMS provider certification" ar="تصديق مزوّد الإسعاف" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16 }}>
          {content.certificationFields.map((f) => (
            <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                <L en={f.en} ar={f.ar} />
                {'issue' in f && f.issue === 'en-only' ? (
                  <span style={{ display: 'inline-block', marginInlineStart: 8, padding: '0 6px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                    <L en="English issue only" ar="الإصدار الإنكليزي فقط" />
                  </span>
                ) : null}
              </span>
              <input
                type={f.key === 'date' ? 'date' : 'text'}
                value={cert[f.key] ?? ''}
                disabled={signed}
                required
                aria-invalid={!signed && (cert[f.key] ?? '').trim() === ''}
                onChange={(e) => setCert((c) => ({ ...c, [f.key]: e.target.value }))}
                style={{
                  ...inputStyle,
                  ...(!signed && (cert[f.key] ?? '').trim() === ''
                    ? { border: '1px solid var(--bad)' }
                    : {}),
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <div data-region="draft-state" style={{ padding: '17px 21px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14, lineHeight: 1.6, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <span>
          {signed ? (
            <L en={content.draftNote.signedEn} ar={content.draftNote.signedAr} />
          ) : (
            <L en={content.draftNote.draftEn} ar={content.draftNote.draftAr} />
          )}
        </span>
        <span style={{ padding: '4px 10px', borderRadius: 999, background: signed ? 'var(--brand-soft)' : 'var(--accent-soft)', color: signed ? 'var(--brand)' : 'var(--accent-ink)', fontSize: 13 }}>
          {signed ? <L en="Signed" ar="موقّع" /> : <L en="Draft" ar="مسودة" />}
        </span>
      </div>

      {!signed ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => persist(true)}
            disabled={!maySign || pending}
            style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: maySign ? 'var(--brand)' : 'var(--surface2)', color: maySign ? 'var(--bg)' : 'var(--muted)', fontSize: 15, fontWeight: 500, cursor: maySign ? 'pointer' : 'not-allowed' }}
          >
            <L en="Sign the declaration" ar="توقيع الإقرار" />
          </button>
          <span data-region="sign-gate" style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
            {gate.canSign && missingCert.length > 0 ? (
              <L
                en={`The certification is not complete: ${missingCert.map((f) => f.en).join(', ')}`}
                ar={`التصديق غير مكتمل: ${missingCert.map((f) => f.ar).join('، ')}`}
              />
            ) : gate.canSign ? (
              <L en="All ten items confirmed" ar="تم تأكيد البنود العشرة" />
            ) : (
              <L
                en={`${gate.totalCount - gate.confirmedCount} of ${gate.totalCount} items still to confirm`}
                ar={`بقي تأكيد ${gate.totalCount - gate.confirmedCount} من ${gate.totalCount} بنود`}
              />
            )}
          </span>
          <button
            type="button"
            onClick={() => persist(false)}
            disabled={pending}
            style={{ height: 44, paddingInline: 20, border: '1px solid var(--line)', background: 'none', borderRadius: 22, fontSize: '14.5px', cursor: 'pointer' }}
          >
            <L en="Save the draft" ar="حفظ المسودة" />
          </button>
          {saved ? (
            <span style={{ fontSize: '13.5px', color: 'var(--brand)' }}>
              <L en="Draft saved — visible to your agency only" ar="حُفظت المسودة — تظهر لجهتكم فقط" />
            </span>
          ) : null}
        </div>
      ) : (
        <div data-region="delivered" style={{ padding: 32, background: 'var(--surface)', border: '1px solid var(--brand)', borderRadius: 16 }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--brand)', marginBlockEnd: 14 }}>
            <L en="Delivered to the organizer" ar="سُلّم إلى المنظّم" />
          </div>
          <div style={{ fontSize: 16, lineHeight: 1.7, maxWidth: '74ch', marginBlockEnd: 20 }}>
            <L en={content.deliveredNote.en} ar={content.deliveredNote.ar} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: 'var(--bg)', padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: '14.5px' }}>
              <span>
                <L en="Signed" ar="وُقّع" />
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{signedAt?.slice(0, 10) ?? ''}</span>
            </div>
            <div style={{ background: 'var(--bg)', padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: '14.5px' }}>
              <span>
                <L en="Status on the organizer's side" ar="الحالة لدى المنظّم" />
              </span>
              <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 13 }}>
                <L en="Provided" ar="مُقدَّم" />
              </span>
            </div>
            {fileBy ? (
              <div style={{ background: 'var(--bg)', padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: '14.5px' }}>
                <span>
                  <L en="Organizer files by" ar="يقدّم المنظّم بحلول" />
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fileBy}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
