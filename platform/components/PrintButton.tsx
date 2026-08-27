'use client';

import { L } from './L';

/**
 * Print the current page. The print stylesheet already strips chrome
 * ([data-noprint], the sequence footer); this button is itself excluded.
 */
export function PrintButton({ en, ar }: { en: string; ar: string }) {
  return (
    <button
      type="button"
      data-noprint=""
      onClick={() => window.print()}
      style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'none', borderRadius: 19, fontSize: '13.5px', cursor: 'pointer' }}
    >
      <L en={en} ar={ar} />
    </button>
  );
}
