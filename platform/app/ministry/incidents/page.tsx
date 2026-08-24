import { L } from '../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../components/MinistryShell';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { getDb } from '../../../lib/db';
import { seriousIncidentsForMinistry } from '../../../lib/queries';
import { SERIOUS_INCIDENT_NOTIFICATION } from '../../../lib/rules';

/**
 * Incidents and reports, across both instruments -- listed side by side but
 * never merged: an event-side report carries event vocabulary, a facility-side
 * incident carries none of it.
 */
export default async function IncidentsPage() {
  const account = await requireMinistryPage('viewMinistry');
  const flag = account.isDemo ? 1 : 0;
  const db = getDb();
  const postEvent = db
    .prepare(
      `SELECT e.id, e.name_en, e.name_ar, r.significant, r.organizer_signed_at, r.director_signed_at, e.end_date
       FROM post_event_reports r JOIN events e ON e.id = r.event_id WHERE e.is_demo = ? ORDER BY e.end_date DESC`,
    )
    .all(flag) as unknown as { id: string; name_en: string; name_ar: string; significant: string; organizer_signed_at: string | null; director_signed_at: string | null; end_date: string | null }[];
  const facilityIncidents = db
    .prepare(
      `SELECT f.name_en, f.name_ar, i.payload, i.created_at
       FROM facility_incidents i JOIN facilities f ON f.id = i.facility_id WHERE f.is_demo = ? ORDER BY i.created_at DESC`,
    )
    .all(flag) as unknown as { name_en: string; name_ar: string; payload: string; created_at: string }[];
  const frReports = db
    .prepare(`SELECT r.payload, r.mode, r.created_at FROM fr_reports r JOIN accounts a ON a.id = r.account_id WHERE a.is_demo = ? ORDER BY r.created_at DESC`)
    .all(flag) as unknown as { payload: string; mode: string; created_at: string }[];

  const serious = seriousIncidentsForMinistry(account.isDemo);
  const sinTypes = Object.fromEntries(
    (SERIOUS_INCIDENT_NOTIFICATION.types as { key: string; en: string; ar: string }[]).map((x) => [x.key, x]),
  );
  const windowHours = SERIOUS_INCIDENT_NOTIFICATION.windowHours as number;
  const withinWindow = (occurred: string, notified: string): boolean => {
    const o = new Date(occurred.replace(' ', 'T'));
    const n = new Date(notified.replace(' ', 'T'));
    return n.getTime() - o.getTime() <= windowHours * 3_600_000;
  };

  return (
    <MinistryShell account={account}>
      <h1 data-sec-h1="" style={{ margin: '0 0 24px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Incidents and reports" ar="الحوادث والتقارير" />
      </h1>

      {/* Protocol 13 p1: the 24-hour notifications, first -- they are the urgent lane. */}
      <div data-region="serious-incidents" style={{ marginBlockEnd: 28 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
          <L en={`Serious-incident notifications — the ${windowHours}-hour obligation`} ar={`إبلاغات الحوادث الجسيمة — موجب الـ${windowHours} ساعة`} />
        </h2>
        {serious.length === 0 ? (
          <div style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en="None notified." ar="لا إبلاغات." />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {serious.map((r) => {
              const t = sinTypes[r.incidentType];
              const inWindow = withinWindow(r.occurredAt, r.notifiedAt);
              return (
                <a key={`${r.eventId}-${r.notifiedAt}`} href={`/ministry/submissions/${r.eventId}`} style={{ padding: '12px 16px', border: '1px solid var(--line)', borderInlineStart: `3px solid ${inWindow ? 'var(--brand)' : 'var(--bad)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: '13.5px', alignItems: 'baseline', textDecoration: 'none', color: 'var(--ink)' }}>
                  <span style={{ fontWeight: 500 }}>
                    <L en={t?.en ?? r.incidentType} ar={t?.ar ?? r.incidentType} />
                  </span>
                  <span>
                    <L en={r.eventEn} ar={r.eventAr} />
                  </span>
                  {r.mophReference ? <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{r.mophReference}</span> : null}
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    <L en={`occurred ${r.occurredAt.replace('T', ' ')}`} ar={`وقعت في ⁦${r.occurredAt.replace('T', ' ')}⁩`} />
                  </span>
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    <L en={`notified ${r.notifiedAt.slice(0, 16)}`} ar={`أُبلغ في ⁦${r.notifiedAt.slice(0, 16)}⁩`} />
                  </span>
                  <span style={{ flex: 'none', padding: '2px 9px', borderRadius: 4, fontSize: 12, background: inWindow ? 'var(--brand-soft)' : 'var(--bad-soft)', color: inWindow ? 'var(--brand)' : 'var(--bad)' }}>
                    {inWindow ? <L en={`Within ${windowHours} hours`} ar={`ضمن ${windowHours} ساعة`} /> : <L en={`Outside ${windowHours} hours`} ar={`خارج ${windowHours} ساعة`} />}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>
      <div data-split="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Post-event medical reports" ar="التقارير الطبية لما بعد الفعاليات" />
          </h2>
          <div data-region="post-event" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {postEvent.map((r) => {
              const significant = JSON.parse(r.significant) as Record<string, boolean>;
              const flagged = Object.values(significant).some(Boolean);
              const complete = Boolean(r.organizer_signed_at) && Boolean(r.director_signed_at);
              return (
                <div key={r.id} style={{ padding: '14px 18px', border: '1px solid var(--line)', borderInlineStart: `3px solid ${flagged ? 'var(--bad)' : 'var(--brand)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14.5px' }}>
                    <L en={r.name_en} ar={r.name_ar} />
                    <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3, fontVariantNumeric: 'tabular-nums' }}>
                      <L en={`Held ${r.end_date ?? ''}`} ar={`أُقيمت في ⁦${r.end_date ?? ''}⁩`} />
                    </span>
                  </span>
                  <span style={{ padding: '3px 9px', borderRadius: 4, background: complete ? 'var(--brand-soft)' : 'var(--accent-soft)', color: complete ? 'var(--brand)' : 'var(--accent-ink)', fontSize: '12.5px', alignSelf: 'center' }}>
                    {complete ? <L en="Both signatures recorded" ar="سُجّل التوقيعان" /> : <L en="Signatures incomplete" ar="التواقيع غير مكتملة" />}
                  </span>
                </div>
              );
            })}
            {postEvent.length === 0 ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en="No reports." ar="لا تقارير." />
              </div>
            ) : null}
          </div>
        </div>
        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Cardiac-arrest reports — separate lane" ar="تقارير توقف القلب — مسار منفصل" />
          </h2>
          <div data-region="cardiac" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {facilityIncidents.map((r, i) => {
              const payload = JSON.parse(r.payload) as Record<string, string>;
              return (
                <div key={`f-${i}`} style={{ padding: '14px 18px', border: '1px solid var(--line)', borderInlineStart: '3px solid var(--accent)', borderRadius: 10, fontSize: '14.5px' }}>
                  <L en={`Facility incident report — ${r.name_en}`} ar={`تقرير حادثة مرفق — ${r.name_ar}`} />
                  <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3, fontVariantNumeric: 'tabular-nums' }}>{payload['date'] ?? r.created_at.slice(0, 10)}</span>
                </div>
              );
            })}
            {frReports.map((r, i) => {
              const payload = JSON.parse(r.payload) as Record<string, string>;
              return (
                <div key={`u-${i}`} style={{ padding: '14px 18px', border: '1px solid var(--line)', borderInlineStart: '3px solid var(--accent)', borderRadius: 10, fontSize: '14.5px' }}>
                  <L
                    en={`First-response dataset report${payload['incident.location'] ? ` — ${payload['incident.location']}` : ''}${r.mode === 'attach' ? ' · own patient-care report attached' : ''}`}
                    ar={`تقرير بيانات استجابة أولية${payload['incident.location'] ? ` — ${payload['incident.location']}` : ''}${r.mode === 'attach' ? ' · أُرفق تقرير رعاية المرضى الخاص' : ''}`}
                  />
                  <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3, fontVariantNumeric: 'tabular-nums' }}>{payload['incident.date'] ?? r.created_at.slice(0, 10)}</span>
                </div>
              );
            })}
            {facilityIncidents.length + frReports.length === 0 ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en="No reports." ar="لا تقارير." />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <MinistryFooter steps={[{ href: '/ministry/facilities/arrests', en: 'Reported arrest locations', ar: 'مواقع الحوادث المبلَّغة', descEn: 'The same reports, grouped by place and category.', descAr: 'التقارير نفسها مجمَّعة بحسب المكان والفئة.' }]} />
    </MinistryShell>
  );
}
