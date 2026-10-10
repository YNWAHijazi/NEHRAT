import { L } from '../L';
import { REQUIREMENT_GROUPS, handledBy, type RequirementInstance, type RequirementSummary } from '../../lib/rules';
import { stateTone } from './RequirementCard';

function SummaryRow({ inst }: { inst: RequirementInstance }) {
  const tone = stateTone(inst);
  const who = handledBy(inst);
  return (
    <a href={inst.section === 'assessment' ? '#assessment' : inst.section === 'declaration' ? '#final-review' : `#${inst.anchor}`} data-summary-row={inst.key} style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 44, padding: '8px 4px', color: 'var(--ink)', borderBlockStart: '1px solid var(--line)', textDecoration: 'none' }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: '14.5px', lineHeight: 1.4 }}><L en={inst.labelEn} ar={inst.labelAr} /></span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}><L en={who.en} ar={who.ar} /></span>
      </span>
      <span style={{ flex: 'none', fontSize: 13, color: tone.color }}><L en={inst.stateEn} ar={inst.stateAr} /></span>
    </a>
  );
}

/**
 * The two collapsible summaries at the top of the record: Required (inline-start) and
 * Recommended (inline-end), each row naming the item, its state and who handles it. A
 * click opens the matching card (JumpTo). They stack on a phone ([data-split]).
 */
export function RequirementSummaries({ instances, summary }: { instances: readonly RequirementInstance[]; summary: RequirementSummary }) {
  // Every item the count covers is listed under it -- the assessment and the declaration
  // included -- so the list and its "n of m" can never disagree (live review, 10 October 2026).
  const required = instances.filter((i) => i.group === 'required');
  const recommended = instances.filter((i) => i.group === 'recommended');
  const panel: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '4px 16px 8px' };
  const head: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, minHeight: 44, cursor: 'pointer', listStyle: 'none', fontSize: 17, fontWeight: 600 };
  return (
    <div data-region="requirement-summaries" data-split="" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, marginBlockEnd: 32 }}>
      <details data-summary="required" open style={panel}>
        <summary className="requirement-summary" style={head}>
          <span><L en={REQUIREMENT_GROUPS.required.en} ar={REQUIREMENT_GROUPS.required.ar} /></span>
          <span data-region="required-count" style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            <L en={`${summary.required.complete} of ${summary.required.total} complete`} ar={`اكتمل ${summary.required.complete} من ${summary.required.total}`} />
          </span>
        </summary>
        <div>{required.map((i) => <SummaryRow key={i.key} inst={i} />)}</div>
      </details>
      <details data-summary="recommended" open style={panel}>
        <summary className="requirement-summary" style={head}>
          <span><L en={REQUIREMENT_GROUPS.recommended.en} ar={REQUIREMENT_GROUPS.recommended.ar} /></span>
          <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}><L en={REQUIREMENT_GROUPS.recommended.noteEn} ar={REQUIREMENT_GROUPS.recommended.noteAr} /></span>
        </summary>
        <div>
          {recommended.length === 0 ? (
            <p style={{ margin: 0, padding: '10px 4px', fontSize: '13.5px', color: 'var(--muted)' }}><L en="Nothing is recommended beyond what is required at this level." ar="لا شيء موصى به زيادةً على المطلوب في هذا المستوى." /></p>
          ) : recommended.map((i) => <SummaryRow key={i.key} inst={i} />)}
        </div>
      </details>
    </div>
  );
}
