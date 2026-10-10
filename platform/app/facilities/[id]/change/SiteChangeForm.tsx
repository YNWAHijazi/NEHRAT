'use client';

import { useState } from 'react';
import { L } from '../../../../components/L';
import { requestSiteChangeAction } from '../../../site-actions';
import { SITE_CHANGE_ASPECTS } from '../../../../lib/rules/site-changes';

/**
 * What to change and why, sent to the Ministry while it holds the registration. Send stays
 * available; until a topic is chosen and the change described, it says what is missing
 * instead of sending (the form is never cleared).
 */
export function SiteChangeForm({ facilityId }: { facilityId: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [tried, setTried] = useState(false);
  const missing = [
    ...(selected.length === 0 ? [{ key: 'aspect', en: 'Choose what needs to change.', ar: 'اختاروا ما يلزم تغييره.' }] : []),
    ...(description.trim() === '' ? [{ key: 'description', en: 'Describe the change.', ar: 'صفوا التغيير.' }] : []),
  ];
  return (
    <form
      action={requestSiteChangeAction.bind(null, facilityId)}
      onSubmit={(e) => { if (missing.length) { e.preventDefault(); setTried(true); } }}
      data-region="site-change-form"
      style={{ padding: 29, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 28 }}
    >
      <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 12 }}>
        <L en="What needs to change" ar="ما يلزم تغييره" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlockEnd: 22 }}>
        {SITE_CHANGE_ASPECTS.map((a) => {
          const on = selected.includes(a.key);
          return (
            <button
              key={a.key}
              type="button"
              aria-pressed={on}
              data-aspect={a.key}
              onClick={() => setSelected((prev) => (on ? prev.filter((k) => k !== a.key) : [...prev, a.key]))}
              style={{ minHeight: 44, paddingInline: 15, border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', color: on ? 'var(--brand)' : 'var(--ink)', borderRadius: 22, fontSize: 14, cursor: 'pointer' }}
            >
              <L en={a.en} ar={a.ar} />
            </button>
          );
        })}
      </div>
      {selected.map((k) => <input key={k} type="hidden" name="aspect" value={k} />)}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlockEnd: 20 }}>
        <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
          <L en="Describe the change and why it is needed" ar="صفوا التغيير وسببه" />
        </span>
        <textarea
          name="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: '100%', padding: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15, lineHeight: 1.6, resize: 'vertical' }}
        />
      </label>
      <button type="submit" data-region="send-change-request" style={{ minHeight: 46, paddingInline: 24, border: 0, borderRadius: 23, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
        <L en="Send the request to the Ministry" ar="إرسال الطلب إلى الوزارة" />
      </button>
      {tried && missing.length ? (
        <ul role="alert" data-region="change-request-missing" style={{ margin: '12px 0 0', paddingInlineStart: 20, fontSize: 14, color: 'var(--bad)', lineHeight: 1.6 }}>
          {missing.map((m) => <li key={m.key} data-missing={m.key}><L en={m.en} ar={m.ar} /></li>)}
        </ul>
      ) : null}
    </form>
  );
}
