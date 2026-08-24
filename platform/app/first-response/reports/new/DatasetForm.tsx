'use client';

/**
 * The five dataset sections with the two submission routes. On the attach route each
 * section can be marked as covered by the attached patient-care report; anything not
 * covered is completed here. Field kinds come from the dataset's own answer sets --
 * the onsite device (section C rows 1-3) is distinguished from the unit's own
 * (rows 4-5) by the dataset itself.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../../components/L';
import { submitFrReportAction } from '../../../actions';
import { ROLES_CONTENT } from '../../../../lib/rules';

const inputStyle: React.CSSProperties = {
  height: 42,
  paddingInline: 13,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: '14.5px',
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
};

export function DatasetForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const content = ROLES_CONTENT.firstResponse;
  const [route, setRoute] = useState<'platform' | 'attach'>('platform');
  const [attachedFile, setAttachedFile] = useState('');
  const [covered, setCovered] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: string) => (v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const submit = () => {
    setError(false);
    startTransition(async () => {
      const result = await submitFrReportAction({
        mode: route,
        attachedFile: route === 'attach' ? attachedFile || null : null,
        covered: route === 'attach' ? covered : {},
        values,
      });
      if ('ok' in result) {
        setDone(true);
        router.push('/first-response/readiness?notice=reported');
      } else {
        setError(true);
      }
    });
  };

  return (
    <div>
      <div data-region="routes" style={{ padding: '24px 28px', border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 16 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 12 }}>
          <L en="How to submit" ar="كيفية التقديم" />
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.7 }}>
          <L en={content.attachRoute.en} ar={content.attachRoute.ar} />
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {content.routes.map((r) => {
            const on = route === r.key;
            return (
              <button
                key={r.key}
                type="button"
                aria-pressed={on}
                onClick={() => setRoute(r.key as 'platform' | 'attach')}
                style={{ height: 42, paddingInline: 20, border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', color: on ? 'var(--brand)' : 'var(--ink)', borderRadius: 22, fontSize: 14, cursor: 'pointer' }}
              >
                <L en={r.en} ar={r.ar} />
              </button>
            );
          })}
        </div>
      </div>

      {route === 'attach' ? (
        <div data-region="attach" style={{ padding: '26px 30px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'end', marginBlockEnd: 18 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 260 }}>
              <span style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                <L en="Attached report" ar="التقرير المرفق" />
              </span>
              <input
                value={attachedFile}
                onChange={(e) => setAttachedFile(e.target.value)}
                placeholder="unit3-pcr-2026-0841.pdf"
                style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
              />
            </label>
          </div>
          <div style={{ fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
            <L en={content.attachCoverage.en} ar={content.attachCoverage.ar} />
          </div>
        </div>
      ) : null}

      <div data-region="sections" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {content.datasetSections.map((s, si) => {
          const isCovered = route === 'attach' && Boolean(covered[s.key]);
          return (
            <div key={s.key} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderInlineStart: '3px solid var(--brand)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ display: 'flex', gap: 14, alignItems: 'baseline', flex: 1, minWidth: 240 }}>
                  <span style={{ flex: 'none', fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 16 }}>{si + 1}</span>
                  <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.015em' }}>
                    <L en={s.en} ar={s.ar} />
                  </span>
                </span>
                {route === 'attach' ? (
                  <button
                    type="button"
                    aria-pressed={isCovered}
                    onClick={() => setCovered((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                    style={{ flex: 'none', height: 34, paddingInline: 14, border: `1px solid ${isCovered ? 'var(--brand)' : 'var(--line)'}`, background: isCovered ? 'var(--brand-soft)' : 'var(--bg)', color: isCovered ? 'var(--brand)' : 'var(--ink)', borderRadius: 17, fontSize: 13, cursor: 'pointer' }}
                  >
                    <L en={content.coveredChip.en} ar={content.coveredChip.ar} />
                  </button>
                ) : null}
              </div>
              {!isCovered ? (
                <div style={{ padding: '0 24px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                  {s.fields.map((f) => {
                    const key = `${s.key}.${f.key}`;
                    if (f.kind === 'ageGroup') {
                      return (
                        <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
                            <L en={f.en} ar={f.ar} />
                          </span>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {content.ageGroups.map((g) => {
                              const on = values[key] === g.key;
                              return (
                                <button
                                  key={g.key}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => set(key)(g.key)}
                                  style={{ padding: '6px 14px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'transparent', color: on ? 'var(--brand)' : 'var(--muted)', borderRadius: 16, fontSize: 13, cursor: 'pointer' }}
                                >
                                  <L en={g.en} ar={g.ar} />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    if (f.kind in ANSWER_SETS) {
                      const opts = ANSWER_SETS[f.kind] ?? [];
                      return (
                        <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
                            <L en={f.en} ar={f.ar} />
                          </span>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {opts.map((o) => {
                              const on = values[key] === o.k;
                              return (
                                <button
                                  key={o.k}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => set(key)(o.k)}
                                  style={{ padding: '6px 12px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'transparent', color: on ? 'var(--brand)' : 'var(--muted)', borderRadius: 14, fontSize: 13, cursor: 'pointer' }}
                                >
                                  <L en={o.en} ar={o.ar} />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
                          <L en={f.en} ar={f.ar} />
                        </span>
                        <input
                          type={f.kind === 'date' ? 'date' : f.kind === 'time' ? 'time' : 'text'}
                          value={values[key] ?? ''}
                          onChange={(e) => set(key)(e.target.value)}
                          style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
                        />
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? (
        <p style={{ margin: '16px 0 0', fontSize: 14, color: 'var(--bad)' }}>
          <L en="The attach route needs the attached report's file name." ar="مسار الإرفاق يحتاج اسم ملف التقرير المرفق." />
        </p>
      ) : null}
      <div style={{ marginBlockStart: 20 }}>
        <button
          type="button"
          onClick={submit}
          disabled={pending || done}
          style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
        >
          <L en="Submit the report" ar="تقديم التقرير" />
        </button>
      </div>
    </div>
  );
}
