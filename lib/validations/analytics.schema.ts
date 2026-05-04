import { z } from 'zod';

export const AnalyticsQuerySchema = z.object({
  companyId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  days: z.coerce.number().int().min(1).max(3650).default(30),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

export type AnalyticsQueryInput = z.infer<typeof AnalyticsQuerySchema>;
