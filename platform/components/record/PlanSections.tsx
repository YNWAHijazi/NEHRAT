import { L } from '../L';
import { approveRecordPlanAction } from '../../app/record-actions';
import type { RecordRequirements } from '../../lib/record-facts';
import type { RecordView } from '../../lib/record-view';
import { FACILITY_CONTENT, FACILITY_REFERENCE_KEY, GOVERNANCE_LANDING, REQUIREMENT_COPY, ROLES_CONTENT, fieldsFor, referenceShortfalls, type AuthorRole, type PlanSectionInstance, type RequirementInstance } from '../../lib/rules';
import { RequirementForm } from './RequirementForm';

export function textInstance(key: string, labelEn: string, labelAr: string, record: RecordRequirements, authors: readonly AuthorRole[]): RequirementInstance {
  const stored = record.facts?.answers[key] ?? null;
  const text = typeof stored?.values['text'] === 'string' ? stored.values['text'] : '';
  return {
    key, n: null, labelEn, labelAr, promptEn: '', promptAr: '', infoEn: null, infoAr: null,
    sourceEn: '', sourceAr: '', responsibilityEn: '', responsibilityAr: '',
    obligation: 'inPlan', obligationEn: '', obligationAr: '', group: 'required', section: 'requirement',
    state: text ? 'complete' : 'pending', stateEn: '', stateAr: '', detailEn: null, detailAr: null,
    authors, approver: null,
    fields: [{ key: 'text', type: 'textarea', labelEn, labelAr }],
    values: stored?.values ?? {}, missing: text ? [] : ['text'], file: null, linkedPlan: [],
    answeredBy: stored ? { role: stored.savedByRole, name: stored.savedByName, at: stored.savedAt, version: stored.version } : null,
    requested: false, blocks: false, anchor: `req-${key}`,
  };
}

