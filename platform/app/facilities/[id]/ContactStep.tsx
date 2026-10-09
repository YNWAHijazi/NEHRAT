'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../components/L';
import { InfoNote } from '../../../components/InfoNote';
import { PhoneInput } from '../../../components/PhoneInput';
import { UseMyDetails } from '../../../components/UseMyDetails';
import { registerAutosave } from '../../../components/record/autosave';
import { saveFacilityContactStepAction } from '../../actions';
import { FACILITY_CONTENT } from '../../../lib/rules';

const inputStyle: React.CSSProperties = { width: '100%', minHeight: 44, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 15 };

interface Contact { name: string; phone: string; email: string }

/**
 * The responsible-contact step of the facility record: the one person or position, with a
 * telephone and an email (partner audit, 2026-10-08). Saved with its own button, and on
 * Next or Previous when changed (components/record/autosave.ts); a refused save keeps the
 * person on the step with the reason.
 */
export function ContactStep({ facilityId, initial, me }: { facilityId: string; initial: Contact; me: Contact | null }) {
  const content = FACILITY_CONTENT;
  const router = useRouter();
  const [values, setValues] = useState<Contact>(initial);
  const [status, setStatus] = useState<'idle' | 'saved' | 'invalid'>('idle');
  const [pending, start] = useTransition();

  const root = useRef<HTMLDivElement>(null);
  const valuesRef = useRef(values); valuesRef.current = values;
  const savedRef = useRef(JSON.stringify(initial));
  const send = async (): Promise<boolean> => {
    const v = valuesRef.current;
    const data = new FormData();
    data.set('coordinatorName', v.name); data.set('coordinatorPhone', v.phone); data.set('coordinatorEmail', v.email);
    const result = await saveFacilityContactStepAction(facilityId, data);
    if ('ok' in result) { savedRef.current = JSON.stringify(v); setStatus('saved'); router.refresh(); return true; }
    setStatus('invalid');
    return false;
  };
  const sendRef = useRef(send); sendRef.current = send;
  useEffect(() => {
    if (!root.current) return;
    return registerAutosave(root.current, async () => (JSON.stringify(valuesRef.current) === savedRef.current ? true : sendRef.current()));
  }, []);

  const set = (key: keyof Contact, v: string) => { setStatus('idle'); setValues((prev) => ({ ...prev, [key]: v })); };
  const invalid = (key: keyof Contact) => status === 'invalid' && !values[key].trim();
  const field = (f: (typeof content.personFields)[number]) => {
    const key: keyof Contact = f.key === 'nameOrPosition' ? 'name' : f.key === 'phone' ? 'phone' : 'email';
    const name = key === 'name' ? 'coordinatorName' : key === 'phone' ? 'coordinatorPhone' : 'coordinatorEmail';
    return (
      <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en={f.en} ar={f.ar} /></span>
        {key === 'phone' ? (
          <PhoneInput name={name} value={values.phone} onChange={(v) => set('phone', v)} required invalid={invalid('phone')} />
        ) : (
          <input name={name} value={values[key]} onChange={(e) => set(key, e.target.value)} required type={key === 'email' ? 'email' : 'text'} dir={key === 'email' ? 'ltr' : undefined}
            aria-invalid={invalid(key) || undefined} style={invalid(key) ? { ...inputStyle, border: '1px solid var(--bad)' } : inputStyle} />
        )}
      </label>
    );
  };

  return (
    <div ref={root} data-region="responsible-contact">
      <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600 }}>
        <L en={content.persons[0]!.en} ar={content.persons[0]!.ar} /> <InfoNote><L en={content.coordinatorOneRecord.en} ar={content.coordinatorOneRecord.ar} /></InfoNote>
      </h3>
      <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: 'var(--muted)' }}><L en={content.persons[0]!.noteEn} ar={content.persons[0]!.noteAr} /></p>
      <form onSubmit={(e) => { e.preventDefault(); setStatus('idle'); start(async () => { await send(); }); }} noValidate style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 16 }}>
          {content.personFields.map(field)}
        </div>
        {me && (me.name || me.phone || me.email) && (values.name !== me.name || values.phone !== me.phone || values.email !== me.email) ? (
          <UseMyDetails onUse={() => { setStatus('idle'); setValues((v) => ({ name: me.name || v.name, phone: me.phone || v.phone, email: me.email || v.email })); }} />
        ) : null}
        {status === 'saved' ? <p role="status" style={{ margin: 0, fontSize: '13.5px', color: 'var(--success)' }}><L en="The responsible facility contact has been recorded." ar="سُجِّلت جهة الاتصال المسؤولة في المنشأة." /></p> : null}
        {status === 'invalid' ? <p role="alert" style={{ margin: 0, fontSize: '13.5px', color: 'var(--bad)' }}><L en="Enter the responsible contact’s name or position, telephone and email." ar="أدخلوا اسم جهة الاتصال المسؤولة أو مسماها الوظيفي ورقم الهاتف والبريد الإلكتروني." /></p> : null}
        <button type="submit" disabled={pending} style={{ justifySelf: 'start', minHeight: 44, padding: '10px 22px', border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}>
          <L en="Save responsible contact" ar="حفظ جهة الاتصال المسؤولة" />
        </button>
      </form>
    </div>
  );
}
