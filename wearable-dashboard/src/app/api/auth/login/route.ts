import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const { username, password, role } = await req.json();

  if (!username || !password || !role) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const WORKER_USERNAME = process.env.WORKER_USERNAME;
  const WORKER_PASSWORD = process.env.WORKER_PASSWORD;

  // Require credentials to be configured in .env.local
  if (role === 'admin' && (!ADMIN_USERNAME || !ADMIN_PASSWORD)) {
    return NextResponse.json(
      { error: 'Setup required: Open .env.local and set ADMIN_USERNAME and ADMIN_PASSWORD, then restart the server.' },
      { status: 503 }
    );
  }
  if (role === 'worker' && (!WORKER_USERNAME || !WORKER_PASSWORD)) {
    return NextResponse.json(
      { error: 'Setup required: Open .env.local and set WORKER_USERNAME and WORKER_PASSWORD, then restart the server.' },
      { status: 503 }
    );
  }

  let valid = false;
  if (role === 'admin') {
    valid = username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
  } else if (role === 'worker') {
    valid = username === WORKER_USERNAME && password === WORKER_PASSWORD;
  }

  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await signToken({ username, role });
  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 12,
    sameSite: 'lax',
  });

  return NextResponse.json({ success: true, role });
}
