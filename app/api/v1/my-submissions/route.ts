/**
 * GET /api/v1/my-submissions
 *
 * Returns all records created by the authenticated user across all data types
 * (contracts, invoices, documents, operations).  Used by the Unified Upload Hub
 * "My Submissions" section to implement row-level data visibility for staff.
 *
 * Admins receive a count per type (their own submissions only by default unless
 * they pass ?all=1, which shows everything).
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

    // Admins with ?all=1 bypass the user filter (see everything)
    const isAdmin  = ['SUPER_ADMIN', 'RAKEL_ADMIN'].includes(session.role);
    const showAll  = isAdmin && req.nextUrl.searchParams.get('all') === '1';

    const userFilter = showAll ? {} : { uploadedBy: userId };

    // ── Parallel query across all four data types ──────────────────────────
    const [contracts, invoices, documents, operations] = await Promise.all([

      (db as any).contract.findMany({
        where:   showAll ? {} : { createdBy: userId },
        select:  { id: true, title: true, status: true, createdAt: true, company: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take:    50,
      }),

      (db as any).invoice.findMany({
        where:   showAll ? {} : { createdBy: userId },
        select:  { id: true, invoiceNumber: true, client: true, status: true, createdAt: true, company: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take:    50,
      }),

      (db as any).document.findMany({
        where:   { ...userFilter, isArchived: false },
        select:  { id: true, title: true, category: true, createdAt: null, uploadedAt: true, company: { select: { name: true } } },
        orderBy: { uploadedAt: 'desc' },
        take:    50,
      }),

      (db as any).operationsRecord.findMany({
        where:   showAll ? {} : { recordedBy: userId },
        select:  { id: true, activityType: true, department: true, createdAt: true, company: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take:    50,
      }),
    ]);

    // ── Normalise into a unified shape ─────────────────────────────────────
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
      total: items.length,
      userId: showAll ? null : userId,
    });

  } catch (err) {
    console.error('[my-submissions] error:', err);
    return handleAuthError(err);
  }
}
