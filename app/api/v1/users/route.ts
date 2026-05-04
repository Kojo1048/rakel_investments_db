import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, handleAuthError } from '@/lib/auth/middleware';
import { withPermission } from '@/lib/auth/middleware';
import { UserQuerySchema, CreateUserSchema } from '@/lib/validations/user.schema';
import { listUsers, createUser } from '@/lib/services/user.service';

export async function GET(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'users:read');

    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = UserQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Admins can see all users; company-scoped roles see only their own company
    const canSeeAllUsers = ['SUPER_ADMIN', 'RAKEL_ADMIN', 'CEO'].includes(session.role);
    const filters = { ...parsed.data };
    if (!canSeeAllUsers) {
      filters.companyId = session.companyId ?? undefined;
    }

    const result = await listUsers(filters);
    return NextResponse.json(result);
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'users:write');

    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const user = await createUser(parsed.data, session);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return handleAuthError(err);
  }
}
