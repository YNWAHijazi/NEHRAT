import { MinistryShell } from '../../../components/MinistryShell';
import { L } from '../../../components/L';
import { currentAccount } from '../../../lib/auth';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '../../../lib/db';
import { can, POST_EVENT_ACTIVITY_FIELDS, POST_EVENT_SIGNIFICANT } from '../../../lib/rules';
import { acceptPostEventReportAction } from '../../ministry-actions';

export default async function ReportsPage() {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (!can(account.role, 'viewSubmission') && !can(account.role, 'viewRegistry')) notFound();
  const rows = getDb().prepare(`SELECT e.id, e.name_en, e.name_ar, p.activity, p.significant,
    p.lessons_text, p.submitted_at, r.reviewed_at FROM post_event_reports p
    JOIN events e ON e.id = p.event_id
    LEFT JOIN post_event_report_reviews r ON r.event_id = e.id AND r.report_submitted_at = p.submitted_at
    WHERE e.is_demo = ? AND p.submitted_at IS NOT NULL
    ORDER BY r.reviewed_at IS NOT NULL, p.submitted_at DESC`).all(account.isDemo ? 1 : 0) as unknown as {
      id: string; name_en: string; name_ar: string; activity: string; significant: string; lessons_text: string;
      submitted_at: string; reviewed_at: string | null;
    }[];
  return <MinistryShell account={account} back={{ href: '/ministry', en: 'Dashboard', ar: 'اللوحة الرئيسية' }}>
    <h1><L en="Post-event reports" ar="تقارير ما بعد الفعاليات" /></h1>
    {rows.length === 0 ? <p><L en="No submitted reports." ar="لا تقارير مقدَّمة." /></p> : null}
    {rows.map((row) => {
      const activity = JSON.parse(row.activity) as Record<string, string>;
      const significant = JSON.parse(row.significant) as Record<string, boolean>;
      return <details key={row.id} style={{ padding: 20, border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 12 }}>
        <summary style={{ cursor: 'pointer' }}><L en={row.name_en} ar={row.name_ar} /> · {row.submitted_at} · {row.reviewed_at ? <L en="Accepted" ar="مقبول" /> : <L en="Awaiting review" ar="بانتظار المراجعة" />}</summary>
        <dl>{POST_EVENT_ACTIVITY_FIELDS.map((field) => <div key={field.key} style={{ marginBlock: 12 }}><dt><L en={field.en} ar={field.ar} /></dt><dd>{activity[field.key] || '—'}</dd></div>)}</dl>
        {POST_EVENT_SIGNIFICANT.filter((field) => significant[field.key]).map((field) => <p key={field.key}><L en={field.en} ar={field.ar} /></p>)}
        <p>{row.lessons_text}</p>
        {row.reviewed_at ? <p><L en="Accepted by the Ministry" ar="قبلته الوزارة" /> · {row.reviewed_at}</p> : can(account.role, 'recordOutcome') ? <form action={acceptPostEventReportAction.bind(null, row.id)}>
          <button type="submit" style={{ padding: '12px 18px', border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)' }}><L en="Accept report" ar="قبول التقرير" /></button>
        </form> : null}
      </details>;
    })}
  </MinistryShell>;
}
