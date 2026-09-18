'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { L } from './L';
import { acceptAttribute, refuseUpload } from '../lib/rules/uploads';

/** Validate before transmitting; the server independently enforces the same policy. */
export function UploadInput({ onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId();
  const [error, setError] = useState<{ en: string; ar: string } | null>(null);
  return <span style={{ display: 'block', minWidth: 0, maxWidth: '100%' }}>
    <input {...props} type="file" accept={acceptAttribute()} aria-describedby={error ? id : props['aria-describedby']}
      aria-invalid={error ? true : undefined} onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        const refusal = file ? refuseUpload(file) : null;
        setError(refusal);
        event.currentTarget.setCustomValidity(refusal ? (document.documentElement.lang === 'ar' ? refusal.ar : refusal.en) : '');
        if (!refusal) onChange?.(event);
      }} />
    {error ? <span id={id} role="alert" style={{ display: 'block', marginBlockStart: 8, color: 'var(--bad)', fontSize: 13 }}><L en={error.en} ar={error.ar} /></span> : null}
  </span>;
}
