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
  // On a phone the columns shrink to a segmented bar and this one line names where the record
  // stands (owner, 9 October 2026: the phone layout was crowded). The full rail is unchanged above 600px.
  const nowIndex = stages.findIndex((s) => s.k === 'current' || s.k === 'returned');
  const now = nowIndex >= 0 ? stages[nowIndex]! : null;
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
      {now ? (
        <div data-rail-now="" style={{ display: 'none' }}>
          <span style={{ fontSize: '14.5px', fontWeight: 600 }}><L en={`${nowIndex + 1}. ${now.en}`} ar={`${nowIndex + 1}. ${now.ar}`} /></span>
          {now.metaEn ? <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}><L en={now.metaEn} ar={now.metaAr} /></span> : null}
        </div>
      ) : null}
    </section>
  );
}
