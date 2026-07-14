import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { requireCompanyAccess } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'operations:read');
    const { id } = await params;
    const { data: record } = await db
      .from('OperationsRecord')
      .select('*, company:Company!OperationsRecord_companyId_fkey(id, name), recorder:User!OperationsRecord_recordedBy_fkey(username, fullName), contract:Contract!OperationsRecord_contractId_fkey(title, contractNumber)')
      .eq('id', id)
      .maybeSingle();
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    requireCompanyAccess(session, record.companyId as string);
    return NextResponse.json({ record });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'operations:write');
    const { id } = await params;

    const { data: record } = await db.from('OperationsRecord').select('id, companyId').eq('id', id).maybeSingle();
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    requireCompanyAccess(session, record.companyId as string);

    const { error: deleteError } = await db.from('OperationsRecord').delete().eq('id', id);
    if (deleteError) throw deleteError;

    console.log(`[operations] DELETE ${id} by ${session.username}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
