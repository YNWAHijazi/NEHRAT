import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { currentAccount, organizationFor } from '../../../lib/auth';
import { DirectorEventView } from './DirectorEventView';
import { invitationForEvent, governanceFor, postEventReportFor, standingDeterminationFor } from '../../../lib/queries';
import { submissionGateFor } from '../../../lib/submission-facts';
import { getDb } from '../../../lib/db';
import { clockNow } from '../../../lib/clock';
import {
  assessmentsFor,
  beirutToday,
  daysBetween,
  eventFor,
  invitationsFor,
  unreadCountFor,
} from '../../../lib/queries';
import {
  DOMAIN_COUNT,
  levelWhy,
  MAX_SCORE_PER_DOMAIN,
  eventFilingDeadline,
  eventMedicalDirectorGate, eventStage, nextAction, POST_EVENT_STAGE, RAIL_STAGE_COUNT,
  LIFECYCLE_CONTENT, materialChangeGate, seriousIncidentGate,
  postEventReportGate,
  type EventGateContext,
  type Gate,
  MINISTRY_CONTENT,
} from '../../../lib/rules';
import enMessages from '../../../lib/i18n/messages/en.json';
import arMessages from '../../../lib/i18n/messages/ar.json';

function messageFor(catalog: Record<string, unknown>, key: string, params?: Record<string, string | number>): string {
  const parts = key.split('.');
  let node: unknown = catalog;
  for (const part of parts) {
    node = (node as Record<string, unknown>)[part];
  }
  let text = String(node ?? key);
  for (const [k, v] of Object.entries(params ?? {})) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

const upLabel: React.CSSProperties = {
  fontSize: '11.5px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBlockEnd: 4,
};

/**
 * The four routes off the event record.
 *
 * They were a wrapping flex row, which put three pills on one line at three
 * different widths and the fourth alone on the next, with two reason captions
 * hanging under two of them and nothing lining up with anything. A grid gives
 * one column per action: the pills come out the same width, they sit on a
 * shared baseline, and every caption starts on the same line.
 *
 * ONE pill style, used by the plain link and by BOTH branches of GatedAction.
 * It was three inline copies and they had already drifted -- the disabled
 * button carried neither the colour nor the centring the two links had.
 */
const actionGrid: React.CSSProperties = {
  display: 'grid',
  /**
   * 376px is measured, not chosen: the longest label, "Open requirements and
   * attachments", sets 331px of text and the pill adds 44px of padding. Below
   * that the label wraps to two lines and the row stops looking aligned, which
   * is what a narrower column produced on the first attempt.
   */
  /**
   * min(376px, 100%), not 376px: a bare minimum track is a FLOOR the grid will
   * not go below, so on a 335px phone the row overflowed its own panel by 41px
   * and the page scrolled sideways. Wrapping it in min() lets the track collapse
   * to the container when the container is the smaller of the two.
   */
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(376px, 100%), 1fr))',
  gap: '14px 12px',
  alignItems: 'start',
  /**
   * Its own full-width row under the counters. Sharing the row left 731px, which
   * fits one 376px column and wastes the rest; the full width fits two.
   */
  flexBasis: '100%',
  // Basis alone left the row at its content width inside a wider panel; grow
  // makes it actually take the row it was given.
  flexGrow: 1,
};

const actionCell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  alignItems: 'stretch',
};

const actionPill: React.CSSProperties = {
  // A FLOOR, not a fixed height: the Arabic issue of a label is not the English
  // one's length, and a fixed 44px clips the second line rather than growing.
  minHeight: 44,
  paddingBlock: 8,
  paddingInline: 22,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  borderRadius: 22,
  fontSize: '14.5px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink)',
  width: '100%',
};

/**
 * Disabled is NOT the same pill in a grid cell. Non-negotiable 10 turns on a
 * reader telling "will become available" from "live" at a glance, and the old
 * disabled button got that distinction from the browser's default disabled
 * grey -- which the shared style would have overwritten with --ink, leaving a
 * dead control that looks live. Muted is stated here rather than inherited.
 */
const actionPillDisabled: React.CSSProperties = { ...actionPill, color: 'var(--muted)' };

const actionReason: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--muted)',
};

/**
 * A gated action row. Two behaviours, distinguishable at a glance:
 * enabled renders as a live control; disabled renders greyed WITH its reason beside it.
 * The third behaviour, absent, never reaches this component -- absent means no row.
 */
