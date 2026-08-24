'use client';

/**
 * Print and PDF, from the reference. The browser's print dialog serves both -- saving
 * as PDF is its built-in destination in the review build.
 */

import { L } from '../../../../components/L';

const btn: React.CSSProperties = {
  height: 44,
  paddingInline: 20,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  borderRadius: 22,
  fontSize: '14.5px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

export function PrintBar() {
  return (
    <div data-noprint="" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
      <button type="button" style={btn} onClick={() => window.print()}>
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
          <path d="M7 9.5V4.5h10v5" />
          <path d="M7 15H4.5v-5.5h15V15H17M7 13.5h10V20H7z" />
        </svg>
        <L en="Print" ar="طباعة" />
      </button>
      <button type="button" style={btn} onClick={() => window.print()}>
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
          <path d="M12 4.5v11M8.5 12l3.5 3.5 3.5-3.5" />
          <path d="M5 19.5h14" />
        </svg>
        <L en="Download as PDF" ar="تنزيل بصيغة PDF" />
      </button>
      <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
        <L en="Reissued from the record at any time. The reference number does not change." ar="يمكن إعادة إصداره من السجل في أي وقت. ولا يتغير الرقم المرجعي." />
      </span>
    </div>
  );
}
