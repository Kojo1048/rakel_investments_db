import { db } from '../db';
import type { AuditAction, Prisma } from '@prisma/client';

export interface AuditFilters {
  userId?: string;
  companyId?: string;
  action?: AuditAction;
  search?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export async function findAuditLogs(filters: AuditFilters = {}) {
  const { userId, companyId, action, search, from, to, page = 1, limit = 50 } = filters;

  const where: Prisma.AuditLogWhereInput = {
    ...(userId && { userId }),
    ...(companyId && { companyId }),
    ...(action && { action }),
    ...((from || to) && {
      createdAt: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
    ...(search && {
      OR: [
        { username: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
        { targetEntity: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        userId: true,
        username: true,
        action: true,
        details: true,
        targetEntity: true,
        ipAddress: true,
        companyId: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return { logs, total, page, limit, pages: Math.ceil(total / limit) };
}

// Append-only — no update/delete operations are ever exposed here
export async function createAuditLog(data: {
  userId: string;
  username: string;
  action: AuditAction;
  details?: string;
  targetEntity?: string;
  ipAddress?: string;
  userAgent?: string;
  companyId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { metadata, ...rest } = data;
  return db.auditLog.create({
    data: {
      ...rest,
      ...(metadata !== undefined ? { metadata: metadata as object } : {}),
    },
  });
}
