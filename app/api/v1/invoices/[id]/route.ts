import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { InvoiceUpdateSchema } from '@/lib/validations/invoices.schema';
import { updateInvoice } from '@/lib/services/invoices.service';
import { findInvoiceById } from '@/lib/repositories/invoices.repository';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    withPermission(getSessionFromRequest(req), 'invoices:read');
    const { id } = await params;
    const invoice = await findInvoiceById(id);
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'invoices:write');
    const { id } = await params;
    const body = await req.json();
    const parsed = InvoiceUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const invoice = await updateInvoice(id, parsed.data, session);
    return NextResponse.json({ invoice });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'invoices:write');
    const { id } = await params;
    const invoice = await findInvoiceById(id);
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Soft-delete: archive so the record stays in the audit trail
    const { db } = await import('@/lib/db');
    await (db as any).invoice.update({ where: { id }, data: { isArchived: true } });

    console.log(`[invoices] DELETE ${id} by ${session.username}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
