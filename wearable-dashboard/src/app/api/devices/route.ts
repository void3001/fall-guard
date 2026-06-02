import { NextRequest, NextResponse } from 'next/server';
import { getAllDevices, markOfflineDevices } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  markOfflineDevices(60);
  return NextResponse.json({ devices: getAllDevices() });
}
