'use client';

import { L } from './L';

/**
 * Print, or save as PDF through the browser's own print dialogue.
 *
 * NO PDF LIBRARY. Every browser's print dialogue offers "Save as PDF", produces a
 * document with the page's own typography and the reader's own paper size, and needs
 * nothing on the server. Generating a PDF ourselves would mean a second rendering of
 * the same certificate that could disagree with the first -- and the two disagreeing
 * about a regulatory determination is a worse failure than not having the button.
 *
 * The control hides itself when printing, so it never appears on the paper.
 */
export function PrintButton({ en, ar }: { en: string; ar: string }): React.ReactElement {
  return (
    <button
      type="button"
      data-no-print=""
      onClick={() => window.print()}
      style={{ height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
    >
      <L en={en} ar={ar} />
    </button>
  );
}
