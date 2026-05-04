'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export type UploadState = { error: string | null };

const ALLOWED_TYPES = ['PDF', 'DOC', 'DOCX', 'XLSX', 'CSV'] as const;
type AllowedFileType = (typeof ALLOWED_TYPES)[number];

function toStr(v: FormDataEntryValue | null, sentinel?: string): string | null {
  const s = (v as string | null)?.trim() ?? '';
  if (!s || s === sentinel) return null;
  return s;
}

function toDate(v: FormDataEntryValue | null): Date | null {
  const s = toStr(v);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function uploadDocument(
  _prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get('rakel_session')?.value;
  if (!token) return { error: 'You are not logged in.' };
  const session = verifyToken(token);
  if (!session) return { error: 'Your session is invalid. Please log in again.' };

  // ── File ────────────────────────────────────────────────────────────────────
  const file = formData.get('file') as File | null;
  console.log('[uploadDocument] file received?', !!file, 'size:', file?.size ?? 0);

  if (!file || file.size === 0) return { error: 'Please select a file to upload.' };
  if (file.size > 50 * 1024 * 1024) return { error: 'File exceeds the 50 MB limit.' };

  const ext = file.name.split('.').pop()?.toUpperCase() ?? '';
  if (!(ALLOWED_TYPES as readonly string[]).includes(ext)) {
    return { error: `Unsupported file type "${ext}". Allowed: PDF, DOC, DOCX, XLSX, CSV.` };
  }

  // ── Save file to /public/uploads/ ────────────────────────────────────────────
  const uploadDir = join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const safeOriginal = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueName   = `${randomUUID()}-${safeOriginal}`;
  const filePath     = join(uploadDir, uniqueName);

  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));

  const storageKey = `/uploads/${uniqueName}`;
  console.log('[uploadDocument] file saved →', storageKey);

  // ── Required fields ──────────────────────────────────────────────────────────
  const title    = toStr(formData.get('title'));
  const category = toStr(formData.get('category'));
  if (!title)    return { error: 'Document title is required.' };
  if (!category) return { error: 'Category is required.' };

  const description    = toStr(formData.get('description'));
  const companyId      = toStr(formData.get('companyId'),  'all');
  const serviceId      = toStr(formData.get('serviceId'),  'all');
  const contractId     = toStr(formData.get('contractId'), 'all');
  const dateReceived   = toDate(formData.get('dateReceived'));
  const expiryDate     = toDate(formData.get('expiryDate'));
  const reminderSettings = (formData.getAll('reminderSettings') as string[]).filter(Boolean);

  // ── Prisma create ────────────────────────────────────────────────────────────
  const data: Record<string, unknown> = {
    title,
    filename:    file.name,
    fileType:    ext as AllowedFileType,
    fileSize:    file.size,
    storageKey,                                                // ← always set
    category,
    description,
    uploader: { connect: { id: session.userId } },
    ...(companyId      && { company:  { connect: { id: companyId  } } }),
    ...(serviceId      && { service:  { connect: { id: serviceId  } } }),
    ...(contractId     && { contract: { connect: { id: contractId } } }),
    ...(dateReceived   && { dateReceived }),
    ...(expiryDate     && { expiryDate }),
    ...(reminderSettings.length > 0 && { reminderSettings }),
  };

  console.log('[uploadDocument] creating record with storageKey:', storageKey);

  try {
    const doc = await (db as any).document.create({ data });
    console.log('[uploadDocument] success — id:', doc.id, 'storageKey:', doc.storageKey);
  } catch (err) {
    console.error('[uploadDocument] Prisma error:', err);
    return { error: 'Failed to save the document record. Please try again.' };
  }

  redirect('/dashboard/documents');
}
