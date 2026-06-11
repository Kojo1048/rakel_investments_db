// lib/repositories/analytics.repository.ts
import { db } from '../db';
import type { AnalyticsRecord } from '../types';

export interface AnalyticsFilters {
  companyId?: string;
  serviceId?: string;
  from?:      Date;
  to?:        Date;
}

const ANALYTICS_COLS = 'id, companyId, serviceId, date, revenue, orders, deliveries, performance';

// Supabase returns numeric(14,2) as string — normalise all numeric fields to number
function normalise(r: any): AnalyticsRecord {
  return {
    id:          r.id,
    companyId:   r.companyId,
    serviceId:   r.serviceId,
    date:        r.date,
    revenue:     Number(r.revenue     ?? 0),
    orders:      Number(r.orders      ?? 0),
    deliveries:  Number(r.deliveries  ?? 0),
    performance: Number(r.performance ?? 0),
  };
}

// ── findAnalytics ─────────────────────────────────────────────────────────────
export async function findAnalytics(filters: AnalyticsFilters): Promise<AnalyticsRecord[]> {
  let query = db.from('AnalyticsRecord').select(ANALYTICS_COLS);

  if (filters.companyId) query = query.eq('companyId', filters.companyId);
  if (filters.serviceId) query = query.eq('serviceId', filters.serviceId);
  if (filters.from)      query = query.gte('date', filters.from.toISOString().split('T')[0]);
  if (filters.to)        query = query.lte('date', filters.to.toISOString().split('T')[0]);

  const { data, error } = await query.order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalise);
}

// ── getAnalyticsSummary ───────────────────────────────────────────────────────
export async function getAnalyticsSummary(filters: AnalyticsFilters) {
  const rows = await findAnalytics(filters);
  return {
    totalRevenue:    rows.reduce((s, r) => s + r.revenue,    0),
    totalOrders:     rows.reduce((s, r) => s + r.orders,     0),
    totalDeliveries: rows.reduce((s, r) => s + r.deliveries, 0),
    avgPerformance:  rows.length
      ? rows.reduce((s, r) => s + r.performance, 0) / rows.length
      : 0,
    recordCount: rows.length,
  };
}

// ── getRevenueByCompany ───────────────────────────────────────────────────────
export async function getRevenueByCompany(from: Date, to: Date) {
  const { data, error } = await db
    .from('AnalyticsRecord')
    .select('companyId, revenue, orders')
    .gte('date', from.toISOString().split('T')[0])
    .lte('date', to.toISOString().split('T')[0]);
  if (error) throw error;

  const groups: Record<string, { revenue: number; orders: number }> = {};
  for (const row of data ?? []) {
    if (!groups[row.companyId]) groups[row.companyId] = { revenue: 0, orders: 0 };
    groups[row.companyId].revenue += Number(row.revenue ?? 0);
    groups[row.companyId].orders  += Number(row.orders  ?? 0);
  }
  return Object.entries(groups)
    .map(([companyId, { revenue, orders }]) => ({ companyId, _sum: { revenue, orders } }))
    .sort((a, b) => b._sum.revenue - a._sum.revenue);
}

// ── upsertAnalyticsRecord ─────────────────────────────────────────────────────
export async function upsertAnalyticsRecord(data: {
  companyId:   string;
  serviceId:   string;
  date:        Date;
  revenue:     number;
  orders:      number;
  deliveries:  number;
  performance: number;
}): Promise<AnalyticsRecord> {
  const payload = { ...data, date: data.date.toISOString().split('T')[0] };
  const { data: record, error } = await db
    .from('AnalyticsRecord')
    .upsert(payload, { onConflict: 'companyId,serviceId,date' })
    .select(ANALYTICS_COLS)
    .single();
  if (error) throw error;
  return normalise(record);
}
