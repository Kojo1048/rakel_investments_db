// lib/repositories/audit.repository.ts
// Confirmed against actual Supabase schema:
//   table → "AuditLog"
//   quoted columns: "userId","targetEntity","ipAddress","userAgent","companyId","createdAt"
//   FK: AuditLog_userId_fkey    → "User"(id)
//   FK: AuditLog_companyId_fkey → "Company"(id)
import { randomUUID } from 'crypto';
import { db } from '../db';
import type { AuditAction } from '../types';

export type { AuditAction };

export interface AuditFilters {
  userId?:    string;
  companyId?: string;
  action?:    AuditAction;
  search?:    string;
  from?:      Date;
  to?:        Date;
  page?:      number;
  limit?:     number;
}

const AUDIT_COLS = `
  id, userId, username, action, details,
  targetEntity, ipAddress, companyId, createdAt,
  company:Company!AuditLog_companyId_fkey(name)
`.trim();

// ── findAuditLogs ─────────────────────────────────────────────────────────────
export async function findAuditLogs(filters: AuditFilters = {}) {
  const { userId, companyId, action, search, from, to, page = 1, limit = 50 } = filters;

  let query = db.from('AuditLog').select(AUDIT_COLS, { count: 'exact' });

  if (userId)    query = query.eq('userId', userId);
  if (companyId) query = query.eq('companyId', companyId);
  if (action)    query = query.eq('action', action);
  if (from)      query = query.gte('createdAt', from.toISOString());
  if (to)        query = query.lte('createdAt', to.toISOString());
  if (search) {
    query = query.or(
      `username.ilike.%${search}%,details.ilike.%${search}%,targetEntity.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query
    .order('createdAt', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) throw error;
  const total = count ?? 0;
  return { logs: data ?? [], total, page, limit, pages: Math.ceil(total / limit) };
}

// ── createAuditLog — append-only, never update/delete ────────────────────────
export async function createAuditLog(data: {
  userId:        string;
  username:      string;
  action:        AuditAction;
  details?:      string;
  targetEntity?: string;
  ipAddress?:    string;
  userAgent?:    string;
  companyId?:    string;
  metadata?:     Record<string, unknown>;
}) {
  const { error } = await db.from('AuditLog').insert({
    id:           randomUUID(),
    userId:       data.userId,
    username:     data.username,
    action:       data.action,
    details:      data.details,
    targetEntity: data.targetEntity,
    ipAddress:    data.ipAddress,
    userAgent:    data.userAgent,
    companyId:    data.companyId,
    metadata:     data.metadata,
  });
  if (error) throw error;
}
