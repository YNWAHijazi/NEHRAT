import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { SequenceFooter } from '../../../../components/SequenceFooter';
import { PostEventForm } from './PostEventForm';
import { notifySeriousIncidentAction } from '../../../actions';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { clockNow } from '../../../../lib/clock';
import {
  assessmentsFor,
  eventFor,
  invitationsFor,
  postEventReportFor,
  seriousIncidentNotificationFor,
  unreadCountFor,
} from '../../../../lib/queries';
import {
  POST_EVENT_ACTIVITY_FIELDS,
  POST_EVENT_SIGNIFICANT,
  postEventReportGate,
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
    organizationStatus: organization?.status ?? 'none',
    now: clockNow(),
  };
  if (postEventReportGate(gateCtx).behaviour !== 'enabled') redirect(`/events/${id}`);

  const window = event.endDate
    ? postEventReportWindow(new Date(`${event.endDate}T12:00:00+03:00`))
    : null;
  const report = postEventReportFor(account.id, id);
  const director = invitationsFor(account.id, id).find(
    (i) => i.kind === 'director' && i.status === 'confirmed',
  );
  const notifiedAt = seriousIncidentNotificationFor(account.id, id);

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Post-event medical report" ar="التقرير الطبي لما بعد الفعالية" />
          </h1>
          <p style={{ margin: '0 0 32px', fontSize: 16, color: 'var(--muted)', lineHeight: 1.6 }}>
            <L
              en={`${event.nameEn}, held ${event.endDate ?? ''}. Due within seven days of the event.`}
              ar={`${event.nameAr}، أُجريت في ⁦${event.endDate ?? ''}⁩. مستحق خلال سبعة أيام من الفعالية.`}
            />
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '14px 20px', border: '1px solid var(--line)', borderRadius: 10, marginBlockEnd: 32, fontSize: '14.5px', color: 'var(--muted)', maxWidth: '74ch' }}>
            <span style={{ flex: 'none', padding: '3px 9px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase' }}>
              <L en="Required" ar="مطلوب" />
            </span>
            <span style={{ lineHeight: 1.6 }}>
              <L
                en="Every field is required unless marked optional. Aggregate figures are required even where the count is zero."
                ar="كل حقل مطلوب إلا ما وُسم اختيارياً. الأرقام الإجمالية مطلوبة حتى إذا كان العدد صفراً."
              />
            </span>
          </div>

          {/* Two obligations, same event, never merged. */}
          <div data-wide="" data-region="obligations" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBlockEnd: 40 }}>
            <div style={{ padding: '26px 28px', border: '2px solid var(--bad)', borderRadius: 14, background: 'var(--bad-soft)' }}>
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
                <span style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 22, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 14, fontWeight: 500 }}>
                  <L en={`Notified ${notifiedAt.slice(0, 10)}`} ar={`أُبلغ في ⁦${notifiedAt.slice(0, 10)}⁩`} />
                </span>
              ) : (
                <form action={notifySeriousIncidentAction.bind(null, id)} style={{ display: 'inline' }}>
                  <button type="submit" style={{ height: 40, paddingInline: 18, border: 0, borderRadius: 22, background: 'var(--bad)', color: 'var(--bg)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                    <L en="Notify now" ar="الإبلاغ الآن" />
                  </button>
                </form>
              )}
            </div>
            <div style={{ padding: '26px 28px', border: '1px solid var(--line)', borderRadius: 14 }}>
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

        <SequenceFooter
          labelEn="Where this record leads"
          labelAr="إلى أين يقود هذا السجل"
          steps={[
            {
              href: '/dashboard',
              en: 'Dashboard',
              ar: 'اللوحة',
              descEn: 'Every record on this account, and what each one owes.',
              descAr: 'كل سجل على هذا الحساب وما يستحق على كل منها.',
              primary: true,
            },
            {
              href: `/events/${id}`,
              en: 'Event record',
              ar: 'سجل الفعالية',
              descEn: 'Level, filing date and submission history.',
              descAr: 'المستوى وتاريخ التقديم وسجل التقديم.',
            },
          ]}
        />
      </main>
    </>
  );
}
