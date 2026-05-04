import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError, AuthError } from '@/lib/auth/middleware';
import { InvoiceQuerySchema, InvoiceCreateSchema } from '@/lib/validations/invoices.schema';
import { getInvoices, createInvoice } from '@/lib/services/invoices.service';

export async function GET(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'invoices:read');
    const params  = Object.fromEntries(req.nextUrl.searchParams);
    const parsed  = InvoiceQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const invoices = await getInvoices(parsed.data, session);
    return NextResponse.json({ invoices });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    const session = withPermission(getSessionFromRequest(req), 'invoices:write');

    // ── 1. Parse body ──────────────────────────────────────────────────────
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    console.log('[invoices] POST body:', body);

    // ── 2. Validate shape ──────────────────────────────────────────────────
    const parsed = InvoiceCreateSchema.safeParse(body);
    if (!parsed.success) {
      console.warn('[invoices] POST validation failed:', parsed.error.flatten());
      return NextResponse.json({ error: 'Invalid data', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // ── 3. Pre-Prisma required-field check ────────────────────────────────
    const companyId = parsed.data.companyId ?? session.companyId ?? null;
    if (!companyId) {
      return NextResponse.json(
        { error: 'No company specified. Select a company before creating an invoice, or log in as a company user.' },
        { status: 400 }
      );
    }
    if (!session.userId) {
      return NextResponse.json({ error: 'Missing session user ID — please log in again.' }, { status: 401 });
    }
    if (!parsed.data.client?.trim()) {
      return NextResponse.json({ error: 'Client name is required.' }, { status: 400 });
    }
    if (typeof parsed.data.amount !== 'number' || isNaN(parsed.data.amount) || parsed.data.amount < 0) {
      return NextResponse.json({ error: 'Amount must be a valid non-negative number.' }, { status: 400 });
    }

    // ── 4. Create ─────────────────────────────────────────────────────────
    const invoice = await createInvoice({ ...parsed.data, companyId }, session);
    console.log('[invoices] POST success — id:', invoice.id);
    return NextResponse.json({ invoice }, { status: 201 });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    const status  = err instanceof AuthError ? (err as AuthError).status : 500;
    console.error('[invoices] POST error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
