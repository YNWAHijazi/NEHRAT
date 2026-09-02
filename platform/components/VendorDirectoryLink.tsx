import Link from 'next/link';
import { L } from './L';
import { ministryConfig } from '../lib/queries';
import { effectiveFlag, vendorDisclaimer } from '../lib/rules';

/**
 * The one quiet way from an operator's screen into the commercial vendor
 * directory, rendered ONLY while the capability is on -- absent otherwise,
 * never greyed, because for the operator an off directory does not exist. One
 * component so the flag is consulted in one place; the screens that need it
 * (device registry, event requirements) render this and consult nothing.
 * The disclaimer travels with the link: commercial, not Ministry endorsement.
 */
export function VendorDirectoryLink() {
  const config = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
  if (!effectiveFlag('vendorDirectory', config)) return null;
  const disclaimer = vendorDisclaimer();
  return (
    <div data-region="vendor-directory-link" style={{ padding: '13px 18px', background: 'var(--surface2)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBlockStart: 20 }}>
      <span style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
        <L en={disclaimer.en} ar={disclaimer.ar} />
      </span>
      <Link href="/vendors" style={{ height: 32, paddingInline: 14, border: '1px solid var(--line)', borderRadius: 16, background: 'var(--bg)', color: 'var(--ink)', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', flex: 'none' }}>
        <L en="Commercial vendor directory" ar="دليل المزوّدين التجاريين" />
      </Link>
    </div>
  );
}
