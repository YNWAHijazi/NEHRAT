import { L } from './L';
import type { RailStage, RailStageKind } from '../lib/rules/rail';

const STAGE_STYLE: Record<RailStageKind, { color: string; edge: string; ink: string; weight: number; lblEn: string; lblAr: string; chipBg: string; chipColor: string }> = {
  done: { color: 'var(--brand)', edge: 'solid', ink: 'var(--ink)', weight: 500, lblEn: 'Complete', lblAr: 'مُنجزة', chipBg: 'var(--brand-soft)', chipColor: 'var(--brand)' },
  current: { color: 'var(--accent)', edge: 'solid', ink: 'var(--ink)', weight: 600, lblEn: 'Current', lblAr: 'الحالية', chipBg: 'var(--accent-soft)', chipColor: 'var(--accent-ink)' },
  returned: { color: 'var(--accent)', edge: 'solid', ink: 'var(--ink)', weight: 600, lblEn: 'Returned here', lblAr: 'أُعيدت إلى هنا', chipBg: 'var(--accent-soft)', chipColor: 'var(--accent-ink)' },
  todo: { color: 'var(--line)', edge: 'solid', ink: 'var(--muted)', weight: 400, lblEn: 'Not yet', lblAr: 'لم تبدأ', chipBg: 'var(--surface2)', chipColor: 'var(--muted)' },
  na: { color: 'var(--line)', edge: 'dashed', ink: 'var(--muted)', weight: 400, lblEn: 'Not applicable', lblAr: 'غير منطبقة', chipBg: 'var(--surface2)', chipColor: 'var(--muted)' },
};

/**
 * The numbered progress rail every service workspace shows on its overview:
 * one column per stage, each with its number, its state chip, its name and one
 * line of detail. Events drew it first; venues use the same one so the two
 * workspaces read the same way.
 */
export function StageRail({ titleEn, titleAr, stages, noteEn, noteAr }: { titleEn: string; titleAr: string; stages: RailStage[]; noteEn: string; noteAr: string }) {
  // On a phone the columns become a compact list of the stages (owner, 9 and 10 October 2026).
  // The full rail is unchanged above 600px.
  const nowIndex = stages.findIndex((s) => s.k === 'current' || s.k === 'returned');
  return (
    <section data-region="rail" style={{ marginBlockEnd: 28, padding: '16px 22px', background: 'var(--surface2)', borderRadius: 16 }}>
      <div style={{ cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          <L en={titleEn} ar={titleAr} />
        </span>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          <L en={noteEn} ar={noteAr} />
        </span>
      </div>
      <div data-rail="" style={{ marginBlockStart: 18, display: 'grid', gridTemplateColumns: `repeat(${stages.length},1fr)`, gap: 12 }}>
        {stages.map((s, i) => {
          const st = STAGE_STYLE[s.k];
          return (
            <div key={i} data-rail-stage={s.k} style={{ paddingBlockStart: 12, borderBlockStart: `3px ${st.edge} ${st.color}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBlockEnd: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                <span style={{ padding: '2px 7px', borderRadius: 999, background: st.chipBg, color: st.chipColor, fontSize: 11, letterSpacing: '.03em' }}>
                  <L en={st.lblEn} ar={st.lblAr} />
                </span>
              </div>
              <div style={{ fontSize: '14.5px', fontWeight: st.weight, lineHeight: 1.4, color: st.ink }}>
                <L en={s.en} ar={s.ar} />
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5, marginBlockStart: 5 }}>
                <L en={s.metaEn} ar={s.metaAr} />
              </div>
            </div>
          );
        })}
      </div>
      {/* On a phone: every stage by name, one compact line each, the current one with its detail
          (owner, 10 October 2026: the bar alone did not say what each stage is). */}
      <ol data-rail-list="" style={{ display: 'none' }}>
        {stages.map((s, i) => {
          const st = STAGE_STYLE[s.k];
          const isNow = i === nowIndex;
          return (
            <li key={i} data-rail-item={s.k} aria-current={isNow ? 'step' : undefined}>
              <span aria-hidden="true" style={{ flex: 'none', inlineSize: 10, blockSize: 10, marginBlockStart: 5, borderRadius: 3, background: s.k === 'todo' || s.k === 'na' ? 'transparent' : st.color, border: s.k === 'todo' || s.k === 'na' ? `1.5px ${st.edge} var(--muted)` : 0 }} />
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: isNow ? 600 : 400, color: s.k === 'todo' || s.k === 'na' ? 'var(--muted)' : 'var(--ink)', lineHeight: 1.45 }}>
                  <L en={`${i + 1}. ${s.en}`} ar={`${i + 1}. ${s.ar}`} />
                  {/* A stage still to come says when, not just "Not yet": the bare chip left the reader
                      with no wait and no owner (no-dead-ends rule). */}
                  {!isNow ? <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12.5 }}> · {s.k === 'todo' && s.metaEn ? <L en={s.metaEn} ar={s.metaAr} /> : <L en={st.lblEn} ar={st.lblAr} />}</span> : null}
                </span>
                {isNow && s.metaEn ? <span style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.4 }}><L en={s.metaEn} ar={s.metaAr} /></span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
