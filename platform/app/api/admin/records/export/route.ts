import { currentAccount } from '../../../../../lib/auth';
import { adminRecords } from '../../../../../lib/queries';
import { can } from '../../../../../lib/rules/ministry';
import { csvDocument } from '../../../../../lib/csv';

export async function GET(request: Request): Promise<Response> {
  const account = await currentAccount();
  if (!account || !can(account.role, 'viewRegistry')) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  }
  const params = new URL(request.url).searchParams;
  const level = params.get('level');
  const records = adminRecords(account.isDemo, {
    level: level ? Number(level) : undefined,
    status: params.get('status') || undefined,
    search: params.get('q') || undefined,
  });
  const rows = records.map((record) => [
    record.id, record.mophReference, record.nameEn, record.nameAr,
    record.organizationEn, record.organizationAr, record.municipalities,
    record.level, record.startDate, record.endDate, record.filed,
    record.filedAt, record.outcome, record.outcomeAt, record.archivedAt,
  ]);
  const headings = [
    'Record ID / رقم السجل', 'Ministry reference / مرجع الوزارة',
    'Event name (EN)', 'اسم الفعالية', 'Organization (EN)', 'المؤسسة',
    'Municipalities / البلديات', 'Level / المستوى', 'Start date / تاريخ البداية',
    'End date / تاريخ النهاية', 'Filed / مقدّم', 'Filed date / تاريخ التقديم',
    'Outcome / النتيجة', 'Outcome date / تاريخ النتيجة', 'Archived date / تاريخ الأرشفة',
  ];
  return new Response(csvDocument([headings, ...rows]), { headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="event-records.csv"',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
