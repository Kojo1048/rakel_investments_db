import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  PDF:  'application/pdf',
  DOC:  'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  CSV:  'text/csv; charset=utf-8',
  PNG:  'image/png',
  JPG:  'image/jpeg',
  JPEG: 'image/jpeg',
  GIF:  'image/gif',
  WEBP: 'image/webp',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    withAuth(getSessionFromRequest(req));

    const { id } = await params;
    console.log('[download] request for document id:', id);

    // ── 1. Fetch record from DB ───────────────────────────────────────────────
    const doc = await (db as any).document.findUnique({
      where:  { id },
      select: { id: true, filename: true, storageKey: true, fileType: true },
    });

    if (!doc) {
      console.warn('[download] document not found in DB:', id);
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    console.log('[download] storageKey from DB:', doc.storageKey ?? 'NULL');

    if (!doc.storageKey) {
      return NextResponse.json(
        { error: 'This document has no file attached. It was uploaded without a file or before file storage was enabled.' },
        { status: 404 }
      );
    }

    // ── 2. Resolve file path ─────────────────────────────────────────────────
    // storageKey is "/uploads/filename.ext" — resolve to public/ directory
    const relPath = doc.storageKey.replace(/^\/+/, '');          // strip leading /
    const absPath = join(process.cwd(), 'public', relPath);

    console.log('[download] resolving to absolute path:', absPath);

    // ── 3. Verify file exists ────────────────────────────────────────────────
    try {
      await access(absPath, constants.R_OK);
      console.log('[download] file exists ✓');
    } catch {
      console.error('[download] file NOT found on disk at:', absPath);
      return NextResponse.json(
        { error: 'File not found on server. It may have been deleted or moved.' },
        { status: 404 }
      );
    }

    // ── 4. Read and stream ───────────────────────────────────────────────────
    const buffer = await readFile(absPath);

    const ext  = (doc.storageKey.split('.').pop() ?? '').toUpperCase();
    const mime = MIME[ext] ?? 'application/octet-stream';

    // Sanitise filename for Content-Disposition
    const safeFilename = doc.filename.replace(/[^\w.\-() ]/g, '_');

    console.log('[download] streaming', buffer.length, 'bytes as', mime);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        mime,
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Content-Length':      String(buffer.length),
        'Cache-Control':       'no-store',
      },
    });
  } catch (err) {
    console.error('[download] unexpected error:', err);
    return NextResponse.json({ error: 'Download failed. Please try again.' }, { status: 500 });
  }
}
