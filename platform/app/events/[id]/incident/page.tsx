import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { notifySeriousIncidentAction } from '../../../actions';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { beirutToday } from '../../../../lib/clock';
import { eventFor, seriousIncidentNotificationsFor, unreadCountFor } from '../../../../lib/queries';
import { SERIOUS_INCIDENT_NOTIFICATION } from '../../../../lib/rules';

/**
 * Protocol 13 p1 -- the 24-hour notification. Deliberately its own route, never a rider
 * on the post-event report: an arrest mid-event must be notifiable the moment it
 * happens, not after 00:00 the day after the event ends. Type and occurrence time are
 * the whole record -- no narrative, nothing that could carry a patient's name.
 */
export default async function IncidentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const { notice, error } = await searchParams;
  const event = eventFor(account.id, id);
  if (!event) notFound();
  if (!event.filed) redirect(`/events/${id}`);

  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const rows = seriousIncidentNotificationsFor(account.id, id);
  const today = beirutToday();
  const started = event.startDate !== null && event.startDate <= today;
  const types = SERIOUS_INCIDENT_NOTIFICATION.types as { key: string; en: string; ar: string }[];
  const typeByKey = Object.fromEntries(types.map((t) => [t.key, t]));
  const hours = SERIOUS_INCIDENT_NOTIFICATION.windowHours as number;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
            <L en={`${event.nameEn} · ${event.startDate ?? ''}`} ar={`${event.nameAr} · ⁦${event.startDate ?? ''}⁩`} />
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Notify a serious incident" ar="الإبلاغ عن حادثة جسيمة" />
          </h1>
          <p style={{ margin: '0 0 36px', fontSize: 16, color: 'var(--muted)', lineHeight: 1.6, maxWidth: '74ch' }}>
            <L
              en={`Cardiac arrest, death, major incident, or interruption or termination for medical reasons — notified as soon as practicable and no later than ${hours} hours after the occurrence. This is a separate obligation; the post-event report does not satisfy it.`}
              ar={`توقف قلب أو وفاة أو حادثة جسيمة أو توقف الفعالية أو إنهاؤها لأسباب طبية — يُبلَّغ عنها في أقرب وقت ممكن عملياً وفي موعد لا يتجاوز ${hours} ساعة من وقوعها. وهذا موجب منفصل؛ ولا يستوفيه التقرير الطبي اللاحق.`}
            />
          </p>

          {notice === 'notified' ? (
            <div style={{ padding: '18px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 28, fontSize: '14.5px', lineHeight: 1.6 }}>
              <L
                en="The Ministry has been notified. The notification appears in the record below."
                ar="أُبلغت الوزارة. ويظهر الإبلاغ في السجل أدناه."
              />
            </div>
          ) : null}
          {error === 'incomplete' ? (
            <div style={{ padding: '18px 22px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 12, marginBlockEnd: 28, fontSize: '14.5px', lineHeight: 1.6 }}>
              <L
                en="The incident type and the time of occurrence are both required."
                ar="نوع الحادثة ووقت وقوعها كلاهما مطلوب."
              />
            </div>
          ) : null}

          {!started ? (
            <div style={{ padding: '22px 26px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 28, fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '80ch' }}>
              <L
                en={`Available from the event's first day${event.startDate ? ` — ${event.startDate}` : ''}. Nothing can have occurred at an event that has not begun.`}
                ar={`متاح من اليوم الأول للفعالية${event.startDate ? ` — ⁦${event.startDate}⁩` : ''}. فلا يمكن أن تقع حادثة في فعالية لم تبدأ.`}
              />
            </div>
          ) : (
            <form action={notifySeriousIncidentAction.bind(null, id)} style={{ padding: '26px 28px', border: '2px solid var(--bad)', borderRadius: 14, marginBlockEnd: 28 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--bad)', marginBlockEnd: 14 }}>
                <L en={`Separate obligation — ${hours} hours`} ar={`موجب منفصل — ${hours} ساعة`} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 16 }}>
                {types.map((t) => (
                  <label key={t.key} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 10, cursor: 'pointer', fontSize: '14.5px' }}>
                    <input type="radio" name="incidentType" value={t.key} required />
                    <L en={t.en} ar={t.ar} />
                  </label>
                ))}
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBlockEnd: 16, maxWidth: 320 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  <L en="When it occurred" ar="وقت الوقوع" />
                </span>
                <input type="datetime-local" name="occurredAt" required style={{ height: 42, paddingInline: 12, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 14 }} />
              </label>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, marginBlockEnd: 16, maxWidth: '80ch' }}>
                <L
                  en="The type and the time are the whole notification. No narrative is collected here: nothing on this form can carry a patient's details."
                  ar="النوع والوقت هما كامل الإبلاغ. لا يُجمع أي سرد هنا: فلا شيء في هذا النموذج يمكن أن يحمل بيانات مريض."
                />
              </div>
              <button type="submit" style={{ height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--bad)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}>
                <L en="Notify the Ministry" ar="إبلاغ الوزارة" />
              </button>
            </form>
          )}

          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Notifications on this event" ar="الإبلاغات على هذه الفعالية" />
          </h2>
          {rows.length === 0 ? (
            <div style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en="None recorded." ar="لا إبلاغات مسجلة." />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((r) => (
                <div key={`${r.notifiedAt}-${r.occurredAt}`} style={{ padding: '12px 16px', border: '1px solid var(--line)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: '13.5px', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 500 }}>
                    <L en={typeByKey[r.incidentType]?.en ?? r.incidentType} ar={typeByKey[r.incidentType]?.ar ?? r.incidentType} />
                  </span>
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    <L en={`occurred ${r.occurredAt.replace('T', ' ')}`} ar={`وقعت في ⁦${r.occurredAt.replace('T', ' ')}⁩`} />
                  </span>
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    <L en={`notified ${r.notifiedAt.slice(0, 16)}`} ar={`أُبلغ في ⁦${r.notifiedAt.slice(0, 16)}⁩`} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
