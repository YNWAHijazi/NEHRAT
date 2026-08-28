/**
 * Serves a stored document to a party entitled to read it.
 *
 * THE RULING THIS IMPLEMENTS (2026-08-28): the Ministry must see documents, not
 * names. The platform stores the file; this is where a reviewer opens it.
 *
 * FOUR THINGS THIS ROUTE REFUSES TO DO, each for a reason worth keeping:
 *
 * 1. It never trusts the stored MIME type. The Content-Type it sends comes from
 *    lib/rules/uploads.ts's allow-list, matched against what was stored. A row
 *    whose type is not on that list is not served at all -- serving a file we
 *    cannot vouch for, inline, on our own origin, is stored XSS with extra steps.
 *
 * 2. It never lets the browser sniff. `X-Content-Type-Options: nosniff` plus a
 *    `sandbox` Content-Security-Policy with no allowances, so even a PDF viewer
 *    plugin gets no script, no forms, no same-origin.
 *
 * 3. It never distinguishes "you may not" from "there is none". Both answer 404.
 *    A 403 on an existing document tells an unauthenticated prober that an event
 *    has a deployment map, which is exactly the enumeration non-negotiable 5b
 *    forbids on the public side and there is no reason to concede it here.
 *
 * 4. It never crosses the demonstration boundary. The bytes follow the record:
 *    lib/rules/scope.ts declares `attachedDocument` as matchSession, so a real
 *    reviewer cannot open a demonstration route map and a demonstration reviewer
 *    cannot open a real organizer's.
 *
 * WHO MAY READ, TODAY: the organizer who owns the event, and any Ministry role
 * holding viewSubmission on a FILED submission. Nominated counterparties -- an
 * EMS provider reading the deployment map it is named in -- are item 5 of the
 * same review and are not smuggled in here; when they arrive they arrive as an
 * explicit branch below, not as a loosened condition.
 */

import { NextResponse } from 'next/server';
import { currentAccount } from '../../../../../lib/auth';
import { getDb } from '../../../../../lib/db';
import { can } from '../../../../../lib/rules/ministry';
import { demonstrationFilter } from '../../../../../lib/rules/scope';
import { PLAN_DOC_KEY, servedType } from '../../../../../lib/rules/uploads';

const notFound = (): NextResponse => new NextResponse('Not found', { status: 404 });

interface Stored {
  fileName: string;
  contentType: string | null;
  bytes: Uint8Array | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; docKey: string }> },
): Promise<NextResponse> {
  const { eventId, docKey } = await params;
  const account = await currentAccount();
  if (!account) return notFound();

  const db = getDb();
  const event = db
    .prepare(`SELECT account_id, filed, is_demo FROM events WHERE id = ?`)
    .get(eventId) as { account_id: number; filed: number; is_demo: number } | undefined;
  if (!event) return notFound();

  // The demonstration boundary, before anything else is considered.
  const filter = demonstrationFilter('attachedDocument', { isDemonstration: account.isDemo });
  if ((event.is_demo === 1) !== filter.isDemo) return notFound();

  const owns = event.account_id === account.id;
  // A Ministry role reads a submission, and a submission exists once it is filed.
  const ministryMayRead = can(account.role, 'viewSubmission') && event.filed === 1;
  if (!owns && !ministryMayRead) return notFound();

  const row = (
    docKey === PLAN_DOC_KEY
      ? db
          .prepare(
            `SELECT attached_file AS fileName, attached_content_type AS contentType,
                    attached_bytes AS bytes FROM plans WHERE event_id = ?`,
          )
          .get(eventId)
      : db
          .prepare(
            `SELECT file_name AS fileName, content_type AS contentType, bytes
             FROM event_attachments WHERE event_id = ? AND doc_key = ?`,
          )
          .get(eventId, docKey)
  ) as Stored | undefined;

  // No row, or a name with no file behind it (every attachment seeded before the
  // storage ruling). The screen says so in words; the route simply has nothing.
  if (!row || !row.bytes || row.bytes.length === 0) return notFound();

  const type = servedType(row.contentType ?? '');
  if (!type) return notFound();

  // The file name goes out RFC-5987 encoded. It is organizer-supplied text and a
  // raw quote or newline in a header is a response-splitting invitation.
  const safeName = encodeURIComponent(row.fileName || 'document');

  return new NextResponse(Buffer.from(row.bytes), {
    status: 200,
    headers: {
      'Content-Type': type.mime,
      'Content-Length': String(row.bytes.length),
      'Content-Disposition': `inline; filename*=UTF-8''${safeName}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      // A regulatory document is never a cacheable public asset.
      'Cache-Control': 'private, no-store',
    },
  });
}
