import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { findAuditLogs } from '@/lib/repositories/audit.repository';
import { z } from 'zod';

const AuditQuerySchema = z.object({
  userId: z.string().optional(),
  companyId: z.string().optional(),
  action: z.string().optional() as z.ZodType<any>,
  search: z.string().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'audit:read');

    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = AuditQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Company-scoped users only see their company's audit logs
    const filters = { ...parsed.data };
    if (session.role !== 'SUPER_ADMIN' && session.role !== 'CEO') {
      filters.companyId = session.companyId ?? undefined;
    }

    const result = await findAuditLogs(filters);
    return NextResponse.json(result);
  } catch (err) {
    return handleAuthError(err);
  }
}
