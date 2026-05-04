import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { countUsers } from '@/lib/repositories/user.repository';

/**
 * GET /api/v1/users/count
 * Returns { total: number } — a lightweight count query used by the dashboard.
 * Deliberately avoids selecting any user fields so schema drift cannot affect it.
 */
export async function GET(req: NextRequest) {
  try {
    withPermission(getSessionFromRequest(req), 'users:read');
    const total = await countUsers();
    return NextResponse.json({ total });
  } catch (err) {
    return handleAuthError(err);
  }
}
