/**
 * Serves a document on the shared counterparty list.
 *
 * The same contract as /api/documents, for the same reasons: allow-listed served
 * type, nosniff, sandbox CSP, 404 for both "no such thing" and "not yours", and
 * the demonstration boundary before anything else. Read the header comment there;
 * it is not repeated here, but every rule in it holds.
 *
 * WHO MAY READ: the counterparty the row's invitation belongs to, the organizer who
 * owns the event, and a Ministry role holding viewSubmission on a filed submission.
 * The shared list is a two-party lane with the Ministry reading over it; nobody else
 * is on it.
 */

import { NextResponse } from 'next/server';
import { currentAccount } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';
import { can } from '../../../../lib/rules/ministry';
import { demonstrationFilter } from '../../../../lib/rules/scope';
import { servedType } from '../../../../lib/rules/uploads';

const notFound = (): NextResponse => new NextResponse('Not found', { status: 404 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const docId = Number(id);
  if (!Number.isInteger(docId)) return notFound();

  const account = await currentAccount();
  if (!account) return notFound();

  const row = getDb()
    .prepare(
      `SELECT d.file_name AS fileName, d.content_type AS contentType, d.bytes AS bytes,
              i.account_id AS holderId, e.account_id AS ownerId, e.filed AS filed,
              e.is_demo AS isDemo
       FROM shared_documents d
       JOIN invitations i ON i.token = d.invitation_token
       JOIN events e ON e.id = i.event_id
       WHERE d.id = ?`,
    )
    .get(docId) as
    | {
        fileName: string; contentType: string | null; bytes: Uint8Array | null;
        holderId: number | null; ownerId: number; filed: number; isDemo: number;
      }
    | undefined;
  if (!row) return notFound();

  const filter = demonstrationFilter('attachedDocument', { isDemonstration: account.isDemo });
  if ((row.isDemo === 1) !== filter.isDemo) return notFound();

  const entitled =
    row.holderId === account.id ||
    row.ownerId === account.id ||
    (can(account.role, 'viewSubmission') && row.filed === 1);
  if (!entitled) return notFound();

  if (!row.bytes || row.bytes.length === 0) return notFound();
  const type = servedType(row.contentType ?? '');
  if (!type) return notFound();

  return new NextResponse(Buffer.from(row.bytes), {
    status: 200,
    headers: {
      'Content-Type': type.mime,
      'Content-Length': String(row.bytes.length),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.fileName || 'document')}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Cache-Control': 'private, no-store',
    },
  });
}
