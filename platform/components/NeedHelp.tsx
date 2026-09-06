import Link from 'next/link';
import { L } from './L';

/**
 * THE ONE WAY TO THE REFERENCE PAGE (fields-only ruling, 2026-09-04): a quiet
 * footer link on every page, so no form carries its own guidance. Mounted once,
 * in the root layout.
 */
export function NeedHelp() {
  return (
    <div data-region="need-help" data-noprint="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '8px 32px 28px' }}>
      <Link href="/help" style={{ fontSize: '12.5px', color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
        <L en="Need help?" ar="تحتاجون مساعدة؟" />
      </Link>
    </div>
  );
}
