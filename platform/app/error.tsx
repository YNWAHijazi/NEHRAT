'use client';

import Link from 'next/link';
import { L } from '../components/L';

/** Unexpected failures keep a recovery route; internal error details stay server-side. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main data-pad="" style={{ maxWidth: 640, marginInline: 'auto', padding: '80px 32px' }}>
    <h1 style={{ fontSize: 28 }}><L en="This page could not be loaded" ar="تعذّر تحميل هذه الصفحة" /></h1>
    <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}><L en="Try again. If you were saving a change, check the record before submitting it again." ar="حاولوا مجدداً. إذا كنتم تحفظون تغييراً، تحقّقوا من السجل قبل إعادة تقديمه." /></p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
      <button type="button" onClick={reset} style={{ padding: '12px 20px', border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', cursor: 'pointer' }}><L en="Try again" ar="المحاولة مجدداً" /></button>
      <Link href="/dashboard"><L en="Dashboard" ar="اللوحة" /></Link>
      <Link href="/help"><L en="Contact support" ar="التواصل مع الدعم" /></Link>
    </div>
  </main>;
}
