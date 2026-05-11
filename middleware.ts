import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/session';

// jsonwebtoken uses Node.js crypto — must run in Node.js, not Edge runtime.
export const runtime = 'nodejs';

// ── Route access rules ────────────────────────────────────────────────────────
// More-specific patterns must come BEFORE broader ones (first match wins).
const PROTECTED_ROUTES: Array<{ pattern: RegExp; roles: string[] }> = [
  { pattern: /^\/superadmin\/documents/, roles: ['SUPER_ADMIN', 'RAKEL_ADMIN'] },
  { pattern: /^\/superadmin/,            roles: ['SUPER_ADMIN'] },
  { pattern: /^\/admin/,                 roles: ['SUPER_ADMIN', 'RAKEL_ADMIN'] },
  { pattern: /^\/rakel/,                 roles: ['RAKEL_ADMIN', 'SUPER_ADMIN'] },
  { pattern: /^\/ceo/,                   roles: ['CEO', 'SUPER_ADMIN'] },
  { pattern: /^\/company/,               roles: ['COMPANY_ADMIN', 'STAFF', 'SUPER_ADMIN', 'RAKEL_ADMIN', 'CEO'] },
  { pattern: /^\/dashboard/,             roles: ['COMPANY_ADMIN', 'STAFF', 'SUPER_ADMIN', 'RAKEL_ADMIN', 'CEO'] },
];

// API endpoints that are always public (no JWT required)
const PUBLIC_API_PREFIXES = [
  '/api/v1/auth/login',
  '/api/v1/registrations',
  '/api/v1/companies/public',
];

// Short-path stub pages that redirect to a real route (auth handled there)
const REDIRECT_STUBS = new Set([
  '/superadmin', '/operations', '/contracts',
  '/invoices',   '/documents',  '/settings',
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── 1. Always skip — static assets and Next.js internals ─────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon') ||
    pathname.startsWith('/placeholder')
  ) {
    return NextResponse.next();
  }

  // ── 2. Always allow — login/register page ────────────────────────────────
  // The login page handles its own "already logged in" redirect via useEffect.
  // NEVER intercept "/" here — doing so creates a redirect loop when
  // auth/me fails: layout → "/" → middleware → dashboard → layout → "/"…
  if (pathname === '/') {
    return NextResponse.next();
  }

  // ── 3. Always allow — stub redirects (auth checked on destination) ────────
  if (REDIRECT_STUBS.has(pathname)) {
    return NextResponse.next();
  }

  // ── 4. Always allow — public API routes ──────────────────────────────────
  if (PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── 5. Protect all other /api/* routes ───────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const token   = req.cookies.get('rakel_session')?.value;
    const session = token ? verifyToken(token) : null;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ── 6. Protect dashboard page routes ─────────────────────────────────────
  const matchedRoute = PROTECTED_ROUTES.find(r => r.pattern.test(pathname));
  if (matchedRoute) {
    const token   = req.cookies.get('rakel_session')?.value;
    const session = token ? verifyToken(token) : null;

    // No valid token → go to login
    if (!session) {
      const loginUrl = new URL('/', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Wrong role → send to the user's own dashboard
    if (!matchedRoute.roles.includes(session.role)) {
      const roleHome: Record<string, string> = {
        SUPER_ADMIN:   '/admin',
        RAKEL_ADMIN:   '/admin',
        CEO:           '/ceo',
        COMPANY_ADMIN: '/company',
        STAFF:         '/company',
      };
      return NextResponse.redirect(
        new URL(roleHome[session.role] ?? '/', req.url)
      );
    }
  }

  // ── 7. Everything else — allow ────────────────────────────────────────────
  return NextResponse.next();
}

export const config = {
  // Exclude static files from middleware entirely.
  // This is the correct pattern — Next.js docs recommend this exact exclusion.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
