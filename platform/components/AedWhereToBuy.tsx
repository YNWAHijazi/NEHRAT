import Link from 'next/link';
import { L } from './L';
import { listedVendors, ministryConfig } from '../lib/queries';
import { effectiveFlag, vendorCategories, vendorDisclaimer } from '../lib/rules';

/**
 * WHERE TO BUY, on the device registry -- and it RESOLVES TO THE DIRECTORY,
 * never to an arbitrary external address: the only destinations this region
 * can name are listed vendors in the defibrillator categories (device supply,
 * pads and batteries) and the directory page itself. Rendered only while BOTH
 * capabilities are on -- the purchase links and the directory they resolve to;
 * either off and the region is absent, never greyed. One component, so the
 * flags are consulted in one place and the device screen consults nothing.
 */
const DEFIBRILLATOR_CATEGORIES = ['defibrillatorSupply', 'padsAndBatteries'];

export function AedWhereToBuy() {
  const config = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
  if (!effectiveFlag('aedPurchaseLinks', config) || !effectiveFlag('vendorDirectory', config)) return null;
  const vendors = listedVendors().filter((v) => DEFIBRILLATOR_CATEGORIES.includes(v.category));
  const disclaimer = vendorDisclaimer();
  return (
    <div data-region="where-to-buy" style={{ padding: '17px 21px', border: '1px solid var(--line)', borderRadius: 12, marginBlockStart: 24, maxWidth: 860 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>
          <L en="Where to buy" ar="أين يُشترى" />
        </span>
        <Link href="/vendors" style={{ fontSize: '12.5px', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 15, height: 30, paddingInline: 12, display: 'inline-flex', alignItems: 'center' }}>
          <L en="Commercial vendor directory" ar="دليل المزوّدين التجاريين" />
        </Link>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '80ch' }}>
        <L en={disclaimer.en} ar={disclaimer.ar} />
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {vendors.length === 0 ? (
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--muted)' }}>
            <L en="No vendor is listed in the device categories." ar="لا مزوّد مُدرجاً في فئات الأجهزة." />
          </p>
        ) : null}
        {vendors.map((v) => {
          const cat = vendorCategories().find((c) => c.key === v.category);
          return (
            <div key={v.id} style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
              <span>
                <L en={v.nameEn} ar={v.nameAr} />
                <span style={{ color: 'var(--muted)' }}>
                  {' '}· <L en={cat?.en ?? v.category} ar={cat?.ar ?? v.category} />
                </span>
              </span>
              <span style={{ color: 'var(--muted)' }}>{[v.area, v.contact].filter(Boolean).join(' · ') || '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
