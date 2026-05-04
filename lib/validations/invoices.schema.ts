import { z } from 'zod';

const optionalId = z.string().min(1).optional();

export const InvoiceCreateSchema = z.object({
  // Admin roles pass companyId explicitly; company-scoped roles leave it
  // undefined — the service fills it from the session.
  companyId:  optionalId,
  contractId: optionalId,
  client:     z.string().min(1).max(200),
  amount:     z.coerce.number().min(0),
  status:     z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).default('DRAFT'),
  issueDate:  z.coerce.date(),
  dueDate:    z.coerce.date().optional(),
  notes:      z.string().max(500).optional(),
});

export const InvoiceUpdateSchema = InvoiceCreateSchema.partial().extend({
  isArchived: z.boolean().optional(),
  paidDate:   z.coerce.date().optional(),
});

export const InvoiceQuerySchema = z.object({
  companyId:      optionalId,
  contractId:     optionalId,
  status:         z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  days:           z.coerce.number().int().min(1).max(3650).default(365),
  includeArchived: z.coerce.boolean().default(false),
});

export type InvoiceCreateInput = z.infer<typeof InvoiceCreateSchema>;
export type InvoiceUpdateInput = z.infer<typeof InvoiceUpdateSchema>;
export type InvoiceQueryInput  = z.infer<typeof InvoiceQuerySchema>;
