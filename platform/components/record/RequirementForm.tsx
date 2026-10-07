'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../L';
import { LangInput } from '../OptionText';
import { saveRequirementAnswerAction } from '../../app/record-actions';
import { REQUIREMENT_COPY, type AnswerValue, type FieldDef, type RecordService, type RequirementInstance } from '../../lib/rules';
import { fieldInput, primaryButton } from '../workspace-styles';

/**
 * The short form on one requirement card: the catalogue's fields with the right
 * control each (brief item 14), one Save, and the version the answer was read at. A
 * stale save comes back as a conflict and says so; it never overwrites.
 */
export function RequirementForm({ kind, id, instance, canEdit }: { kind: RecordService; id: string; instance: RequirementInstance; canEdit: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, AnswerValue>>({ ...instance.values });
  const [status, setStatus] = useState<'idle' | 'saved' | 'conflict' | 'invalid' | 'error'>('idle');
  const [refused, setRefused] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const baseVersion = instance.answeredBy?.version ?? 0;
  // A newer answer arriving from the server (after "Show the newer answer", or after this
  // form's own save) replaces what the form holds: the version is what the next save is read at.
  useEffect(() => { setValues({ ...instance.values }); setRefused([]); }, [baseVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = (f: FieldDef) => !f.showWhen || values[f.showWhen.field] === f.showWhen.equals;
  const missing = new Set(instance.missing);

  const save = () => {
    setStatus('idle');
    start(async () => {
      const result = await saveRequirementAnswerAction(kind, id, instance.key, { baseVersion, values });
      if ('ok' in result) { setStatus('saved'); setRefused([]); router.refresh(); }
      else if (result.error === 'conflict') setStatus('conflict');
      else if (result.error === 'invalid') { setStatus('invalid'); setRefused(result.fields ?? []); }
      else setStatus('error');
    });
  };

  const set = (key: string, v: AnswerValue) => setValues((prev) => ({ ...prev, [key]: v }));

  return (
    <div data-region="requirement-form" data-key={instance.key}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '14px 20px' }}>
        {instance.fields.filter(visible).map((f) => {
          const invalid = (!canEdit ? false : missing.has(f.key) && status !== 'idle') || refused.includes(f.key);
          const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, gridColumn: f.type === 'textarea' || f.type === 'checkbox' || f.type === 'choice' ? '1 / -1' : undefined };
          if (f.type === 'checkbox') {
            const on = values[f.key] === true;
            return (
              <label key={f.key} style={{ ...labelStyle, flexDirection: 'row', alignItems: 'start', gap: 12, cursor: canEdit ? 'pointer' : 'default', minHeight: 44 }}>
                <input type="checkbox" name={f.key} checked={on} disabled={!canEdit} onChange={() => set(f.key, !on)} style={{ flex: 'none', width: 20, height: 20, marginBlockStart: 2, accentColor: 'var(--brand)' }} />
                <span style={{ fontSize: 15, lineHeight: 1.55 }}><L en={f.labelEn} ar={f.labelAr} /></span>
              </label>
            );
          }
          if (f.type === 'choice') {
            const current = typeof values[f.key] === 'string' ? values[f.key] : '';
            return (
              <fieldset key={f.key} style={{ ...labelStyle, border: 0, padding: 0, margin: 0 }}>
                <legend style={{ fontSize: '14.5px', color: 'var(--muted)', padding: 0, marginBlockEnd: 8 }}><L en={f.labelEn} ar={f.labelAr} /></legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(f.options ?? []).map((o) => {
                    const on = current === o.value;
                    return (
                      <button key={o.value} type="button" data-choice={o.value} aria-pressed={on} disabled={!canEdit} onClick={() => set(f.key, o.value)}
                        style={{ minHeight: 44, paddingInline: 18, border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', color: on ? 'var(--brand)' : 'var(--ink)', borderRadius: 22, fontSize: 14.5, cursor: canEdit ? 'pointer' : 'default' }}>
                        <L en={o.en} ar={o.ar} />
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          }
          const common = {
            name: f.key, disabled: !canEdit, 'aria-invalid': invalid || undefined,
            style: { ...fieldInput, ...(invalid ? { border: '1px solid var(--bad)' } : {}) },
          };
          return (
            <label key={f.key} style={labelStyle}>
              <span style={{ fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.45 }}><L en={f.labelEn} ar={f.labelAr} /></span>
              {f.type === 'textarea' ? (
                <textarea {...common} rows={3} value={String(values[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} style={{ ...common.style, minHeight: 88, resize: 'vertical' }} />
              ) : f.type === 'number' ? (
                <input {...common} type="number" min={0} inputMode="numeric" value={values[f.key] === undefined ? '' : String(values[f.key])} onChange={(e) => set(f.key, e.target.value === '' ? '' : Number(e.target.value))} />
              ) : f.type === 'date' ? (
                <input {...common} type="date" value={String(values[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <LangInput {...common} type="text" value={String(values[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)}
                  placeholderEn={f.placeholderEn ?? ''} placeholderAr={f.placeholderAr ?? ''} labelEn={f.labelEn} labelAr={f.labelAr} />
              )}
            </label>
          );
        })}
      </div>
      {canEdit ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginBlockStart: 18 }}>
          <button type="button" onClick={save} disabled={pending} style={primaryButton}><L en="Save" ar="حفظ" /></button>
          <span role="status" aria-live="polite" style={{ fontSize: '13.5px', color: status === 'saved' ? 'var(--success)' : status === 'idle' ? 'var(--muted)' : 'var(--bad)' }}>
            {status === 'saved' ? <L en="Saved." ar="حُفظ." /> : null}
            {status === 'conflict' ? (
              <>
                <L en={REQUIREMENT_COPY.conflictEn} ar={REQUIREMENT_COPY.conflictAr} />{' '}
                <button type="button" onClick={() => router.refresh()} style={{ border: 0, background: 'transparent', color: 'var(--brand)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 }}>
                  <L en="Show the newer answer" ar="عرض الإجابة الأحدث" />
                </button>
              </>
            ) : null}
            {status === 'invalid' ? <L en="A value was refused. Check the marked fields." ar="رُفضت قيمة. راجعوا الحقول المعلّمة." /> : null}
            {status === 'error' ? <L en="The answer could not be saved." ar="تعذّر حفظ الإجابة." /> : null}
          </span>
        </div>
      ) : null}
      {instance.answeredBy ? (
        <div data-region="answered-by" style={{ marginBlockStart: 12, fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
          <L
            en={fillCopy(REQUIREMENT_COPY.answeredByEn, instance.answeredBy, 'en')}
            ar={fillCopy(REQUIREMENT_COPY.answeredByAr, instance.answeredBy, 'ar')}
          />
        </div>
      ) : null}
    </div>
  );
}

function fillCopy(template: string, by: { role: string; name: string; at: string; version: number }, lang: 'en' | 'ar'): string {
  const role = { organizer: ['Organizer', 'المنظّم'], ems: ['EMS agency', 'جهة الإسعاف'], director: ['Medical Director', 'المدير الطبي'] }[by.role] ?? [by.role, by.role];
  return template.replace('{name}', by.name).replace('{role}', role[lang === 'en' ? 0 : 1]!).replace('{date}', by.at.slice(0, 10)).replace('{version}', String(by.version));
}
