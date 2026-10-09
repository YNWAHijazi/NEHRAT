import type { ReactNode } from 'react';
import { L } from '../L';
import type { RecordParty, RecordRequirements as RecordData } from '../../lib/record-facts';
import type { RecordView } from '../../lib/record-view';
import { REQUIREMENT_AUTHORS, REQUIREMENT_COPY, REQUIREMENT_GROUPS, handledBy, mayAuthor, type AuthorRole, type RequirementInstance } from '../../lib/rules';
import { FileControl } from './FileControl';
import { JumpTo } from './JumpTo';
import { RestoreScroll } from './KeepScroll';
import { PartyBlock } from './PartyBlock';
import { LinkedAnswers, PlanSections, textInstance } from './PlanSections';
import { HandoffDialog } from './HandoffDialog';
import { RecordStepper, type StepperStep } from './RecordStepper';
import { RequirementCard } from './RequirementCard';
import { RequirementForm } from './RequirementForm';
import { RequirementSummaries } from './RequirementSummaries';

export interface RecordRequirementsProps {
  record: RecordData;
  viewerRole: AuthorRole;
  /** The viewer's confirmed standing on the record (the owner, or a confirmed party). */
  viewerConfirmed: boolean;
  /** Stored content types per catalogue key, for the inline viewer. */
  contentTypes: Readonly<Record<string, string | null>>;
  /** ?upload=&doc= from a refused upload. */
  refusal?: { key: string; reason: string } | null;
  derived: { scheduleEn: string; scheduleAr: string; contactsEn: string; contactsAr: string; organizerPhoneMissing: boolean };
  governance?: Record<string, string>;
  facility?: RecordView['facility'];
  /** The viewer's own confirmed party on the record, when the viewer is a medical party. */
  viewerParty?: RecordParty | null;
  /** The last step: the final review and Submit, on the owner's page. */
  final?: ReactNode;
  /** The printable requirement list, offered from the step list. */
  listHref?: string | null;
  /** Level 3 events: the Director's credential-verification state, under the Director row. */
  directorVerification?: { en: string; ar: string } | null;
  /** The step an action's redirect names (?saved=, ?doc=, the plan after an approval): it leads, whatever the hash does. */
  initialStep?: string | null;
  /** Just invited (?invited=ems|director): the dialog says which steps that party fills. */
  handoff?: 'ems' | 'director' | null;
  /** Content a page adds above a row's form, by catalogue key (a venue's linked PAD facility on V7). */
  extras?: Readonly<Record<string, ReactNode>>;
}

/**
 * The requirement-led body every record page shares, one requirement at a time (owner
 * direction, 2026-10-07): a numbered step per required row, then the recommended rows,
 * then the final review; the full list stays below for whoever wants it whole. Events
 * and venues, organizer and medical parties, all read the same instances; only who may
 * write differs.
 */
