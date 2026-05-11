import * as InvoicesRepo from '../repositories/invoices.repository';
import { createAuditLog } from '../repositories/audit.repository';
import type { InvoiceCreateInput, InvoiceQueryInput, InvoiceUpdateInput } from '../validations/invoices.schema';
import type { SessionPayload } from '../auth/session';
import { requireCompanyAccess } from '../auth/permissions';

export async function getInvoices(query: InvoiceQueryInput, session: SessionPayload) {
  if (query.companyId) {
    requireCompanyAccess(session, query.companyId);
  } else if (session.role !== 'SUPER_ADMIN' && session.role !== 'RAKEL_ADMIN' && session.role !== 'CEO') {
    query.companyId = session.companyId ?? undefined;
  }
  return InvoicesRepo.findInvoices({
    companyId:      query.companyId,
    contractId:     query.contractId,
    status:         query.status,
    includeArchived: query.includeArchived,
  });
}

export async function createInvoice(input: InvoiceCreateInput, session: SessionPayload) {
  const companyId = input.companyId ?? session.companyId ?? null;

  if (!companyId) {
    throw new Error(
      'No company specified. SUPER_ADMIN and RAKEL_ADMIN must include companyId in the request body.'
    );
  }

  const invoiceNumber = await InvoicesRepo.generateInvoiceNumber();

  const data = {
    companyId,
    contractId:    input.contractId,
    invoiceNumber,
    client:        input.client,
    amount:        input.amount,
    currency:      input.currency ?? 'NLE',
    status:        input.status,
    issueDate:     input.issueDate,
    dueDate:       input.dueDate,
    notes:         input.notes,
    createdBy:     session.userId,
  };

  console.log('[invoices] createInvoice payload:', { ...data, amount: data.amount });
  const invoice = await InvoicesRepo.createInvoice(data);

  // Write audit log — drives the notification bell.
  createAuditLog({
    userId:      session.userId,
    username:    session.username,
    action:      'INVOICE_CREATE',
    details:     `Created invoice ${invoiceNumber} for ${input.client}`,
    targetEntity: invoiceNumber,
    companyId,
  }).catch(err => console.error('[invoices] audit log error:', err));

  return invoice;
}

export async function updateInvoice(id: string, input: InvoiceUpdateInput, session: SessionPayload) {
  const invoice = await InvoicesRepo.findInvoiceById(id);
  if (!invoice) throw new Error('Not found');
  requireCompanyAccess(session, invoice.companyId);

  const updated = await InvoicesRepo.updateInvoice(id, input as any);

  createAuditLog({
    userId:      session.userId,
    username:    session.username,
    action:      'INVOICE_UPDATE',
    details:     `Updated invoice ${invoice.invoiceNumber}`,
    targetEntity: invoice.invoiceNumber,
    companyId:   invoice.companyId,
  }).catch(err => console.error('[invoices] audit log error:', err));

  return updated;
}
