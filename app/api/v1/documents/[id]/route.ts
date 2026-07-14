import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { requireCompanyAccess } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { unlink } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// ── GET /api/v1/documents/:id ────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'documents:read');
    const { id } = await params;
    const { data: doc } = await db
      .from('Document')
      .select('id, title, filename, fileType, fileSize, storageKey, category, description, companyId, uploadedAt, isArchived, company:Company!Document_companyId_fkey(name), uploader:User!Document_uploadedBy_fkey(username, fullName)')
      .eq('id', id)
      .maybeSingle();
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (doc.companyId) requireCompanyAccess(session, doc.companyId as string);
    return NextResponse.json({ document: doc });
  } catch (err) {
    return handleAuthError(err);
  }
}

// ── DELETE /api/v1/documents/:id ─────────────────────────────────────────────
// Only SUPER_ADMIN and RAKEL_ADMIN may delete documents.

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'documents:delete');
    const { id } = await params;

    const { data: doc } = await db
      .from('Document')
      .select('id, filename, storageKey, title, companyId')
      .eq('id', id)
      .maybeSingle();
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (doc.companyId) requireCompanyAccess(session, doc.companyId as string);

    // 1. Remove the physical file (best-effort — don't fail if already missing)
    if (doc.storageKey) {
      try {
        const relPath = (doc.storageKey as string).replace(/^\/+/, '');
        const absPath = join(process.cwd(), 'public', relPath);
        await unlink(absPath);
        console.log(`[documents] DELETE file removed: ${absPath}`);
      } catch {
        console.warn(`[documents] DELETE could not remove file for doc ${id} — may already be gone`);
      }
    }

    // 2. Remove the database record
    const { error: deleteError } = await db.from('Document').delete().eq('id', id);
    if (deleteError) throw deleteError;

    console.log(`[documents] DELETE ${id} ("${doc.title}") by ${session.username}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[documents] DELETE error:', err);
    return handleAuthError(err);
  }
}
