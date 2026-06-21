// lib/repositories/document.repository.ts
// Confirmed against actual Supabase schema:
//   table → "Document"
//   quoted columns: "fileType","fileSize","storageKey","companyId","serviceId","contractId",
//                   "uploadedBy","isArchived","uploadedAt","dateReceived","expiryDate",
//                   "reminderSettings","reminderSent"
//   FK: Document_uploadedBy_fkey → "User"(id)
//   FK: Document_companyId_fkey  → "Company"(id)
//   FK: Document_serviceId_fkey  → "Service"(id)
//   FK: Document_contractId_fkey → "Contract"(id)
import { randomUUID } from 'crypto';
import { db } from '../db';
import type { FileType } from '../types';

export type { FileType };

export interface DocumentFilters {
  companyId?: string;
  serviceId?: string;
  category?:  string;
  fileType?:  FileType;
  search?:    string;
  from?:      Date;
  to?:        Date;
  page?:      number;
  limit?:     number;
}

const DOCUMENT_COLS = `
  id, title, filename, fileType, fileSize, storageKey,
  category, description, companyId, serviceId, contractId,
  uploadedBy, isArchived, uploadedAt,
  dateReceived, expiryDate, reminderSettings, reminderSent,
  company:Company!Document_companyId_fkey(id, name),
  service:Service!Document_serviceId_fkey(id, name, slug),
  uploader:User!Document_uploadedBy_fkey(id, username, fullName)
`.trim();

// ── findDocuments ─────────────────────────────────────────────────────────────
export async function findDocuments(filters: DocumentFilters = {}) {
  const {
    companyId, serviceId, category, fileType,
    search, from, to, page = 1, limit = 20,
  } = filters;

  let query = db
    .from('Document')
    .select(DOCUMENT_COLS, { count: 'exact' })
    .eq('isArchived', false);

  if (companyId) query = query.eq('companyId', companyId);
  if (serviceId) query = query.eq('serviceId', serviceId);
  if (category)  query = query.eq('category', category);
  if (fileType)  query = query.eq('fileType', fileType);
  if (from)      query = query.gte('uploadedAt', from.toISOString());
  if (to)        query = query.lte('uploadedAt', to.toISOString());
  if (search) {
    query = query.or(
      `title.ilike.%${search}%,filename.ilike.%${search}%,description.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query
    .order('uploadedAt', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) throw error;
  const total = count ?? 0;
  return { documents: data ?? [], total, page, limit, pages: Math.ceil(total / limit) };
}

// ── createDocument ────────────────────────────────────────────────────────────
export async function createDocument(data: {
  title:             string;
  filename:          string;
  fileType:          FileType;
  fileSize:          number;
  storageKey?:       string;
  category:          string;
  description?:      string;
  companyId?:        string;
  serviceId?:        string;
  contractId?:       string;
  uploadedBy:        string;
  dateReceived?:     Date | null;
  expiryDate?:       Date | null;
  reminderSettings?: string[] | null;
}) {
  const { data: doc, error } = await db
    .from('Document')
    .insert({ id: randomUUID(), ...data })
    .select('*')
    .single();
  if (error) throw error;
  return doc;
}

// ── deleteDocument ────────────────────────────────────────────────────────────
export async function deleteDocument(id: string) {
  const { error } = await db.from('Document').delete().eq('id', id);
  if (error) throw error;
}
