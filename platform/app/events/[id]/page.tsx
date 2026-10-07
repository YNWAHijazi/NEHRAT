import { EventWorkspaceHeader } from '../../../components/EventWorkspaceHeader';
import { InfoNote } from '../../../components/InfoNote';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { StageRail } from '../../../components/StageRail';
import { NextStepCard } from '../../../components/NextStepCard';
import { GatedAction, actionGrid } from '../../../components/RecordActions';
import { RecordRequirements } from '../../../components/record/RecordRequirements';
import { FinalReview, type ReviewRow } from '../../../components/record/FinalReview';
import { VendorDirectoryLink } from '../../../components/VendorDirectoryLink';
import { EmailDeliveryNotice } from '../../../components/EmailDeliveryNotice';
import type { RailStage } from '../../../lib/rules/rail';
import { currentAccount, organizationFor } from '../../../lib/auth';
import { DirectorEventView } from './DirectorEventView';
import { invitationForEvent, governanceFor, nominationBriefing, nomineePlanSlice, postEventReportFacts, postEventReportFor, standingDeterminationFor, submissionFor, venueRouteFor, revisionOpenFor } from '../../../lib/queries';
import { submissionGateFor } from '../../../lib/submission-facts';
import { requirementSnapshotVersions } from '../../../lib/record-facts';
import { eventRecordView } from '../../../lib/record-view';
import { clockNow } from '../../../lib/clock';
import { reapplyEventAction } from '../../actions';
import {
  archiveWindowDays,
  assessmentsFor,
  beirutToday,
  eventFor,
  unreadCountFor,
} from '../../../lib/queries';
import {
  eventFilingDeadline,
  isArchivedRecord,
  eventStage, POST_EVENT_STAGE, RAIL_STAGE_COUNT,
  LIFECYCLE_CONTENT, materialChangeGate, seriousIncidentGate,
  postEventReportGate, organizerEventState,
  type EventGateContext,
  MINISTRY_CONTENT,
  postEventReportRequired,
  recordNextStep,
  levelWhy,
  COMPLIANCE_DECLARATIONS,
  COMPLIANCE_CERTIFICATION_STATEMENT,
  COMPLIANCE_HEADER,
  REQUIREMENT_DECISIONS,
} from '../../../lib/rules';

