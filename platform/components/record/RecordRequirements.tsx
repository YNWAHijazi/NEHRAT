import { L } from '../L';
import type { RecordParty, RecordRequirements as RecordData } from '../../lib/record-facts';
import type { RecordView } from '../../lib/record-view';
import { REQUIREMENT_COPY, REQUIREMENT_GROUPS, mayAuthor, type AuthorRole, type RequirementInstance } from '../../lib/rules';
import { FileControl } from './FileControl';
import { JumpTo } from './JumpTo';
import { PartyBlock } from './PartyBlock';
import { PlanSections } from './PlanSections';
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
}

/**
 * The requirement-led body every record page shares (brief items 1-2): the two
 * summaries, then the full-width Required and Recommended groups of collapsible cards,
 * then the later-phase rows for clarity. Events and venues, organizer and medical
 * parties, all read the same instances; only who may write differs.
 */
export function RecordRequirements({ record, viewerRole, viewerConfirmed, contentTypes, refusal, derived, governance = {}, facility = null, viewerParty = null }: RecordRequirementsProps) {
  const { instances, service, id } = record;
  const canEditInst = (inst: RequirementInstance) => record.editable && viewerConfirmed && mayAuthor(inst, viewerRole);
  const canInvite = record.editable && viewerRole === 'organizer';
  const rows = (group: 'required' | 'recommended') => instances.filter((i) => i.group === group && i.section === 'requirement');
  const later = instances.filter((i) => i.group === 'later');
  const firstPending = rows('required').find((i) => i.state !== 'complete')?.key;

  const body = (inst: RequirementInstance) => {
    const canEdit = canEditInst(inst);
    switch (inst.key) {
      case 'B3':
        return <PartyBlock kind={service} id={id} parties={record.parties} invite="director" canInvite={canInvite} />;
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
      case 'B4':
        return inst.fields.length === 0 ? (
          <p style={{ margin: 0, fontSize: '14.5px', color: 'var(--muted)' }}><a href="#req-B5"><L en="Open the response team" ar="فتح فريق الاستجابة" /></a></p>
        ) : <RequirementForm kind={service} id={id} instance={inst} canEdit={canEdit} />;
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

  const groupHead = (group: 'required' | 'recommended') => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 12 }}>
      <h2 style={{ fontSize: 24, margin: 0, fontWeight: 600, letterSpacing: '-.025em' }}><L en={REQUIREMENT_GROUPS[group].en} ar={REQUIREMENT_GROUPS[group].ar} /></h2>
      <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en={REQUIREMENT_GROUPS[group].noteEn} ar={REQUIREMENT_GROUPS[group].noteAr} /></span>
    </div>
  );

  return (
    <div data-region="record-requirements">
      <JumpTo />
      <RequirementSummaries instances={instances} summary={record.summary} />
      <section data-group="required" style={{ marginBlockEnd: 32 }}>
        {groupHead('required')}
        {rows('required').map((inst) => (
          <RequirementCard key={inst.key} inst={inst} open={inst.state !== 'complete' && (inst.key === firstPending || inst.state === 'waiting' || inst.key === 'B2')} extra={planLink(inst)}>
            {body(inst)}
          </RequirementCard>
        ))}
      </section>
      {rows('recommended').length > 0 ? (
        <section data-group="recommended" style={{ marginBlockEnd: 32 }}>
          {groupHead('recommended')}
          {rows('recommended').map((inst) => (
            <RequirementCard key={inst.key} inst={inst} open={false} extra={planLink(inst)}>
              {body(inst)}
            </RequirementCard>
          ))}
        </section>
      ) : null}
      {later.length > 0 ? (
        <details data-group="later" className="record-details">
          <summary><L en={REQUIREMENT_GROUPS.later.en} ar={REQUIREMENT_GROUPS.later.ar} /> · <L en={REQUIREMENT_GROUPS.later.noteEn} ar={REQUIREMENT_GROUPS.later.noteAr} /></summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            {later.map((inst) => (
              <div key={inst.key} id={inst.anchor} data-requirement={inst.key} data-group="later" style={{ background: 'var(--bg)', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14.5px' }}>
                  <span style={{ fontWeight: 500 }}><L en={inst.labelEn} ar={inst.labelAr} /></span>
                  <span style={{ display: 'block', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.5 }}><L en={inst.promptEn} ar={inst.promptAr} /></span>
                </span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en={inst.obligationEn} ar={inst.obligationAr} /></span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
