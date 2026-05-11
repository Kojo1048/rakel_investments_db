import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { db } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    withPermission(getSessionFromRequest(req), 'operations:read');
    const { id } = await params;
    const record = await (db as any).operationsRecord.findUnique({
      where:  { id },
      include: {
        company:  { select: { id: true, name: true } },
        recorder: { select: { username: true, fullName: true } },
        contract: { select: { title: true, contractNumber: true } },
      },
    });
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ record });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'operations:write');
    const { id } = await params;

    const record = await (db as any).operationsRecord.findUnique({ where: { id } });
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await (db as any).operationsRecord.delete({ where: { id } });

    console.log(`[operations] DELETE ${id} by ${session.username}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
