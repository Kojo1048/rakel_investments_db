import { NextRequest, NextResponse } from 'next/server';
import { LoginSchema } from '@/lib/validations/auth.schema';
import { login } from '@/lib/services/auth.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;
    const ipAddress = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined;
    const userAgent = req.headers.get('user-agent') ?? undefined;

    const { token, user } = await login(username, password, ipAddress, userAgent);

    const isProduction = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({
      user: {
        id: user.userId,
        username: user.username,
        role: user.role,
        status: user.status,
        companyId: user.companyId ?? null,
        fullName: null,
        email: null,
      },
    });

    response.cookies.set('rakel_session', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    const status = message.includes('Invalid') ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
