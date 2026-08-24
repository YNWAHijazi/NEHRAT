import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { SequenceFooter } from '../../../components/SequenceFooter';
import { currentAccount, organizationFor } from '../../../lib/auth';
import { DirectorEventView } from './DirectorEventView';
import { invitationForEvent, governanceFor, postEventReportFor } from '../../../lib/queries';
import { getDb } from '../../../lib/db';
import { clockNow } from '../../../lib/clock';
import {
  assessmentsFor,
  beirutToday,
  daysBetween,
  documentStateFor,
  eventFor,
  invitationsFor,
  unreadCountFor,
} from '../../../lib/queries';
import {
  DOMAIN_COUNT,
  MAX_SCORE_PER_DOMAIN,
  documentsForLevel,
  eventFilingDeadline,
  eventMedicalDirectorGate,
  materialChangeGate,
  postEventReportGate,
  type EventGateContext,
  type Gate,
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
      <Link
        href={href}
        style={{ height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}
      >
        <L en={en} ar={ar} />
      </Link>
    );
  }
  const reasonEn = gate.reasonKey ? messageFor(enMessages, gate.reasonKey, gate.params) : '';
  const reasonAr = gate.reasonKey ? messageFor(arMessages, gate.reasonKey, gate.params) : '';
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 5, alignItems: 'start' }}>
      <button
        type="button"
        disabled
        style={{ height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px' }}
      >
        <L en={en} ar={ar} />
      </button>
      <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--muted)', maxWidth: 210 }}>
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
    <div data-region="rail" style={{ marginBlockEnd: 28, padding: '22px 26px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14 }}>
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
                <span style={{ padding: '2px 7px', borderRadius: 3, background: st.chipBg, color: st.chipColor, fontSize: 11, letterSpacing: '.03em' }}>
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
    if (!invitation) notFound();
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
  const today = beirutToday();

  const gateCtx: EventGateContext = {
    finalLevel: derivation?.finalLevel ?? event.level,
    eventEndDate: event.endDate,
    eventStartDate: event.startDate,
    filed: event.filed,
    organizationStatus: organization?.status ?? 'none',
    now: clockNow(),
  };

  const filing = eventFilingDeadline(gateCtx);
  const daysLeft = filing ? daysBetween(today, filing.date) : null;
  const emdGate = eventMedicalDirectorGate(gateCtx);
  const level = gateCtx.finalLevel;

  // The requirements counters, derived from the same state the requirements screen shows.
  const documentState = level ? documentStateFor(account.id, id, level) : {};
  const documents = level ? documentsForLevel(level) : [];
  const attachOutstanding = documents.filter(
    (d) => !d.optional && !d.thirdParty && !documentState[d.key],
  ).length;
  const providers = invitationsFor(account.id, id).filter((i) => i.kind === 'ems');
  const agencyPending = providers.filter((p) => p.status !== 'confirmed').length;
  const agencyPendColor = agencyPending > 0 ? 'var(--bad)' : 'var(--brand)';

  // The six-stage rail, from the record's own state. Stage 1 follows the organization's
  // real status; stage 6 is level-gated: at Level 3 it is coming (todo), below it is not
  // applicable (na) -- the same two-behaviour rule as everywhere else.
  const orgRecorded = organization?.status === 'recorded';
  const assessed = derivation?.complete === true;
  const latestDate = latest?.createdAt.slice(0, 10) ?? '';
  const stage: number = !assessed ? 2 : !event.filed ? 3 : event.outcome ? 5 : 4;
  const stages: RailStage[] = [
    orgRecorded
      ? { k: 'done', en: 'Organization recorded', ar: 'تسجيل المؤسسة', metaEn: organization?.recordedAt ?? '', metaAr: organization?.recordedAt ? `\u2066${organization.recordedAt}\u2069` : '' }
      : { k: 'current', en: 'Organization recording', ar: 'تسجيل المؤسسة', metaEn: 'Pending with the Ministry. Filing waits for it.', metaAr: 'قيد الاستكمال لدى الوزارة. التقديم بانتظاره.' },
    assessed
      ? { k: 'done', en: 'Assessment complete', ar: 'إتمام التقييم', metaEn: `${latestDate} · Level ${level ?? ''}`, metaAr: `\u2066${latestDate}\u2069 · المستوى ${level ?? ''}` }
      : { k: 'current', en: 'Assessment', ar: 'التقييم', metaEn: 'Not yet complete', metaAr: 'لم يكتمل بعد' },
    stage === 3
      ? { k: 'current', en: 'Requirements and attachments', ar: 'المتطلبات والمرفقات', metaEn: `${attachOutstanding} outstanding`, metaAr: `${attachOutstanding} غير مقدَّم` }
      : stage > 3
        ? { k: 'done', en: 'Requirements and attachments', ar: 'المتطلبات والمرفقات', metaEn: '', metaAr: '' }
        : { k: 'todo', en: 'Requirements and attachments', ar: 'المتطلبات والمرفقات', metaEn: '', metaAr: '' },
    event.filed
      ? { k: 'done', en: 'Submitted', ar: 'التقديم', metaEn: event.mophReference ?? '', metaAr: event.mophReference ?? '' }
      : { k: 'todo', en: 'Submitted', ar: 'التقديم', metaEn: filing ? `File by ${filing.date}` : '', metaAr: filing ? `التقديم بحلول \u2066${filing.date}\u2069` : '' },
    event.outcome
      ? { k: 'done', en: 'Ministry outcome', ar: 'نتيجة الوزارة', metaEn: event.stateEn, metaAr: event.stateAr }
      : { k: event.filed ? 'current' : 'todo', en: 'Ministry outcome', ar: 'نتيجة الوزارة', metaEn: 'One of three outcomes', metaAr: 'إحدى ثلاث نتائج' },
    level === 3
      ? { k: 'todo', en: 'Post-event report', ar: 'التقرير اللاحق', metaEn: 'Within 7 days of the event', metaAr: 'خلال 7 أيام من الفعالية' }
      : { k: 'na', en: 'Post-event report', ar: 'التقرير اللاحق', metaEn: 'Owed only after a reportable event or on Ministry request', metaAr: 'يُستحق فقط بعد واقعة واجبة الإبلاغ أو بطلب الوزارة' },
  ];
  const railNoteEn = `Stage ${stage} of 6` + (level === 3 ? '' : ' · stage 6 not applicable');
  const railNoteAr = `المرحلة ${stage} من 6` + (level === 3 ? '' : ' · المرحلة 6 غير منطبقة');

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

        {filing?.conditional && filing.conditionEn && filing.conditionAr ? (
          <p style={{ margin: '0 0 32px', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '78ch' }}>
            <L en={filing.conditionEn} ar={filing.conditionAr} />
          </p>
        ) : null}

        {/* The derivation: both results, and which governed. Never the final level alone. */}
        {derivation ? (
          <div data-region="derivation" style={{ padding: '26px 30px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 40 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 18 }}>
              <L en="How the level was determined" ar="كيف تحدد المستوى" />
            </div>
            <div data-wide="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, alignItems: 'start' }}>
              <div>
                <div style={upLabel}>
                  <L en="Assessment score" ar="مجموع نقاط التقييم" />
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {derivation.scoreTotal ?? '—'}
                  <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}> / {DOMAIN_COUNT * MAX_SCORE_PER_DOMAIN}</span>
                </div>
                <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 4 }}>
                  {derivation.scoreBandLevel !== null ? (
                    <L en={`Score band: Level ${derivation.scoreBandLevel}`} ar={`نطاق النقاط: المستوى ${derivation.scoreBandLevel}`} />
                  ) : (
                    <L en="Incomplete" ar="غير مكتمل" />
                  )}
                </div>
              </div>
              <div>
                <div style={upLabel}>
                  <L en="Minimum conditions" ar="الحدود الدنيا الإلزامية" />
                </div>
                {derivation.triggeredConditions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {derivation.triggeredConditions.map((c) => (
                      <div key={c.key} style={{ fontSize: '13.5px', lineHeight: 1.5 }}>
                        <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 3, background: `var(--l${c.level}s)`, borderInlineStart: `2px solid var(--l${c.level})`, marginInlineEnd: 7 }}>
                          <L en={`Level ${c.level}`} ar={`المستوى ${c.level}`} />
                        </span>
                        <L en={c.en} ar={c.ar} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                    <L en="None triggered" ar="لم يُستوفَ أي حد" />
                  </div>
                )}
              </div>
              <div>
                <div style={upLabel}>
                  <L en="Final event level — the higher of the two" ar="المستوى النهائي — الأعلى من الاثنين" />
                </div>
                <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', color: level ? `var(--l${level})` : 'var(--muted)' }}>
                  {level !== null ? <L en={`Level ${level}`} ar={`المستوى ${level}`} /> : <L en="Not yet derived" ar="لم يُستنتج بعد" />}
                </div>
                {derivation.governedBy ? (
                  <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 4 }}>
                    <L
                      en={messageFor(enMessages, `level.governedBy${derivation.governedBy === 'score' ? 'Score' : derivation.governedBy === 'minimumCondition' ? 'MinimumCondition' : 'Both'}`)}
                      ar={messageFor(arMessages, `level.governedBy${derivation.governedBy === 'score' ? 'Score' : derivation.governedBy === 'minimumCondition' ? 'MinimumCondition' : 'Both'}`)}
                    />
                  </div>
                ) : null}
                {!derivation.complete && derivation.missingInputs.length > 0 ? (
                  <div style={{ fontSize: '13.5px', color: 'var(--accent-ink)', marginBlockStart: 6, lineHeight: 1.5 }}>
                    <L
                      en={messageFor(enMessages, 'gate.assessmentIncomplete')}
                      ar={messageFor(arMessages, 'gate.assessmentIncomplete')}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* The requirements counters and routes, from the reference record. */}
        <div data-region="counters" style={{ padding: '26px 30px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 40, display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 600, color: agencyPendColor }}>{agencyPending}</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 4 }}>
                <L en="named agencies yet to answer" ar="جهة مُسمّاة لم تُجب بعد" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 600, color: 'var(--accent-ink)' }}>{attachOutstanding}</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 4 }}>
                <L en="documents left to attach" ar="مستنداً بقي إرفاقه" />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'start' }}>
            <Link href={`/events/${event.id}/requirements`} style={{ height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
              <L en="Open requirements and attachments" ar="فتح المتطلبات والمرفقات" />
            </Link>
            <GatedAction
              gate={materialChangeGate(gateCtx)}
              href={`/events/${event.id}/change`}
              en="Report a material change"
              ar="الإبلاغ عن تغيير جوهري"
            />
            <GatedAction
              gate={postEventReportGate(gateCtx)}
              href={`/events/${event.id}/post-event`}
              en="Post-event medical report"
              ar="التقرير الطبي لما بعد الفعالية"
            />
          </div>
        </div>

        {/* Level 3 requirements note: present ONLY at Level 3. At Level 2 this block is
            absent -- no greyed row, no mention (non-negotiable #10). */}
        {emdGate.behaviour !== 'absent' && level === 3 ? (
          <div style={{ padding: '22px 26px', border: '1px solid var(--line)', borderInlineStart: '3px solid var(--l3)', borderRadius: 12, marginBlockEnd: 40 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
              <L en="Level 3 requirement" ar="متطلب المستوى 3" />
            </div>
            <div style={{ fontSize: '15.5px', lineHeight: 1.6 }}>
              <L
                en="An Event Medical Director — a licensed physician — is required. The organizer cannot file the Level 3 package without one. Nomination is made from the requirements screen."
                ar="يلزم مدير طبي للفعالية — طبيب مرخّص. لا يمكن للمنظّم تقديم ملف المستوى 3 من دونه. يتم الترشيح من شاشة المتطلبات."
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockEnd: 40 }}>
              {versions.map((v) => (
                <div key={v.version} style={{ background: 'var(--bg)', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14.5px' }}>
                    <L en={`Version ${v.version}`} ar={`الإصدار ${v.version}`} />
                    {v.derivation.finalLevel !== null ? (
                      <span style={{ color: 'var(--muted)' }}>
                        {' · '}
                        <L en={`Level ${v.derivation.finalLevel}`} ar={`المستوى ${v.derivation.finalLevel}`} />
                      </span>
                    ) : null}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{v.createdAt.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <SequenceFooter
          labelEn="Where this record leads"
          labelAr="إلى أين يقود هذا السجل"
          steps={[
            {
              href: `/events/${event.id}/requirements`,
              en: 'Requirements and attachments',
              ar: 'المتطلبات والمرفقات',
              descEn: 'Everything the derived level requires, in the order it needs acting on.',
              descAr: 'كل ما يتطلبه المستوى المستنتج، بالترتيب الذي يستدعي التصرف.',
              primary: true,
            },
            {
              href: '/dashboard',
              en: 'Dashboard',
              ar: 'اللوحة',
              descEn: 'Every record on this account, and what each one owes.',
              descAr: 'كل سجل على هذا الحساب وما يستحق على كل منها.',
            },
          ]}
        />
      </main>
    </>
  );
}
