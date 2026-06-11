/**
 * GET /api/admin/check-permissions
 * Diagnostic endpoint — Super Admin only.
 * Tests read access to every key table and reports which ones fail.
 *
 * If any table shows "permission denied", run scripts/fix-permissions.sql
 * in the Supabase Dashboard SQL Editor.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const TABLES = [
  'User', 'Company', 'Document', 'Contract', 'Invoice',
  'AuditLog', 'OperationsRecord', 'AnalyticsRecord',
  'PendingRegistration', 'Service', 'CompanyService',
  'UserSession', 'SystemSetting',
] as const;

export async function GET(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'settings:write');
    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const results: Record<string, { ok: boolean; error?: string }> = {};

    await Promise.all(
      TABLES.map(async (table) => {
        const { error } = await db.from(table).select('id').limit(1);
        results[table] = error
          ? { ok: false, error: error.message }
          : { ok: true };
      })
    );

    const failed = Object.entries(results).filter(([, v]) => !v.ok).map(([k]) => k);
    const allOk  = failed.length === 0;

    return NextResponse.json({
      ok: allOk,
      tables: results,
      failedTables: failed,
      message: allOk
        ? 'All tables accessible via service_role.'
        : `Permission denied on: ${failed.join(', ')}. Run scripts/fix-permissions.sql in the Supabase SQL Editor to grant access.`,
    });
  } catch (err) {
    console.error('[check-permissions]', err);
    return handleAuthError(err);
  }
}
