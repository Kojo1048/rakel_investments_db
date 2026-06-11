import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import {
  findPendingRegistrations,
  createRegistration,
  findRegistrationByUsername,
} from '@/lib/repositories/registration.repository';
import { RegisterSchema } from '@/lib/validations/auth.schema';
import { hashPassword, isUsernameAvailable, isEmailAvailable } from '@/lib/services/auth.service';

// ── GET /api/v1/registrations ─────────────────────────────────────────────────
// Returns pending registrations. Requires registrations:read permission.

export async function GET(req: NextRequest) {
  try {
    withPermission(getSessionFromRequest(req), 'registrations:read');
    const companyId = req.nextUrl.searchParams.get('companyId') ?? undefined;
    const registrations = await findPendingRegistrations(companyId);
    return NextResponse.json({ registrations });
  } catch (err) {
    return handleAuthError(err);
  }
}

// ── POST /api/v1/registrations ────────────────────────────────────────────────
// Public endpoint — anyone can submit a registration request.

export async function POST(req: NextRequest) {
  // ── 1. Parse request body ────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  // ── 2. Validate against RegisterSchema ───────────────────────────────────
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const {
    username,
    email,
    password,
    fullName,
    requestedRole,
    companyId,
    reason,
    staffModules,
  } = parsed.data;

  try {
    // ── 3. Check for duplicate username ─────────────────────────────────────
    const [usernameInUsers, usernameInPending] = await Promise.all([
      isUsernameAvailable(username),
      findRegistrationByUsername(username),
    ]);

    if (!usernameInUsers || usernameInPending) {
      return NextResponse.json(
        { error: 'Username already taken or a registration with this username is already pending.' },
        { status: 409 }
      );
    }

    // ── 4. Check for duplicate email ────────────────────────────────────────
    if (!(await isEmailAvailable(email))) {
      return NextResponse.json(
        { error: 'Email already registered.' },
        { status: 409 }
      );
    }

    // ── 5. Hash password ─────────────────────────────────────────────────────
    const passwordHash = await hashPassword(password);

    await createRegistration({
      username,
      email,
      passwordHash,
      fullName,
      requestedRole,
      ...(reason && reason.trim()                 ? { reason: reason.trim() } : {}),
      ...(staffModules && staffModules.length > 0 ? { staffModules }          : {}),
      ...(companyId                               ? { companyId }             : {}),
    });

    return NextResponse.json(
      { message: 'Registration submitted. Awaiting admin approval.' },
      { status: 201 }
    );

  } catch (err: unknown) {
    console.error('[registrations] POST error:', err);

    const supabaseCode = (err as any)?.code;

    // 23505 = unique constraint violation (race condition on username/email)
    if (supabaseCode === '23505') {
      return NextResponse.json(
        { error: 'Username or email already exists.' },
        { status: 409 }
      );
    }

    // 23503 = foreign key violation (invalid companyId)
    if (supabaseCode === '23503') {
      return NextResponse.json(
        { error: 'The selected company does not exist. Please choose a valid company.' },
        { status: 400 }
      );
    }

    // Unknown server error
    return NextResponse.json(
      { error: 'Registration failed. Please try again later.' },
      { status: 500 }
    );
  }
}
