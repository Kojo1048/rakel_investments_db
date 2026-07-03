import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';


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
    const { data, error: dbError } = await db
      .from('Document')
      .select('id, filename, storageKey, fileType')
      .eq('id', id)
      .maybeSingle();

      if (dbError) throw dbError;

      const doc = data as {
        id: string;
        filename: string;
        storageKey: string | null;
        fileType: string;
      } | null;

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
    console.log('[download] downloading from supabase:', doc.storageKey);

    const {data: fileData, error: storageError} = await db.storage
    .from('uploads')
    .download(doc.storageKey);

    if (storageError || !fileData){
      console.error('[download] Supabase downlaod failed:', storageError);
      return NextResponse.json(
        {error: 'File not found in storage.'},
        {status: 404}
      );
    }

    const buffer =Buffer.from(await fileData.arrayBuffer())

    const ext  = (doc.storageKey.split('.').pop() ?? '').toUpperCase();
    const mime = MIME[ext] ?? 'application/octet-stream';

    // Sanitise filename for Content-Disposition
    const safeFilename = doc.filename.replace(/[^\w.\-() ]/g, '_');

    console.log('[download] streaming', buffer.length, 'bytes as', mime);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        mime,
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Content-Length':      String(buffer.length),
        'Cache-Control':       'no-store',
      },
    });
  } catch (err) {
    console.error('[download] unexpected error:', err);
    return NextResponse.json({ error: 'Download failed. Please try again.' }, { status: 500 });
  }
}
