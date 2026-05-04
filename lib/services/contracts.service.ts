import * as ContractsRepo from '../repositories/contracts.repository';
import { createAuditLog } from '../repositories/audit.repository';
import type { ContractCreateInput, ContractQueryInput, ContractUpdateInput } from '../validations/contracts.schema';
import type { SessionPayload } from '../auth/session';
import { requireCompanyAccess } from '../auth/permissions';

export async function getContracts(query: ContractQueryInput, session: SessionPayload) {
  if (query.companyId) {
    requireCompanyAccess(session, query.companyId);
  } else if (session.role !== 'SUPER_ADMIN' && session.role !== 'RAKEL_ADMIN' && session.role !== 'CEO') {
    query.companyId = session.companyId ?? undefined;
  }
  return ContractsRepo.findContracts({
    companyId:      query.companyId,
    status:         query.status,
    includeArchived: query.includeArchived,
  });
}

export async function createContract(input: ContractCreateInput, session: SessionPayload) {
  const companyId = input.companyId ?? session.companyId ?? null;

  if (!companyId) {
    throw new Error(
      'No company specified. SUPER_ADMIN and RAKEL_ADMIN must include companyId in the request body.'
    );
  }

  const data = {
    companyId,
    title:          input.title,
    contractNumber: input.contractNumber,
    client:         input.client,
    status:         input.status,
    startDate:      input.startDate,
    expiryDate:     input.expiryDate,
    description:    input.description,
    createdBy:      session.userId,
  };

  console.log('[contracts] createContract payload:', data);
  const contract = await ContractsRepo.createContract(data);

  // Write audit log — drives the notification bell.
  // Fire-and-forget so a log failure never rolls back the contract.
  createAuditLog({
    userId:      session.userId,
    username:    session.username,
    action:      'CONTRACT_CREATE',
    details:     `Created contract: ${input.title}`,
    targetEntity: contract.id,
    companyId,
  }).catch(err => console.error('[contracts] audit log error:', err));

  return contract;
}

export async function updateContract(id: string, input: ContractUpdateInput, session: SessionPayload) {
  const contract = await ContractsRepo.findContractById(id);
  if (!contract) throw new Error('Not found');
  requireCompanyAccess(session, contract.companyId);

  const updated = await ContractsRepo.updateContract(id, input as any);

  createAuditLog({
    userId:      session.userId,
    username:    session.username,
    action:      'CONTRACT_UPDATE',
    details:     `Updated contract: ${contract.title}`,
    targetEntity: id,
    companyId:   contract.companyId,
  }).catch(err => console.error('[contracts] audit log error:', err));

  return updated;
}
