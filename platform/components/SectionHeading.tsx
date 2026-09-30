import { L } from './L';
import { InfoNote } from './InfoNote';

/** Number each preparation section, including the optional Medical Director. */
export function SectionHeading({ n, en, ar, help }: { n?: number; en: string; ar: string; help?: React.ReactNode }) {
  // FIELDS ONLY (partner ruling, 2026-09-04): the group heading is structure;
  // the explanatory note under it was guidance and left for the reference page.
  return (
    <h2 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em', display: 'flex', gap: 14, alignItems: 'baseline' }}>
      <span style={{ flex: 'none', fontSize: 16, fontWeight: 500, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }} aria-hidden={n === undefined}>{n}</span>
      <span>
        <L en={en} ar={ar} /> {help ? <InfoNote>{help}</InfoNote> : null}
      </span>
    </h2>
  );
}
