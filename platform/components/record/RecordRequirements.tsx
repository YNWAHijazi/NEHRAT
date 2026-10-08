import type { ReactNode } from 'react';
import { L } from '../L';
import type { RecordParty, RecordRequirements as RecordData } from '../../lib/record-facts';
import type { RecordView } from '../../lib/record-view';
import { REQUIREMENT_COPY, REQUIREMENT_GROUPS, handledBy, mayAuthor, type AuthorRole, type RequirementInstance } from '../../lib/rules';
import { FileControl } from './FileControl';
import { JumpTo } from './JumpTo';
import { PartyBlock } from './PartyBlock';
import { PlanSections } from './PlanSections';
import { RecordStepper, type StepperStep } from './RecordStepper';
import { RequirementCard } from './RequirementCard';
import { RequirementForm } from './RequirementForm';
import { RequirementSummaries } from './RequirementSummaries';
import { VenueDeclarationForm } from './VenueDeclarationForm';

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
}

/**
 * The requirement-led body every record page shares, one requirement at a time (owner
 * direction, 2026-10-07): a numbered step per required row, then the recommended rows,
 * then the final review; the full list stays below for whoever wants it whole. Events
 * and venues, organizer and medical parties, all read the same instances; only who may
 * write differs.
 */
export function RecordRequirements({ record, viewerRole, viewerConfirmed, contentTypes, refusal, derived, governance = {}, facility = null, viewerParty = null, final = null, listHref = null, directorVerification = null, initialStep = null }: RecordRequirementsProps) {
  const { instances, service, id } = record;
  const canEditInst = (inst: RequirementInstance) => record.editable && viewerConfirmed && mayAuthor(inst, viewerRole);
  const canInvite = record.editable && viewerRole === 'organizer';
  const rows = (group: 'required' | 'recommended') => instances.filter((i) => i.group === group && i.section === 'requirement');
  const later = instances.filter((i) => i.group === 'later');

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
            {viewerRole === 'ems' && service === 'venue' && viewerParty && record.editable ? (
              <VenueDeclarationForm id={id} signed={Boolean(viewerParty.declarationSigned)} fileHref={viewerParty.declarationSigned ? `/api/venue-documents/${id}/20-${viewerParty.token}` : null} />
            ) : null}
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
        return inst.fields.length === 0 ? null : <RequirementForm kind={service} id={id} instance={inst} canEdit={canEdit} />;
      }
      case 'B7':
        return (
          <>
            {record.level !== 1 ? <PartyBlock kind={service} id={id} parties={record.parties} invite="ems" canInvite={canInvite} /> : null}
            <RequirementForm kind={service} id={id} instance={inst} canEdit={canEdit} />
          </>
        );
      case 'B16':
        return inst.fields.length === 0 ? (
          <p style={{ margin: 0, fontSize: '14.5px' }}><a href="#plan-P12"><L en="Open the major-incident section of the medical plan" ar="فتح قسم الحوادث الجسيمة في الخطة الطبية" /></a></p>
        ) : <RequirementForm kind={service} id={id} instance={inst} canEdit={canEdit} />;
      default:
        return (
          <>
            {inst.fields.length > 0 ? <RequirementForm kind={service} id={id} instance={inst} canEdit={canEdit} /> : null}
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
  const yours = (inst: RequirementInstance) => mayAuthor(inst, viewerRole) || (viewerRole === 'organizer' && inst.key === 'B3');
  // A row the viewer would write but cannot says why, on the card itself: a filed record
  // waits on the Ministry; a closed one is read-only. Silence here read as a defect.
  const readOnlyNote = record.editable ? null : record.filed
    ? <L en="Submitted to the Ministry: read-only unless the Ministry returns it for revision." ar="قُدّم إلى الوزارة: للقراءة فقط ما لم تُعده الوزارة للتعديل." />
    : <L en="This record is read-only: it is archived, cancelled or closed." ar="هذا السجل للقراءة فقط: فهو مؤرشف أو ملغى أو مقفل." />;
  const steps: StepperStep[] = [...rows('required'), ...rows('recommended')].map((inst) => ({
    key: inst.key, anchor: inst.anchor, labelEn: inst.labelEn, labelAr: inst.labelAr, stateEn: inst.stateEn, stateAr: inst.stateAr, state: inst.state,
    kind: inst.group === 'recommended' ? 'recommended' : 'required',
    yours: yours(inst), whoEn: handledBy(inst).en, whoAr: handledBy(inst).ar,
    body: <RequirementCard inst={inst} open extra={planLink(inst)} yours={yours(inst)} note={yours(inst) ? readOnlyNote : null}>{body(inst)}</RequirementCard>,
  }));
  if (final) steps.push({ key: 'final-review', anchor: 'final-review', labelEn: 'Review and submit', labelAr: 'المراجعة والتقديم', stateEn: '', stateAr: '', state: 'final', kind: 'final', yours: true, whoEn: '', whoAr: '', body: final });
  // The page opens on the step a redirect named; else on the viewer's first required row still open; else any open required row; with nothing open, on the final review.
  const initialKey = (initialStep && steps.find((s) => s.key === initialStep)?.key)
    || steps.find((s) => s.kind === 'required' && s.yours && s.state !== 'complete')?.key
    || steps.find((s) => s.kind === 'required' && s.state !== 'complete')?.key
    || steps.find((s) => s.kind === 'final')?.key || steps[0]?.key || '';

  return (
    <div data-region="record-requirements">
      <JumpTo />
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
