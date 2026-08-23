import Link from 'next/link';

/**
 * A build-stage interstitial for routes whose slice has not been built.
 *
 * Deliberately NOT styled as a product state and NOT bilingual product copy: "not built
 * yet" is neither a disabled-with-reason gate nor an absence (non-negotiable #10), so it
 * must not borrow either treatment. This page is developer communication, marked as
 * such, and disappears as slices land.
 */
export function DevInterstitial({ slice }: { slice: string }) {
  return (
    <main data-dev-only="" style={{ maxWidth: 640, marginInline: 'auto', padding: '80px 32px' }}>
      <p style={{ padding: '18px 22px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, lineHeight: 1.7, color: 'var(--muted)' }}>
        Build note: this screen belongs to {slice} and is not part of this review build.
        It is listed here so navigation does not dead-end; it carries no product state.
      </p>
      <p style={{ fontSize: 14 }}>
        <Link href="/dashboard">Return to the dashboard</Link>
      </p>
    </main>
  );
}
