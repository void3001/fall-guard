import { NextResponse } from 'next/server';
import { getLatestPerDevice } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { markOfflineDevices } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  markOfflineDevices(60); // mark as offline if no data in 60s
  const rows = getLatestPerDevice();
  return NextResponse.json({ telemetry: rows });
}
