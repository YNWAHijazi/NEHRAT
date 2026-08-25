import { L } from './L';

/**
 * A recorded EN/AR divergence, shown where the requirement is read.
 *
 * The source-documents README records eight (now nine) places where the English and
 * Arabic issues of an instrument say different things. Each was flagged in the data
 * and, until now, rendered nowhere -- so an organizer reading the Arabic issue's
 * stronger obligation had no way to learn the build follows the English. The rule
 * (CLAUDE.md): follow the English and REPORT the disagreement, never silently
 * reconcile it. This is the reporting.
 */
export function SourceDivergence({ en, ar }: { en: string; ar: string }) {
  return (
    <span
      data-divergence=""
      style={{
        display: 'block',
        marginBlockStart: 8,
        paddingInlineStart: 10,
        borderInlineStart: '2px solid var(--accent)',
        fontSize: '12.5px',
        lineHeight: 1.6,
        color: 'var(--muted)',
        maxWidth: '78ch',
      }}
    >
      <span style={{ display: 'block', fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 2 }}>
        <L en="The two issues differ here" ar="يختلف الإصداران هنا" />
      </span>
      <L en={en} ar={ar} />
    </span>
  );
}
