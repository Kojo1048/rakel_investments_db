import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import type { UserRole, UserStatus } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

export interface SessionPayload {
  userId: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  companyId: string | null;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('rakel_session')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function setSessionCookie(token: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    name: 'rakel_session',
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours — matches JWT_EXPIRES_IN
  };
}

export function clearSessionCookie() {
  return {
    name: 'rakel_session',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
}