export function LinkedAnswers({ linked }: { linked: readonly RequirementInstance[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {linked.map((inst) => (
        <div key={inst.key} data-linked={inst.key} style={{ fontSize: '14.5px', lineHeight: 1.55 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline' }}>
            <a href={`#${inst.anchor}`} style={{ fontWeight: 500 }}><L en={inst.labelEn} ar={inst.labelAr} /></a>
            <span style={{ fontSize: 13, color: inst.state === 'complete' ? 'var(--success)' : 'var(--accent-ink)' }}><L en={inst.stateEn} ar={inst.stateAr} /></span>
          </div>
          {inst.fields.filter((f) => inst.values[f.key] !== undefined && inst.values[f.key] !== '').map((f) => (
            <div key={f.key} style={{ color: 'var(--muted)', fontSize: '13.5px' }}>
              <L en={f.labelEn} ar={f.labelAr} />: <span style={{ color: 'var(--ink)' }}>{inst.values[f.key] === true ? <L en="Confirmed" ar="مؤكَّد" /> : String(inst.values[f.key])}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * The medical plan, generated from the same instances the cards show (brief item 10):
 * sixteen short collapsible sections, each either filled from the record, read from the
 * linked requirement rows, or carrying its own text. The eleven major-incident items
 * sit under section 12 at Level 3. The named Director approves the current version;
 * nothing here lets the organizer write.
 */
export function PlanSections({ record, viewerRole, canEdit, canApprove, derived, governance, facility, organizerMayEdit }: {
  record: RecordRequirements; viewerRole: AuthorRole; canEdit: boolean; canApprove: boolean;
  /** The record's own facts for the two derived sections. */
  derived: { scheduleEn: string; scheduleAr: string; contactsEn: string; contactsAr: string };
  governance: Record<string, string>;
  facility: RecordView['facility'];
  /** The organizer writes the facility reference's confirmation, nobody else. */
  organizerMayEdit: boolean;
}) {
  const sections: PlanSectionInstance[] = record.plan;
  const planInst = record.instances.find((i) => i.key === 'B2');
  const itemStyle: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 10, marginBlockEnd: 8, background: 'var(--surface)' };
  const govSections = ROLES_CONTENT.director.govSections as readonly { key: string; en: string; ar: string; readerEn?: string; readerAr?: string }[];
  const governanceFor = (n: number): { key: string; en: string; ar: string; text: string }[] => {
    const keys = n === GOVERNANCE_LANDING.clinicalSection ? ['clinical', 'command'] : n === GOVERNANCE_LANDING.incidentSection ? ['incidentRole'] : [];
    return keys.map((k) => ({ key: k, text: governance[k]?.trim() ?? '', en: govSections.find((g) => g.key === k)?.readerEn ?? govSections.find((g) => g.key === k)?.en ?? k, ar: govSections.find((g) => g.key === k)?.readerAr ?? govSections.find((g) => g.key === k)?.ar ?? k })).filter((g) => g.text !== '');
  };
  const refStored = record.facts?.answers[FACILITY_REFERENCE_KEY] ?? null;
  const refValues = refStored?.values ?? {};
  const refInstance: RequirementInstance | null = facility && record.level !== null ? {
    key: FACILITY_REFERENCE_KEY, n: null, labelEn: 'Facility reference', labelAr: 'الإحالة إلى المنشأة', promptEn: '', promptAr: '', infoEn: null, infoAr: null,
    sourceEn: '', sourceAr: '', responsibilityEn: '', responsibilityAr: '', obligation: 'recommended', obligationEn: '', obligationAr: '', group: 'recommended', section: 'requirement',
    state: refValues['confirmed'] === true ? 'complete' : 'pending', stateEn: '', stateAr: '', detailEn: null, detailAr: null, authors: ['organizer'], approver: null,
    fields: fieldsFor(FACILITY_REFERENCE_KEY, record.level, 'event') ?? [], values: refValues, missing: refValues['confirmed'] === true ? [] : ['confirmed'], file: null, linkedPlan: [],
    answeredBy: refStored ? { role: refStored.savedByRole, name: refStored.savedByName, at: refStored.savedAt, version: refStored.version } : null,
    requested: false, blocks: false, anchor: `req-${FACILITY_REFERENCE_KEY}`,
  } : null;
  return (
    <div data-region="plan-sections">
      {planInst?.state === 'waiting' && record.approval === null ? (
        <p data-region="plan-approval-state" style={{ margin: '0 0 12px', fontSize: '13.5px', color: 'var(--accent-ink)' }}><L en={REQUIREMENT_COPY.waitingApprovalEn} ar={REQUIREMENT_COPY.waitingApprovalAr} /></p>
      ) : null}
      {record.approval ? (
        <p data-region="plan-approval-state" style={{ margin: '0 0 12px', fontSize: '13.5px', color: 'var(--success)' }}>
          <L en={`Approval recorded by ${record.approval.by} · ${record.approval.at.slice(0, 10)} · plan version ${record.approval.planVersion}`} ar={`سجّل الاعتماد ${record.approval.by} · ⁦${record.approval.at.slice(0, 10)}⁩ · نسخة الخطة ${record.approval.planVersion}`} />
        </p>
      ) : null}
      {sections.map((s) => (
        <details key={s.key} id={`plan-${s.key}`} data-plan-section={s.key} data-complete={s.complete} style={itemStyle}>
          <summary className="requirement-summary" style={{ padding: '10px 14px', minHeight: 44 }}>
            <span style={{ fontSize: '14.5px', fontWeight: 500 }}><span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginInlineEnd: 8 }}>{s.n}</span><L en={s.en} ar={s.ar} /></span>
            <span style={{ flex: 'none', fontSize: 13, color: s.complete ? 'var(--success)' : 'var(--accent-ink)' }}><L en={s.complete ? 'Addressed' : 'Pending'} ar={s.complete ? 'مستوفى' : 'قيد الإنجاز'} /></span>
          </summary>
          <div style={{ padding: '0 14px 14px' }}>
            {s.protocolEn && s.protocolEn !== s.en ? (
              <p data-region="protocol-wording" style={{ margin: '0 0 6px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5, fontStyle: 'italic' }}><L en={s.protocolEn} ar={s.protocolAr} /></p>
            ) : null}
            <p style={{ margin: '0 0 10px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.5 }}><L en={s.promptEn} ar={s.promptAr} /></p>
            {s.source === 'derived' ? (
              <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.6 }}>
                {s.key === 'P01' ? <L en={derived.scheduleEn} ar={derived.scheduleAr} /> : <L en={derived.contactsEn} ar={derived.contactsAr} />}
              </p>
            ) : null}
            {s.linked.length > 0 ? <LinkedAnswers linked={s.linked} /> : null}
            {/* THE FACILITY REFERENCE under AED deployment (SPEC 2e): the registered devices
                are referenced, the organizer confirms they stay accessible, and the two event
                facts derive any shortfall by name. */}
            {s.key === 'P06' && facility && refInstance ? (
              <details id={refInstance.anchor} data-region="facility-reference" style={{ marginBlockStart: 12, background: 'var(--surface2)', borderRadius: 10 }}>
                <summary className="requirement-summary" style={{ padding: '10px 14px', minHeight: 44 }}>
                  <span style={{ fontSize: '14px' }}>
                    <L en={`${facility.nameEn} has ${facility.devices} registered ${facility.devices === 1 ? 'defibrillator' : 'defibrillators'} — use them in this plan?`} ar={`لدى ${facility.nameAr} ${facility.devices} من أجهزة إزالة الرجفان المسجّلة — استخدامها في هذه الخطة؟`} />
                  </span>
                  <span style={{ flex: 'none', fontSize: 12.5, color: refInstance.state === 'complete' ? 'var(--success)' : 'var(--muted)' }}><L en={refInstance.state === 'complete' ? 'Confirmed' : 'Not confirmed'} ar={refInstance.state === 'complete' ? 'مؤكَّد' : 'غير مؤكَّد'} /></span>
                </summary>
                <div style={{ padding: '0 14px 14px' }}>
                  {facility.facts.locationsEn.length > 0 ? (
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)' }}><L en={facility.facts.locationsEn.join(' · ')} ar={facility.facts.locationsAr.join(' · ')} /></p>
                  ) : null}
                  <RequirementForm kind="event" id={record.id} instance={refInstance} canEdit={organizerMayEdit} />
                  {referenceShortfalls(facility.facts, { admitsChildren: refValues['admitsChildren'] === true, temporaryAreas: refValues['temporaryAreas'] === true }).map((sf) => {
                    const def = FACILITY_CONTENT.reference.shortfalls[sf.key];
                    return (
                      <div key={sf.key} data-region="shortfall" style={{ marginBlockStart: 10, padding: '12px 16px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 10, fontSize: '13.5px', lineHeight: 1.6 }}>
                        <span style={{ fontWeight: 600 }}><L en={def.en} ar={def.ar} /></span>{' '}<L en={def.bodyEn} ar={def.bodyAr} />
                      </div>
                    );
                  })}
                </div>
              </details>
            ) : null}
            {governanceFor(s.n).length > 0 ? (
              <div data-region="plan-governance" style={{ marginBlockStart: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {governanceFor(s.n).map((g) => (
                  <div key={g.key} style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: '13.5px', lineHeight: 1.6 }}>
                    <span style={{ fontWeight: 600 }}><L en={g.en} ar={g.ar} /></span>
                    <span style={{ display: 'block', whiteSpace: 'pre-wrap', marginBlockStart: 4 }}>{g.text}</span>
                    <span style={{ display: 'block', marginBlockStart: 4, fontSize: 12, color: 'var(--muted)' }}><L en="Written by the Medical Director." ar="كتبها المدير الطبي." /></span>
                  </div>
                ))}
              </div>
            ) : null}
            {s.ownText ? (
              <div style={{ marginBlockStart: s.linked.length > 0 ? 12 : 0 }}>
                <RequirementForm kind={record.service} id={record.id} instance={textInstance(s.key, s.en, s.ar, record, ['ems', 'director'])} canEdit={canEdit} />
              </div>
            ) : null}
            {s.items.length > 0 ? (
              <div style={{ marginBlockStart: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {s.items.map((m) => (
                  <details key={m.key} id={`req-${m.key}`} data-major-incident={m.key} data-complete={m.complete} style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)' }}>
                    <summary className="requirement-summary" style={{ padding: '8px 12px', minHeight: 44 }}>
                      <span style={{ fontSize: 14 }}><span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginInlineEnd: 8 }}>{m.n}</span><L en={m.en} ar={m.ar} /></span>
                      <span style={{ flex: 'none', fontSize: 12.5, color: m.complete ? 'var(--success)' : 'var(--accent-ink)' }}><L en={m.complete ? 'Addressed' : 'Pending'} ar={m.complete ? 'مستوفى' : 'قيد الإنجاز'} /></span>
                    </summary>
                    <div style={{ padding: '0 12px 12px' }}>
                      <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted)' }}><L en={m.promptEn} ar={m.promptAr} /></p>
                      {m.linked.length > 0 ? <LinkedAnswers linked={m.linked} /> : (
                        <RequirementForm kind={record.service} id={record.id} instance={textInstance(m.key, m.en, m.ar, record, ['ems', 'director'])} canEdit={canEdit} />
                      )}
                    </div>
                  </details>
                ))}
              </div>
            ) : null}
          </div>
        </details>
      ))}
      {canApprove && viewerRole === 'director' && record.level === 3 && planInst?.state === 'waiting' ? (
        <form action={approveRecordPlanAction.bind(null, record.service, record.id)} data-region="plan-approval" style={{ marginBlockStart: 16, padding: '14px 16px', border: '1px solid var(--brand)', borderRadius: 10 }}>
          <input type="hidden" name="planVersion" value={record.planVersion} />
          <input type="hidden" name="assessmentVersion" value={record.assessmentVersion ?? 0} />
          <label style={{ display: 'flex', gap: 12, alignItems: 'start', fontSize: '14.5px', lineHeight: 1.55, cursor: 'pointer' }}>
            <input type="checkbox" name="confirm" value="yes" required style={{ flex: 'none', width: 20, height: 20, marginBlockStart: 2, accentColor: 'var(--brand)' }} />
            <span><L en={`I have reviewed every section of plan version ${record.planVersion} against assessment version ${record.assessmentVersion ?? 0} and approve it as the Event Medical Director.`} ar={`راجعتُ كل أقسام نسخة الخطة ${record.planVersion} مقابل نسخة التقييم ${record.assessmentVersion ?? 0} وأعتمدها بصفتي المدير الطبي للفعالية.`} /></span>
          </label>
          <button type="submit" style={{ marginBlockStart: 12, minHeight: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}><L en="Approve this version" ar="اعتماد هذه النسخة" /></button>
        </form>
      ) : null}
    </div>
  );
}
