import type { ReactNode } from 'react';
import { L } from '../L';
import { InfoNote } from '../InfoNote';
import { REQUIREMENT_COPY, handledBy, type RequirementInstance } from '../../lib/rules';

/** The chip's colours: amber while a required row is pending, green with a text label when complete, neutral otherwise (brief item 5). */
export function stateTone(inst: RequirementInstance, yours = true): { color: string; bg: string; edge: string } {
  if (inst.state === 'complete') return { color: 'var(--success)', bg: 'var(--success-soft)', edge: 'var(--success)' };
  // Another party's open row is theirs to colour: it reads neutral here (owner, 2026-10-07).
  if (yours && inst.group === 'required' && (inst.state === 'pending' || inst.state === 'waiting')) return { color: 'var(--accent-ink)', bg: 'var(--accent-soft)', edge: 'var(--accent)' };
  return { color: 'var(--muted)', bg: 'var(--surface2)', edge: 'var(--line)' };
}

export function StateChip({ inst, yours = true }: { inst: RequirementInstance; yours?: boolean }) {
  const tone = stateTone(inst, yours);
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
export function RequirementCard({ inst, open, children, extra, yours = true }: { inst: RequirementInstance; open: boolean; children: ReactNode; extra?: ReactNode; yours?: boolean }) {
  const tone = stateTone(inst, yours);
  const who = handledBy(inst);
  return (
    <details id={inst.anchor} data-requirement={inst.key} data-group={inst.group} data-state={inst.state} open={open || undefined}
      className="requirement-card record-card" style={{ padding: 0, background: 'var(--bg)', border: '1px solid var(--line)', borderInlineStart: `4px solid ${tone.edge}`, borderRadius: 12, marginBlockEnd: 12 }}>
      <summary className="requirement-summary record-card-summary">
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
          <span className="record-card-title"><L en={inst.labelEn} ar={inst.labelAr} /></span>
          <span className="record-card-prompt">
            <L en={inst.promptEn} ar={inst.promptAr} />
          </span>
        </span>
        <StateChip inst={inst} yours={yours} />
      </summary>
      <div className="record-card-body">
        {inst.detailEn && inst.detailAr ? (
          <p data-region="state-detail" className="record-card-detail" style={{ color: inst.state === 'waiting' ? 'var(--accent-ink)' : 'var(--muted)' }}>
            <L en={inst.detailEn} ar={inst.detailAr} />
          </p>
        ) : null}
        {children}
        <div className="record-card-foot">
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
