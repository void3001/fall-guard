import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'wearable_safety_super_secret_key_2026'
);

export type Role = 'admin' | 'worker';

export interface SessionPayload {
  username: string;
  role: Role;
  rfid?: string;
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireSession(role?: Role): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  if (role && session.role !== role) throw new Error('Forbidden');
  return session;
}
