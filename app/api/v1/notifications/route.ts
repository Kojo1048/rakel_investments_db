import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { db } from '@/lib/db';

// All audit actions surfaced as notifications to SUPER_ADMIN and RAKEL_ADMIN.
// Uses only existing AuditAction enum values — no schema changes needed.
export const NOTIFICATION_ACTIONS = [
  // Auth
  'LOGIN',
  'LOGOUT',
  // Documents
  'DOCUMENT_UPLOAD',
  'DOCUMENT_DELETE',
  'DOCUMENT_EXPIRY_REMINDER',
  // Invoices
  'INVOICE_CREATE',
  'INVOICE_UPDATE',
  // Contracts
  'CONTRACT_CREATE',
  'CONTRACT_UPDATE',
  // Operations
  'OPERATIONS_ENTRY',
  // Users
  'USER_CREATE',
  'USER_DELETE',
  'USER_APPROVE',
  'USER_DECLINE',
  // Companies
  'COMPANY_CREATE',
  'COMPANY_UPDATE',
  // Other
  'DATA_IMPORT',
  'REGISTRATION_SUBMIT',
] as const;

export type NotificationAction = (typeof NOTIFICATION_ACTIONS)[number];

// Roles that are allowed to query the notification feed
const ALLOWED_ROLES = ['SUPER_ADMIN', 'RAKEL_ADMIN'] as const;

export async function GET(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'audit:read');

    if (!(ALLOWED_ROLES as readonly string[]).includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limit  = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '30', 10), 50);
    const since  = req.nextUrl.searchParams.get('since');
    const unread = req.nextUrl.searchParams.get('unread') === '1';

    const queryWhere = (actions: readonly string[]) => ({
      action: { in: actions as unknown as any[] },
      ...(since && { createdAt: { gt: new Date(since) } }),
    });

    const querySelect = {
      id:          true,
      username:    true,
      action:      true,
      details:     true,
      targetEntity: true,
      companyId:   true,
      createdAt:   true,
      company:     { select: { name: true } },
    };

    let notifications: any[] = [];
    try {
      notifications = await db.auditLog.findMany({
        where:   queryWhere(NOTIFICATION_ACTIONS),
        orderBy: { createdAt: 'desc' },
        take:    unread ? undefined : limit,
        select:  querySelect,
      });
    } catch {
      // DOCUMENT_EXPIRY_REMINDER may not yet be in the DB enum.
      // Fall back to all other stable actions.
      const STABLE = NOTIFICATION_ACTIONS.filter(a => a !== 'DOCUMENT_EXPIRY_REMINDER');
      notifications = await db.auditLog.findMany({
        where:   queryWhere(STABLE),
        orderBy: { createdAt: 'desc' },
        take:    unread ? undefined : limit,
        select:  querySelect,
      });
    }

    if (unread) {
      return NextResponse.json({ count: notifications.length });
    }

    return NextResponse.json({ notifications, total: notifications.length });
  } catch (err) {
    return handleAuthError(err);
  }
}