export default async function EventRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string; upload?: string; doc?: string; error?: string; approval?: string; mail?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const query = (await searchParams) ?? {};

  // The Director's ONE PAGE on the same route: the event's facts, the governance
  // sections they write, the report when it is owed (partner ruling, counterparty
  // pass). An account that was not nominated on this event gets not-found, exactly
  // like a missing id (rule 6).
  if (account.role === 'director') {
    const invitation = invitationForEvent(account.id, id, 'director');
    // A declined nomination ends the entitlement by the holder's own answer.
    if (!invitation || invitation.status === 'declined') notFound();
    const governance = governanceFor(id);
    const report = postEventReportFor(invitation.organizerAccountId, id);
    const confirmed = invitation.status === 'confirmed';
    return (
      <DirectorEventView
        account={account}
        invitation={invitation}
        unread={unreadCountFor(account.id)}
        governance={governance}
        reportSigned={report ? { organizer: Boolean(report.organizerSignedAt), director: Boolean(report.directorSignedAt) } : null}
        briefing={nominationBriefing(invitation.token)}
        plan={confirmed ? nomineePlanSlice(id) : null}
        notice={query.notice}
        view={confirmed ? eventRecordView(invitation.organizerAccountId, id) : null}
        refusal={query.upload && query.doc ? { key: query.doc, reason: query.upload } : null}
        approval={query.approval ?? null}
        error={query.error ?? null}
      />
    );
  }

  const event = eventFor(account.id, id);
  if (!event) notFound();
  const notice = query.notice;

  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const versions = assessmentsFor(account.id, id);
  const latest = versions[0] ?? null;
  const derivation = latest?.derivation ?? null;
  const today = beirutToday();

  // Shelved by the Ministry or the owner, or concluded past the archive window on
  // its own -- one rule, the same one the mutating actions refuse on.
  const recordArchived = isArchivedRecord(
    { archivedAt: event.archivedAt, endDate: event.endDate },
    today,
    archiveWindowDays(),
  );

  const gateCtx: EventGateContext = {
    finalLevel: derivation?.finalLevel ?? event.level,
    eventEndDate: event.endDate,
    eventEndTime: event.closingTime ?? null,
    eventStartDate: event.startDate,
    filed: event.filed,
    lifecycle: event.lifecycle,
    organizationStatus: organization?.status ?? 'none',
    archived: recordArchived,
    now: clockNow(),
  };

  const filing = eventFilingDeadline(gateCtx);
  const level = gateCtx.finalLevel;

  // THE ONE SOURCE OF STATUS (brief item 7): the record's requirement instances, the
  // same ones the submit gate reads. The outstanding figure IS the gate's blocker count.
  const gate = submissionGateFor(account.id, id);
  const record = gate.record;
  const standingDetermination = standingDeterminationFor(id);
  const CERT = MINISTRY_CONTENT.certificate;
  const returned = event.filed && revisionOpenFor(id);
  const outstanding = gate.blockers.length;
  const action = record
    ? recordNextStep({ service: 'event', level, editable: record.editable, filed: event.filed, returned, instances: record.instances, organizationPending: organization?.status === 'pending' })
    : null;

  // The six-stage rail, from the record's own state.
  const assessed = derivation?.complete === true || (derivation === null && event.level !== null);
  const latestDate = latest?.createdAt.slice(0, 10) ?? '';
  const reportSubmitted = postEventReportFor(account.id, id)?.submittedAt != null;
  // Protocol 13 p2, all three limbs (register closure, 2026-09-03): Level 3
  // always; a notified reportable event at Level 1 or 2; a Ministry request.
  const reportFacts = postEventReportFacts(id);
  const reportRequirement = postEventReportRequired({
    finalLevel: level,
    seriousIncidentNotified: reportFacts.seriousIncidentNotified,
    reportableEventRecorded: reportFacts.reportableEventRecorded,
    ministryRequested: reportFacts.ministryRequested,
  });
  const stageInfo = eventStage({
    assessed,
    filed: event.filed,
    outcome: event.outcome,
    finalLevel: level,
    reportRequired: reportRequirement.required,
    eventEndDate: event.endDate,
    reportSubmitted,
    now: clockNow(),
  });
  const stage = stageInfo.stage;
  const requiredSummary = record?.summary.required ?? { total: 0, complete: 0 };
  const stages: RailStage[] = [
    { k: 'done', en: 'Event details', ar: 'بيانات الفعالية', metaEn: '', metaAr: '' },
    assessed
      ? { k: 'done', en: 'Assessment', ar: 'التقييم', metaEn: `${latestDate} · Level ${level ?? ''}`, metaAr: `⁦${latestDate}⁩ · المستوى ${level ?? ''}` }
      : { k: 'current', en: 'Assessment', ar: 'التقييم', metaEn: 'Not yet complete', metaAr: 'لم يكتمل بعد' },
    stage === 3
      ? { k: returned ? 'returned' : 'current', en: 'Requirements', ar: 'المتطلبات', metaEn: `${requiredSummary.complete} of ${requiredSummary.total} complete`, metaAr: `اكتمل ${requiredSummary.complete} من ${requiredSummary.total}` }
      : stage > 3
        ? { k: 'done', en: 'Requirements', ar: 'المتطلبات', metaEn: '', metaAr: '' }
        : { k: 'todo', en: 'Requirements', ar: 'المتطلبات', metaEn: '', metaAr: '' },
    event.filed
      ? { k: 'done', en: 'Submitted', ar: 'التقديم', metaEn: event.mophReference ?? '', metaAr: event.mophReference ?? '' }
      : { k: 'todo', en: 'Submit', ar: 'التقديم', metaEn: filing ? `Submit by ${filing.date}` : '', metaAr: filing ? `التقديم بحلول ⁦${filing.date}⁩` : '' },
    event.outcome
      ? { k: 'done', en: 'Ministry outcome', ar: 'نتيجة الوزارة', metaEn: event.stateEn, metaAr: event.stateAr }
      : { k: event.filed ? 'current' : 'todo', en: 'Ministry review', ar: 'مراجعة الوزارة', metaEn: event.filed ? 'Waiting for the Ministry' : 'After submission', metaAr: event.filed ? 'بانتظار الوزارة' : 'بعد التقديم' },
    reportRequirement.required
      ? stage === POST_EVENT_STAGE
        ? { k: 'current', en: 'Post-event report', ar: 'التقرير الطبي لما بعد الفعالية', metaEn: 'Open now — within 7 days of the event', metaAr: 'مفتوح الآن — خلال 7 أيام من الفعالية' }
        : { k: reportSubmitted ? 'done' : 'todo', en: 'Post-event report', ar: 'التقرير الطبي لما بعد الفعالية', metaEn: reportRequirement.limb === 'level3' ? 'Within 7 days of the event' : reportRequirement.en, metaAr: reportRequirement.limb === 'level3' ? 'خلال 7 أيام من الفعالية' : reportRequirement.ar }
      : { k: 'na', en: 'Post-event report', ar: 'التقرير الطبي لما بعد الفعالية', metaEn: reportRequirement.en, metaAr: reportRequirement.ar },
  ];
  const railNoteEn = `Stage ${stage} of ${RAIL_STAGE_COUNT}`;
  const railNoteAr = `المرحلة ${stage} من ${RAIL_STAGE_COUNT}`;

  // Submission history: the frozen packages, the assessment versions and creation, newest first.
  const snapshots = requirementSnapshotVersions('event', id);
  const history: { en: string; ar: string; date: string }[] = [
    ...snapshots.map((s) => ({ en: `Submitted — version ${s.version}`, ar: `قُدِّم — النسخة ${s.version}`, date: s.filedAt.slice(0, 10) })),
    ...versions.map((v) => ({
      en: `Assessment saved — version ${v.version}`,
      ar: `حُفظ التقييم — النسخة ${v.version}`,
      date: v.createdAt.slice(0, 10),
    })),
    { en: 'Event created', ar: 'أُنشئت الفعالية', date: event.createdAt.slice(0, 10) },
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const why = latest ? levelWhy(latest.derivation, latest.inputs.eventDisciplines) : null;
  const submission = submissionFor(account.id, id);
  const view = eventRecordView(account.id, id);
  const contentTypes = view?.contentTypes ?? {};
  const derived = view?.derived ?? { scheduleEn: '', scheduleAr: '', contactsEn: '', contactsAr: '', organizerPhoneMissing: true };
  const venueRoute = venueRouteFor(account.id, id);
  const dates = event.startDate === event.endDate ? (event.startDate ?? '—') : `${event.startDate} — ${event.endDate}`;
  const review = (inst: { key: string; labelEn: string; labelAr: string; stateEn: string; stateAr: string; anchor: string; state: string }): ReviewRow =>
    ({ key: inst.key, labelEn: inst.labelEn, labelAr: inst.labelAr, stateEn: inst.stateEn, stateAr: inst.stateAr, anchor: inst.anchor, complete: inst.state === 'complete' });
  const declarationInst = record?.instances.find((i) => i.key === 'P-C') ?? null;
  const statementsApply = level !== null && level >= 2;
  // The eight header fields the compliance form defines -- from the data, not hand-written.
  const headerValue: Record<string, { en: string; ar: string }> = {
    eventName: { en: event.nameEn, ar: event.nameAr },
    organizer: { en: organization?.nameEn ?? '—', ar: organization?.nameAr ?? '—' },
    dates: { en: dates, ar: dates },
    venueRoute: { en: venueRoute || '—', ar: venueRoute || '—' },
    finalLevel: { en: `Level ${level ?? '—'}`, ar: `المستوى ${level ?? '—'}` },
    submissionDate: { en: submission?.filedAt?.slice(0, 10) ?? '—', ar: submission?.filedAt?.slice(0, 10) ?? '—' },
    mophReference: { en: event.mophReference ?? '—', ar: event.mophReference ?? '—' },
    planVersion: { en: record && record.planVersion > 0 ? String(record.planVersion) : '—', ar: record && record.planVersion > 0 ? String(record.planVersion) : '—' },
  };
  const headerRows = COMPLIANCE_HEADER.map((h) => ({ en: h.en, ar: h.ar, valueEn: headerValue[h.key]?.en ?? '—', valueAr: headerValue[h.key]?.ar ?? '—' }));

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <EventWorkspaceHeader accountId={account.id} event={event} />
        {/* The lifecycle band beats everything: a cancelled or postponed record says
            so before anything else, with the consequence stated. */}
        {recordArchived ? (
          <div data-region="archived-band" style={{ padding: '20px 26px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
            {event.archivedAt !== null ? (
              <L en={`Archived by the Ministry on ${event.archivedAt.slice(0, 10)} · Read-only.`} ar={`أُرشف هذا السجل لدى الوزارة في ⁦${event.archivedAt.slice(0, 10)}⁩ · للقراءة فقط.`} />
            ) : (
              <L en={`Archived · Read-only.`} ar={`مؤرشفة · للقراءة فقط.`} />
            )}
          </div>
        ) : null}
        {notice === 'reapplied' ? (
          <div data-region="reapplied-notice" style={{ padding: '20px 26px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 16, marginBlockEnd: 20, fontSize: 15, lineHeight: 1.7 }}>
            <L en={`Copied from ${event.copiedFrom ?? 'the previous event'}. Update the dates and review the requirements.`} ar={`نُسخت من ${event.copiedFrom ?? 'الفعالية السابقة'}. حدّثوا التواريخ وراجعوا المتطلبات.`} />{' '}
            <InfoNote><L en="Nothing from the previous event carries over as approved. The level is derived again from your answers." ar="لا شيء من الفعالية السابقة يُعتمد كما هو. ويُستنتج المستوى من جديد من إجاباتكم." /></InfoNote>
          </div>
        ) : null}
        {query.error === 'archived' ? (
          <div role="alert" style={{ padding: '16px 22px', border: '1px solid var(--bad)', borderRadius: 12, marginBlockEnd: 20, fontSize: '14.5px' }}>
            <L en="This record is archived and read-only." ar="هذا السجل مؤرشف وللقراءة فقط." />
          </div>
        ) : null}
        {/* REAPPLY: the one action a concluded record offers -- it edits nothing and
            refiles nothing; it starts a NEW record prefilled from this one. */}
        {event.endDate !== null && event.endDate < today ? (
          <div data-region="reapply" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', padding: '16px 22px', border: '1px dashed var(--line)', borderRadius: 12, marginBlockEnd: 20 }}>
            <InfoNote labelEn="About duplicating an event" labelAr="حول نسخ الفعالية">
              <L en="Reuse these details for your next event. Enter new dates and review the requirements before submitting." ar="استخدموا هذه البيانات لفعاليتكم المقبلة. أدخلوا التواريخ الجديدة وراجعوا المتطلبات قبل التقديم." />
            </InfoNote>
            <form action={reapplyEventAction.bind(null, event.id)}>
              <button type="submit" style={{ height: 44, paddingInline: 22, border: '1px solid var(--brand)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', color: 'var(--brand)', cursor: 'pointer' }}>
                <L en="Duplicate event" ar="نسخ الفعالية" />
              </button>
            </form>
          </div>
        ) : null}
        {event.lifecycle === 'cancelled' ? (
          <div data-region="lifecycle-band" style={{ padding: '20px 26px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--bad)', borderRadius: 16, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.7 }}>
            <L en={LIFECYCLE_CONTENT.cancel.bandEn.replace('{date}', event.lifecycleAt ?? '')} ar={LIFECYCLE_CONTENT.cancel.bandAr.replace('{date}', event.lifecycleAt ? `⁦${event.lifecycleAt}⁩` : '')} />
          </div>
        ) : null}
        {event.lifecycle === 'postponed' ? (
          <div data-region="lifecycle-band" style={{ padding: '20px 26px', background: 'var(--accent-soft)', borderRadius: 16, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.7, color: 'var(--accent-ink)' }}>
            <L
              en={(event.postponedTo ? LIFECYCLE_CONTENT.postpone.bandDateEn.replace('{newDate}', event.postponedTo) : LIFECYCLE_CONTENT.postpone.bandNoDateEn).replace('{date}', event.lifecycleAt ?? '')}
              ar={(event.postponedTo ? LIFECYCLE_CONTENT.postpone.bandDateAr.replace('{newDate}', `⁦${event.postponedTo}⁩`) : LIFECYCLE_CONTENT.postpone.bandNoDateAr).replace('{date}', event.lifecycleAt ? `⁦${event.lifecycleAt}⁩` : '')}
            />{' '}
            <Link href={`/events/${event.id}/lifecycle`} style={{ fontSize: '13.5px' }}><L en="Open cancellation and postponement" ar="فتح الإلغاء والتأجيل" /></Link>
          </div>
        ) : null}
        {/* THE CERTIFICATE, at the top of the record once a determination stands. */}
        {standingDetermination ? (
          <div data-region="determination-card" style={{ paddingBlock: '23px', paddingInlineStart: '26px', paddingInlineEnd: '27px', background: 'var(--surface2)', borderInlineStart: `3px solid ${standingDetermination.outcome === 'satisfied' ? 'var(--brand)' : 'var(--accent)'}`, borderRadius: 12, marginBlockEnd: 32 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
              <L en={CERT.titleEn} ar={CERT.titleAr} />
            </div>
            <div style={{ fontSize: '17px', fontWeight: 500, lineHeight: 1.5, marginBlockEnd: 6 }}>
              <L
                en={MINISTRY_CONTENT.outcomes.find((o) => o.key === standingDetermination.outcome)?.en ?? standingDetermination.outcome}
                ar={MINISTRY_CONTENT.outcomes.find((o) => o.key === standingDetermination.outcome)?.ar ?? standingDetermination.outcome}
              />
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginBlockEnd: 14 }}>
              <L en={`${event.mophReference ?? ''} · ${CERT.byLabelEn} ${standingDetermination.recordedBy} · ${standingDetermination.recordedAt}`} ar={`${event.mophReference ?? ''} · ${CERT.byLabelAr} ${standingDetermination.recordedBy} · ⁦${standingDetermination.recordedAt}⁩`} />
            </div>
            <a href={`/events/${id}/determination`} style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
              <L en={standingDetermination.outcome === 'satisfied' ? 'View / print preparedness certificate' : CERT.openEn} ar={standingDetermination.outcome === 'satisfied' ? 'عرض / طباعة شهادة التأهب' : CERT.openAr} />
            </a>
          </div>
        ) : null}

        {/* Lead with work the organizer can do now; filing gates remain unchanged. */}
        {action && event.lifecycle === 'active' && !recordArchived ? (
          <NextStepCard step={action} to={action.href.startsWith('#') ? action.href : action.href === '/organization' ? '/organization' : `/events/${event.id}/${action.href}`} />
        ) : null}
        {/* Filed and not yet decided: say what happens next, and keep the receipt one click away. */}
        {event.filed && !returned && !standingDetermination && event.lifecycle === 'active' && !recordArchived ? (
          <NextStepCard
            step={{
              kind: 'underReview', href: 'acknowledgment', tone: 'brand',
              titleEn: organizerEventState({ outcome: null, filed: true, assessed: true }).en,
              titleAr: organizerEventState({ outcome: null, filed: true, assessed: true }).ar,
              bodyEn: 'The Ministry reviews the submission and records one of three outcomes. You are notified on this platform when it does.',
              bodyAr: 'تراجع الوزارة الطلب وتسجّل إحدى ثلاث نتائج. يصلكم إشعار على هذه المنصة عند تسجيلها.',
              buttonEn: 'View acknowledgment of receipt', buttonAr: 'عرض إشعار الاستلام',
            }}
            to={`/events/${event.id}/acknowledgment`}
          />
        ) : null}

        <StageRail titleEn="Event progress" titleAr="مراحل الفعالية" stages={stages} noteEn={railNoteEn} noteAr={railNoteAr} />

        {/* The compact details and assessment block, with deliberate edit actions. */}
        <section id="assessment" data-region="details-assessment" tabIndex={-1} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 28px', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 28, scrollMarginBlockStart: 16 }}>
          <div style={{ fontSize: '14.5px', lineHeight: 1.6, minWidth: 0 }}>
            <span style={{ fontWeight: 500 }}><L en="Details and assessment" ar="البيانات والتقييم" /></span>
            <span style={{ display: 'block', color: 'var(--muted)', fontSize: '13.5px' }}>
              {assessed ? (
                <>
                  <L en={`Level ${level} · assessment version ${latest?.version ?? '—'} · ${latestDate}`} ar={`المستوى ${level} · نسخة التقييم ${latest?.version ?? '—'} · ⁦${latestDate}⁩`} />
                  {why?.reason ? <> <InfoNote labelEn="How the level is calculated" labelAr="كيفية احتساب المستوى"><L en={why.reason.en} ar={why.reason.ar} />{why.comparison ? <> <L en={why.comparison.en} ar={why.comparison.ar} /></> : null}</InfoNote></> : null}
                </>
              ) : <L en="The assessment is not complete; no level is derived and no requirements apply yet." ar="التقييم غير مكتمل؛ لم يُستنتج مستوى ولا تنطبق متطلبات بعد." />}
            </span>
          </div>
          {event.lifecycle !== 'cancelled' && !recordArchived ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {!event.filed ? (
                <Link href={`/events/${event.id}/edit`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, paddingInline: 16, border: '1px solid var(--line)', borderRadius: 20, fontSize: 14, color: 'var(--ink)' }}>
                  <L en="Edit event details" ar="تعديل تفاصيل الفعالية" />
                </Link>
              ) : null}
              <Link href={`/events/${event.id}/reassess`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, paddingInline: 16, border: '1px solid var(--line)', borderRadius: 20, fontSize: 14, color: 'var(--ink)' }}>
                <L en={assessed ? 'Run the assessment again' : 'Complete the assessment'} ar={assessed ? 'إعادة إجراء التقييم' : 'إكمال التقييم'} />
              </Link>
            </div>
          ) : null}
        </section>

        {/* The routes off the record that are not requirements: a material change, an incident, the report. */}
        {event.filed ? (
          <div data-region="record-actions" style={{ ...actionGrid, display: 'grid', marginBlockEnd: 28 }}>
            <GatedAction gate={materialChangeGate(gateCtx)} href={`/events/${event.id}/change`} en="Report a material change" ar="الإبلاغ عن تغيير جوهري" />
            <GatedAction gate={seriousIncidentGate(gateCtx)} href={`/events/${event.id}/incident`} en="Notify a serious incident" ar="الإبلاغ عن حادثة جسيمة" />
            <GatedAction gate={postEventReportGate(gateCtx)} href={`/events/${event.id}/post-event`} en="Post-event medical report" ar="التقرير الطبي لما بعد الفعالية" />
          </div>
        ) : null}

        {record && level !== null && declarationInst ? (
          <div id="req-summary" tabIndex={-1}>
            {/* How the last invitation was delivered (sent, link only, demonstration), after the row's action returns here. */}
            <EmailDeliveryNotice status={typeof query.mail === 'string' ? query.mail : undefined} />
            {record.filed && !returned ? (
              <div data-region="submitted-band" style={{ padding: '14px 20px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 20, fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
                <L en={`Submitted on ${submission?.filedAt?.slice(0, 10) ?? ''} · version ${submission?.version ?? 1}. The answers below are the record as the Ministry reads it.`} ar={`قُدِّم في ⁦${submission?.filedAt?.slice(0, 10) ?? ''}⁩ · النسخة ${submission?.version ?? 1}. الإجابات أدناه هي السجل كما تقرأه الوزارة.`} />
              </div>
            ) : null}
            <RecordRequirements
              record={record}
              viewerRole="organizer"
              viewerConfirmed
              contentTypes={contentTypes}
              refusal={query.upload && query.doc ? { key: query.doc, reason: query.upload } : null}
              derived={derived}
              governance={view?.governance ?? {}}
              facility={view?.facility ?? null}
              listHref={`/events/${id}/requirements`}
              final={(
                <FinalReview
                  eventId={id}
                  level={level}
                  remaining={record.blockers.map(review)}
                  optional={record.instances.filter((i) => i.group === 'recommended' && i.state !== 'complete').map(review)}
                  statements={statementsApply ? COMPLIANCE_DECLARATIONS.filter((d) => d.minLevel <= level).map((d) => ({ en: d.en, ar: d.ar })) : []}
                  declarationInst={declarationInst}
                  initial={submission}
                  filed={event.filed}
                  revisionOpen={returned}
                  expedited={gate.expedited}
                  certificationStatement={COMPLIANCE_CERTIFICATION_STATEMENT}
                  headerRows={headerRows}
                  externalBlockers={gate.blockers.filter((b) => b.kind === 'eventCancelled' || b.kind === 'feeUnpaid').map((b) => ({ kind: b.kind, en: b.itemEn, ar: b.itemAr }))}
                  fee={gate.fee}
                />
              )}
            />
            {/* The commercial directory link renders only while its capability is on (non-negotiable 12). */}
            <VendorDirectoryLink />
            <p data-region="decision-note" style={{ marginBlock: '24px 0', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '80ch' }}>
              <L en={`The questions and completion tests on this page follow the revised requirements matrix and the owner's confirmed decisions; ${Object.entries(REQUIREMENT_DECISIONS).filter(([, d]) => d.state === 'proposal').map(([k]) => k).join(', ')} are proposals awaiting partner sign-off.`} ar={`تتبع الأسئلة واختبارات الاكتمال في هذه الصفحة مصفوفة المتطلبات المنقّحة وقرارات المالك المؤكَّدة؛ و${Object.entries(REQUIREMENT_DECISIONS).filter(([, d]) => d.state === 'proposal').map(([k]) => k).join('، ')} مقترحات بانتظار اعتماد الشريك.`} />
            </p>
          </div>
        ) : null}

        {history.length > 0 ? (
          <details data-region="history" className="record-details" style={{ marginBlockStart: 32 }}>
            <summary><L en="Submission history" ar="سجل التقديم" /></summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockEnd: 16 }}>
              {history.map((h) => (
                <div key={`${h.en}-${h.date}`} style={{ background: 'var(--bg)', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14.5px' }}><L en={h.en} ar={h.ar} /></span>
                  <span style={{ fontSize: 14, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{h.date}</span>
                </div>
              ))}
            </div>
            {event.filed ? (
              <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '58ch' }}>
                <L en="You already submitted this record. Report any assessment change to the Ministry too." ar="سبق تقديم هذا السجل. أبلغوا الوزارة أيضاً بأي تغيير في التقييم." />
              </p>
            ) : null}
          </details>
        ) : null}
        {outstanding > 0 && record?.editable ? <span hidden data-region="outstanding-count">{outstanding}</span> : null}
        {event.lifecycle !== 'cancelled' && !recordArchived ? (
          <div style={{ marginBlockStart: 12 }}>
            <Link href={`/events/${event.id}/lifecycle`} style={{ fontSize: '13.5px', color: 'var(--muted)', textDecoration: 'underline' }}>
              <L en={LIFECYCLE_CONTENT.control.linkEn} ar={LIFECYCLE_CONTENT.control.linkAr} />
            </Link>
          </div>
        ) : null}
      </main>
    </>
  );
}
