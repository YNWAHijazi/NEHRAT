import { NextResponse } from 'next/server';
import { currentAccount } from '../../../../../lib/auth';
import { getDb } from '../../../../../lib/db';
import { can } from '../../../../../lib/rules/ministry';
import { servedType } from '../../../../../lib/rules/uploads';

/**
 * The photo of an installed AED. Served to the facility's owner and to a Ministry
 * role that may view submissions, inside the demonstration boundary; to nobody
 * else, and never with a type the allow-list did not vouch for (lib/rules/uploads.ts).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; label: string }> }) {
  const no = () => new NextResponse('Not found', { status: 404 });
  const account = await currentAccount();
  if (!account) return no();
  const { id, label } = await params;
  if (!/^AED-\d{3,}$/.test(label)) return no();
  const db = getDb();
  const facility = db.prepare('SELECT account_id, is_demo FROM facilities WHERE id = ?').get(id) as { account_id: number; is_demo: number } | undefined;
  if (!facility || facility.is_demo !== Number(account.isDemo)) return no();
  if (facility.account_id !== account.id && !can(account.role, 'viewSubmission')) return no();
  const row = db.prepare('SELECT file_name, content_type, bytes FROM facility_device_photos WHERE facility_id = ? AND label = ?').get(id, label) as
    | { file_name: string; content_type: string; bytes: Uint8Array | null }
    | undefined;
  const type = row ? servedType(row.content_type) : null;
  if (!row?.bytes?.length || !type || type.inline !== 'image') return no();
  return new NextResponse(Buffer.from(row.bytes), {
    headers: {
      'Content-Type': type.mime,
      'Content-Length': String(row.bytes.length),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Cache-Control': 'private, no-store',
    },
  });
}
