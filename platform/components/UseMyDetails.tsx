'use client';

import { L } from './L';

/**
 * "Use my details": fills a contact block with the signed-in person's own name and
 * telephone, for when someone else's were typed there first. Shown only when the account
 * holds something to fill and the block does not already say it.
 */
export function UseMyDetails({ onUse, disabled = false }: { onUse: () => void; disabled?: boolean }) {
  return (
    <button type="button" data-region="use-my-details" onClick={onUse} disabled={disabled}
      style={{ border: 0, background: 'transparent', padding: 0, minHeight: 32, color: 'var(--brand)', fontSize: '13.5px', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', justifySelf: 'start' }}>
      <L en="Use my details" ar="استخدام بياناتي" />
    </button>
  );
}
