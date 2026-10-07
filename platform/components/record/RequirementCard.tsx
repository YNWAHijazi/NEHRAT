import type { ReactNode } from 'react';
import { L } from '../L';
import { InfoNote } from '../InfoNote';
import { REQUIREMENT_COPY, handledBy, type RequirementInstance } from '../../lib/rules';

/** The chip's colours: amber while a required row is pending, green with a text label when complete, neutral otherwise (brief item 5). */
export function stateTone(inst: RequirementInstance): { color: string; bg: string; edge: string } {
  if (inst.state === 'complete') return { color: 'var(--success)', bg: 'var(--success-soft)', edge: 'var(--success)' };
  if (inst.group === 'required' && (inst.state === 'pending' || inst.state === 'waiting')) return { color: 'var(--accent-ink)', bg: 'var(--accent-soft)', edge: 'var(--accent)' };
  return { color: 'var(--muted)', bg: 'var(--surface2)', edge: 'var(--line)' };
}

export function StateChip({ inst }: { inst: RequirementInstance }) {
  const tone = stateTone(inst);
  return (
    <span data-state={inst.state} style={{ flex: 'none', padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 500, background: tone.bg, color: tone.color }}>
      <L en={inst.stateEn} ar={inst.stateAr} />
    </span>
  );
}

/**
 * One collapsible card per requirement: a short label, the one actionable sentence,
 * the state in words and colour, who handles it, the source rule behind an
 * information control, and the body the caller supplies (a form, a file control,
 * an invitation, the plan). The id is the anchor the summaries jump to.
 */
export function RequirementCard({ inst, open, children, extra }: { inst: RequirementInstance; open: boolean; children: ReactNode; extra?: ReactNode }) {
  const tone = stateTone(inst);
  const who = handledBy(inst);
  return (
    <details id={inst.anchor} data-requirement={inst.key} data-group={inst.group} data-state={inst.state} open={open || undefined}
      className="requirement-card" style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderInlineStart: `4px solid ${tone.edge}`, borderRadius: 12, marginBlockEnd: 12 }}>
      <summary className="requirement-summary" style={{ padding: '14px 18px', minHeight: 44 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35 }}><L en={inst.labelEn} ar={inst.labelAr} /></span>
          <span style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.5 }}>
            <L en={inst.promptEn} ar={inst.promptAr} />
          </span>
        </span>
        <StateChip inst={inst} />
      </summary>
      <div className="requirement-body" style={{ padding: '4px 18px 20px' }}>
        {inst.detailEn && inst.detailAr ? (
          <p data-region="state-detail" style={{ margin: '0 0 14px', fontSize: '13.5px', color: inst.state === 'waiting' ? 'var(--accent-ink)' : 'var(--muted)', lineHeight: 1.55 }}>
            <L en={inst.detailEn} ar={inst.detailAr} />
          </p>
        ) : null}
        {children}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', alignItems: 'center', marginBlockStart: 16, fontSize: '12.5px', color: 'var(--muted)' }}>
          <span><L en={`${REQUIREMENT_COPY.whoEn}: ${who.en}`} ar={`${REQUIREMENT_COPY.whoAr}: ${who.ar}`} /></span>
          <span>
            <L en={`${REQUIREMENT_COPY.sourceRuleEn}: ${inst.sourceEn}`} ar={`${REQUIREMENT_COPY.sourceRuleAr}: ${inst.sourceAr}`} />
            {inst.infoEn && inst.infoAr ? (
              <InfoNote>
                <L en={inst.infoEn} ar={inst.infoAr} />
                {inst.responsibilityEn ? <> <L en={`${REQUIREMENT_COPY.responsibilityEn}: ${inst.responsibilityEn}.`} ar={`${REQUIREMENT_COPY.responsibilityAr}: ${inst.responsibilityAr}.`} /></> : null}
              </InfoNote>
            ) : inst.responsibilityEn ? (
              <InfoNote><L en={`${REQUIREMENT_COPY.responsibilityEn}: ${inst.responsibilityEn}.`} ar={`${REQUIREMENT_COPY.responsibilityAr}: ${inst.responsibilityAr}.`} /></InfoNote>
            ) : null}
          </span>
          {extra}
        </div>
      </div>
    </details>
  );
}
