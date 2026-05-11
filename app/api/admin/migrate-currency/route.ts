/**
 * ONE-TIME migration endpoint — adds the currency column to Invoice.
 * DELETE THIS FILE after running it once successfully.
 *
 * Call: POST /api/admin/migrate-currency
 * (requires an active admin session — checked via cookie)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Gate behind Super Admin only
    withPermission(getSessionFromRequest(req), 'settings:write');

    // ADD COLUMN IF NOT EXISTS is safe — no-op if column already present
    await (db as any).$executeRawUnsafe(
      `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'NLE'`
    );

    return NextResponse.json({
      success: true,
      message: 'currency column added (or already existed). You can now delete app/api/admin/migrate-currency/route.ts',
    });
  } catch (err) {
    console.error('[migrate-currency]', err);
    return handleAuthError(err);
  }
}
