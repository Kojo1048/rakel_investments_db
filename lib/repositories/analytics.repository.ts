import { db } from '../db';
import type { Prisma } from '@prisma/client';

export interface AnalyticsFilters {
  companyId?: string;
  serviceId?: string;
  from?: Date;
  to?: Date;
}

export async function findAnalytics(filters: AnalyticsFilters) {
  const { companyId, serviceId, from, to } = filters;

  const where: Prisma.AnalyticsRecordWhereInput = {
    ...(companyId && { companyId }),
    ...(serviceId && { serviceId }),
    ...((from || to) && {
      date: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  };

  return db.analyticsRecord.findMany({
    where,
    orderBy: { date: 'asc' },
    select: {
      id: true,
      companyId: true,
      serviceId: true,
      date: true,
      revenue: true,
      orders: true,
      deliveries: true,
      performance: true,
    },
  });
}

// Aggregated totals for KPI cards
export async function getAnalyticsSummary(filters: AnalyticsFilters) {
  const { companyId, serviceId, from, to } = filters;

  const where: Prisma.AnalyticsRecordWhereInput = {
    ...(companyId && { companyId }),
    ...(serviceId && { serviceId }),
    ...((from || to) && {
      date: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  };

  const agg = await db.analyticsRecord.aggregate({
    where,
    _sum: { revenue: true, orders: true, deliveries: true },
    _avg: { performance: true },
    _count: true,
  });

  return {
    totalRevenue: agg._sum.revenue ?? 0,
    totalOrders: agg._sum.orders ?? 0,
    totalDeliveries: agg._sum.deliveries ?? 0,
    avgPerformance: agg._avg.performance ?? 0,
    recordCount: agg._count,
  };
}

// Revenue aggregated per company — used in CEO / Admin dashboards
export async function getRevenueByCompany(from: Date, to: Date) {
  return db.analyticsRecord.groupBy({
    by: ['companyId'],
    where: { date: { gte: from, lte: to } },
    _sum: { revenue: true, orders: true },
    orderBy: { _sum: { revenue: 'desc' } },
  });
}

export async function upsertAnalyticsRecord(data: {
  companyId: string;
  serviceId: string;
  date: Date;
  revenue: number;
  orders: number;
  deliveries: number;
  performance: number;
}) {
  return db.analyticsRecord.upsert({
    where: {
      companyId_serviceId_date: {
        companyId: data.companyId,
        serviceId: data.serviceId,
        date: data.date,
      },
    },
    create: data,
    update: {
      revenue: data.revenue,
      orders: data.orders,
      deliveries: data.deliveries,
      performance: data.performance,
    },
  });
}
