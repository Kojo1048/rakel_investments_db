/**
 * Checks whether the currency column exists on Invoice.
 * The original one-time Prisma migration has been replaced with a Supabase check.
 * If the column is missing, add it manually in the Supabase Dashboard SQL Editor:
 *   ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'NLE';
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    withPermission(getSessionFromRequest(req), 'settings:write');

    const { data, error } = await db
      .from('Invoice')
      .select('currency')
      .limit(1);

    if (error) {
      return NextResponse.json({
        success: false,
        message: 'currency column may be missing. Add it in the Supabase SQL Editor: ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT \'NLE\';',
        error: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'currency column exists on Invoice table.',
    });
  } catch (err) {
    console.error('[migrate-currency]', err);
    return handleAuthError(err);
  }
}
