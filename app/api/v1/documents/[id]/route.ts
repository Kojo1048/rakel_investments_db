import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { unlink } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// ── GET /api/v1/documents/:id ────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  try {
    withPermission(getSessionFromRequest(req), 'documents:read');
    const { id } = await params;
    const doc = await (db as any).document.findUnique({
      where:  { id },
      select: {
        id: true, title: true, filename: true, fileType: true,
        fileSize: true, storageKey: true, category: true, description: true,
        companyId: true, uploadedAt: true, isArchived: true,
        company:  { select: { name: true } },
        uploader: { select: { username: true, fullName: true } },
      },
    });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
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

    const doc = await (db as any).document.findUnique({
      where:  { id },
      select: { id: true, filename: true, storageKey: true, title: true },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

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
    await (db as any).document.delete({ where: { id } });

    console.log(`[documents] DELETE ${id} ("${doc.title}") by ${session.username}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[documents] DELETE error:', err);
    return handleAuthError(err);
  }
}
