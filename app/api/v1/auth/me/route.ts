import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/middleware';
import { findUserById } from '@/lib/repositories/user.repository';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await findUserById(session.userId);
    if (!dbUser) {
      // User no longer exists in DB (e.g. after a DB reset) — clear the stale
      // cookie so the middleware stops redirecting and the user reaches the login page.
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      res.cookies.set('rakel_session', '', { maxAge: 0, path: '/' });
      return res;
    }

    // Return the same normalized shape as the login response so
    // AuthContext always receives a consistent object regardless of
    // whether the user was hydrated via login or a page refresh.
    return NextResponse.json({
      user: {
        id:           dbUser.id,
        username:     dbUser.username,
        role:         dbUser.role,
        status:       dbUser.status,
        companyId:    dbUser.companyId    ?? null,
        companyName:  (dbUser as any).company?.name ?? null,
        fullName:     dbUser.fullName     ?? null,
        email:        dbUser.email        ?? null,
        staffModules: (dbUser as any).staffModules ?? null,
      },
    });
  } catch (err) {
    console.error('[ME] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