function GatedAction({
  gate,
  href,
  en,
  ar,
}: {
  gate: Gate;
  href: string;
  en: string;
  ar: string;
}) {
  if (gate.behaviour === 'absent') return null;
  if (gate.behaviour === 'enabled') {
    return (
      <span style={actionCell}>
        <Link href={href} style={actionPill}>
          <L en={en} ar={ar} />
        </Link>
      </span>
    );
  }
  const reasonEn = gate.reasonKey ? messageFor(enMessages, gate.reasonKey, gate.params) : '';
  const reasonAr = gate.reasonKey ? messageFor(arMessages, gate.reasonKey, gate.params) : '';
  return (
    <span style={actionCell}>
      <button type="button" disabled style={actionPillDisabled}>
        <L en={en} ar={ar} />
      </button>
      <span style={actionReason}>
        <L en={reasonEn} ar={reasonAr} />
      </span>
    </span>
  );
}


type StageKind = 'done' | 'current' | 'returned' | 'todo' | 'na';

interface RailStage {
  k: StageKind;
  en: string;
  ar: string;
  metaEn: string;
  metaAr: string;
}

const STAGE_STYLE: Record<StageKind, { color: string; edge: string; ink: string; weight: number; lblEn: string; lblAr: string; chipBg: string; chipColor: string }> = {
  done: { color: 'var(--brand)', edge: 'solid', ink: 'var(--ink)', weight: 500, lblEn: 'Complete', lblAr: 'مُنجزة', chipBg: 'var(--brand-soft)', chipColor: 'var(--brand)' },
  current: { color: 'var(--accent)', edge: 'solid', ink: 'var(--ink)', weight: 600, lblEn: 'Current', lblAr: 'الحالية', chipBg: 'var(--accent-soft)', chipColor: 'var(--accent-ink)' },
  returned: { color: 'var(--accent)', edge: 'solid', ink: 'var(--ink)', weight: 600, lblEn: 'Returned here', lblAr: 'أُعيدت إلى هنا', chipBg: 'var(--accent-soft)', chipColor: 'var(--accent-ink)' },
  todo: { color: 'var(--line)', edge: 'solid', ink: 'var(--muted)', weight: 400, lblEn: 'Not yet', lblAr: 'لم تبدأ', chipBg: 'var(--surface2)', chipColor: 'var(--muted)' },
  na: { color: 'var(--line)', edge: 'dashed', ink: 'var(--muted)', weight: 400, lblEn: 'Not applicable', lblAr: 'غير منطبقة', chipBg: 'var(--surface2)', chipColor: 'var(--muted)' },
};

