import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, handleAuthError } from '@/lib/auth/middleware';
import { getRakelNotifications } from '@/lib/notifications/getRakelNotifications';

export const dynamic = 'force-dynamic';

// Roles allowed to access this aggregated notification feed
const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'RAKEL_ADMIN']);

export async function GET(req: NextRequest) {
  try {
    // ── 1. Authenticate ──────────────────────────────────────────────────────
    const session = getSessionFromRequest(req);

    if (!session) {
      console.warn('[notifications/rakel] 401 — no valid session cookie');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Authorise by role (no permission string needed — this endpoint is
    //       purpose-built for admin roles and is not governed by the generic
    //       permission table that was causing the 403).  ─────────────────────
    if (!ALLOWED_ROLES.has(session.role)) {
      console.warn(
        `[notifications/rakel] 403 — role "${session.role}" not in allowed set [${[...ALLOWED_ROLES].join(', ')}]`
      );
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log(
      `[notifications/rakel] GET — user: ${session.username}, role: ${session.role}`
    );

    // ── 3. Fetch and return ──────────────────────────────────────────────────
    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10),
      50
    );

    const notifications = await getRakelNotifications(limit);

    return NextResponse.json({ notifications, total: notifications.length });

  } catch (err) {
    console.error('[notifications/rakel] Unexpected error:', err);
    return handleAuthError(err);
  }
}
