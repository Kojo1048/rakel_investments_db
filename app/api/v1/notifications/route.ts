import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { db } from '@/lib/db';

export const NOTIFICATION_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'DOCUMENT_UPLOAD',
  'DOCUMENT_DELETE',
  'DOCUMENT_EXPIRY_REMINDER',
  'INVOICE_CREATE',
  'INVOICE_UPDATE',
  'CONTRACT_CREATE',
  'CONTRACT_UPDATE',
  'OPERATIONS_ENTRY',
  'USER_CREATE',
  'USER_DELETE',
  'USER_APPROVE',
  'USER_DECLINE',
  'COMPANY_CREATE',
  'COMPANY_UPDATE',
  'DATA_IMPORT',
  'REGISTRATION_SUBMIT',
] as const;

export type NotificationAction = (typeof NOTIFICATION_ACTIONS)[number];

const ALLOWED_ROLES = ['SUPER_ADMIN', 'RAKEL_ADMIN', 'COMPANY_ADMIN'] as const;

const NOTIFICATION_COLS = `
  id, username, action, details,
  targetEntity, companyId, createdAt,
  company:Company!AuditLog_companyId_fkey(name)
`.trim();

export async function GET(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'audit:read');

    if (!(ALLOWED_ROLES as readonly string[]).includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limit  = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '30', 10), 50);
    const since  = req.nextUrl.searchParams.get('since');
    const unread = req.nextUrl.searchParams.get('unread') === '1';

    let query = db
      .from('AuditLog')
      .select(NOTIFICATION_COLS)
      .in('action', [...NOTIFICATION_ACTIONS])
      .order('createdAt', { ascending: false });

    // Company Admins only ever see their own company's events
    if (session.role === 'COMPANY_ADMIN') {
      query = query.eq('companyId', session.companyId ?? '');
    }

    if (since) query = query.gt('createdAt', since);
    if (!unread) query = query.limit(limit);

    const { data: notifications, error } = await query;
    if (error) throw error;

    if (unread) {
      return NextResponse.json({ count: (notifications ?? []).length });
    }

    return NextResponse.json({ notifications: notifications ?? [], total: (notifications ?? []).length });
  } catch (err) {
    return handleAuthError(err);
  }
}
