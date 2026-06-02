import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Routes that don't require auth
const PUBLIC = ['/', '/api/auth/login', '/api/auth/logout', '/api/data/ingest'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes and static assets
  if (
    PUBLIC.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('session')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const session = await verifyToken(token);

  if (!session) {
    const res = NextResponse.redirect(new URL('/', req.url));
    res.cookies.delete('session');
    return res;
  }

  // Role-based route guards
  if (pathname.startsWith('/admin') && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (pathname.startsWith('/worker') && session.role !== 'worker') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/worker/:path*',
    '/api/telemetry',
    '/api/alerts/:path*',
    '/api/workers/:path*',
    '/api/devices',
    '/api/history',
  ],
};
