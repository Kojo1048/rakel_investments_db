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

    // ── 6. Build Prisma-safe data object ─────────────────────────────────────
    // staffModules is handled separately inside createRegistration() to avoid
    // PrismaClientValidationError when the generated client predates the schema
    // change that added the staffModules column.
    await createRegistration({
      username,
      email,
      passwordHash,
      fullName,
      requestedRole,
      ...(reason && reason.trim()                     ? { reason: reason.trim() } : {}),
      ...(staffModules && staffModules.length > 0     ? { staffModules }          : {}),
      ...(companyId                                   ? { company: { connect: { id: companyId } } } : {}),
    });

    return NextResponse.json(
      { message: 'Registration submitted. Awaiting admin approval.' },
      { status: 201 }
    );

  } catch (err: unknown) {
    console.error('[registrations] POST error:', err);

    // Surface the real error code so the client knows whether it is a
    // bad-request problem or a genuine server fault.
    const prismaCode = (err as any)?.code;
    const message    = (err as any)?.message ?? '';

    // P2002 = unique constraint violation (race condition on username/email)
    if (prismaCode === 'P2002') {
      return NextResponse.json(
        { error: 'Username or email already exists.' },
        { status: 409 }
      );
    }

    // P2025 = related record not found (e.g. invalid companyId)
    if (prismaCode === 'P2025') {
      return NextResponse.json(
        { error: 'The selected company does not exist. Please choose a valid company.' },
        { status: 400 }
      );
    }

    // PrismaClientValidationError — unknown field or type mismatch
    if (message.includes('PrismaClientValidationError') || message.includes('Unknown field')) {
      return NextResponse.json(
        { error: 'Registration failed due to a data validation error. Please try again.' },
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
