import { z } from 'zod';

export const CreateUserSchema = z.object({
  username: z.string().min(3).max(50).trim().regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().optional(),
  password: z.string().min(8).max(100),
  fullName: z.string().min(2).max(100).trim().optional(),
  role: z.enum(['SUPER_ADMIN', 'CEO', 'COMPANY_ADMIN', 'STAFF']),
  companyId: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'PENDING', 'DECLINED', 'INACTIVE']).default('ACTIVE'),
});

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).max(100).trim().optional(),
  role: z.enum(['SUPER_ADMIN', 'CEO', 'COMPANY_ADMIN', 'STAFF']).optional(),
  companyId: z.string().min(1).nullable().optional(),
  status: z.enum(['ACTIVE', 'PENDING', 'DECLINED', 'INACTIVE']).optional(),
  password: z.string().min(8).max(100).optional(),
});

export const UserQuerySchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'CEO', 'COMPANY_ADMIN', 'STAFF']).optional(),
  status: z.enum(['ACTIVE', 'PENDING', 'DECLINED', 'INACTIVE']).optional(),
  companyId: z.string().min(1).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UserQueryInput = z.infer<typeof UserQuerySchema>;
