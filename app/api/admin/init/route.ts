import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { ensureDefaultAccounts } from '@/lib/init-db';

export const runtime = 'nodejs';

/**
 * POST /api/admin/init
 * Super-Admin-only endpoint to manually trigger default-account creation.
 * Useful when the server is already running but accounts are missing.
 */
export async function POST(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'settings:write');

    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ensureDefaultAccounts();

    return NextResponse.json({
      ok: true,
      message: 'Rakel Admin account verified or created successfully.',
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
