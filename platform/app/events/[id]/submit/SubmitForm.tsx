'use client';

/**
 * The compliance and submission form, completed in the platform, not uploaded.
 *
 * Every blocker the gate returns renders by name; the File control is disabled while any
 * stands (SPEC 5b). Filing past the lead time is not blocked: it proceeds marked
 * expedited, and expedited review waives nothing (Protocol 8.4).
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../../components/L';
import { fileSubmissionAction, saveComplianceAction } from '../../../actions';
import { SourceDivergence } from '../../../../components/SourceDivergence';
import type { SubmissionRow } from '../../../../lib/queries';
import type { SubmissionBlocker } from '../../../../lib/rules';

interface DeclItem {
  en: string;
  ar: string;
  minLevel: number;
  arabicIsTranslation?: boolean;
  divergence?: string;
  divergenceNoteEn?: string;
  divergenceNoteAr?: string;
  fields?: { key: string; en: string; ar: string }[];
}

const inputStyle: React.CSSProperties = {
  height: 44,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
};

export function SubmitForm({
  eventId,
  level,
  declarations,
  initial,
  blockers,
  expedited,
  revisionOpen,
  headerRows,
  telephoneDivergence,
  certificationStatement,
}: {
  eventId: string;
  level: 1 | 2 | 3;
  declarations: DeclItem[];
  initial: SubmissionRow | null;
  blockers: SubmissionBlocker[];
  expedited: boolean;
  /** Filed, and the latest Ministry outcome asks for more -- the form reopens for a re-file. */
  revisionOpen: boolean;
  /** The recorded EN/AR divergence on the certification telephone, or null. */
  telephoneDivergence: { en: string; ar: string } | null;
  /** The compliance form's certifying words, shown above the fields they are signed with. */
  certificationStatement: { en: string; ar: string } | null;
  headerRows: { en: string; ar: string; value: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const applicable = useMemo(
    () => declarations.filter((d) => d.minLevel <= level),
    [declarations, level],
  );
  const [ticked, setTicked] = useState<Record<string, boolean>>(initial?.declarations ?? {});
  const [insurance, setInsurance] = useState<Record<string, string>>(initial?.insurance ?? {});
  const [representative, setRepresentative] = useState(initial?.representative ?? '');
  const [telephone, setTelephone] = useState(initial?.telephone ?? '');
  const [position, setPosition] = useState(initial?.position ?? '');
  const [saved, setSaved] = useState(false);
  const [fileError, setFileError] = useState(false);

  const filed = initial?.filedAt != null;
  // Locked once filed -- except while a revision or incomplete outcome holds the form open.
  const locked = filed && !revisionOpen;

  const save = () => {
    setSaved(false);
    startTransition(async () => {
      const result = await saveComplianceAction(eventId, {
        declarations: ticked,
        insurance,
        representative,
        telephone,
        position,
      });
      if ('ok' in result) {
        setSaved(true);
        router.refresh();
      }
    });
  };

  const file = () => {
    setFileError(false);
    startTransition(async () => {
      const result = await fileSubmissionAction(eventId);
      if ('reference' in result) {
        router.push(`/events/${eventId}/acknowledgment`);
      } else {
        setFileError(true);
        router.refresh();
      }
    });
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div data-region="form-card" style={{ padding: 28, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 24 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en="Form header" ar="ترويسة النموذج" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBlockEnd: 28 }}>
          {headerRows.map((h) => (
            <div key={h.en} style={{ background: 'var(--bg)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: '14.5px', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--muted)' }}>
                <L en={h.en} ar={h.ar} />
              </span>
              <span style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>{h.value}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en="Organizer compliance declaration" ar="إقرار امتثال المنظِّم" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBlockEnd: 28 }}>
          {applicable.map((d, i) => {
            const on = ticked[String(i)] === true;
            return (
              <div key={d.en} style={{ background: 'var(--bg)' }}>
                {/* A real checkbox: the control must look pressable (reviewer walk). */}
                <label style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'start', fontSize: '14.5px', cursor: locked ? 'default' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={locked}
                    onChange={() => setTicked((prev) => ({ ...prev, [String(i)]: !on }))}
                    style={{ flex: 'none', width: 18, height: 18, marginBlockStart: 2, accentColor: 'var(--brand)' }}
                  />
                  <span style={{ lineHeight: 1.5, flex: 1 }}>
                    <L en={d.en} ar={d.ar} />
                    {d.divergenceNoteEn && d.divergenceNoteAr ? (
                      <SourceDivergence en={d.divergenceNoteEn} ar={d.divergenceNoteAr} />
                    ) : null}
                  </span>
                  <span style={{ flex: 'none', fontSize: 13, color: on ? 'var(--brand)' : 'var(--muted)' }}>
                    {on ? <L en="Declared" ar="مُقَرّ به" /> : <L en="Not declared" ar="غير مُقَرّ به" />}
                  </span>
                </label>
                {d.fields && level === 3 ? (
                  <div style={{ padding: '0 16px 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
                      {d.fields.map((f) => (
                        <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                            <L en={f.en} ar={f.ar} />
                          </span>
                          <input
                            value={insurance[f.key] ?? ''}
                            disabled={locked}
                            onChange={(e) => setInsurance((prev) => ({ ...prev, [f.key]: e.target.value }))}
                            style={inputStyle}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en="Organizer certification" ar="تصديق المنظِّم" />
        </div>
        {certificationStatement ? (
          <div data-region="certification-statement" style={{ padding: '14px 18px', border: '1px solid var(--line)', borderInlineStart: '3px solid var(--brand)', borderRadius: 10, marginBlockEnd: 18, fontSize: '14.5px', lineHeight: 1.65, maxWidth: '78ch' }}>
            <L en={certificationStatement.en} ar={certificationStatement.ar} />
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en="Authorized representative" ar="الممثل المفوّض" />
            </span>
            <input value={representative} disabled={locked} onChange={(e) => setRepresentative(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en="Position" ar="الصفة" />
            </span>
            <input value={position} disabled={locked} onChange={(e) => setPosition(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en="Telephone" ar="الهاتف" />
              {telephoneDivergence ? (
                <SourceDivergence en={telephoneDivergence.en} ar={telephoneDivergence.ar} />
              ) : null}
            </span>
            <input value={telephone} disabled={locked} onChange={(e) => setTelephone(e.target.value)} style={inputStyle} />
          </label>
        </div>
        {!locked ? (
          <div style={{ marginBlockStart: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={pending}
              onClick={save}
              style={{ height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', cursor: 'pointer' }}
            >
              <L en="Save the form" ar="حفظ النموذج" />
            </button>
            {saved ? (
              <span style={{ fontSize: '13.5px', color: 'var(--brand)' }}>
                <L en="Saved." ar="حُفظ." />
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {locked ? (
        <div style={{ padding: '22px 26px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 28, fontSize: 15, lineHeight: 1.65 }}>
          <L
            en={`Filed. The Ministry reference number is ${initial?.mophReference ?? ''}. The acknowledgment carries what it means.`}
            ar={`قُدِّم. الرقم المرجعي للوزارة هو ⁦${initial?.mophReference ?? ''}⁩. ويحمل الإشعار دلالته.`}
          />
        </div>
      ) : (
        <>
          {revisionOpen ? (
            <div style={{ padding: '22px 26px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 12, marginBlockEnd: 22, fontSize: '14.5px', lineHeight: 1.65, maxWidth: '80ch' }}>
              <L
                en={`The Ministry's determination asks for more. The form is open for revision; re-filing archives version ${initial?.version ?? 1} and your reference number does not change.`}
                ar={`نتيجة الوزارة تطلب المزيد. النموذج مفتوح للتعديل؛ وإعادة التقديم تؤرشف النسخة ${initial?.version ?? 1} ولا يتغير رقمكم المرجعي.`}
              />
            </div>
          ) : null}
          {expedited ? (
            <div style={{ padding: '22px 26px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 12, marginBlockEnd: 22, fontSize: '14.5px', lineHeight: 1.65, maxWidth: '80ch' }}>
              <L
                en="The standard filing timeline has passed. The submission can still be filed and will be marked as an expedited submission for Ministry review. Expedited review does not waive the applicable minimum requirements."
                ar="انقضت المهلة الاعتيادية للتقديم. لا يزال بالإمكان تقديم الملف وسيوسم بأنه تقديم مستعجل لمراجعة الوزارة. ولا تُسقط المراجعة المستعجلة الحد الأدنى للمتطلبات المنطبقة."
              />
            </div>
          ) : null}
          {blockers.length > 0 ? (
            <div style={{ padding: '24px 28px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 12, marginBlockEnd: 22, maxWidth: '80ch' }}>
              <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, marginBlockEnd: 12 }}>
                <L
                  en={`The compliance and submission form cannot be certified yet — ${blockers.length} items outstanding`}
                  ar={`لا يمكن التصديق على نموذج الامتثال والتقديم بعد — ${blockers.length} بنود غير مستوفاة`}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {blockers.map((b) => (
                  <div key={b.itemEn} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', fontSize: '14.5px', lineHeight: 1.55 }}>
                    <span style={{ flex: 'none', color: 'var(--accent-ink)' }}>·</span>
                    <span style={{ flex: 1 }}>
                      <L en={b.itemEn} ar={b.itemAr} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginBlockEnd: 12 }}>
            <button
              type="button"
              disabled={blockers.length > 0 || pending}
              onClick={file}
              style={{
                height: 48,
                paddingInline: 26,
                border: 0,
                borderRadius: 22,
                background: blockers.length > 0 ? 'var(--surface2)' : 'var(--brand)',
                color: blockers.length > 0 ? 'var(--muted)' : 'var(--bg)',
                fontSize: 15,
                fontWeight: 500,
                cursor: blockers.length > 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {revisionOpen ? (
                <L en="File the revised submission" ar="تقديم الملف المعدَّل" />
              ) : (
                <L en="File the submission" ar="تقديم الملف" />
              )}
            </button>
            {blockers.length > 0 ? (
              <span style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.5 }}>
                <L
                  en={`Blocked while ${blockers.length} items are outstanding.`}
                  ar={`محجوب ما دامت ${blockers.length} بنود غير مستوفاة.`}
                />
              </span>
            ) : null}
            {fileError ? (
              <span style={{ fontSize: '13.5px', color: 'var(--bad)' }}>
                <L en="Filing was refused by the server-side check. The outstanding items are listed above." ar="رفض التحقق على الخادم التقديم. البنود غير المستوفاة مدرجة أعلاه." />
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
