import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError, AuthError } from '@/lib/auth/middleware';
import { ContractQuerySchema, ContractCreateSchema } from '@/lib/validations/contracts.schema';
import { getContracts, createContract } from '@/lib/services/contracts.service';

export async function GET(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'contracts:read');
    const params  = Object.fromEntries(req.nextUrl.searchParams);
    const parsed  = ContractQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const contracts = await getContracts(parsed.data, session);
    return NextResponse.json({ contracts });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    const session = withPermission(getSessionFromRequest(req), 'contracts:write');

    // ── 1. Parse body ──────────────────────────────────────────────────────
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    console.log('[contracts] POST body:', body);

    // ── 2. Validate shape ──────────────────────────────────────────────────
    const parsed = ContractCreateSchema.safeParse(body);
    if (!parsed.success) {
      console.warn('[contracts] POST validation failed:', parsed.error.flatten());
      return NextResponse.json({ error: 'Invalid data', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // ── 3. Pre-Prisma required-field check ────────────────────────────────
    const companyId = parsed.data.companyId ?? session.companyId ?? null;
    if (!companyId) {
      return NextResponse.json(
        { error: 'No company specified. Select a company before creating a contract, or log in as a company user.' },
        { status: 400 }
      );
    }
    if (!session.userId) {
      return NextResponse.json({ error: 'Missing session user ID — please log in again.' }, { status: 401 });
    }

    // ── 4. Create ─────────────────────────────────────────────────────────
    const contract = await createContract({ ...parsed.data, companyId }, session);
    console.log('[contracts] POST success — id:', contract.id);
    return NextResponse.json({ contract }, { status: 201 });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    const status  = err instanceof AuthError ? (err as AuthError).status : 500;
    console.error('[contracts] POST error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
