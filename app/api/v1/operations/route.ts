import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError, AuthError } from '@/lib/auth/middleware';
import { OperationsQuerySchema, OperationsCreateSchema } from '@/lib/validations/operations.schema';
import { getOperations, createOperationsEntry } from '@/lib/services/operations.service';

export async function GET(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'operations:read');
    const params  = Object.fromEntries(req.nextUrl.searchParams);
    const parsed  = OperationsQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const data = await getOperations(parsed.data, session);
    return NextResponse.json(data);
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    const session = withPermission(getSessionFromRequest(req), 'operations:write');

    // ── 1. Parse body ──────────────────────────────────────────────────────
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    console.log('[operations] POST body:', body);

    // ── 2. Validate shape ──────────────────────────────────────────────────
    const parsed = OperationsCreateSchema.safeParse(body);
    if (!parsed.success) {
      console.warn('[operations] POST validation failed:', parsed.error.flatten());
      return NextResponse.json({ error: 'Invalid data', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // ── 3. Pre-Prisma required-field check ────────────────────────────────
    const companyId = parsed.data.companyId ?? session.companyId ?? null;
    if (!companyId) {
      return NextResponse.json(
        { error: 'No company specified. Select a company before logging an entry, or log in as a company user.' },
        { status: 400 }
      );
    }
    if (!session.userId) {
      return NextResponse.json({ error: 'Missing session user ID — please log in again.' }, { status: 401 });
    }
    if (!parsed.data.department?.trim()) {
      return NextResponse.json({ error: 'Department is required.' }, { status: 400 });
    }
    if (!parsed.data.activityType?.trim()) {
      return NextResponse.json({ error: 'Activity type is required.' }, { status: 400 });
    }

    const d = parsed.data;
    console.log('[operations] POST pre-write fields:', {
      companyId,
      date:             d.date,
      department:       d.department,
      manpowerCount:    d.manpowerCount,
      activityType:     d.activityType,
      performanceScore: d.performanceScore,
      recordedBy:       session.userId,
    });

    // ── 4. Create ─────────────────────────────────────────────────────────
    const record = await createOperationsEntry({ ...parsed.data, companyId }, session);
    console.log('[operations] POST success — id:', record.id);
    return NextResponse.json({ record }, { status: 201 });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    const status  = err instanceof AuthError ? (err as AuthError).status : 500;
    console.error('[operations] POST error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
