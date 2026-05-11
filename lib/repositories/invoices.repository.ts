import { db } from '../db';
import type { Prisma } from '@prisma/client';

export interface InvoiceFilters {
  companyId?: string;
  contractId?: string;
  status?: string;
  includeArchived?: boolean;
}

const invoiceSelect = {
  id: true,
  companyId: true,
  contractId: true,
  invoiceNumber: true,
  client: true,
  amount: true,
  currency: true,
  status: true,
  issueDate: true,
  dueDate: true,
  paidDate: true,
  notes: true,
  isArchived: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { name: true } },
  contract: { select: { title: true, contractNumber: true } },
  creator: { select: { username: true } },
} satisfies Prisma.InvoiceSelect;

export async function findInvoices(filters: InvoiceFilters) {
  const where: Prisma.InvoiceWhereInput = {
    ...(filters.companyId && { companyId: filters.companyId }),
    ...(filters.contractId && { contractId: filters.contractId }),
    ...(filters.status && { status: filters.status as any }),
    ...(!filters.includeArchived && { isArchived: false }),
  };

  return db.invoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: invoiceSelect,
  });
}

export async function findInvoiceById(id: string) {
  return db.invoice.findUnique({ where: { id }, select: invoiceSelect });
}

export async function createInvoice(data: {
  companyId: string;
  contractId?: string;
  invoiceNumber: string;
  client: string;
  amount: number;
  currency?: string;
  status?: string;
  issueDate: Date;
  dueDate?: Date;
  notes?: string;
  createdBy: string;
}) {
  return db.invoice.create({ data: data as any });
}

export async function updateInvoice(id: string, data: Partial<{
  client: string;
  amount: number;
  status: string;
  dueDate: Date;
  paidDate: Date;
  notes: string;
  isArchived: boolean;
}>) {
  return db.invoice.update({ where: { id }, data: data as any });
}

export async function generateInvoiceNumber(_companyId?: string): Promise<string> {
  // Count ALL invoices globally with the current-year prefix to prevent
  // collisions across companies (per-company count causes duplicates when
  // two companies each have N invoices → both get INV-YYYY-00N+1).
  const year   = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const count  = await db.invoice.count({
    where: { invoiceNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export async function getInvoiceStatusSummary(companyId?: string) {
  return db.invoice.groupBy({
    by: ['status'],
    where: { ...(companyId && { companyId }), isArchived: false },
    _count: true,
    _sum: { amount: true },
  });
}
