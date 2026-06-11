/**
 * GET /api/v1/my-submissions
 *
 * Returns all non-archived records created by the authenticated user across
 * all four data types (contracts, invoices, documents, operations).
 *
 * Security: userId is ALWAYS taken from the validated session — never from
 * the request body or query params.
 *
 * Admin shortcut: SUPER_ADMIN and RAKEL_ADMIN may pass ?all=1 to see every
 * record across the system (useful for audit/support purposes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withAuth, handleAuthError } from '@/lib/auth/middleware';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SubmissionItem {
  id:          string;
  type:        'contract' | 'invoice' | 'document' | 'operation';
  title:       string;
  status?:     string;
  companyName: string | null;
  createdAt:   string;
}

export async function GET(req: NextRequest) {
  try {
    const session = withAuth(getSessionFromRequest(req));
    const userId  = session.userId;

    const isAdmin = ['SUPER_ADMIN', 'RAKEL_ADMIN'].includes(session.role);
    const showAll = isAdmin && req.nextUrl.searchParams.get('all') === '1';

    // ── Parallel queries, each filtered to the session user unless showAll ──
    const [contractsRes, invoicesRes, documentsRes, operationsRes] = await Promise.all([
      (() => {
        let q = db.from('Contract')
          .select('id, title, status, createdAt, company:Company!Contract_companyId_fkey(name)')
          .eq('isArchived', false)
          .order('createdAt', { ascending: false })
          .limit(50);
        if (!showAll) q = q.eq('createdBy', userId);
        return q;
      })(),
      (() => {
        let q = db.from('Invoice')
          .select('id, invoiceNumber, client, status, createdAt, company:Company!Invoice_companyId_fkey(name)')
          .eq('isArchived', false)
          .order('createdAt', { ascending: false })
          .limit(50);
        if (!showAll) q = q.eq('createdBy', userId);
        return q;
      })(),
      (() => {
        let q = db.from('Document')
          .select('id, title, category, uploadedAt, company:Company!Document_companyId_fkey(name)')
          .eq('isArchived', false)
          .order('uploadedAt', { ascending: false })
          .limit(50);
        if (!showAll) q = q.eq('uploadedBy', userId);
        return q;
      })(),
      (() => {
        let q = db.from('OperationsRecord')
          .select('id, activityType, department, createdAt, company:Company!OperationsRecord_companyId_fkey(name)')
          .order('createdAt', { ascending: false })
          .limit(50);
        if (!showAll) q = q.eq('recordedBy', userId);
        return q;
      })(),
    ]);

    const contracts  = contractsRes.data  ?? [];
    const invoices   = invoicesRes.data   ?? [];
    const documents  = documentsRes.data  ?? [];
    const operations = operationsRes.data ?? [];

    // ── Normalise into a unified shape, then sort newest-first ────────────
    const items: SubmissionItem[] = [
      ...contracts.map((c: any) => ({
        id:          c.id,
        type:        'contract' as const,
        title:       c.title,
        status:      c.status,
        companyName: c.company?.name ?? null,
        createdAt:   new Date(c.createdAt).toISOString(),
      })),

      ...invoices.map((inv: any) => ({
        id:          inv.id,
        type:        'invoice' as const,
        title:       `${inv.invoiceNumber} — ${inv.client}`,
        status:      inv.status,
        companyName: inv.company?.name ?? null,
        createdAt:   new Date(inv.createdAt).toISOString(),
      })),

      ...documents.map((doc: any) => ({
        id:          doc.id,
        type:        'document' as const,
        title:       doc.title,
        status:      doc.category,
        companyName: doc.company?.name ?? null,
        createdAt:   new Date(doc.uploadedAt).toISOString(),
      })),

      ...operations.map((op: any) => ({
        id:          op.id,
        type:        'operation' as const,
        title:       `${op.activityType} — ${op.department}`,
        status:      undefined,
        companyName: op.company?.name ?? null,
        createdAt:   new Date(op.createdAt).toISOString(),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      items,
      total:  items.length,
      userId: showAll ? null : userId,
    });

  } catch (err) {
    console.error('[my-submissions] error:', err);
    return handleAuthError(err);
  }
}
