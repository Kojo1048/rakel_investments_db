import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { UpdateUserSchema } from '@/lib/validations/user.schema';
import { getUserById, updateUser, deleteUser } from '@/lib/services/user.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'users:read');
    const { id } = await params;
    const user = await getUserById(id);
    return NextResponse.json({ user });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'users:write');
    const { id } = await params;

    const body = await req.json();
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const user = await updateUser(id, parsed.data, session);
    return NextResponse.json({ user });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'users:delete');
    const { id } = await params;
    await deleteUser(id, session);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
