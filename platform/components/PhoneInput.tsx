'use client';

import { useState } from 'react';
import { OptionText, useDocumentLang } from './OptionText';
import { COUNTRY_CODES, joinPhone, splitPhone } from '../lib/phone';

/**
 * One telephone field: the country code chosen from a list (Lebanon first), the number
 * typed beside it. The form receives one value under `name`, "+961 3 123 456", from a
 * hidden input -- every server check that reads a telephone reads the same string as
 * before. Controlled (value + onChange) or uncontrolled (defaultValue) like an <input>.
 */
export function PhoneInput({ name, value, defaultValue = '', onChange, required = false, disabled = false, invalid = false, id, style, inputName }: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  style?: React.CSSProperties;
  /** The visible number box's name; by default `${name}Number`, so it never shadows the stored value. */
  inputName?: string;
}) {
  const lang = useDocumentLang();
  // The boxes keep what the person typed (a leading 0 stays on screen); only the stored value is normalised.
  const [parts, setParts] = useState(() => splitPhone(value ?? defaultValue));
  // A parent that sets a different value (Use my details) replaces what the boxes show.
  const [seen, setSeen] = useState(value);
  if (value !== undefined && value !== seen) {
    setSeen(value);
    if (value !== joinPhone(parts.code, parts.national)) setParts(value === '' ? { code: parts.code, national: '' } : splitPhone(value));
  }
  const set = (codeIn: string, nationalIn: string) => {
    // A whole international number typed or pasted into the number box picks its own code.
    const { code, national } = /^\s*(\+|00)/.test(nationalIn) ? splitPhone(nationalIn) : { code: codeIn, national: nationalIn };
    setParts({ code, national });
    const joined = joinPhone(code, national);
    setSeen(joined);
    onChange?.(joined);
  };
  const border = invalid ? '1px solid var(--bad)' : '1px solid var(--line)';
  const box: React.CSSProperties = { height: 44, background: 'var(--bg)', border, fontSize: 15, color: 'var(--ink)' };
  return (
    <span data-phone="" dir="ltr" style={{ display: 'flex', gap: 0, minWidth: 0, ...style }}>
      {name ? <input type="hidden" name={name} value={joinPhone(parts.code, parts.national)} /> : null}
      <select aria-label={lang === 'ar' ? 'رمز البلد' : 'Country code'} value={parts.code} disabled={disabled} onChange={(e) => set(e.target.value, parts.national)}
        data-phone-code=""
        style={{ ...box, flex: 'none', maxInlineSize: '7.5em', paddingInline: '8px 4px', borderStartStartRadius: 8, borderEndStartRadius: 8, borderStartEndRadius: 0, borderEndEndRadius: 0, borderInlineEnd: 0 }}>
        {COUNTRY_CODES.map((c) => (
          <option key={c.iso} value={c.code}><OptionText en={`${c.code} ${c.en}`} ar={`${c.code} ${c.ar}`} /></option>
        ))}
      </select>
      <input id={id} name={inputName ?? (name ? `${name}Number` : undefined)} type="tel" aria-label={lang === 'ar' ? 'رقم الهاتف' : 'Phone number'} inputMode="tel" autoComplete="tel-national" value={parts.national} required={required} disabled={disabled}
        aria-invalid={invalid || undefined} data-phone-number=""
        onChange={(e) => set(parts.code, e.target.value)}
        style={{ ...box, flex: 1, minWidth: 0, paddingInline: 12, borderStartStartRadius: 0, borderEndStartRadius: 0, borderStartEndRadius: 8, borderEndEndRadius: 8 }} />
    </span>
  );
}
