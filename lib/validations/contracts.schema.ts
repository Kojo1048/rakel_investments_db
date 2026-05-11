import { z } from 'zod';

// Non-CUID-strict ID validator — accepts any non-empty string.
// z.string().cuid() can reject valid Prisma IDs on some adapter versions.
const optionalId = z.string().min(1).optional();

export const ContractCreateSchema = z.object({
  // Admin roles (SUPER_ADMIN, RAKEL_ADMIN) pass companyId explicitly;
  // company-scoped roles (COMPANY_ADMIN, STAFF) leave it undefined — the
  // service fills it from the session.
  companyId:      optionalId,
  title:          z.string().min(1, 'Contract title is required').max(200),
  contractNumber: z.string().min(1, 'Contract number is required').max(100),
  client:         z.string().min(1, 'Client name is required').max(200),
  status:         z.enum(['ACTIVE', 'PENDING', 'EXPIRED', 'COMPLETED', 'CANCELLED']).default('PENDING'),
  startDate:      z.coerce.date({ required_error: 'Start date is required' }),
  expiryDate:     z.coerce.date({ required_error: 'Expiry date is required' }),
  description:    z.string().min(1, 'Description is required').max(1000),
});

export const ContractUpdateSchema = ContractCreateSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const ContractQuerySchema = z.object({
  companyId:      optionalId,
  status:         z.enum(['ACTIVE', 'PENDING', 'EXPIRED', 'COMPLETED', 'CANCELLED']).optional(),
  days:           z.coerce.number().int().min(1).max(3650).default(365),
  includeArchived: z.coerce.boolean().default(false),
});

export type ContractCreateInput = z.infer<typeof ContractCreateSchema>;
export type ContractUpdateInput = z.infer<typeof ContractUpdateSchema>;
export type ContractQueryInput  = z.infer<typeof ContractQuerySchema>;
