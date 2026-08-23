import Link from 'next/link';
import { L } from '../components/L';

/**
 * The uniform absence. A record that does not exist and a record that belongs to another
 * account both land here, indistinguishably.
 */
export default function NotFound() {
  return (
    <main data-pad="" style={{ maxWidth: 640, marginInline: 'auto', padding: '80px 32px' }}>
      <h1 style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 600, letterSpacing: '-.025em' }}>
        <L en="There is no record here" ar="لا يوجد سجل هنا" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 15, lineHeight: 1.65, color: 'var(--muted)' }}>
        <L
          en="The address does not correspond to a record on this account."
          ar="لا يقابل هذا العنوان أي سجل على هذا الحساب."
        />
      </p>
      <Link href="/dashboard" style={{ fontSize: 15, borderBlockEnd: '1px solid var(--brand)', paddingBlockEnd: 2 }}>
        <L en="Dashboard" ar="اللوحة" />
      </Link>
    </main>
  );
}
