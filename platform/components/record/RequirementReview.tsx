import { L } from '../L';
import { DocumentViewer } from '../DocumentViewer';
import type { RecordParty, RecordRequirements, RequirementSnapshot } from '../../lib/record-facts';
import { EVENT_FILE_KEYS } from '../../lib/requirement-migration';
import { REQUIREMENT_GROUPS, type PlanSectionInstance, type RequirementInstance } from '../../lib/rules';

const panel: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 12, padding: 20, marginBlockEnd: 24, scrollMarginBlockStart: 24 };

function Value({ value }: { value: string | number | boolean | undefined }) {
  if (value === undefined || value === '' || value === false) return <span style={{ color: 'var(--muted)' }}><L en="Not provided" ar="غير مقدّم" /></span>;
  if (value === true) return <L en="Confirmed" ar="مؤكَّد" />;
  if (typeof value === 'number') return <>{value.toLocaleString('en-US')}</>;
  if (/^[+\d][\d\s:\-—+()/]*$/.test(String(value).trim())) return <bdi dir="ltr">{value}</bdi>;
  return <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</span>;
}

function Row({ inst, eventId, kind, contentTypes, fileChanged, revision }: { inst: RequirementInstance; eventId: string; kind: 'event' | 'venue'; contentTypes: Readonly<Record<string, string | null>>; fileChanged: boolean; revision: number | null }) {
  const tone = inst.state === 'complete' ? 'var(--brand)' : inst.group === 'required' ? 'var(--accent-ink)' : 'var(--muted)';
  // A venue's submitted files are read from the frozen submission, never the live table.
  const href = kind === 'event' ? `/api/documents/${eventId}/${EVENT_FILE_KEYS[inst.key] ?? inst.key}` : `/api/venue-documents/${eventId}/${inst.key}${revision ? `?revision=${revision}` : ''}`;
  return (
    <details data-review-requirement={inst.key} data-state={inst.state} style={{ borderBlockStart: '1px solid var(--line)', paddingBlock: 10 }}>
      <summary className="requirement-summary" style={{ minHeight: 40 }}>
        <span style={{ fontSize: '14.5px' }}><L en={inst.labelEn} ar={inst.labelAr} /> <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>· <L en={inst.obligationEn} ar={inst.obligationAr} /></span></span>
        <span style={{ flex: 'none', fontSize: 13, color: tone }}><L en={inst.stateEn} ar={inst.stateAr} /></span>
      </summary>
      <div style={{ padding: '6px 0 4px' }}>
        <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--muted)' }}><L en={`Rule at this level: ${inst.sourceEn}`} ar={`القاعدة في هذا المستوى: ${inst.sourceAr}`} />{inst.detailEn && inst.detailAr ? <> · <L en={inst.detailEn} ar={inst.detailAr} /></> : null}</p>
        {inst.fields.length > 0 ? (
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12, margin: 0 }}>
            {inst.fields.filter((f) => !f.showWhen || inst.values[f.showWhen.field] === f.showWhen.equals).map((f) => (
              <div key={f.key}>
                <dt style={{ fontSize: 12.5, color: 'var(--muted)' }}><L en={f.labelEn} ar={f.labelAr} /></dt>
                <dd style={{ margin: '3px 0 0', fontSize: '14px' }}>
                  {f.type === 'choice' ? (() => { const o = f.options?.find((x) => x.value === inst.values[f.key]); return o ? <L en={o.en} ar={o.ar} /> : <Value value={undefined} />; })() : <Value value={inst.values[f.key]} />}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {inst.file ? (
          <div style={{ marginBlockStart: 10, fontSize: 13.5 }}>
            <L en={inst.file.labelEn} ar={inst.file.labelAr} />: {inst.file.present ? <><span style={{ fontVariantNumeric: 'tabular-nums' }}>{inst.file.present.fileName}</span>{fileChanged ? <> · <span style={{ color: 'var(--accent-ink)' }}><L en="replaced after filing — the stored file below is the current one" ar="استُبدل بعد التقديم — الملف المخزَّن أدناه هو الحالي" /></span></> : null}<DocumentViewer href={href} hasFile contentType={contentTypes[inst.key] ?? null} label={inst.labelEn} /></> : <Value value={undefined} />}
          </div>
        ) : null}
        {inst.answeredBy ? (
          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            <L en={`Recorded by ${inst.answeredBy.name} (${inst.answeredBy.role}) · ${inst.answeredBy.at.slice(0, 16).replace('T', ' ')} · version ${inst.answeredBy.version}`} ar={`سجّله ${inst.answeredBy.name} (${inst.answeredBy.role}) · ⁦${inst.answeredBy.at.slice(0, 16).replace('T', ' ')}⁩ · النسخة ${inst.answeredBy.version}`} />
          </p>
        ) : null}
      </div>
    </details>
  );
}

/**
 * The Ministry reads the SAME requirement record the organizer and the medical parties
 * wrote (brief item 17): each row's source rule, answer, file, author, date and version,
 * the plan's sections, the Director's approval and each agency's signature. It reads the
 * package frozen at filing when one exists; a record filed before the record page has no
 * snapshot and is read live, and the page says so.
 */
export function RequirementReview({ id, kind, snapshot, live, contentTypes, revision = null, extraFiles = [] }: {
  id: string; kind: 'event' | 'venue'; snapshot: RequirementSnapshot | null; live: RecordRequirements | null; contentTypes: Readonly<Record<string, string | null>>;
  /** Venues: the submission whose frozen files the links open. */
  revision?: number | null;
  /** Files filed outside the catalogue's rows -- each agency's signed venue declaration. */
  extraFiles?: readonly { labelEn: string; labelAr: string; href: string; fileName: string }[];
}) {
  const instances: RequirementInstance[] = snapshot?.instances ?? live?.instances ?? [];
  const plan: PlanSectionInstance[] = snapshot?.plan ?? live?.plan ?? [];
  const parties: RecordParty[] = snapshot?.parties ?? live?.parties ?? [];
  const approval = snapshot?.approval ?? live?.approval ?? null;
  if (instances.length === 0) return null;
  const fileChanged = (inst: RequirementInstance) => Boolean(snapshot && inst.file?.present && live?.instances.find((i) => i.key === inst.key)?.file?.present?.fileName !== inst.file.present.fileName);
  const groups: { group: 'required' | 'recommended' | 'later'; rows: RequirementInstance[] }[] = (['required', 'recommended', 'later'] as const)
    .map((group) => ({ group, rows: instances.filter((i) => i.group === group && i.section === 'requirement') }))
    .filter((g) => g.rows.length > 0);
  const missing = instances.filter((i) => i.group === 'required' && i.state !== 'complete');
  return (
    <section id="review-requirements" data-region="review-requirements" style={panel}>
      <h2 style={{ fontSize: 20, marginBlockStart: 0 }}><L en="Requirement record" ar="سجل المتطلبات" /></h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
        {snapshot ? (
          <L en={`Frozen at filing · version ${snapshot.version} · ${snapshot.filedAt.slice(0, 16).replace('T', ' ')} · catalogue ${snapshot.catalogueRevision}`} ar={`مجمَّد عند التقديم · النسخة ${snapshot.version} · ⁦${snapshot.filedAt.slice(0, 16).replace('T', ' ')}⁩ · الفهرس ${snapshot.catalogueRevision}`} />
        ) : (
          <L en="Filed before the requirement record page existed: the answers below are read live, not from a frozen package." ar="قُدِّم قبل وجود صفحة سجل المتطلبات: تُقرأ الإجابات أدناه مباشرة، لا من حزمة مجمَّدة." />
        )}
      </p>
      {missing.length > 0 ? (
        <div data-region="review-missing" style={{ padding: '10px 14px', background: 'var(--accent-soft)', borderRadius: 8, marginBlockEnd: 12, fontSize: 13.5 }}>
          <L en={`Missing or incomplete at filing: ${missing.map((m) => m.labelEn).join(', ')}`} ar={`ناقص أو غير مكتمل عند التقديم: ${missing.map((m) => m.labelAr).join('، ')}`} />
        </div>
      ) : null}
      {groups.map((g) => (
        <div key={g.group} data-review-group={g.group} style={{ marginBlockEnd: 16 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 4px' }}><L en={REQUIREMENT_GROUPS[g.group].en} ar={REQUIREMENT_GROUPS[g.group].ar} /></h3>
          {g.rows.map((inst) => <Row key={inst.key} inst={inst} eventId={id} kind={kind} contentTypes={contentTypes} fileChanged={fileChanged(inst)} revision={revision} />)}
        </div>
      ))}
      {plan.length > 0 ? (
        <details data-region="review-plan-sections" style={{ marginBlockStart: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 15 }}>
            <L en="Medical plan sections" ar="أقسام الخطة الطبية" /> · <L en={`${plan.filter((s) => s.complete).length} of ${plan.length} addressed`} ar={`${plan.filter((s) => s.complete).length} من ${plan.length} مستوفاة`} />
            {approval ? <> · <L en={`Approval recorded by ${approval.by} · ${approval.at.slice(0, 10)} · plan version ${approval.planVersion}`} ar={`سجّل الاعتماد ${approval.by} · ⁦${approval.at.slice(0, 10)}⁩ · نسخة الخطة ${approval.planVersion}`} /></> : null}
          </summary>
          <div style={{ marginBlockStart: 8 }}>
            {plan.map((s) => (
              <div key={s.key} data-review-plan-section={s.key} style={{ borderBlockStart: '1px solid var(--line)', paddingBlock: 8, fontSize: 13.5 }}>
                <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginInlineEnd: 8 }}>{s.n}</span><L en={s.en} ar={s.ar} /> — <span style={{ color: s.complete ? 'var(--brand)' : 'var(--accent-ink)' }}><L en={s.complete ? 'Addressed' : 'Pending'} ar={s.complete ? 'مستوفى' : 'قيد الإنجاز'} /></span>
                {s.linked.length > 0 ? <span style={{ color: 'var(--muted)' }}> · <L en={`from ${s.linked.map((l) => l.labelEn).join(', ')}`} ar={`من ${s.linked.map((l) => l.labelAr).join('، ')}`} /></span> : null}
                {s.text ? <div style={{ marginBlockStart: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{s.text}</div> : null}
                {s.items.length > 0 ? (
                  <div style={{ marginBlockStart: 6, paddingInlineStart: 16 }}>
                    {s.items.map((m) => <div key={m.key} data-review-major-incident={m.key} style={{ paddingBlock: 3 }}>{m.n}. <L en={m.en} ar={m.ar} /> — <span style={{ color: m.complete ? 'var(--brand)' : 'var(--accent-ink)' }}><L en={m.complete ? 'Addressed' : 'Pending'} ar={m.complete ? 'مستوفى' : 'قيد الإنجاز'} /></span>{m.text ? <div style={{ whiteSpace: 'pre-wrap', color: 'var(--muted)' }}>{m.text}</div> : null}</div>)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {parties.length > 0 ? (
        <div data-region="review-parties" style={{ marginBlockStart: 12, fontSize: 13.5 }}>
          <L en="Named parties" ar="الأطراف المسمّاة" />: {parties.map((p) => `${p.name} (${p.kind === 'ems' ? 'EMS' : 'Director'}: ${p.status}${p.kind === 'ems' && p.declarationSigned ? ', declaration signed' : ''})`).join(' · ')}
        </div>
      ) : null}
      {extraFiles.length > 0 ? (
        <div data-region="review-extra-files" style={{ marginBlockStart: 10, fontSize: 13.5 }}>
          {extraFiles.map((f) => (
            <p key={f.href} style={{ margin: '4px 0' }}>
              <L en={f.labelEn} ar={f.labelAr} />: <a href={f.href} target="_blank" rel="noreferrer"><L en="Open document" ar="فتح المستند" /> · {f.fileName}</a>
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
