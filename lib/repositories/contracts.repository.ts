import { db } from '../db';
import type { Prisma } from '@prisma/client';

export interface ContractFilters {
  companyId?: string;
  status?: string;
  includeArchived?: boolean;
  from?: Date;
  to?: Date;
}

const contractSelect = {
  id: true,
  companyId: true,
  title: true,
  contractNumber: true,
  client: true,
  status: true,
  startDate: true,
  expiryDate: true,
  description: true,
  isArchived: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { name: true } },
  creator: { select: { username: true, fullName: true } },
} satisfies Prisma.ContractSelect;

export async function findContracts(filters: ContractFilters) {
  const where: Prisma.ContractWhereInput = {
    ...(filters.companyId && { companyId: filters.companyId }),
    ...(filters.status && { status: filters.status as any }),
    ...(!filters.includeArchived && { isArchived: false }),
  };

  return db.contract.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: contractSelect,
  });
}

export async function findContractById(id: string) {
  return db.contract.findUnique({
    where: { id },
    select: contractSelect,
  });
}

export async function createContract(data: {
  companyId: string;
  title: string;
  contractNumber?: string;
  client?: string;
  status?: string;
  startDate?: Date;
  expiryDate?: Date;
  description?: string;
  createdBy: string;
}) {
  return db.contract.create({ data: data as any });
}

export async function updateContract(id: string, data: Partial<{
  title: string;
  contractNumber: string;
  client: string;
  status: string;
  startDate: Date;
  expiryDate: Date;
  description: string;
  isArchived: boolean;
}>) {
  return db.contract.update({ where: { id }, data: data as any });
}

export async function getContractStatusCounts(companyId?: string) {
  return db.contract.groupBy({
    by: ['status'],
    where: { ...(companyId && { companyId }), isArchived: false },
    _count: true,
  });
}
