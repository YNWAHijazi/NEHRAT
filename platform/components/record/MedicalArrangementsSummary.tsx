import { L } from '../L';
import { REQUIREMENT_COPY, type RequirementInstance } from '../../lib/rules';

/**
 * The Level 1 documented medical arrangements, generated from the answers on the cards
 * (partner audit, 8 October 2026): no separate medical-plan form at Level 1. The
 * organizer reads it on the final step before submitting; a change is made on the
 * row it came from. Rendered on the server from the same instances the cards show.
 */
export function MedicalArrangementsSummary({ instances, submitted = false }: { instances: readonly RequirementInstance[]; /** Filed and read-only: no instruction to review before submitting. */ submitted?: boolean }) {
  const rows = instances.filter((i) => i.section === 'requirement' && i.group !== 'later');
  const line = (inst: RequirementInstance): { en: string; ar: string }[] => {
    const out: { en: string; ar: string }[] = [];
    for (const f of inst.fields) {
      const v = inst.values[f.key];
      if (v === undefined || v === '' || v === false) continue;
      if (f.showWhen && inst.values[f.showWhen.field] !== f.showWhen.equals) continue;
      if (f.type === 'checkbox') out.push({ en: f.labelEn, ar: f.labelAr });
      else if (f.type === 'choice') {
        const o = (f.options ?? []).find((x) => x.value === v);
        out.push({ en: `${f.labelEn} ${o?.en ?? String(v)}`, ar: `${f.labelAr} ${o?.ar ?? String(v)}` });
      } else out.push({ en: `${f.labelEn} ${String(v)}`, ar: `${f.labelAr} ${String(v)}` });
    }
    return out;
  };
  return (
    <section data-region="medical-arrangements-summary" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '16px 20px', marginBlockEnd: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 600 }}><L en={REQUIREMENT_COPY.summaryTitleEn} ar={REQUIREMENT_COPY.summaryTitleAr} /></h3>
      <p style={{ margin: '0 0 12px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.55 }}>{submitted ? <L en="Generated from the submitted answers." ar="مُعدّة من الإجابات المقدَّمة." /> : <L en={REQUIREMENT_COPY.summaryNoteEn} ar={REQUIREMENT_COPY.summaryNoteAr} />}</p>
      <dl style={{ margin: 0, display: 'grid', gap: '8px 16px', gridTemplateColumns: 'minmax(140px, 1fr) 2fr', fontSize: '14px', lineHeight: 1.5 }}>
        {rows.map((inst) => {
          const lines = line(inst);
          return (
            <div key={inst.key} data-summary-line={inst.key} data-state={inst.state} style={{ display: 'contents' }}>
              <dt style={{ fontWeight: 500 }}><a href={`#${inst.anchor}`} style={{ color: 'inherit', textDecoration: 'none' }}><L en={inst.labelEn} ar={inst.labelAr} /></a></dt>
              <dd style={{ margin: 0, color: lines.length ? 'var(--ink)' : 'var(--muted)' }}>
                {lines.length ? lines.map((l, i) => <span key={i} style={{ display: 'block' }}><L en={l.en} ar={l.ar} /></span>) : <L en={inst.stateEn} ar={inst.stateAr} />}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
