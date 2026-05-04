import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, type SessionPayload } from './session';
import { AuthError, type Permission, hasPermission } from './permissions';
export { AuthError };

// Extracts and verifies the session token from the request cookie
export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get('rakel_session')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Use inside API route handlers to enforce authentication
export function withAuth(
  session: SessionPayload | null
): SessionPayload {
  if (!session) throw new AuthError('Unauthorized', 401);
  if (session.status !== 'ACTIVE') throw new AuthError('Account is not active', 403);
  return session;
}

// Use inside API route handlers to enforce a specific permission
export function withPermission(
  session: SessionPayload | null,
  permission: Permission
): SessionPayload {
  const s = withAuth(session);
  if (!hasPermission(s, permission)) throw new AuthError('Forbidden', 403);
  return s;
}

// Converts an AuthError into a proper NextResponse JSON error
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

// Wraps an API route handler with session injection + unified error handling
export function apiHandler(
  fn: (req: NextRequest, session: SessionPayload | null) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const session = getSessionFromRequest(req);
      return await fn(req, session);
    } catch (err) {
      return handleAuthError(err);
    }
  };
}