export function RecordRequirements({ record, viewerRole, viewerConfirmed, contentTypes, refusal, derived, governance = {}, facility = null, viewerParty = null, final = null, listHref = null, directorVerification = null, initialStep = null, handoff = null, extras = {} }: RecordRequirementsProps) {
  const { instances, service, id } = record;
  const canEditInst = (inst: RequirementInstance) => record.editable && viewerConfirmed && mayAuthor(inst, viewerRole);
  const canInvite = record.editable && viewerRole === 'organizer';
  const rows = (group: 'required' | 'recommended') => instances.filter((i) => i.group === group && i.section === 'requirement');
  const later = instances.filter((i) => i.group === 'later');

  // Who fills a row, in words, for the card's ownership line and the italic placeholder (owner, 8 October 2026).
  const hasParty = (kind: 'ems' | 'director') => record.parties.some((p) => p.kind === kind && (p.status === 'nominated' || p.status === 'confirmed'));
  // The EMS row the agency fills, before any agency is invited (owner, 9 October 2026): the first
  // act on it is the organizer's invitation, so it reads as the organizer's step -- amber -- until
  // the invitation is sent; then it turns grey, labelled with who fills it.
  const inviteFirst = (inst: RequirementInstance) => inst.key === 'B7' && viewerRole === 'organizer' && record.editable && record.level !== 1 && !mayAuthor(inst, 'organizer') && !hasParty('ems');
  const names = (roles: readonly AuthorRole[]) => ({ en: roles.map((r) => REQUIREMENT_AUTHORS[r].en).join(' or the '), ar: roles.map((r) => REQUIREMENT_AUTHORS[r].ar).join(' أو ') });
  const awaitingFor = (inst: RequirementInstance): { en: string; ar: string } | null => {
    if (canEditInst(inst)) return null;
    if (!mayAuthor(inst, viewerRole) && inst.authors.length > 0) {
      const n = { en: inst.authors.map((r) => REQUIREMENT_AUTHORS[r].en).join(' / '), ar: inst.authors.map((r) => REQUIREMENT_AUTHORS[r].ar).join(' / ') };
      return { en: `Awaiting ${n.en} input`, ar: `بانتظار إدخال ${n.ar}` };
    }
    return { en: 'Not answered', ar: 'لم تُقدَّم إجابة' };
  };
  const ownerLine = (inst: RequirementInstance): { en: string; ar: string } | null => {
    if (inviteFirst(inst)) return { en: 'You invite the EMS agency first; it then fills this step', ar: 'تدعون جهة الإسعاف أولاً، ثم تملأ هذه الخطوة' };
    if (inst.authors.length === 0) return null;
    const others = inst.authors.filter((r) => r !== viewerRole);
    if (mayAuthor(inst, viewerRole)) {
      if (others.length === 0) return { en: 'You fill this step', ar: 'تملؤون هذه الخطوة' };
      const o = names(others);
      return { en: `You or the ${o.en} fill this step`, ar: `تملؤون هذه الخطوة أنتم أو ${o.ar}` };
    }
    const o = names(inst.authors);
    return { en: `Filled by the ${o.en}`, ar: `تملؤها ${o.ar}` };
  };
  const form = (inst: RequirementInstance, canEdit: boolean) => <RequirementForm kind={service} id={id} instance={inst} canEdit={canEdit} awaiting={awaitingFor(inst)} />;

  const body = (inst: RequirementInstance) => {
    const canEdit = canEditInst(inst);
    switch (inst.key) {
      case 'B3':
        return (
          <>
            <PartyBlock kind={service} id={id} parties={record.parties} invite="director" canInvite={canInvite} />
            {directorVerification ? (
              <p data-region="director-verification" style={{ margin: '0 0 8px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.55 }}>
                <L en={directorVerification.en} ar={directorVerification.ar} />
              </p>
            ) : null}
          </>
        );
      case 'B20':
        return (
          <>
            <PartyBlock kind={service} id={id} parties={record.parties} invite="ems" canInvite={false} declarations />
            {viewerRole === 'ems' && service === 'event' ? (
              <a href={`/events/${id}/declaration`} style={{ fontSize: '14.5px' }}><L en="Open your agency's readiness declaration" ar="فتح إقرار جاهزية جهتكم" /></a>
            ) : null}
          </>
        );
      case 'V7':
        // A hosting venue's AEDs: the PAD facility registration on the same site, shown and never
        // re-entered. With none linked, the operator links one, registers one, or records that there is none.
        return (
          <>
            {extras['V7'] ?? null}
            {record.facts?.padFacility ? null : form(inst, canEdit)}
          </>
        );
      case 'B2':
        return (
          <PlanSections record={record} viewerRole={viewerRole} canEdit={canEdit} canApprove={record.editable && viewerConfirmed} derived={derived} governance={governance} facility={facility} organizerMayEdit={record.editable && viewerConfirmed && viewerRole === 'organizer'} />
        );
      case 'B4': {
        // Levels 2 and 3: where the BLS provider also covers first aid, that answer discharges
        // this row and there is nothing to enter twice (partner audit, 8 October 2026).
        const team = instances.find((i) => i.key === 'B5');
        if (team && team.values['firstAid'] === 'yes') {
          return <p style={{ margin: 0, fontSize: '14.5px', color: 'var(--muted)' }}><a href="#req-B5"><L en="Open the BLS medical response team" ar="فتح فريق الاستجابة الطبية للدعم الحيوي الأساسي" /></a></p>;
        }
        return inst.fields.length === 0 ? null : form(inst, canEdit);
      }
      case 'B7':
        // Invitation first (owner, 8 October 2026): while no agency is invited, the organizer who
        // cannot answer this row sees only the invitation; the agency's questions follow it.
        return (
          <>
            {record.level !== 1 ? <PartyBlock kind={service} id={id} parties={record.parties} invite="ems" canInvite={canInvite} /> : null}
            {!canEdit && viewerRole === 'organizer' && record.level !== 1 && !hasParty('ems') ? null : form(inst, canEdit)}
          </>
        );
      case 'B16': {
        // Level 3: the eleven major-incident items are answered here and are the plan's section 12 (owner, 8 October 2026).
        const items = record.plan.find((p) => p.key === 'P12')?.items ?? [];
        if (inst.fields.length > 0 || items.length === 0) return form(inst, canEdit);
        const itemAuthors: AuthorRole[] = ['ems', 'director'];
        const itemEdit = record.editable && viewerConfirmed && itemAuthors.includes(viewerRole);
        return (
          <div data-region="major-incident-items" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((m) => (
              <div key={m.key} data-major-incident-item={m.key} data-complete={m.complete} style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10 }}>
                <div style={{ fontSize: '14.5px', fontWeight: 500, marginBlockEnd: 4 }}><span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginInlineEnd: 8 }}>{m.n}</span><L en={m.en} ar={m.ar} /></div>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted)' }}><L en={m.promptEn} ar={m.promptAr} /></p>
                {m.linked.length > 0 ? <LinkedAnswers linked={m.linked} /> : (
                  <RequirementForm kind={service} id={id} instance={textInstance(m.key, m.en, m.ar, record, itemAuthors)} canEdit={itemEdit}
                    awaiting={itemEdit ? null : itemAuthors.includes(viewerRole) || !record.editable ? { en: 'Not answered', ar: 'لم تُقدَّم إجابة' } : { en: 'Awaiting EMS agency / Medical Director input', ar: 'بانتظار إدخال جهة الإسعاف / المدير الطبي' }} />
                )}
              </div>
            ))}
          </div>
        );
      }
      default:
        return (
          <>
            {inst.fields.length > 0 ? form(inst, canEdit) : null}
            {inst.file ? <FileControl kind={service} id={id} inst={inst} canEdit={canEdit} filed={record.filed} contentType={contentTypes[inst.key] ?? null} refusal={refusal?.key === inst.key ? refusal.reason : null} /> : null}
          </>
        );
    }
  };

  const planLink = (inst: RequirementInstance) => inst.linkedPlan.length > 0 && record.level !== null && record.level >= 2 ? (
    <a href={`#plan-${inst.linkedPlan[0]}`} style={{ color: 'var(--muted)', textDecoration: 'underline' }}>
      <L en={REQUIREMENT_COPY.planSectionEn.replace('{n}', inst.linkedPlan.map((k) => String(Number(k.slice(1)))).join(', '))} ar={REQUIREMENT_COPY.planSectionAr.replace('{n}', inst.linkedPlan.map((k) => String(Number(k.slice(1)))).join('، '))} />
    </a>
  ) : null;

  // The steps: every required row, then the recommended rows, then the final review when the page has one.
  // A step is the viewer's when the catalogue names their role on it (the organizer's invitation rows included).
  const yours = (inst: RequirementInstance) => mayAuthor(inst, viewerRole) || (viewerRole === 'organizer' && inst.key === 'B3') || inviteFirst(inst);
  // A row the viewer would write but cannot says why, on the card itself: a filed record
  // waits on the Ministry; a closed one is read-only. Silence here read as a defect.
  const readOnlyNote = record.editable ? null : record.filed
    ? <L en="Submitted to the Ministry: read-only unless the Ministry returns it for revision." ar="قُدّم إلى الوزارة: للقراءة فقط ما لم تُعده الوزارة للتعديل." />
    : <L en="This record is read-only: it is archived, cancelled or closed." ar="هذا السجل للقراءة فقط: فهو مؤرشف أو ملغى أو مقفل." />;
  const steps: StepperStep[] = [...rows('required'), ...rows('recommended')].map((inst) => ({
    key: inst.key, anchor: inst.anchor, labelEn: inst.labelEn, labelAr: inst.labelAr, stateEn: inst.stateEn, stateAr: inst.stateAr, state: inst.state,
    kind: inst.group === 'recommended' ? 'recommended' : 'required',
    yours: yours(inst), whoEn: handledBy(inst).en, whoAr: handledBy(inst).ar,
    body: <RequirementCard inst={inst} open extra={planLink(inst)} yours={yours(inst)} owner={ownerLine(inst)} note={yours(inst) ? readOnlyNote : null}>{body(inst)}</RequirementCard>,
  }));
  if (final) steps.push({ key: 'final-review', anchor: 'final-review', labelEn: 'Review and submit', labelAr: 'المراجعة والتقديم', stateEn: '', stateAr: '', state: 'final', kind: 'final', yours: true, whoEn: '', whoAr: '', body: final });
  // The page opens on the step a redirect named; else on the viewer's first required row still open; else any open required row; with nothing open, on the final review.
  const initialKey = (initialStep && steps.find((s) => s.key === initialStep)?.key)
    || steps.find((s) => s.kind === 'required' && s.yours && s.state !== 'complete')?.key
    || steps.find((s) => s.kind === 'required' && s.state !== 'complete')?.key
    || steps.find((s) => s.kind === 'final')?.key || steps[0]?.key || '';

  // Who completes this record, said once above the steps (owner, 8 October 2026).
  const roles = new Set(instances.flatMap((i) => i.authors));
  const parties: AuthorRole[] = (['organizer', 'ems', 'director'] as AuthorRole[]).filter((r) => roles.has(r));
  const guide = parties.length > 1 ? (() => {
    const others = parties.filter((r) => r !== viewerRole);
    const o = { en: others.map((r) => `the ${REQUIREMENT_AUTHORS[r].en}`).join(' and '), ar: others.map((r) => REQUIREMENT_AUTHORS[r].ar).join(' و') };
    // Plain and short (owner, 8 October 2026): who fills what, when answers save, when anything is sent.
    return {
      en: `${parties.length === 3 ? 'Three' : 'Two'} parties fill in this record: you${parties.length === 3 ? ',' : ' and'} ${o.en}. Amber steps are yours. Grey steps are filled in by ${o.en} after they accept your invitation; their answers then appear on those steps. Your answers are saved when you move to another step. Nothing is sent to the Ministry until you submit.`,
      ar: `${parties.length === 3 ? 'ثلاثة أطراف يملؤون' : 'طرفان يملآن'} هذا السجل: أنتم و${o.ar}. الخطوات الكهرمانية لكم. أما الخطوات الرمادية فيملؤها ${o.ar} بعد قبول دعوتكم، ثم تظهر إجاباتهم عليها. تُحفظ إجاباتكم عند الانتقال إلى خطوة أخرى. لا يُرسل شيء إلى الوزارة قبل أن تقدّموا السجل.`,
    };
  })() : null;
  const handoffParty = handoff && record.editable && viewerRole === 'organizer' ? handoff : null;
  const handoffSteps = handoffParty ? steps.map((s, i) => ({ s, n: i + 1, inst: instances.find((x) => x.key === s.key) })).filter(({ s: st, inst }) => st.kind === 'required' && inst && !mayAuthor(inst, 'organizer') && inst.authors.includes(handoffParty)) : [];
  const handoffRow = handoffParty === 'ems' ? instances.find((x) => x.key === 'B7') : handoffSteps[0]?.inst;
  const currentIndex = Math.max(0, steps.findIndex((s) => s.key === initialKey));
  // On to the organizer's own steps: the next one still open, else the next one of theirs.
  const mine = (s: StepperStep) => s.yours && s.kind !== 'final' && s.key !== 'B3';
  const skipStep = steps.slice(currentIndex + 1).find((s) => mine(s) && s.state !== 'complete') ?? steps.find((s) => mine(s) && s.state !== 'complete')
    ?? steps.slice(currentIndex + 1).find(mine) ?? steps.find(mine);

  return (
    <div data-region="record-requirements">
      <JumpTo />
      <RestoreScroll />
      {guide ? (
        <div data-region="record-guide" role="note" style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 20, fontSize: '14px', lineHeight: 1.6 }}>
          <L en={guide.en} ar={guide.ar} />
        </div>
      ) : null}
      {handoffParty && handoffSteps.length > 0 ? (
        <HandoffDialog
          party={REQUIREMENT_AUTHORS[handoffParty]}
          steps={handoffSteps.map(({ s, n }) => ({ n, anchor: s.anchor, labelEn: s.labelEn, labelAr: s.labelAr }))}
          questions={(handoffRow?.fields ?? []).map((f) => ({ en: f.labelEn, ar: f.labelAr }))}
          skipTo={skipStep?.anchor ?? null}
        />
      ) : null}
      {steps.length > 0 ? (
        <RecordStepper steps={steps} initialKey={initialKey} listHref={listHref} groups={{ required: REQUIREMENT_GROUPS.required, recommended: REQUIREMENT_GROUPS.recommended }} />
      ) : null}
      {/* The whole list, for whoever wants it whole: the two summaries and the later-phase rows. Collapsed by default (owner, 7 October). */}
      <details data-region="requirement-list-all" className="record-details" style={{ marginBlockStart: 40 }}>
        <summary><L en="All requirements" ar="جميع المتطلبات" /> · <L en={`${record.summary.required.complete} of ${record.summary.required.total} required complete`} ar={`${record.summary.required.complete} من ${record.summary.required.total} من المتطلبات المطلوبة مكتملة`} /></summary>
        {listHref ? (
          <div style={{ marginBlockEnd: 12 }}>
            <a href={listHref} style={{ fontSize: '13.5px', color: 'var(--brand)', textDecoration: 'underline', textUnderlineOffset: 3 }}><L en="Download the full requirement list" ar="تنزيل قائمة المتطلبات الكاملة" /></a>
          </div>
        ) : null}
        <RequirementSummaries instances={instances} summary={record.summary} />
        {later.length > 0 ? (
          <details data-group="later" className="record-details">
            <summary><L en={REQUIREMENT_GROUPS.later.en} ar={REQUIREMENT_GROUPS.later.ar} /> · <L en={REQUIREMENT_GROUPS.later.noteEn} ar={REQUIREMENT_GROUPS.later.noteAr} /></summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              {later.map((inst) => (
                <div key={inst.key} id={inst.anchor} data-requirement={inst.key} data-group="later" style={{ background: 'var(--bg)', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14.5px' }}>
                    <span style={{ fontWeight: 500 }}><L en={inst.labelEn} ar={inst.labelAr} /></span>
                    {inst.promptEn ? <span style={{ display: 'block', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.5 }}><L en={inst.promptEn} ar={inst.promptAr} /></span> : null}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en={inst.obligationEn} ar={inst.obligationAr} /></span>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </details>
    </div>
  );
}
