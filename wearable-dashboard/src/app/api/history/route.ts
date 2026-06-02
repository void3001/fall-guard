import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalTelemetry } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get('device_id') || '';
  const from = parseInt(searchParams.get('from') || '0');
  const to = parseInt(searchParams.get('to') || `${Math.floor(Date.now() / 1000)}`);

  if (!device_id) {
    return NextResponse.json({ error: 'device_id required' }, { status: 400 });
  }

  const rows = getHistoricalTelemetry(device_id, from, to);
  return NextResponse.json({ history: rows });
}
