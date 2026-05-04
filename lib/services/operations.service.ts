import * as OperationsRepo from '../repositories/operations.repository';
import { createAuditLog } from '../repositories/audit.repository';
import type { OperationsCreateInput, OperationsQueryInput } from '../validations/operations.schema';
import type { SessionPayload } from '../auth/session';
import { requireCompanyAccess } from '../auth/permissions';

export async function getOperations(query: OperationsQueryInput, session: SessionPayload) {
  if (query.companyId) {
    requireCompanyAccess(session, query.companyId);
  } else if (session.role !== 'SUPER_ADMIN' && session.role !== 'RAKEL_ADMIN' && session.role !== 'CEO') {
    query.companyId = session.companyId ?? undefined;
  }

  const to   = query.to   ?? new Date();
  const from = query.from ?? new Date(to.getTime() - query.days * 24 * 60 * 60 * 1000);

  const [records, summary] = await Promise.all([
    OperationsRepo.findOperations({ ...query, from, to }),
    OperationsRepo.getOperationsSummary({ companyId: query.companyId, from, to }),
  ]);

  return { records, summary, from, to };
}

export async function createOperationsEntry(
  input: OperationsCreateInput,
  session: SessionPayload
) {
  const companyId = input.companyId ?? session.companyId ?? null;

  if (!companyId) {
    throw new Error(
      'No company specified. SUPER_ADMIN and RAKEL_ADMIN must include companyId in the request body.'
    );
  }

  const data = {
    companyId,
    date:                 input.date,
    department:           input.department,
    manpowerCount:        input.manpowerCount,
    equipmentTotal:       input.equipmentTotal  ?? 0,
    equipmentOperational: input.equipmentOperational ?? 0,
    activityType:         input.activityType,
    activityDescription:  input.activityDescription,
    performanceScore:     input.performanceScore,
    notes:                input.notes,
    recordedBy:           session.userId,
    ...(input.contractId && { contractId: input.contractId }),
  };

  console.log('[operations] createOperationsEntry payload:', {
    companyId: data.companyId,
    department: data.department,
    activityType: data.activityType,
    date: data.date,
    manpowerCount: data.manpowerCount,
    performanceScore: data.performanceScore,
  });

  const record = await OperationsRepo.createOperationsRecord(data);

  // Write audit log — drives the notification bell.
  createAuditLog({
    userId:      session.userId,
    username:    session.username,
    action:      'OPERATIONS_ENTRY',
    details:     `${input.activityType} — ${input.department} (${input.manpowerCount} staff)`,
    targetEntity: input.department,
    companyId,
  }).catch(err => console.error('[operations] audit log error:', err));

  return record;
}
