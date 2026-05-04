import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    withPermission(getSessionFromRequest(req), 'companies:read');

    const services = await db.service.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, icon: true, description: true },
    });

    return NextResponse.json({ services });
  } catch (err) {
    return handleAuthError(err);
  }
}
