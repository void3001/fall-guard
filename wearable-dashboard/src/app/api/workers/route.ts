import { NextRequest, NextResponse } from 'next/server';
import { getAllWorkers, upsertWorker, deleteWorker } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ workers: getAllWorkers() });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  if (!body.rfid || !body.name) {
    return NextResponse.json({ error: 'rfid and name are required' }, { status: 400 });
  }
  upsertWorker(body);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { rfid } = await req.json();
  if (!rfid) return NextResponse.json({ error: 'rfid required' }, { status: 400 });
  deleteWorker(rfid);
  return NextResponse.json({ success: true });
}
