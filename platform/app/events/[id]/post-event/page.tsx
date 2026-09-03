import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { PostEventForm } from './PostEventForm';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { clockNow } from '../../../../lib/clock';
import {
  assessmentsFor,
  eventFor,
  invitationsFor,
  postEventReportFacts,
  postEventReportFor,
  seriousIncidentNotificationFor,
  unreadCountFor,
  venueRouteFor,
} from '../../../../lib/queries';
import {
  POST_EVENT_ACTIVITY_FIELDS,
  POST_EVENT_SIGNIFICANT,
  postEventReportGate,
  postEventReportRequired,
  postEventReportWindow,
  type EventGateContext,
  type Level,
} from '../../../../lib/rules';


/**
 * The post-event medical report. The route itself honours the time gate: before the
 * window opens the record shows the disabled action with its date, and this page sends
 * an early visitor back to the record.
 *
 * The 24-hour serious-incident notification is a SEPARATE obligation on the same event.
 * Filing this report does not satisfy it, and the page says so side by side.
 */
export default async function PostEventPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const event = eventFor(account.id, id);
  if (!event) notFound();

  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const versions = assessmentsFor(account.id, id);
  const level = (versions[0]?.derivation.finalLevel ?? event.level) as Level | null;
  if (level === null) redirect(`/events/${id}`);

  const gateCtx: EventGateContext = {
    finalLevel: level,
    eventEndDate: event.endDate,
    eventStartDate: event.startDate,
    filed: event.filed,
    lifecycle: event.lifecycle,
    organizationStatus: organization?.status ?? 'none',
    now: clockNow(),
  };
  if (postEventReportGate(gateCtx).behaviour !== 'enabled') redirect(`/events/${id}`);

  const window = event.endDate
    ? postEventReportWindow(new Date(`${event.endDate}T12:00:00+03:00`))
    : null;
  const facts = postEventReportFacts(id);
  const requirement = postEventReportRequired({
    finalLevel: (assessmentsFor(account.id, id)[0]?.derivation.finalLevel ?? event.level) as Level | null,
    seriousIncidentNotified: facts.seriousIncidentNotified,
    ministryRequested: facts.ministryRequested,
  });
  const report = postEventReportFor(account.id, id);
  const director = invitationsFor(account.id, id).find(
    (i) => i.kind === 'director' && i.status === 'confirmed',
  );
  const notifiedAt = seriousIncidentNotificationFor(account.id, id);

  // The post-event medical report's header block. The instrument names the report's subject on it
  // itself -- event, dates, venue or route, organizer, final level -- so the sheet is
  // self-identifying once printed or exported. Every value is read from the record.
  const dates =
    event.startDate && event.endDate && event.startDate !== event.endDate
      ? `${event.startDate} \u2013 ${event.endDate}`
      : (event.endDate ?? event.startDate ?? '');
  const route = venueRouteFor(account.id, id);
  const identity: { en: string; ar: string; valueEn: string; valueAr: string }[] = [
    { en: 'Event name', ar: 'اسم الفعالية', valueEn: event.nameEn, valueAr: event.nameAr },
    { en: 'Event date(s)', ar: 'تاريخ الفعالية', valueEn: dates, valueAr: dates },
    { en: 'Venue or route', ar: 'الموقع أو المسار', valueEn: route, valueAr: route },
    {
      en: 'Organizer',
      ar: 'الجهة المنظمة',
      valueEn: organization?.nameEn ?? '',
      valueAr: organization?.nameAr ?? '',
    },
    { en: 'Final level', ar: 'المستوى النهائي', valueEn: `Level ${level}`, valueAr: `المستوى ${level}` },
  ];

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} back={{ href: `/events/${id}`, en: 'Event record', ar: 'سجل الفعالية' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Post-event medical report" ar="التقرير الطبي لما بعد الفعالية" />
          </h1>
          <p style={{ margin: '0 0 32px', fontSize: 16, color: 'var(--muted)', lineHeight: 1.6 }}>
            {/* Second sweep: "Due within seven days of the event" was cut here — the
                obligation card below carries the due date as a date. */}
            <L
              en={`${event.nameEn}, held ${event.endDate ?? ''}.`}
              ar={`${event.nameAr}، أُجريت في ⁦${event.endDate ?? ''}⁩.`}
            />
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '15px 21px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 32, fontSize: '14.5px', color: 'var(--muted)', maxWidth: '74ch' }}>
            <span style={{ flex: 'none', padding: '3px 9px', border: '1px solid var(--line)', borderRadius: 999, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase' }}>
              <L en="Required" ar="مطلوب" />
            </span>
            <span style={{ lineHeight: 1.6 }}>
              <L
                en="Every field is required unless marked optional. Aggregate figures are required even where the count is zero."
                ar="كل حقل مطلوب إلا ما وُسم اختيارياً. الأرقام الإجمالية مطلوبة حتى إذا كان العدد صفراً."
              />
            </span>
          </div>

          {report?.directorReturnedAt ? (
            <div data-region="director-return" style={{ padding: '16px 22px', background: 'var(--accent-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: '14px', lineHeight: 1.65, color: 'var(--accent-ink)', maxWidth: '80ch' }}>
              <L
                en={`The Event Medical Director returned this report on ${report.directorReturnedAt} rather than signing it${report.directorReturnNote ? ` — the reason, as written: “${report.directorReturnNote}”` : ''}. Revise the report below; saving clears the return and the Director signs the revised version.`}
                ar={`أعاد المدير الطبي هذا التقرير في ⁦${report.directorReturnedAt}⁩ بدل توقيعه${report.directorReturnNote ? ` — والسبب كما كُتب: «${report.directorReturnNote}»` : ''}. نقّحوا التقرير أدناه؛ والحفظ يزيل الإعادة ويوقّع المدير النسخة المنقّحة.`}
              />
            </div>
          ) : null}
          <dl data-region="report-identity" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 0, margin: '0 0 32px', background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden', padding: 1 }}>
            {identity.map((f) => (
              <div key={f.en} style={{ padding: '14px 18px', borderInlineEnd: '1px solid var(--line)' }}>
                <dt style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 6 }}>
                  <L en={f.en} ar={f.ar} />
                </dt>
                <dd style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.5 }}>
                  {f.valueEn ? (
                    <L en={f.valueEn} ar={f.valueAr || f.valueEn} />
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>
                      <L en="Not recorded" ar="غير مسجَّل" />
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {/* Two obligations, same event, never merged. */}
          <div data-wide="" data-region="obligations" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBlockEnd: 40 }}>
            <div style={{ padding: '26px 28px', border: '2px solid var(--bad)', borderRadius: 16, background: 'var(--bad-soft)' }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--bad)', marginBlockEnd: 10 }}>
                <L en="Separate obligation — 24 hours" ar="موجب منفصل — 24 ساعة" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5, marginBlockEnd: 10 }}>
                <L en="Notify a serious incident within 24 hours" ar="أبلغوا عن أي حادثة جسيمة خلال 24 ساعة" />
              </div>
              <div style={{ fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)', marginBlockEnd: 16 }}>
                <L
                  en="Cardiac arrest, death, major incident, or interruption or termination for medical reasons. Filing this report does not satisfy the notification."
                  ar="توقف قلب أو وفاة أو حادثة جسيمة أو توقف الفعالية أو إنهاؤها لأسباب طبية. تقديم هذا التقرير لا يستوفي الإبلاغ."
                />
              </div>
              {notifiedAt ? (
                <span style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 22, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 14, fontWeight: 500, marginInlineEnd: 10 }}>
                  <L en={`Notified ${notifiedAt.slice(0, 10)}`} ar={`أُبلغ في ⁦${notifiedAt.slice(0, 10)}⁩`} />
                </span>
              ) : null}
              <a href={`/events/${id}/incident`} style={{ display: 'inline-block', height: 40, lineHeight: '40px', paddingInline: 18, borderRadius: 20, background: 'var(--bad)', color: 'var(--bg)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
                {/* The reference's own wording, copied not improved: "Notify now". */}
                <L en="Notify now" ar="الإبلاغ الآن" />
              </a>
            </div>
            <div style={{ padding: '27px 29px', background: 'var(--surface2)', borderRadius: 16 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
                <L en="This obligation — 7 days" ar="هذا الموجب — 7 أيام" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5, marginBlockEnd: 10 }}>
                <L en="Post-event medical report" ar="التقرير الطبي لما بعد الفعالية" />
              </div>
              <div style={{ fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)' }}>
                <L
                  en={`Due ${window?.due.date ?? ''}. Required after every Level 3 event, after a reportable event at Level 1 or 2, or on Ministry request.`}
                  ar={`مستحق في ⁦${window?.due.date ?? ''}⁩. مطلوب بعد كل فعالية من المستوى 3، وبعد واقعة واجبة الإبلاغ في المستوى 1 أو 2، أو بطلب الوزارة.`}
                />
              </div>
              {/* THE ANSWER FOR THIS EVENT, from the one rule -- the three limbs
                  stopped being copy and started being evaluated (register
                  closure, 2026-09-03). */}
              <div data-region="report-requirement" style={{ fontSize: '13.5px', lineHeight: 1.6, marginBlockStart: 8 }}>
                <L en={`For this event: ${requirement.en}`} ar={`لهذه الفعالية: ${requirement.ar}`} />
              </div>
            </div>
          </div>

          <PostEventForm
            eventId={id}
            level={level}
            activityFields={[...POST_EVENT_ACTIVITY_FIELDS]}
            significantEvents={[...POST_EVENT_SIGNIFICANT]}
            initial={report}
            directorConfirmed={Boolean(director)}
          />
        </div>

      </main>
    </>
  );
}
