'use client';

/**
 * The incident report as a form. Answer sets come from the data (yesNo / yesNoUnknown / yesNoNa /
 * transport enumeration / check / checkNa); the name check runs live on the narrative
 * and the corrective-actions text, and the submit stays disabled while either flags.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../../../components/L';
import { submitFacilityIncidentAction } from '../../../../actions';
import { FACILITY_CONTENT, detectPersonalName } from '../../../../../lib/rules';

const inputStyle: React.CSSProperties = {
  height: 44,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
};

const ANSWER_SETS: Record<string, { k: string; en: string; ar: string }[]> = {
  yesNo: [
    { k: 'yes', en: 'Yes', ar: 'نعم' },
    { k: 'no', en: 'No', ar: 'لا' },
  ],
  yesNoUnknown: [
    { k: 'yes', en: 'Yes', ar: 'نعم' },
    { k: 'no', en: 'No', ar: 'لا' },
    { k: 'unknown', en: 'Unknown', ar: 'غير معروف' },
  ],
  yesNoNa: [
    { k: 'yes', en: 'Yes', ar: 'نعم' },
    { k: 'no', en: 'No', ar: 'لا' },
    { k: 'na', en: 'Not applicable', ar: 'غير منطبق' },
  ],
  check: [{ k: 'yes', en: 'Verified', ar: 'تم التحقق' }],
  checkNa: [
    { k: 'yes', en: 'Verified', ar: 'تم التحقق' },
    { k: 'na', en: 'Not applicable', ar: 'غير منطبق' },
  ],
};

function AnswerRow({
  fieldKey,
  en,
  ar,
  answers,
  value,
  onPick,
}: {
  fieldKey: string;
  en: string;
  ar: string;
  answers: string;
  value: string | null;
  onPick: (v: string) => void;
}) {
  const opts = ANSWER_SETS[answers] ?? [];
  return (
    <div style={{ background: 'var(--bg)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', fontSize: '14.5px', flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 220, lineHeight: 1.5 }}>
        <L en={en} ar={ar} />
      </span>
      <span style={{ display: 'flex', gap: 6, flex: 'none', flexWrap: 'wrap' }}>
        {opts.map((o) => {
          const on = value === o.k;
          return (
            <button
              key={o.k}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(o.k)}
              style={{ padding: '4px 12px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'transparent', color: on ? 'var(--brand)' : 'var(--muted)', borderRadius: 16, fontSize: 13, cursor: 'pointer' }}
            >
              <L en={o.en} ar={o.ar} />
            </button>
          );
        })}
      </span>
      {value ? <input type="hidden" name={fieldKey} value={value} /> : null}
    </div>
  );
}

export function IncidentForm({
  facilityId,
  coordinatorName,
  coordinatorPhone,
  coordinatorEmail,
}: {
  facilityId: string;
  coordinatorName: string;
  coordinatorPhone: string;
  coordinatorEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const content = FACILITY_CONTENT.incident;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [narrative, setNarrative] = useState('');
  const [corrective, setCorrective] = useState('');
  const [serverError, setServerError] = useState(false);
  const flagged = useMemo(() => detectPersonalName(narrative) || detectPersonalName(corrective), [narrative, corrective]);
  const pick = (k: string) => (v: string) => setAnswers((prev) => ({ ...prev, [k]: v }));

  const submit = (formData: FormData) => {
    setServerError(false);
    startTransition(async () => {
      const result = await submitFacilityIncidentAction(facilityId, formData);
      if (result && 'error' in result) setServerError(true);
      else router.push(`/facilities/${facilityId}?notice=incident`);
    });
  };

  const sectionCard: React.CSSProperties = { padding: 26, border: '1px solid var(--line)', borderRadius: 14 };
  const rowsWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' };

  return (
    <form action={submit}>
      <div data-region="no-name" style={{ padding: '24px 28px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 16, marginBlockEnd: 32 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--brand)', marginBlockEnd: 10 }}>
          <L en="Before you start" ar="قبل أن تبدأ" />
        </div>
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, fontWeight: 500 }}>
          <L en={content.noPatientName.en} ar={content.noPatientName.ar} />
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div data-region="incident-info" style={sectionCard}>
          <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 600 }}>
            <L en="Incident information" ar="معلومات الحادثة" />
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
            {content.infoFields.map((f) => (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                  <L en={f.en} ar={f.ar} />
                </span>
                <input
                  name={f.key}
                  type={f.key === 'date' ? 'date' : f.key === 'time' ? 'time' : 'text'}
                  required={f.key !== 'location'}
                  style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
                />
              </label>
            ))}
          </div>
        </div>

        <div data-region="immediate-response" style={sectionCard}>
          <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 600 }}>
            <L en="Immediate response" ar="الاستجابة الفورية" />
          </h3>
          <div style={rowsWrap}>
            {content.immediateResponse.map((f) => (
              <AnswerRow key={f.key} fieldKey={f.key} en={f.en} ar={f.ar} answers={f.answers} value={answers[f.key] ?? null} onPick={pick(f.key)} />
            ))}
          </div>
        </div>

        <div data-region="ems-attendance" style={sectionCard}>
          <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 600 }}>
            <L en="EMS attendance and patient transfer" ar="حضور خدمات الطوارئ الطبية ونقل المريض" />
          </h3>
          <div style={{ ...rowsWrap, marginBlockEnd: 16 }}>
            {content.emsAttendance
              .filter((f) => f.answers !== 'text' && f.answers !== 'transport')
              .map((f) => (
                <AnswerRow key={f.key} fieldKey={f.key} en={f.en} ar={f.ar} answers={f.answers} value={answers[f.key] ?? null} onPick={pick(f.key)} />
              ))}
          </div>
          <div style={{ marginBlockEnd: 16 }}>
            <div style={{ fontSize: 14, marginBlockEnd: 8 }}>
              <L en="Patient transported by" ar="تم نقل المريض بواسطة" />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {content.transportOptions.map((o) => {
                const on = answers['transportedBy'] === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick('transportedBy')(o.key)}
                    style={{ padding: '6px 14px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'transparent', color: on ? 'var(--brand)' : 'var(--muted)', borderRadius: 16, fontSize: 13, cursor: 'pointer' }}
                  >
                    <L en={o.en} ar={o.ar} />
                  </button>
                );
              })}
              {answers['transportedBy'] ? <input type="hidden" name="transportedBy" value={answers['transportedBy']} /> : null}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                <L en="Name of EMS agency, if known" ar="اسم جهة خدمات الطوارئ الطبية، إن كان معروفاً" />
              </span>
              <input name="agencyName" style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                <L en="Receiving emergency department or hospital, if known" ar="قسم الطوارئ أو المستشفى المستقبِل، إن كان معروفاً" />
              </span>
              <input name="hospital" style={inputStyle} />
            </label>
          </div>
        </div>

        <div data-region="narrative" style={{ ...sectionCard, border: `1px solid ${flagged ? 'var(--bad)' : 'var(--line)'}` }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>
            <L en={content.narrative.titleEn} ar={content.narrative.titleAr} />
          </h3>
          <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--muted)' }}>
            <L en={content.narrative.hintEn} ar={content.narrative.hintAr} />
          </p>
          <textarea
            name="narrative"
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            rows={4}
            style={{ width: '100%', padding: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15, lineHeight: 1.6, resize: 'vertical' }}
          />
          {flagged ? (
            <div style={{ marginBlockStart: 14, padding: '14px 18px', borderInlineStart: '3px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: '0 8px 8px 0', fontSize: '14.5px', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, marginBlockEnd: 4 }}>
                <L en={content.narrative.flagTitleEn} ar={content.narrative.flagTitleAr} />
              </div>
              <div style={{ color: 'var(--muted)' }}>
                <L en={content.narrative.flagBodyEn} ar={content.narrative.flagBodyAr} />
              </div>
            </div>
          ) : null}
        </div>

        <div data-region="post-incident" style={sectionCard}>
          <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 600 }}>
            <L en="Post-incident readiness" ar="الجاهزية بعد الحادثة" />
          </h3>
          <div style={{ ...rowsWrap, marginBlockEnd: 16 }}>
            {content.postIncident.map((f) => (
              <AnswerRow key={f.key} fieldKey={f.key} en={f.en} ar={f.ar} answers={f.answers} value={answers[f.key] ?? null} onPick={pick(f.key)} />
            ))}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>
              <L en={content.correctiveField.en} ar={content.correctiveField.ar} />
            </span>
            <textarea
              name="corrective"
              value={corrective}
              onChange={(e) => setCorrective(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15, lineHeight: 1.6, resize: 'vertical' }}
            />
          </label>
        </div>

        <div data-region="submitted-by" style={sectionCard}>
          <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 600 }}>
            <L en={content.submittedBy.labelEn} ar={content.submittedBy.labelAr} />
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                <L en="Name or position" ar="الاسم أو المسمى الوظيفي" />
              </span>
              <input name="submittedByName" defaultValue={coordinatorName} required style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                <L en="Telephone" ar="رقم الهاتف" />
              </span>
              <input name="submittedByPhone" defaultValue={coordinatorPhone} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                <L en="Email" ar="البريد الإلكتروني" />
              </span>
              <input name="submittedByEmail" defaultValue={coordinatorEmail} style={inputStyle} />
            </label>
          </div>
        </div>

        {serverError ? (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--bad)' }}>
            <L
              en="Something that looks like a personal name is still in the report. Remove it and submit again."
              ar="لا يزال في التقرير ما يبدو اسماً شخصياً. أزيلوه وقدّموا مجدداً."
            />
          </p>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <button
            type="submit"
            disabled={flagged || pending}
            style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: flagged ? 'var(--surface2)' : 'var(--brand)', color: flagged ? 'var(--muted)' : 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: flagged ? 'not-allowed' : 'pointer' }}
          >
            <L en="Submit report" ar="تقديم التقرير" />
          </button>
          <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en={content.footerEn} ar={content.footerAr} />
          </span>
        </div>
      </div>
    </form>
  );
}
