import { notFound } from 'next/navigation';
import { L } from '../../components/L';
import { PublicShell } from '../../components/PublicShell';
import { currentAccount } from '../../lib/auth';
import { listedVendors, ministryConfig, sponsoredVendorIds } from '../../lib/queries';
import { effectiveFlag, vendorCategories, vendorDisclaimer } from '../../lib/rules';

/**
 * THE PUBLIC VENDOR DIRECTORY -- capability content, so the whole route answers
 * not-found while the capability is off: for the public, an off directory does
 * not exist (absent, never greyed). Vendors are added by the administrator,
 * never self-registered, and every listing carries the disclaimer: listing is
 * commercial and is not Ministry endorsement.
 */
export default async function VendorDirectoryPage() {
  const config = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
  if (!effectiveFlag('vendorDirectory', config)) notFound();
  const account = await currentAccount();
  const vendors = listedVendors();
  const disclaimer = vendorDisclaimer();
  // Sponsored positions: top of the category and labelled, wherever the row
  // appears, always -- and only while THAT capability is on. Off, the directory
  // renders plain and no position is held.
  const sponsored = effectiveFlag('sponsoredListings', config) ? sponsoredVendorIds() : new Set<number>();

  return (
    <PublicShell signedIn={account !== null}>
      <h1 data-sec-h1="" data-region="vendor-directory" style={{ margin: '10px 0 12px', fontSize: 34, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Commercial vendor directory" ar="دليل المزوّدين التجاريين" />
      </h1>
      <p data-region="vendor-disclaimer" style={{ margin: '0 0 28px', fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '74ch' }}>
        <L en={disclaimer.en} ar={disclaimer.ar} />
      </p>

      {vendorCategories().map((cat) => {
        const inCategory = vendors
          .filter((v) => v.category === cat.key)
          .sort((a, b) => Number(sponsored.has(b.id)) - Number(sponsored.has(a.id)));
        if (inCategory.length === 0) return null;
        return (
          <div key={cat.key} data-region={`vendors-${cat.key}`} style={{ marginBlockEnd: 28 }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>
              <L en={cat.en} ar={cat.ar} />
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              {inCategory.map((v) => (
                <div key={v.id} style={{ background: 'var(--bg)', padding: '15px 19px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '15px', fontWeight: 500, display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <L en={v.nameEn} ar={v.nameAr} />
                    {sponsored.has(v.id) ? (
                      <span data-sponsored="" style={{ padding: '2px 9px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                        <L en="Sponsored" ar="مموَّل" />
                      </span>
                    ) : null}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    {[v.area, v.contact].filter(Boolean).join(' · ') || '—'}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              <L en={disclaimer.en} ar={disclaimer.ar} />
            </p>
          </div>
        );
      })}

      {vendors.length === 0 ? (
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
          <L en="No vendor is listed." ar="لا مزوّد مُدرجاً." />
        </p>
      ) : null}
    </PublicShell>
  );
}
