'use client';
import { L } from './L';

export type SubmissionCheck = { key: string; en: string; ar: string; done: boolean; href: string };
export function SubmissionChecklist({ required, optional }: { required: SubmissionCheck[]; optional: SubmissionCheck[] }) {
  return <div data-region="submission-checklist">
    {[{ key: 'required', en: 'Required', ar: 'مطلوب', rows: required }, { key: 'optional', en: 'Optional', ar: 'اختياري', rows: optional }].map(group => group.rows.length ? <section key={group.key} data-checklist={group.key} style={{ marginBlockEnd: 24 }}>
      <h2 style={{ fontSize: 20, marginBlock: '0 12px' }}><L en={group.en} ar={group.ar} /></h2>
      {group.key === 'optional' ? <p style={{ marginBlock: '0 12px', color: 'var(--muted)', fontSize: 14 }}><L en="These do not hold up your submission." ar="هذه البنود لا تمنع تقديم طلبك." /></p> : null}
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {group.rows.map(row => <a key={row.key} data-check={row.key} href={row.href} style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', color: 'var(--ink)', background: 'var(--bg)', borderBlockEnd: '1px solid var(--line)', borderInlineStart: `3px solid ${row.done ? 'var(--brand)' : group.key === 'required' ? 'var(--accent-ink)' : 'var(--line)'}` }}>
          <span><L en={row.en} ar={row.ar} /></span>
          <span style={{ flexShrink: 0, fontSize: 13, color: row.done ? 'var(--brand)' : group.key === 'required' ? 'var(--accent-ink)' : 'var(--muted)' }}><L en={row.done ? 'Complete' : group.key === 'required' ? 'Pending' : 'Not added'} ar={row.done ? 'مكتمل' : group.key === 'required' ? 'قيد الانتظار' : 'غير مضاف'} /></span>
        </a>)}
      </div>
    </section> : null)}
  </div>;
}
