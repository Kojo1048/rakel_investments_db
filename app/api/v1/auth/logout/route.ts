import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/middleware';
import { logout } from '@/lib/services/auth.service';
import { clearSessionCookie } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);

  if (session) {
    await logout(session.userId, session.username);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('rakel_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
