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

/** Generate a unique CNT-YYYY-NNNNNN number, retrying up to 5 times on collision. */
async function generateContractNumber(): Promise<string> {
  const year = new Date().getFullYear();
  for (let i = 0; i < 5; i++) {
    const rand = Math.floor(Math.random() * 900_000 + 100_000); // always 6 digits
    const num  = `CNT-${year}-${rand}`;
    const exists = await ContractsRepo.findContractByNumber(num);
    if (!exists) return num;
  }
  // Extremely unlikely — fall back to timestamp-based suffix
  return `CNT-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
}

export async function createContract(input: ContractCreateInput, session: SessionPayload) {
  const companyId = input.companyId ?? session.companyId ?? null;

  if (!companyId) {
    throw new Error(
      'No company specified. SUPER_ADMIN and RAKEL_ADMIN must include companyId in the request body.'
    );
  }

  // ── Resolve contract number ─────────────────────────────────────────────
  const rawNumber = input.contractNumber?.trim() || null;
  let contractNumber: string | null;

  if (rawNumber) {
    // Pre-check uniqueness before hitting the DB constraint
    const existing = await ContractsRepo.findContractByNumber(rawNumber);
    if (existing) {
      throw new Error(
        'Contract number already exists. Please use a different contract number, or leave it blank to auto-generate one.'
      );
    }
    contractNumber = rawNumber;
  } else {
    // Auto-generate when the user leaves the field empty
    contractNumber = await generateContractNumber();
  }

  const data = {
    companyId,
    title:          input.title,
    contractNumber,
    client:         input.client      ?? null,
    status:         input.status      ?? 'PENDING',
    startDate:      input.startDate   ?? null,
    expiryDate:     input.expiryDate  ?? null,
    description:    input.description ?? null,
    createdBy:      session.userId,
  };

  console.log('[contracts] createContract payload:', { ...data, companyId });

  let contract;
  try {
    contract = await ContractsRepo.createContract(data);
  } catch (err: any) {
    // P2002 = unique constraint violation — should be caught by the pre-check above,
    // but handle it defensively in case of a race condition.
    if (err?.code === 'P2002') {
      throw new Error(
        'Contract number already exists. Please use a different contract number, or leave it blank to auto-generate one.'
      );
    }
    throw err;
  }

  // Fire-and-forget audit log — never blocks the response
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
