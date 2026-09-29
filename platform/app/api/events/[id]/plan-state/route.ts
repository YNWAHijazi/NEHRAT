import { NextResponse } from 'next/server';
import { currentAccount } from '../../../../../lib/auth';
import { planAccess } from '../../../../../lib/plan-access';
import { planFor } from '../../../../../lib/queries';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  const { id } = await params;
  const access = account ? planAccess(account, id) : null;
  if (!access) return new NextResponse('Not found', { status: 404 });
  return NextResponse.json({ version: planFor(access.ownerId, id)?.version ?? 0 }, { headers: { 'Cache-Control': 'private, no-store' } });
}
