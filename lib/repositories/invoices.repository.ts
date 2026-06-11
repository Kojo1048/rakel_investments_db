// lib/repositories/invoices.repository.ts
// Confirmed against actual Supabase schema:
//   table → "Invoice"
//   quoted columns: "companyId","contractId","invoiceNumber","issueDate","dueDate","paidDate",
//                   "isArchived","createdBy","createdAt","updatedAt"
//   FK: Invoice_createdBy_fkey → "User"(id)
//   FK: Invoice_companyId_fkey → "Company"(id)
//   FK: Invoice_contractId_fkey → "Contract"(id)
import { randomUUID } from 'crypto';
import { db } from '../db';
import type { InvoiceStatus } from '../types';

export type { InvoiceStatus };

export interface InvoiceFilters {
  companyId?:       string;
  contractId?:      string;
  status?:          InvoiceStatus;
  includeArchived?: boolean;
}

const INVOICE_COLS = `
  id, companyId, contractId, invoiceNumber, client,
  amount, currency, status, issueDate, dueDate, paidDate,
  notes, isArchived, createdBy, createdAt, updatedAt,
  company:Company!Invoice_companyId_fkey(name),
  contract:Contract!Invoice_contractId_fkey(title, contractNumber),
  creator:User!Invoice_createdBy_fkey(username)
`.trim();

// ── findInvoices ──────────────────────────────────────────────────────────────
export async function findInvoices(filters: InvoiceFilters) {
  let query = db.from('Invoice').select(INVOICE_COLS);

  if (filters.companyId)        query = query.eq('companyId', filters.companyId);
  if (filters.contractId)       query = query.eq('contractId', filters.contractId);
  if (filters.status)           query = query.eq('status', filters.status);
  if (!filters.includeArchived) query = query.eq('isArchived', false);

  const { data, error } = await query.order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── findInvoiceById ───────────────────────────────────────────────────────────
export async function findInvoiceById(id: string) {
  const { data, error } = await db
    .from('Invoice')
    .select(INVOICE_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── createInvoice ─────────────────────────────────────────────────────────────
export async function createInvoice(data: {
  companyId:     string;
  contractId?:   string;
  invoiceNumber: string;
  client:        string;
  amount:        number;
  currency?:     string;
  status?:       InvoiceStatus;
  issueDate:     Date;
  dueDate?:      Date;
  notes?:        string;
  createdBy:     string;
}) {
  const { data: invoice, error } = await db
    .from('Invoice')
    .insert({ id: randomUUID(), ...data, updatedAt: new Date().toISOString() })
    .select(INVOICE_COLS)
    .single();
  if (error) throw error;
  return invoice;
}

// ── updateInvoice ─────────────────────────────────────────────────────────────
export async function updateInvoice(
  id: string,
  data: Partial<{
    client:     string;
    amount:     number;
    status:     InvoiceStatus;
    dueDate:    Date;
    paidDate:   Date;
    notes:      string;
    isArchived: boolean;
  }>
) {
  const { data: invoice, error } = await db
    .from('Invoice')
    .update({ ...data, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select(INVOICE_COLS)
    .single();
  if (error) throw error;
  return invoice;
}

// ── generateInvoiceNumber ─────────────────────────────────────────────────────
export async function generateInvoiceNumber(_companyId?: string): Promise<string> {
  const year   = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const { count, error } = await db
    .from('Invoice')
    .select('*', { count: 'exact', head: true })
    .like('invoiceNumber', `${prefix}%`);
  if (error) throw error;
  return `${prefix}${String((count ?? 0) + 1).padStart(4, '0')}`;
}

// ── getInvoiceStatusSummary ───────────────────────────────────────────────────
export async function getInvoiceStatusSummary(companyId?: string) {
  let query = db
    .from('Invoice')
    .select('status, amount')
    .eq('isArchived', false);
  if (companyId) query = query.eq('companyId', companyId);

  const { data, error } = await query;
  if (error) throw error;

  const groups: Record<string, { count: number; sum: number }> = {};
  for (const row of data ?? []) {
    if (!groups[row.status]) groups[row.status] = { count: 0, sum: 0 };
    groups[row.status].count += 1;
    groups[row.status].sum   += Number(row.amount ?? 0);
  }
  return Object.entries(groups).map(([status, { count, sum }]) => ({
    status,
    _count: count,
    _sum:   { amount: sum },
  }));
}
