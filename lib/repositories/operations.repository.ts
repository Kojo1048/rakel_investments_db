import { randomUUID } from 'crypto';
import { db } from '../db';

export interface OperationsFilters {
  companyId?:    string;
  department?:   string;
  activityType?: string;
  from?:         Date;
  to?:           Date;
}

const OPS_COLS = `
  id, companyId, contractId, date, department,
  manpowerCount, equipmentTotal, equipmentOperational,
  activityType, activityDescription, performanceScore,
  notes, isArchived, recordedBy, createdAt, updatedAt,
  recorder:User!OperationsRecord_recordedBy_fkey(username, fullName)
`.trim();

export async function findOperations(filters: OperationsFilters) {
  const { companyId, department, activityType, from, to } = filters;

  let query = db.from('OperationsRecord').select(OPS_COLS);

  if (companyId)    query = query.eq('companyId', companyId);
  if (department)   query = query.eq('department', department);
  if (activityType) query = query.eq('activityType', activityType);
  if (from)         query = query.gte('date', from.toISOString().split('T')[0]);
  if (to)           query = query.lte('date', to.toISOString().split('T')[0]);

  const { data, error } = await query.order('date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createOperationsRecord(data: {
  companyId:            string;
  contractId?:          string;
  date:                 Date;
  department:           string;
  manpowerCount:        number;
  equipmentTotal:       number;
  equipmentOperational: number;
  activityType:         string;
  activityDescription?: string;
  performanceScore:     number;
  notes?:               string;
  recordedBy:           string;
}) {
  const payload = {
    id: randomUUID(),
    ...data,
    date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : data.date,
    updatedAt: new Date().toISOString(),
  };
  const { data: record, error } = await db
    .from('OperationsRecord')
    .insert(payload)
    .select(OPS_COLS)
    .single();
  if (error) throw error;
  return record;
}

export async function getOperationsSummary(filters: OperationsFilters) {
  const { companyId, from, to } = filters;

  let query = db
    .from('OperationsRecord')
    .select('manpowerCount, performanceScore, equipmentTotal, equipmentOperational');

  if (companyId) query = query.eq('companyId', companyId);
  if (from)      query = query.gte('date', from.toISOString().split('T')[0]);
  if (to)        query = query.lte('date', to.toISOString().split('T')[0]);

  const { data, error } = await query;
  if (error) throw error;

  const rows  = data ?? [];
  const count = rows.length;
  if (count === 0) {
    return { avgManpower: 0, avgPerformance: 0, totalEntries: 0, avgEquipmentUtilization: 0 };
  }

  const totals = rows.reduce(
    (acc, r) => ({
      manpower:    acc.manpower    + Number(r.manpowerCount          ?? 0),
      performance: acc.performance + Number(r.performanceScore       ?? 0),
      eqTotal:     acc.eqTotal     + Number(r.equipmentTotal         ?? 0),
      eqOp:        acc.eqOp        + Number(r.equipmentOperational   ?? 0),
    }),
    { manpower: 0, performance: 0, eqTotal: 0, eqOp: 0 }
  );

  return {
    avgManpower:             Math.round(totals.manpower    / count),
    avgPerformance:          Math.round(totals.performance / count),
    totalEntries:            count,
    avgEquipmentUtilization: totals.eqTotal > 0
      ? Math.round((totals.eqOp / totals.eqTotal) * 100)
      : 0,
  };
}
