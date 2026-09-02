/**
 * Serves a role-relevant document to a NOMINATED PARTY, on their token alone.
 *
 * Why this is not /api/documents with a looser condition: that route answers to an
 * ACCOUNT, and the whole point of the three-stage nomination is that a party can read
 * what they are being asked to take on before they hold one. Two different credentials
 * answering two different questions, kept apart so neither is weakened to serve the
 * other. The security contract is identical -- read the header of
 * app/api/documents/[eventId]/[docKey]/route.ts; every rule in it holds here too.
 *
 * WHAT THE TOKEN BUYS, and nothing more:
 *   - documents on the ALLOW-LIST for this nomination's role, by key. Not "everything
 *     except"; a document added to the catalogue tomorrow is invisible here until
 *     somebody decides it concerns the nominee.
 *   - on the ONE event the nomination names.
 *   - while the nomination is live. A withdrawn or removed nomination is a dead token
 *     and reads nothing.
 *
 * The token is unguessable and is the credential (rule 6). It is not a session: it
 * grants no screen, no other event, and no part of the submission.
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { nomineeMayReadDocument } from '../../../../../lib/rules/nomination-access';
import { servedType } from '../../../../../lib/rules/uploads';

const notFound = (): NextResponse => new NextResponse('Not found', { status: 404 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; docKey: string }> },
): Promise<NextResponse> {
  const { token, docKey } = await params;
  const db = getDb();

  const inv = db
    .prepare(`SELECT event_id, kind, status FROM invitations WHERE token = ?`)
    .get(token) as { event_id: string; kind: 'ems' | 'director'; status: string } | undefined;
  if (!inv) return notFound();
  // Declined ends the entitlement just as withdrawal or removal does: the token
  // stops serving the organizer's documents when its holder is no longer in the event.
  if (inv.status === 'withdrawn' || inv.status === 'removed' || inv.status === 'declined') return notFound();
  if (!nomineeMayReadDocument(inv.kind, docKey)) return notFound();

  const row = db
    .prepare(
      `SELECT file_name AS fileName, content_type AS contentType, bytes
       FROM event_attachments WHERE event_id = ? AND doc_key = ?`,
    )
    .get(inv.event_id, docKey) as
    | { fileName: string; contentType: string | null; bytes: Uint8Array | null }
    | undefined;
  if (!row || !row.bytes || row.bytes.length === 0) return notFound();

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
