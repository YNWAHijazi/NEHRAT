import { L } from './L';
import { activeAdvertsFor, ministryConfig } from '../lib/queries';
import { adLabel, adPlacements, effectiveFlag } from '../lib/rules';

/**
 * THE ONLY WAY AN ADVERT RENDERS. One component, keyed by a placement that must
 * be on the structural list -- the foot of a public page, never a screen where
 * someone is filing, reviewing or reporting an incident. The guard test in
 * tests/feature-flags.test.ts pins exactly which files may mount this, so
 * putting an advert somewhere new is a code change that fails a test, not a
 * guideline someone forgot. Null while the capability is off or the placement
 * holds nothing in period; every advert carries the label, always.
 */
export function AdFooter({ placement }: { placement: string }) {
  if (!adPlacements().some((p) => p.key === placement)) {
    throw new Error(`AdFooter: "${placement}" is not on the structural placement list`);
  }
  const config = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
  if (!effectiveFlag('advertising', config)) return null;
  const adverts = activeAdvertsFor(placement);
  if (adverts.length === 0) return null;
  const label = adLabel();
  return (
    <div data-region="ad-footer" style={{ marginBlockStart: 48, paddingBlockStart: 20, borderBlockStart: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {adverts.map((ad) => (
        <div key={ad.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 640 }}>
          <span style={{ fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <L en={label.en} ar={label.ar} />
          </span>
          <a href={ad.linkUrl} rel="nofollow noopener sponsored" style={{ display: 'block' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ad.imageUrl} alt={ad.alt} style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
          </a>
        </div>
      ))}
    </div>
  );
}
