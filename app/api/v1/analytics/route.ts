import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { AnalyticsQuerySchema } from '@/lib/validations/analytics.schema';
import { getAnalytics } from '@/lib/services/analytics.service';

export async function GET(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'analytics:read');

    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = AnalyticsQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = await getAnalytics(parsed.data, session);
    return NextResponse.json(data);
  } catch (err) {
    return handleAuthError(err);
  }
}
