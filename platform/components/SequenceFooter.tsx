/**
 * The sequence footer: what every screen owes the user (ROADMAP 7). Names where the
 * screen leads next, with a short line on what each destination is for. This is product
 * navigation -- the tab strip is not built.
 */

import Link from 'next/link';
import { L } from './L';

export interface SequenceStep {
  href: string;
  en: string;
  ar: string;
  descEn: string;
  descAr: string;
  primary?: boolean;
}

export function SequenceFooter({
  labelEn,
  labelAr,
  steps,
}: {
  labelEn: string;
  labelAr: string;
  steps: readonly SequenceStep[];
}) {
  if (steps.length === 0) return null;
  return (
    <div
      data-seq=""
      style={{
        marginBlockStart: 64,
        paddingBlockStart: 32,
        borderBlockStart: '1px solid var(--line)',
      }}
    >
      <div
        style={{
          fontSize: '11.5px',
          letterSpacing: '.07em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBlockEnd: 16,
        }}
      >
        <L en={labelEn} ar={labelAr} />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))',
          gap: 12,
        }}
      >
        {steps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            style={{
              textAlign: 'start',
              padding: '22px 24px',
              background: step.primary ? 'var(--brand-soft)' : 'var(--surface)',
              border: `1px solid ${step.primary ? 'var(--brand)' : 'var(--line)'}`,
              borderRadius: 14,
              display: 'flex',
              gap: 14,
              alignItems: 'start',
              color: step.primary ? 'var(--brand)' : 'var(--ink)',
            }}
          >
            <svg
              aria-hidden="true"
              data-flip=""
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flex: 'none', marginBlockStart: 2 }}
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <span>
              <span
                style={{
                  display: 'block',
                  fontSize: 16,
                  fontWeight: 500,
                  lineHeight: 1.4,
                }}
              >
                <L en={step.en} ar={step.ar} />
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '13.5px',
                  lineHeight: 1.6,
                  color: 'var(--muted)',
                  marginBlockStart: 5,
                }}
              >
                <L en={step.descEn} ar={step.descAr} />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
