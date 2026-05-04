import { db } from '../db';
import type { Prisma } from '@prisma/client';

export interface OperationsFilters {
  companyId?: string;
  department?: string;
  activityType?: string;
  from?: Date;
  to?: Date;
}

export async function findOperations(filters: OperationsFilters) {
  const { companyId, department, activityType, from, to } = filters;

  const where: Prisma.OperationsRecordWhereInput = {
    ...(companyId && { companyId }),
    ...(department && { department }),
    ...(activityType && { activityType }),
    ...((from || to) && {
      date: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  };

  return db.operationsRecord.findMany({
    where,
    orderBy: { date: 'desc' },
    select: {
      id: true,
      companyId: true,
      date: true,
      department: true,
      manpowerCount: true,
      equipmentTotal: true,
      equipmentOperational: true,
      activityType: true,
      activityDescription: true,
      performanceScore: true,
      notes: true,
      recordedBy: true,
      createdAt: true,
      recorder: { select: { username: true, fullName: true } },
    },
  });
}

export async function createOperationsRecord(data: {
  companyId: string;
  date: Date;
  department: string;
  manpowerCount: number;
  equipmentTotal: number;
  equipmentOperational: number;
  activityType: string;
  activityDescription?: string;
  performanceScore: number;
  notes?: string;
  recordedBy: string;
}) {
  return db.operationsRecord.create({ data });
}

export async function getOperationsSummary(filters: OperationsFilters) {
  const { companyId, from, to } = filters;
  const where: Prisma.OperationsRecordWhereInput = {
    ...(companyId && { companyId }),
    ...((from || to) && { date: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
  };

  const agg = await db.operationsRecord.aggregate({
    where,
    _avg: { manpowerCount: true, performanceScore: true, equipmentOperational: true, equipmentTotal: true },
    _sum: { manpowerCount: true },
    _count: true,
  });

  return {
    avgManpower: Math.round(agg._avg.manpowerCount ?? 0),
    avgPerformance: Math.round(agg._avg.performanceScore ?? 0),
    totalEntries: agg._count,
    avgEquipmentUtilization:
      (agg._avg.equipmentTotal ?? 0) > 0
        ? Math.round(((agg._avg.equipmentOperational ?? 0) / (agg._avg.equipmentTotal ?? 1)) * 100)
        : 0,
  };
}
