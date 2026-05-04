import { z } from 'zod';

export const CreateCompanySchema = z.object({
  name: z.string().min(2).max(100).trim(),
  slug: z.string().min(2).max(60).trim().regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  description: z.string().max(500).optional(),
  colorPrimary: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#3b82f6'),
  colorSecondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#60a5fa'),
  serviceIds: z.array(z.string().min(1)).min(1, 'At least one service required'),
});

export const UpdateCompanySchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  colorPrimary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  colorSecondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isActive: z.boolean().optional(),
  serviceIds: z.array(z.string().min(1)).optional(),
});

export const CompanyQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;
export type CompanyQueryInput = z.infer<typeof CompanyQuerySchema>;
