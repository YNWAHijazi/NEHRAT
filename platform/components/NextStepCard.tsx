import Link from 'next/link';
import { L } from './L';
import { InfoNote } from './InfoNote';
import type { NextStep } from '../lib/rules/rail';

/**
 * The one task a workspace overview leads with. The step itself comes from
 * lib/rules (events: nextAction; venues: venueNextAction); this only draws it.
 */
export function NextStepCard({ step, to }: { step: NextStep; to: string }) {
  return (
    <section
      data-region="next-action"
      data-next-action={step.kind}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 20,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '22px 26px',
        border: `1px solid ${step.tone === 'brand' ? 'var(--brand)' : 'var(--accent)'}`,
        background: step.tone === 'brand' ? 'var(--brand-soft)' : 'var(--accent-soft)',
        borderRadius: 16,
        marginBlockEnd: 20,
        color: 'var(--ink)',
        textDecoration: 'none',
      }}
    >
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: step.tone === 'brand' ? 'var(--brand)' : 'var(--accent-ink)', marginBlockEnd: 6 }}>
          <L en="Next step" ar="الخطوة التالية" />
        </span>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 600, lineHeight: 1.45, marginBlockEnd: 6 }}>
          <L en={step.titleEn} ar={step.titleAr} /> <InfoNote labelEn="About this step" labelAr="حول هذه الخطوة">
            <L en={step.bodyEn} ar={step.bodyAr} />
          </InfoNote>
        </span>
      </div>
      <Link href={to}
        style={{
          flex: 'none',
          height: 44,
          paddingInline: 22,
          borderRadius: 22,
          background: step.tone === 'brand' ? 'var(--brand)' : 'var(--bg)',
          color: step.tone === 'brand' ? 'var(--bg)' : 'var(--ink)',
          border: step.tone === 'brand' ? '0' : '1px solid var(--line)',
          fontSize: '14.5px',
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <L en={step.buttonEn} ar={step.buttonAr} />
      </Link>
    </section>
  );
}
