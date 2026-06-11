import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { ContractUpdateSchema } from '@/lib/validations/contracts.schema';
import { updateContract } from '@/lib/services/contracts.service';
import { findContractById } from '@/lib/repositories/contracts.repository';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'contracts:read');
    const { id } = await params;
    const contract = await findContractById(id);
    if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ contract });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'contracts:write');
    const { id } = await params;
    const body = await req.json();
    const parsed = ContractUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const contract = await updateContract(id, parsed.data, session);
    return NextResponse.json({ contract });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'contracts:write');
    const { id } = await params;
    const contract = await findContractById(id);
    if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Soft-delete: archive instead of hard delete to preserve audit trail
    const { error: archiveError } = await db
      .from('Contract')
      .update({ isArchived: true, updatedAt: new Date().toISOString() })
      .eq('id', id);
    if (archiveError) throw archiveError;

    console.log(`[contracts] DELETE ${id} by ${session.username}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
