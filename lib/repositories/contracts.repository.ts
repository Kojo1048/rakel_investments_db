// lib/repositories/contracts.repository.ts
// Confirmed against actual Supabase schema:
//   table → "Contract"
//   quoted columns: "companyId","contractNumber","startDate","expiryDate","isArchived","createdBy","createdAt","updatedAt"
//   FK: Contract_createdBy_fkey → "User"(id)
//   FK: Contract_companyId_fkey → "Company"(id)
import { randomUUID } from 'crypto';
import { db } from '../db';
import type { ContractStatus } from '../types';

export type { ContractStatus };

export interface ContractFilters {
  companyId?:       string;
  status?:          ContractStatus;
  includeArchived?: boolean;
  from?:            Date;
  to?:              Date;
}

const CONTRACT_COLS = `
  id, companyId, title, contractNumber, client, status,
  startDate, expiryDate, description, isArchived,
  createdBy, createdAt, updatedAt,
  company:Company!Contract_companyId_fkey(name),
  creator:User!Contract_createdBy_fkey(username, fullName)
`.trim();

// ── findContracts ─────────────────────────────────────────────────────────────
export async function findContracts(filters: ContractFilters) {
  let query = db.from('Contract').select(CONTRACT_COLS);

  if (filters.companyId)        query = query.eq('companyId', filters.companyId);
  if (filters.status)           query = query.eq('status', filters.status);
  if (!filters.includeArchived) query = query.eq('isArchived', false);

  const { data, error } = await query.order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── findContractById ──────────────────────────────────────────────────────────
export async function findContractById(id: string) {
  const { data, error } = await db
    .from('Contract')
    .select(CONTRACT_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── findContractByNumber ──────────────────────────────────────────────────────
export async function findContractByNumber(contractNumber: string) {
  const { data, error } = await db
    .from('Contract')
    .select('id')
    .eq('contractNumber', contractNumber)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── createContract ────────────────────────────────────────────────────────────
export async function createContract(data: {
  companyId:        string;
  title:            string;
  contractNumber?:  string | null;
  client?:          string | null;
  status?:          ContractStatus | null;
  startDate?:       Date | null;
  expiryDate?:      Date | null;
  description?:     string | null;
  createdBy:        string;
}) {
  const { data: contract, error } = await db
    .from('Contract')
    .insert({ id: randomUUID(), ...data, updatedAt: new Date().toISOString() })
    .select(CONTRACT_COLS)
    .single();
  if (error) throw error;
  return contract;
}

// ── updateContract ────────────────────────────────────────────────────────────
export async function updateContract(
  id: string,
  data: Partial<{
    title:           string;
    contractNumber:  string;
    client:          string;
    status:          ContractStatus;
    startDate:       Date;
    expiryDate:      Date;
    description:     string;
    isArchived:      boolean;
  }>
) {
  const { data: contract, error } = await db
    .from('Contract')
    .update({ ...data, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select(CONTRACT_COLS)
    .single();
  if (error) throw error;
  return contract;
}

// ── getContractStatusCounts ───────────────────────────────────────────────────
export async function getContractStatusCounts(companyId?: string) {
  let query = db
    .from('Contract')
    .select('status')
    .eq('isArchived', false);
  if (companyId) query = query.eq('companyId', companyId);

  const { data, error } = await query;
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return Object.entries(counts).map(([status, count]) => ({ status, _count: count }));
}
