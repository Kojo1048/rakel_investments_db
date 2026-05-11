import { z } from 'zod';

const optionalId = z.string().min(1).optional();

export const OperationsCreateSchema = z.object({
  // Admin roles pass companyId explicitly; company-scoped roles leave it
  // undefined — the service fills it from the session.
  companyId:            optionalId,
  contractId:           optionalId,
  date:                 z.coerce.date(),
  department:           z.string().min(1).max(100),
  manpowerCount:        z.coerce.number().int().min(1, 'Manpower count is required'),
  equipmentTotal:       z.coerce.number().int().min(0),
  equipmentOperational: z.coerce.number().int().min(0),
  activityType:         z.string().min(1).max(100),
  activityDescription:  z.string().max(500).optional(),
  performanceScore:     z.coerce.number().min(0).max(100),
  notes:                z.string().min(1, 'Notes are required').max(500),
});

export const OperationsQuerySchema = z.object({
  companyId:    optionalId,
  department:   z.string().optional(),
  activityType: z.string().optional(),
  days:         z.coerce.number().int().min(1).max(3650).default(30),
  from:         z.coerce.date().optional(),
  to:           z.coerce.date().optional(),
});

export type OperationsCreateInput = z.infer<typeof OperationsCreateSchema>;
export type OperationsQueryInput  = z.infer<typeof OperationsQuerySchema>;
