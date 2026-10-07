import Link from 'next/link';
import { L } from '../L';
import { PrintButton } from '../PrintButton';
import type { RecordRequirements } from '../../lib/record-facts';
import { REQUIREMENT_DECISIONS, REQUIREMENT_GROUPS, handledBy, type RequirementInstance } from '../../lib/rules';

/**
 * The whole requirement list on one printable page -- the "download" the record page
 * offers (owner direction, 2026-10-07). Every row the level applies, with its question,
 * who handles it, the rule at this level and its state today; the browser's print
 * dialogue saves it as a PDF. No answers: the record page and the reviewer carry those.
 */
export function RequirementList({ record, nameEn, nameAr, backHref }: { record: RecordRequirements; nameEn: string; nameAr: string; backHref: string }) {
  const groups: { key: 'required' | 'recommended' | 'later'; rows: RequirementInstance[] }[] = (['required', 'recommended', 'later'] as const)
    .map((key) => ({ key, rows: record.instances.filter((i) => i.group === key && i.section === 'requirement') }))
    .filter((g) => g.rows.length > 0);
  return (
    <div data-region="requirement-list" style={{ maxWidth: 860 }}>
      <div data-no-print="" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: 20 }}>
        <Link href={backHref} style={{ fontSize: 14 }}><L en="Back to the record" ar="العودة إلى السجل" /></Link>
        <PrintButton en="Print or save as PDF" ar="طباعة أو حفظ بصيغة PDF" />
      </div>
      <h1 style={{ fontSize: 28, margin: '0 0 6px', letterSpacing: '-.025em' }}><L en="Requirement list" ar="قائمة المتطلبات" /></h1>
      <p style={{ margin: '0 0 24px', fontSize: 15, color: 'var(--muted)' }}>
        <L en={`${nameEn} · ${record.id} · Level ${record.level ?? '—'}`} ar={`${nameAr} · ${record.id} · المستوى ${record.level ?? '—'}`} />
      </p>
      {groups.map((g) => (
        <section key={g.key} data-list-group={g.key} style={{ marginBlockEnd: 28 }}>
          <h2 style={{ fontSize: 17, margin: '0 0 8px' }}><L en={REQUIREMENT_GROUPS[g.key].en} ar={REQUIREMENT_GROUPS[g.key].ar} /> <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 14 }}>· <L en={REQUIREMENT_GROUPS[g.key].noteEn} ar={REQUIREMENT_GROUPS[g.key].noteAr} /></span></h2>
          <ol style={{ margin: 0, paddingInlineStart: 0, listStyle: 'none', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            {g.rows.map((inst, i) => {
              const who = handledBy(inst);
              return (
                <li key={inst.key} data-list-row={inst.key} style={{ padding: '12px 16px', borderBlockStart: i === 0 ? 0 : '1px solid var(--line)', display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto', gap: '4px 12px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 500 }}><L en={inst.labelEn} ar={inst.labelAr} /></span>
                    <span style={{ display: 'block', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}><L en={inst.promptEn} ar={inst.promptAr} /></span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)', marginBlockStart: 4 }}>
                      <L en={`${who.en} · ${inst.sourceEn}`} ar={`${who.ar} · ${inst.sourceAr}`} />
                    </span>
                  </span>
                  <span style={{ fontSize: 13, color: inst.state === 'complete' ? 'var(--success)' : 'var(--muted)', whiteSpace: 'nowrap' }}><L en={inst.stateEn} ar={inst.stateAr} /></span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <p data-region="decision-note" style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '80ch' }}>
        <L
          en={`Rows and completion tests follow the revised requirements matrix and the decisions confirmed by the owner and the partner (${Object.keys(REQUIREMENT_DECISIONS).join(', ')}, 7 October 2026).`}
          ar={`تتبع البنود واختبارات الاكتمال مصفوفة المتطلبات المنقّحة والقرارات التي أكّدها المالك والشريك (${Object.keys(REQUIREMENT_DECISIONS).join('، ')}، 7 تشرين الأول 2026).`}
        />
      </p>
    </div>
  );
}