function StageRailCard({ stages, noteEn, noteAr }: { stages: RailStage[]; noteEn: string; noteAr: string }) {
  return (
    <div data-region="rail" style={{ marginBlockEnd: 28, padding: '23px 27px', background: 'var(--surface2)', borderRadius: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 18 }}>
        <span style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          <L en="Where this event stands" ar="موضع هذه الفعالية" />
        </span>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          <L en={noteEn} ar={noteAr} />
        </span>
      </div>
      <div data-rail="" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
        {stages.map((s, i) => {
          const st = STAGE_STYLE[s.k];
          return (
            <div key={i} style={{ paddingBlockStart: 12, borderBlockStart: `3px ${st.edge} ${st.color}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBlockEnd: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                <span style={{ padding: '2px 7px', borderRadius: 999, background: st.chipBg, color: st.chipColor, fontSize: 11, letterSpacing: '.03em' }}>
                  <L en={st.lblEn} ar={st.lblAr} />
                </span>
              </div>
              <div style={{ fontSize: '14.5px', fontWeight: st.weight, lineHeight: 1.4, color: st.ink }}>
                <L en={s.en} ar={s.ar} />
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5, marginBlockStart: 5 }}>
                <L en={s.metaEn} ar={s.metaAr} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function EventRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;

  // The Director's view of the same route: what the matrix names them for. An
  // account that was not nominated on this event gets not-found, exactly like a
  // missing id (rule 6).
  if (account.role === 'director') {
    const invitation = invitationForEvent(account.id, id, 'director');
    // A declined nomination ends the entitlement by the holder's own answer.
    if (!invitation || invitation.status === 'declined') notFound();
    const governance = governanceFor(id);
    const providers = getDb()
      .prepare(`SELECT declaration FROM invitations WHERE event_id = ? AND kind = 'ems'`)
      .all(id) as unknown as { declaration: string }[];
    const report = postEventReportFor(invitation.organizerAccountId, id);
    return (
      <DirectorEventView
        account={account}
        invitation={invitation}
        unread={unreadCountFor(account.id)}
        governance={governance}
        providerStats={{ named: providers.length, signed: providers.filter((x) => x.declaration === 'signed').length }}
        reportSigned={report ? { organizer: Boolean(report.organizerSignedAt), director: Boolean(report.directorSignedAt) } : null}
      />
    );
  }

  const event = eventFor(account.id, id);
  if (!event) notFound();

  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const versions = assessmentsFor(account.id, id);
  const latest = versions[0] ?? null;
  const derivation = latest?.derivation ?? null;
  const why = derivation ? levelWhy(derivation, latest?.inputs.eventDisciplines) : null;
  const today = beirutToday();

  const gateCtx: EventGateContext = {
    finalLevel: derivation?.finalLevel ?? event.level,
    eventEndDate: event.endDate,
    eventStartDate: event.startDate,
    filed: event.filed,
    lifecycle: event.lifecycle,
    organizationStatus: organization?.status ?? 'none',
    now: clockNow(),
  };

  const filing = eventFilingDeadline(gateCtx);
  const daysLeft = filing ? daysBetween(today, filing.date) : null;
  const emdGate = eventMedicalDirectorGate(gateCtx);
  const level = gateCtx.finalLevel;

  const allInvitations = invitationsFor(account.id, id);
  // Is the Level 3 Director requirement actually outstanding? A nomination is not a
  // confirmation, so only a confirmed Director fills it.
  const standingDetermination = standingDeterminationFor(id);
  const CERT = MINISTRY_CONTENT.certificate;
  const directorConfirmed = allInvitations.some(
    (i) => i.kind === 'director' && i.status === 'confirmed',
  );
  // Both kinds count; a declined party HAS answered and is not pending.
  const agencyPending = allInvitations.filter((p) => p.status === 'nominated').length;
  const agencyPendColor = agencyPending > 0 ? 'var(--bad)' : 'var(--brand)';
  // The record and the submission package speak with one voice: the outstanding
  // figure IS the submit gate's blocker count, not a separate arithmetic.
  const gate = submissionGateFor(account.id, id);
  const outstanding = gate.blockers.length;
  const action = nextAction(gate.blockers);

  // The six-stage rail, from the record's own state. Stage 1 follows the organization's
  // real status; stage 6 is level-gated: at Level 3 it is coming (todo), below it is not
  // applicable (na) -- the same two-behaviour rule as everywhere else.
  const orgRecorded = organization?.status === 'recorded';
  // A seeded row's level stands in for stored answers (the level is the
  // assessment's product); the stage comes from the SHARED rule the dashboard
  // tile uses, so the two can never disagree again.
  const assessed = derivation?.complete === true || (derivation === null && event.level !== null);
  const latestDate = latest?.createdAt.slice(0, 10) ?? '';
  const reportSubmitted = postEventReportFor(account.id, id)?.submittedAt != null;
  const stageInfo = eventStage({
    assessed,
    filed: event.filed,
    outcome: event.outcome,
    finalLevel: level,
    eventEndDate: event.endDate,
    reportSubmitted,
    now: clockNow(),
  });
  const stage = stageInfo.stage;
  const stages: RailStage[] = [
    orgRecorded
      ? { k: 'done', en: 'Organization recorded', ar: 'تسجيل المؤسسة', metaEn: organization?.recordedAt ?? '', metaAr: organization?.recordedAt ? `\u2066${organization.recordedAt}\u2069` : '' }
      : { k: 'current', en: 'Organization recording', ar: 'تسجيل المؤسسة', metaEn: 'With the Ministry', metaAr: 'لدى الوزارة' },
    assessed
      ? { k: 'done', en: 'Assessment complete', ar: 'إتمام التقييم', metaEn: `${latestDate} · Level ${level ?? ''}`, metaAr: `\u2066${latestDate}\u2069 · المستوى ${level ?? ''}` }
      : { k: 'current', en: 'Assessment', ar: 'التقييم', metaEn: 'Not yet complete', metaAr: 'لم يكتمل بعد' },
    stage === 3
      ? { k: 'current', en: 'Requirements and attachments', ar: 'المتطلبات والمرفقات', metaEn: `${outstanding} outstanding`, metaAr: `${outstanding} غير مستوفى` }
      : stage > 3
        ? { k: 'done', en: 'Requirements and attachments', ar: 'المتطلبات والمرفقات', metaEn: '', metaAr: '' }
        : { k: 'todo', en: 'Requirements and attachments', ar: 'المتطلبات والمرفقات', metaEn: '', metaAr: '' },
    event.filed
      ? { k: 'done', en: 'Submitted', ar: 'التقديم', metaEn: event.mophReference ?? '', metaAr: event.mophReference ?? '' }
      : { k: 'todo', en: 'Submitted', ar: 'التقديم', metaEn: filing ? `File by ${filing.date}` : '', metaAr: filing ? `التقديم بحلول \u2066${filing.date}\u2069` : '' },
    event.outcome
      ? { k: 'done', en: 'Ministry outcome', ar: 'نتيجة الوزارة', metaEn: event.stateEn, metaAr: event.stateAr }
      : { k: event.filed ? 'current' : 'todo', en: 'Ministry outcome', ar: 'نتيجة الوزارة', metaEn: 'Waiting for the Ministry', metaAr: 'بانتظار الوزارة' },
    level === 3
      ? stage === POST_EVENT_STAGE
        ? { k: 'current', en: 'Post-event report', ar: 'التقرير الطبي لما بعد الفعالية', metaEn: 'Open now — within 7 days of the event', metaAr: 'مفتوح الآن — خلال 7 أيام من الفعالية' }
        : { k: reportSubmitted ? 'done' : 'todo', en: 'Post-event report', ar: 'التقرير الطبي لما بعد الفعالية', metaEn: 'Within 7 days of the event', metaAr: 'خلال 7 أيام من الفعالية' }
      : { k: 'na', en: 'Post-event report', ar: 'التقرير الطبي لما بعد الفعالية', metaEn: 'Not needed for this event', metaAr: 'غير مطلوب لهذه الفعالية' },
  ];
  // The tail that repeated the sixth column's own "Not applicable" label was cut
  // in the second simplification sweep -- the rail already says it.
  const railNoteEn = `Stage ${stage} of ${RAIL_STAGE_COUNT}`;
  const railNoteAr = `المرحلة ${stage} من ${RAIL_STAGE_COUNT}`;

  // Submission history: the assessment versions plus creation, newest first.
  const history: { en: string; ar: string; date: string }[] = [
    ...versions.map((v) => ({
      en: `Assessment saved — version ${v.version}`,
      ar: `حُفظ التقييم — النسخة ${v.version}`,
      date: v.createdAt.slice(0, 10),
    })),
    { en: 'Event created', ar: 'أُنشئت الفعالية', date: event.createdAt.slice(0, 10) },
  ];

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        {/* The lifecycle band beats everything: a cancelled or postponed record says
            so before anything else, with the consequence stated. */}
        {event.archivedAt !== null ? (
          <div data-region="archived-band" style={{ padding: '20px 26px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
            <L
              en={`Archived by the Ministry on ${event.archivedAt.slice(0, 10)}. This record is read-only; nothing further is owed on it.`}
              ar={`أُرشف هذا السجل لدى الوزارة في ⁦${event.archivedAt.slice(0, 10)}⁩. وهو للقراءة فقط؛ ولا شيء مستحقاً عليه بعد الآن.`}
            />
          </div>
        ) : null}
        {event.lifecycle === 'cancelled' ? (
          <div data-region="lifecycle-band" style={{ padding: '20px 26px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--bad)', borderRadius: 16, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.7 }}>
            <L
              en={LIFECYCLE_CONTENT.cancel.bandEn.replace('{date}', event.lifecycleAt ?? '')}
              ar={LIFECYCLE_CONTENT.cancel.bandAr.replace('{date}', event.lifecycleAt ? `⁦${event.lifecycleAt}⁩` : '')}
            />
          </div>
        ) : null}
        {event.lifecycle === 'postponed' ? (
          <div data-region="lifecycle-band" style={{ padding: '20px 26px', background: 'var(--accent-soft)', borderRadius: 16, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.7, color: 'var(--accent-ink)' }}>
            <L
              en={(event.postponedTo ? LIFECYCLE_CONTENT.postpone.bandDateEn.replace('{newDate}', event.postponedTo) : LIFECYCLE_CONTENT.postpone.bandNoDateEn).replace('{date}', event.lifecycleAt ?? '')}
              ar={(event.postponedTo ? LIFECYCLE_CONTENT.postpone.bandDateAr.replace('{newDate}', `⁦${event.postponedTo}⁩`) : LIFECYCLE_CONTENT.postpone.bandNoDateAr).replace('{date}', event.lifecycleAt ? `⁦${event.lifecycleAt}⁩` : '')}
            />{' '}
            <Link href={`/events/${event.id}/lifecycle`} style={{ fontSize: '13.5px' }}>
              <L en="Open cancellation and postponement" ar="فتح الإلغاء والتأجيل" />
            </Link>
          </div>
        ) : null}
        {/* ONE next action, above the rail: what to do, why the rest can wait, one
            button. Derived from the SAME blockers the Submit gate names, so the panel
            and the screen it opens can never disagree. The waiting state is the one
            that matters -- amber that is somebody else's move says so. */}
        {!event.filed && event.lifecycle === 'active' && event.archivedAt === null ? (
          <Link
            href={action.href === 'organization' ? '/organization' : `/events/${event.id}/${action.href}`}
            data-region="next-action"
            data-next-action={action.kind}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 20,
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '22px 26px',
              border: `1px solid ${action.tone === 'brand' ? 'var(--brand)' : 'var(--accent)'}`,
              background: action.tone === 'brand' ? 'var(--brand-soft)' : 'var(--accent-soft)',
              borderRadius: 16,
              marginBlockEnd: 20,
              color: 'var(--ink)',
              textDecoration: 'none',
            }}
          >
            <span style={{ flex: 1, minWidth: 280 }}>
              <span style={{ display: 'block', fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: action.tone === 'brand' ? 'var(--brand)' : 'var(--accent-ink)', marginBlockEnd: 6 }}>
                <L en="Your next action" ar="إجراؤكم التالي" />
              </span>
              <span style={{ display: 'block', fontSize: 17, fontWeight: 600, lineHeight: 1.45, marginBlockEnd: 6 }}>
                <L en={action.titleEn} ar={action.titleAr} />
              </span>
              <span style={{ display: 'block', fontSize: '14.5px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '72ch' }}>
                <L en={action.bodyEn} ar={action.bodyAr} />
              </span>
            </span>
            <span
              style={{
                flex: 'none',
                height: 44,
                paddingInline: 22,
                borderRadius: 22,
                background: action.tone === 'brand' ? 'var(--brand)' : 'var(--bg)',
                color: action.tone === 'brand' ? 'var(--bg)' : 'var(--ink)',
                border: action.tone === 'brand' ? '0' : '1px solid var(--line)',
                fontSize: '14.5px',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <L en={action.buttonEn} ar={action.buttonAr} />
            </span>
          </Link>
        ) : null}

        <StageRailCard stages={stages} noteEn={railNoteEn} noteAr={railNoteAr} />

        {/* Identity header, from the reference */}
        <div data-region="record-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 32 }}>
          <div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBlockEnd: 12 }}>
              <div>
                <div style={{ ...upLabel, fontSize: 11, marginBlockEnd: 3 }}>
                  <L en="Record ID" ar="معرّف السجل" />
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{event.id}</div>
              </div>
              <div>
                <div style={{ ...upLabel, fontSize: 11, marginBlockEnd: 3 }}>
                  <L en="Ministry reference number" ar="الرقم المرجعي للوزارة" />
                </div>
                {event.mophReference ? (
                  <div style={{ fontSize: '14.5px', fontVariantNumeric: 'tabular-nums' }}>{event.mophReference}</div>
                ) : (
                  <div style={{ fontSize: '14.5px', color: 'var(--muted)' }}>
                    <L en="Issued on submission" ar="يصدر عند التقديم" />
                  </div>
                )}
              </div>
              <div>
                <div style={{ ...upLabel, fontSize: 11, marginBlockEnd: 3 }}>
                  <L en="Event date" ar="تاريخ الفعالية" />
                </div>
                <div style={{ fontSize: '14.5px', fontVariantNumeric: 'tabular-nums' }}>{event.startDate ?? '—'}</div>
              </div>
            </div>
            <h1 data-sec-h1="" style={{ margin: 0, fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
              <L en={event.nameEn} ar={event.nameAr} />
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <div>
              <div style={upLabel}>
                <L en="Final level" ar="المستوى النهائي" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, color: level ? `var(--l${level})` : 'var(--muted)' }}>
                {level ?? '—'}
              </div>
            </div>
            {filing ? (
              <>
                <div>
                  <div style={upLabel}>
                    <L en="File by" ar="التقديم بحلول" />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{filing.date}</div>
                </div>
                <div>
                  <div style={upLabel}>
                    <L en="Days left" ar="الأيام المتبقية" />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--accent-ink)', fontVariantNumeric: 'tabular-nums' }}>{daysLeft}</div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* THE CERTIFICATE, at the top of the record once a determination stands.
            A determination was recorded, the organizer was notified, and there was
            nothing on their side they could print -- and this document is what they
            hand to the authorising authority. */}
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
              <L
                en={`${event.mophReference ?? ''} · ${CERT.byLabelEn} ${standingDetermination.recordedBy} · ${standingDetermination.recordedAt}`}
                ar={`${event.mophReference ?? ''} · ${CERT.byLabelAr} ${standingDetermination.recordedBy} · ⁦${standingDetermination.recordedAt}⁩`}
              />
            </div>
            <a
              href={`/events/${id}/determination`}
              style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}
            >
              <L en={CERT.openEn} ar={CERT.openAr} />
            </a>
          </div>
        ) : null}

        {filing?.conditional && filing.conditionEn && filing.conditionAr ? (
          <p style={{ margin: '0 0 32px', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '78ch' }}>
            <L en={filing.conditionEn} ar={filing.conditionAr} />
          </p>
        ) : null}

        {/* The level and one line why (partner review). Both results and which governed
            stay reported, compactly -- the full condition-by-condition detail is the
            Ministry reviewer's screen, not the organizer's (non-negotiable 1 holds). */}
        {derivation ? (
          <div data-region="derivation" style={{ padding: '27px 31px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 40 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 12 }}>
              <L en="Level" ar="المستوى" />
            </div>
            {level !== null ? (
              <>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: `var(--l${level})` }}>
                  <L en={`Level ${level}`} ar={`المستوى ${level}`} />
                </div>
                {why?.reason ? (
                  <p style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.6, maxWidth: '60ch' }}>
                    <L en={why.reason.en} ar={why.reason.ar} />
                  </p>
                ) : null}
                {why?.comparison ? (
                  <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    <L en={why.comparison.en} ar={why.comparison.ar} />
                  </p>
                ) : null}
              </>
            ) : (
              <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                <span style={{ color: 'var(--muted)' }}>
                  <L en="Not yet derived." ar="لم يُستنتج بعد." />
                </span>{' '}
                <span style={{ color: 'var(--accent-ink)' }}>
                  <L
                    en={messageFor(enMessages, 'gate.assessmentIncomplete')}
                    ar={messageFor(arMessages, 'gate.assessmentIncomplete')}
                  />
                </span>
              </div>
            )}
          </div>
        ) : null}

        {/* The requirements counters and routes, from the reference record. */}
        <div data-region="counters" style={{ padding: '27px 31px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 40, display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 600, color: agencyPendColor }}>{agencyPending}</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 4 }}>
                <L en="named agencies yet to answer" ar="جهة مُسمّاة لم تُجب بعد" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 600, color: 'var(--accent-ink)' }}>{outstanding}</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 4 }}>
                <L en="items outstanding before filing" ar="بنداً غير مستوفى قبل التقديم" />
              </div>
            </div>
          </div>
          <div style={actionGrid}>
            <span style={actionCell}>
              <Link href={`/events/${event.id}/requirements`} style={actionPill}>
                <L en="Open requirements and attachments" ar="فتح المتطلبات والمرفقات" />
              </Link>
            </span>
            <GatedAction
              gate={materialChangeGate(gateCtx)}
              href={`/events/${event.id}/change`}
              en="Report a material change"
              ar="الإبلاغ عن تغيير جوهري"
            />
            <GatedAction
              gate={seriousIncidentGate(gateCtx)}
              href={`/events/${event.id}/incident`}
              en="Notify a serious incident"
              ar="الإبلاغ عن حادثة جسيمة"
            />
            <GatedAction
              gate={postEventReportGate(gateCtx)}
              href={`/events/${event.id}/post-event`}
              en="Post-event medical report"
              ar="التقرير الطبي لما بعد الفعالية"
            />
          </div>
        </div>

        {/* Level 3 requirements note: present ONLY at Level 3, and only WHILE THE
            REQUIREMENT IS UNFILLED. It used to render on the level alone, so an
            organizer who had nominated a Director and had them confirm was still
            being told to appoint one -- an instruction to do something already done,
            on the same screen that shows it was done. Derived from the record now:
            it disappears the moment a Director confirms. */}
        {emdGate.behaviour !== 'absent' && level === 3 && !directorConfirmed ? (
          <div style={{ paddingBlock: '23px', paddingInlineStart: '26px', paddingInlineEnd: '27px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--l3)', borderRadius: 12, marginBlockEnd: 40 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
              <L en="Level 3 requirement" ar="متطلب المستوى 3" />
            </div>
            <div style={{ fontSize: '15.5px', lineHeight: 1.6 }}>
              <L
                en="A licensed physician must be named as Event Medical Director before you can file."
                ar="يجب تسمية طبيب مرخّص مديراً طبياً للفعالية قبل التقديم."
              />
            </div>
          </div>
        ) : null}

        {history.length > 0 ? (
          <div data-region="history">
            <h2 style={{ margin: '0 0 16px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
              <L en="Submission history" ar="سجل التقديم" />
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockEnd: 40 }}>
              {history.map((h) => (
                <div key={`${h.en}-${h.date}`} style={{ background: 'var(--bg)', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14.5px' }}>
                    <L en={h.en} ar={h.ar} />
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{h.date}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Assessment history: versioned, never edited in place, previous versions readable */}
        {versions.length > 0 ? (
          <>
            <h2 style={{ margin: '0 0 16px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
              <L en="Assessment versions" ar="إصدارات التقييم" />
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockEnd: 16 }}>
              {versions.map((v) => (
                <div key={v.version} style={{ background: 'var(--bg)', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14.5px' }}>
                    <L en={`Version ${v.version}`} ar={`الإصدار ${v.version}`} />
                    {v.derivation.finalLevel !== null ? (
                      <span style={{ color: 'var(--muted)' }}>
                        {' · '}
                        <L en={`Level ${v.derivation.finalLevel}`} ar={`المستوى ${v.derivation.finalLevel}`} />
                        {v.derivation.scoreTotal !== null ? (
                          <>
                            {' · '}
                            <L en={`score ${v.derivation.scoreTotal}`} ar={`المجموع ${v.derivation.scoreTotal}`} />
                          </>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{v.createdAt.slice(0, 10)}</span>
                </div>
              ))}
            </div>
            {event.lifecycle !== 'cancelled' && event.archivedAt === null ? (
              <div style={{ marginBlockEnd: 40, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
                <Link href={`/events/${event.id}/reassess`} style={{ display: 'inline-flex', alignItems: 'center', height: 40, paddingInline: 18, border: '1px solid var(--line)', borderRadius: 20, fontSize: 14, color: 'var(--ink)' }}>
                  <L en="Run the assessment again" ar="إعادة إجراء التقييم" />
                </Link>
                {event.filed ? (
                  <span style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '58ch' }}>
                    <L en="Your submission is filed: a changed assessment is a material change — report it alongside." ar="ملفكم مقدَّم: التقييم المتغيّر تغيير جوهري — أبلغوا عنه أيضاً." />
                  </span>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {event.lifecycle !== 'cancelled' && event.archivedAt === null ? (
          <div style={{ marginBlockEnd: 28 }}>
            {/* ABSENT once filed, not greyed: after filing, editing the details never
                applies again -- Report a material change is the instrument's route, and
                it appears exactly when this disappears. Before filing, editing stays
                (partner review; the walkthrough found an event editable after its
                determination was recorded). */}
            {!event.filed ? (
              <Link href={`/events/${event.id}/edit`} style={{ fontSize: '13.5px', color: 'var(--muted)', textDecoration: 'underline', marginInlineEnd: 20 }}>
                <L en="Edit event details" ar="تعديل تفاصيل الفعالية" />
              </Link>
            ) : null}
            <Link href={`/events/${event.id}/lifecycle`} style={{ fontSize: '13.5px', color: 'var(--muted)', textDecoration: 'underline' }}>
              <L en={LIFECYCLE_CONTENT.control.linkEn} ar={LIFECYCLE_CONTENT.control.linkAr} />
            </Link>
          </div>
        ) : null}
      </main>
    </>
  );
}
