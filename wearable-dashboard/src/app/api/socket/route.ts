// Socket.io in Next.js App Router requires a custom server.
// This route exists as a placeholder so the client-side io() call
// doesn't produce a 404 error. The actual Socket.io handshake
// is handled by the custom server (server.ts).
// When running `npm run dev` (next dev), Socket.io won't work.
// Use `npm run dev:server` (ts-node server.ts) for full Socket.io support.
// For now, the dashboard uses polling fallback via setInterval.

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { message: 'Socket.io requires custom server. See server.ts' },
    { status: 200 }
  );
}
