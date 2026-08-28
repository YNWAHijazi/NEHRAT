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
import { DocumentViewer } from '../../../../components/DocumentViewer';
import { attachDocumentAction } from '../../../actions';
import { acceptAttribute, catalogueEntry, missingCertificationFields } from '../../../../lib/rules';
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
  /** A declaration that cannot be made without a file behind it. */
  attachmentKey?: string;
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
  attachments,
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
  headerRows: { en: string; ar: string; valueEn: string; valueAr: string }[];
  /**
   * Which catalogue documents are attached, and what is known about each. The
   * insurance declaration reads this: it used to carry a text box asking whether
   * evidence was attached, and the word "yes" satisfied it.
   */
  attachments: Record<string, { fileName: string; hasFile: boolean; contentType: string | null }>;
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

  // The organizer's own certification had the identical hole to the provider's: a
  // submission could be filed with no authorized representative named. The filing
  // gate enforces it; this names the fields where they are.
  const missingCert = new Set(
    missingCertificationFields('organizer', { representative, telephone, position }).map((f) => f.key),
  );

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
      <div data-region="form-card" style={{ padding: 29, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en="Form header" ar="ترويسة النموذج" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBlockEnd: 28 }}>
          {headerRows.map((h) => (
            <div key={h.en} style={{ background: 'var(--bg)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: '14.5px', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--muted)' }}>
                <L en={h.en} ar={h.ar} />
              </span>
              <span style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
                <L en={h.valueEn} ar={h.valueAr} />
              </span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en="Organizer compliance declaration" ar="إقرار امتثال المنظِّم" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBlockEnd: 28 }}>
          {applicable.map((d, i) => {
            // A declaration backed by an attachment is unavailable while the file is
            // absent -- disabled WITH A REASON below it, never a tick that lies.
            const evidence = d.attachmentKey ? attachments[d.attachmentKey] : undefined;
            const evidenceDoc = d.attachmentKey ? catalogueEntry(d.attachmentKey) : undefined;
            const evidenceMissing = d.attachmentKey !== undefined && !evidence;
            const on = ticked[String(i)] === true;
            return (
              <div key={d.en} style={{ background: 'var(--bg)' }}>
                {/* A real checkbox: the control must look pressable (reviewer walk). */}
                <label style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'start', fontSize: '14.5px', cursor: locked ? 'default' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={locked || evidenceMissing}
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
                    {/* THE EVIDENCE IS A FILE, NOT A WORD. This was a text box, and
                        typing "yes" into it satisfied the declaration. An attachment
                        row like every other: upload it, read it back, and the
                        declaration above stays unavailable until it is there. */}
                    {d.attachmentKey ? (
                      <div data-region="insurance-evidence" style={{ marginBlockStart: 16, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '13.5px' }}>
                            <L en={evidenceDoc?.en ?? 'Evidence of insurance'} ar={evidenceDoc?.ar ?? 'إثبات التأمين'} />
                          </span>
                          <span style={{ fontSize: '12.5px', padding: '3px 9px', borderRadius: 999, background: evidence ? 'var(--brand-soft)' : 'var(--bad-soft)', color: evidence ? 'var(--brand)' : 'var(--bad)' }}>
                            {evidence ? <L en="Attached" ar="مُرفق" /> : <L en="Not attached" ar="غير مُرفق" />}
                          </span>
                        </div>
                        {evidence ? (
                          <>
                            <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, fontVariantNumeric: 'tabular-nums' }}>{evidence.fileName}</div>
                            <DocumentViewer
                              href={`/api/documents/${eventId}/${d.attachmentKey}`}
                              hasFile={evidence.hasFile}
                              contentType={evidence.contentType}
                              label="Evidence of insurance"
                            />
                          </>
                        ) : (
                          <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, marginBlockStart: 4, maxWidth: '74ch' }}>
                            <L
                              en="The declaration above cannot be made until the certificate or policy is attached."
                              ar="لا يمكن الإقرار أعلاه قبل إرفاق الشهادة أو البوليصة."
                            />
                          </div>
                        )}
                        {!locked ? (
                          <form action={attachDocumentAction.bind(null, eventId)} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBlockStart: 10 }}>
                            <input type="hidden" name="docKey" value={d.attachmentKey} />
                            <input type="hidden" name="returnTo" value={`/events/${eventId}/submit`} />
                            <input type="file" name="file" required accept={acceptAttribute()} aria-label="Attach the evidence of insurance" style={{ fontSize: 13, maxWidth: 240 }} />
                            <button type="submit" style={{ height: 34, paddingInline: 14, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 17, fontSize: '12.5px', cursor: 'pointer' }}>
                              {evidence ? <L en="Replace" ar="استبدال" /> : <L en="Attach" ar="إرفاق" />}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
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
          <div data-region="certification-statement" style={{ paddingBlock: '15px', paddingInlineStart: '18px', paddingInlineEnd: '19px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 10, marginBlockEnd: 18, fontSize: '14.5px', lineHeight: 1.65, maxWidth: '78ch' }}>
            <L en={certificationStatement.en} ar={certificationStatement.ar} />
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en="Authorized representative" ar="الممثل المفوّض" />
            </span>
            <input
              value={representative}
              disabled={locked}
              required
              aria-invalid={!locked && missingCert.has('representative')}
              onChange={(e) => setRepresentative(e.target.value)}
              style={{ ...inputStyle, ...(!locked && missingCert.has('representative') ? { border: '1px solid var(--bad)' } : {}) }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en="Position" ar="الصفة" />
            </span>
            <input
              value={position}
              disabled={locked}
              required
              aria-invalid={!locked && missingCert.has('position')}
              onChange={(e) => setPosition(e.target.value)}
              style={{ ...inputStyle, ...(!locked && missingCert.has('position') ? { border: '1px solid var(--bad)' } : {}) }}
            />
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
                  en={`The compliance and submission form cannot be certified yet — ${blockers.length} ${blockers.length === 1 ? 'item' : 'items'} outstanding`}
                  ar={`لا يمكن التصديق على نموذج الامتثال والتقديم بعد — ${blockers.length} بنود غير مستوفاة`}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {blockers.map((b) => {
                  // Each blocker links to the screen that clears it -- a named item
                  // the organizer cannot act on from here is a corridor, not a gate.
                  const href =
                    b.kind === 'organizationPending'
                      ? '/organization'
                      : b.kind === 'declarationsIncomplete' || b.kind === 'eventCancelled'
                        ? null
                        : b.kind === 'documentMissing' && b.docKey === 'plan'
                          ? `/events/${eventId}/plan`
                          : b.kind === 'documentMissing' && b.docKey === 'complianceForm'
                            ? null // completed on THIS screen -- a link would loop
                            : `/events/${eventId}/requirements`;
                  return (
                    <div key={b.itemEn} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', fontSize: '14.5px', lineHeight: 1.55 }}>
                      <span style={{ flex: 'none', color: 'var(--accent-ink)' }}>·</span>
                      <span style={{ flex: 1 }}>
                        {href ? (
                          <a href={href} style={{ color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                            <L en={b.itemEn} ar={b.itemAr} />
                          </a>
                        ) : (
                          <L en={b.itemEn} ar={b.itemAr} />
                        )}
                      </span>
                    </div>
                  );
                })}
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
                borderRadius: 24,
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
                  en={`Blocked while ${blockers.length} ${blockers.length === 1 ? 'item is' : 'items are'} outstanding.`}
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
