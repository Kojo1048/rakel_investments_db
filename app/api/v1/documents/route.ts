import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { DocumentQuerySchema, CreateDocumentSchema } from '@/lib/validations/document.schema';
import { findDocuments, createDocument } from '@/lib/repositories/document.repository';
import { createAuditLog } from '@/lib/repositories/audit.repository';
import { requireCompanyAccess } from '@/lib/auth/permissions';
import { db} from '@/lib/db';
import { randomUUID } from 'crypto';

// Must run in Node.js runtime — uses fs and crypto
export const runtime = 'nodejs';

// ── GET /api/v1/documents ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'documents:read');

    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = DocumentQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const filters = { ...parsed.data };

    const canQueryAllCompanies =
      session.role === 'SUPER_ADMIN' ||
      session.role === 'RAKEL_ADMIN'  ||
      session.role === 'CEO';

    if (!canQueryAllCompanies) {
      filters.companyId = session.companyId ?? undefined;
    }

    console.log('[documents] GET filters:', {
      role:      session.role,
      companyId: filters.companyId ?? '(all)',
    });

    const result = await findDocuments(filters);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[documents] GET error:', err);
    return handleAuthError(err);
  }
}

// ── POST /api/v1/documents ────────────────────────────────────────────────────

const ALLOWED_EXT = ['PDF', 'DOC', 'DOCX', 'XLSX', 'CSV'] as const;
const MAX_BYTES   = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  

  try {
    const session = withPermission(getSessionFromRequest(req), 'documents:upload');

    console.log('[documents] POST received from user:', session.username, 'role:', session.role);

    // ── 1. Parse multipart FormData ──────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (parseErr) {
      console.error('[documents] POST formData parse error:', parseErr);
      return NextResponse.json(
        { error: 'Upload must be sent as multipart/form-data — do not set Content-Type manually.' },
        { status: 400 }
      );
    }

    // ── 2. Validate file ─────────────────────────────────────────────────────
    const file = formData.get('file') as File | null;
    console.log('[documents] POST file received?', !!file, 'size:', file?.size ?? 0, 'name:', file?.name ?? '—');

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided. The "file" field must contain a real file.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds the 50 MB limit.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toUpperCase() ?? '';
    if (!(ALLOWED_EXT as readonly string[]).includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type "${ext}". Allowed: ${ALLOWED_EXT.join(', ')}.` },
        { status: 400 }
      );
    }

    // ── 3. Save file to /public/uploads/ ─────────────────────────────────────
    const safeOriginal = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${randomUUID()}-${safeOriginal}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const storageKey = `documents/${uniqueName}`;

    const { error: uploadError} = await db.storage
    .from('uploads')
    .upload(storageKey, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      console.error('[documents] Supabase upload failed', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file to storage'},
        { status: 500}
      );
    }

    console.log('[documents] Uploaded to supabase Storage:', storageKey);





    // ── 4. Validate metadata ─────────────────────────────────────────────────
    const toStr = (key: string): string | undefined => {
      const v = (formData.get(key) as string | null)?.trim();
      return v || undefined;
    };

    const reminders = (formData.getAll('reminderSettings') as string[]).filter(Boolean);

    const rawBody = {
      title:            toStr('title')    ?? '',
      filename:         file.name,
      fileType:         ext,
      fileSize:         file.size,          // number — from Web File API
      category:         toStr('category') ?? '',
      description:      toStr('description'),
      companyId:        toStr('companyId'),
      serviceId:        toStr('serviceId'),
      contractId:       toStr('contractId'),
      dateReceived:     toStr('dateReceived'),
      expiryDate:       toStr('expiryDate'),
      reminderSettings: reminders.length > 0 ? reminders : undefined,
    };

    console.log('[documents] POST rawBody (no file bytes):', {
      ...rawBody,
      fileSize: rawBody.fileSize,
    });

    const parsed = CreateDocumentSchema.safeParse(rawBody);
    if (!parsed.success) {
      console.warn('[documents] POST validation failed:', parsed.error.flatten());
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // ── 4b. File-name business rules ─────────────────────────────────────────
    {
      const cat      = rawBody.category.trim();
      const title    = rawBody.title.trim();
      const baseName = file.name.replace(/\.[^.]+$/, '').trim(); // strip extension
      const norm     = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

      if (cat === 'Invoices') {
        // Invoice files must contain the word "invoice" (case-insensitive)
        if (!file.name.toLowerCase().includes('invoice')) {
          
          return NextResponse.json(
            { error: 'Invoice file name must contain the word "invoice" (e.g. invoice_2026_001.pdf).' },
            { status: 400 }
          );
        }
      } else if (cat !== 'Operations' && title) {
        // Contracts and all Document categories: file name (without extension) must match the title
        if (norm(baseName) !== norm(title)) {
          

          const entityLabel = cat === 'Contracts' ? 'Contract Title' : 'Document Title';
          return NextResponse.json(
            { error: `File name must match the ${entityLabel}. Expected: "${title}"` },
            { status: 400 }
          );
        }
      }
    }

    // ── 5. Permission check ─────────────────────────────────────────────────
    if (parsed.data.companyId) {
      requireCompanyAccess(session, parsed.data.companyId);
    }

    const { companyId, serviceId, contractId, dateReceived, expiryDate, reminderSettings, ...rest } =
      parsed.data;

    // ── 6. Create document record ─────────────────────────────────────────────
    console.log('[documents] POST creating DB record — storageKey:', storageKey, 'companyId:', companyId ?? '(none)');

    const document = await createDocument({
      ...rest,
      storageKey,

      uploadedBy: session.userId,

      companyId,
      serviceId,
      contractId,

      dateReceived,
      expiryDate,
      reminderSettings,

    });

    const savedKey = (document as any).storageKey;
    console.log('[documents] POST DB record created — id:', document.id, 'storageKey in DB:', savedKey ?? 'NULL ← problem!');

    if (!savedKey) {
      console.error('[documents] POST WARNING: storageKey was NOT saved to DB. Check Prisma select includes storageKey.');
    }

    

    await createAuditLog({
      userId:       session.userId,
      username:     session.username,
      action:       'DOCUMENT_UPLOAD',
      details:      `Uploaded document: ${parsed.data.title}`,
      targetEntity: parsed.data.filename,
      companyId:    companyId ?? session.companyId ?? undefined,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {

    console.error('[documents] POST error:', err);
    return handleAuthError(err);
  }
}
