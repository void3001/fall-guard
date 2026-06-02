import { NextResponse } from 'next/server';
import { getAlerts, getActiveAlerts } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const active = searchParams.get('active') === 'true';
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  const alerts = active ? getActiveAlerts() : getAlerts(limit, offset);
  return NextResponse.json({ alerts });
}
