import { NextRequest, NextResponse } from 'next/server';
import { acknowledgeAlert } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  acknowledgeAlert(parseInt(id));
  return NextResponse.json({ success: true });
}
