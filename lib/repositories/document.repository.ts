import { db } from '../db';
import type { FileType, Prisma } from '@prisma/client';

export interface DocumentFilters {
  companyId?: string;
  serviceId?: string;
  category?: string;
  fileType?: FileType;
  search?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

// Core fields — always safe to query (exist in the original schema)
const DOCUMENT_SELECT_BASE = {
  id: true,
  title: true,
  filename: true,
  fileType: true,
  fileSize: true,
  storageKey: true,
  category: true,
  description: true,
  companyId: true,
  serviceId: true,
  uploadedBy: true,
  uploadedAt: true,
  company:  { select: { id: true, name: true } },
  service:  { select: { id: true, name: true, slug: true } },
  uploader: { select: { id: true, username: true, fullName: true } },
} satisfies Prisma.DocumentSelect;

// Extended fields added in add_expiry_fields.sql migration.
// Uses `as any` because prisma generate may not have been re-run yet after
// the schema was updated — the Prisma client types lag behind the schema file.
// At runtime the DB either has these columns (query succeeds) or it doesn't
// (safeSelect catches the error and falls back to DOCUMENT_SELECT_BASE).
const DOCUMENT_SELECT = {
  ...DOCUMENT_SELECT_BASE,
  dateReceived:     true,
  expiryDate:       true,
  reminderSettings: true,
  reminderSent:     true,
} as unknown as Prisma.DocumentSelect;

// Try the full SELECT; if the migration has not been run yet, fall back to base.
// Catches P2022 (Prisma), 42703 (PostgreSQL undefined_column), and any
// error message mentioning a missing column — regardless of which DB adapter
// is in use (native engine vs pg WASM adapter).
function isMissingColumnError(err: any): boolean {
  if (!err) return false;
  const code = err?.code ?? err?.cause?.code ?? '';
  const msg  = (err?.message ?? err?.cause?.message ?? '').toLowerCase();
  return (
    code === 'P2022'       ||   // Prisma mapped code
    code === '42703'       ||   // PostgreSQL: undefined_column
    msg.includes('does not exist') ||
    msg.includes('column not found')
  );
}

async function safeSelect<T>(
  full: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> {
  try {
    return await full();
  } catch (err: any) {
    if (isMissingColumnError(err)) {
      console.warn(
        '[document.repository] Expiry columns not found — run the migration: ' +
        'psql -d <db> -f prisma/migrations/add_expiry_fields.sql  ' +
        '(or: npx prisma db push). Falling back to base document select.'
      );
      return fallback();
    }
    throw err;
  }
}

export async function findDocuments(filters: DocumentFilters = {}) {
  const {
    companyId, serviceId, category, fileType,
    search, from, to, page = 1, limit = 20,
  } = filters;

  const where: Prisma.DocumentWhereInput = {
    ...(companyId && { companyId }),
    ...(serviceId && { serviceId }),
    ...(category  && { category }),
    ...(fileType  && { fileType }),
    ...((from || to) && {
      uploadedAt: {
        ...(from && { gte: from }),
        ...(to   && { lte: to }),
      },
    }),
    ...(search && {
      OR: [
        { title:       { contains: search, mode: 'insensitive' } },
        { filename:    { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const queryFull = () => Promise.all([
    db.document.findMany({
      where,
      select:  DOCUMENT_SELECT,
      orderBy: { uploadedAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    db.document.count({ where }),
  ]);

  const queryBase = () => Promise.all([
    db.document.findMany({
      where,
      select:  DOCUMENT_SELECT_BASE,
      orderBy: { uploadedAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    db.document.count({ where }),
  ]);

  const [documents, total] = await safeSelect(queryFull, queryBase);
  return { documents, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function createDocument(data: Prisma.DocumentCreateInput) {
  return safeSelect(
    () => db.document.create({ data, select: DOCUMENT_SELECT }),
    () => {
      // Strip expiry fields if migration has not been run
      const { dateReceived, expiryDate, reminderSettings, reminderSent, ...baseData } =
        data as any;
      void dateReceived; void expiryDate; void reminderSettings; void reminderSent;
      return db.document.create({ data: baseData, select: DOCUMENT_SELECT_BASE });
    }
  );
}

export async function deleteDocument(id: string) {
  return db.document.delete({ where: { id } });
}
