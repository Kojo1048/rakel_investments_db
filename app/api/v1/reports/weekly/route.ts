import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { db } from '@/lib/db/index';
import { randomUUID } from 'crypto';
// ─── Week helpers ────────────────────────────────────────────────────────────

function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekBounds(anchor: Date = new Date()): { start: Date; end: Date; year: number; week: number } {
  const d = new Date(anchor);
  d.setHours(12, 0, 0, 0);
  const dow = d.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday, year: monday.getFullYear(), week: getISOWeekNumber(monday) };
}

function reportKey(year: number, week: number) {
  return `weekly_report_${year}_W${String(week).padStart(2, '0')}`;
}

// ─── Report data computation ─────────────────────────────────────────────────

export interface WeeklyReportData {
  weekLabel: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  generatedBy: string;
  newUsers: number;
  contractsCreated: number;
  invoicesGenerated: number;
  operationsLogged: number;
  invoiceTotalAmount: number;
  usersByCompany: { companyName: string; count: number }[];
  contractsByStatus: { status: string; count: number }[];
  invoicesByStatus: { status: string; count: number; total: number }[];
  topDepartments: { department: string; entries: number }[];
}

async function computeReport(
  start: Date,
  end: Date,
  year: number,
  week: number,
  actor: string
): Promise<WeeklyReportData> {
  const startStr = start.toISOString();
  const endStr   = end.toISOString();

  const [
    userCountRes,
    contractCountRes,
    invoiceCountRes,
    opsCountRes,
    userRowsRes,
    contractRowsRes,
    invoiceRowsRes,
    deptRowsRes,
  ] = await Promise.all([
    db.from('User').select('*', { count: 'exact', head: true })
      .gte('createdAt', startStr).lte('createdAt', endStr),
    db.from('Contract').select('*', { count: 'exact', head: true })
      .gte('createdAt', startStr).lte('createdAt', endStr),
    db.from('Invoice').select('*', { count: 'exact', head: true })
      .gte('createdAt', startStr).lte('createdAt', endStr),
    db.from('OperationsRecord').select('*', { count: 'exact', head: true })
      .gte('createdAt', startStr).lte('createdAt', endStr),
    db.from('User').select('companyId')
      .gte('createdAt', startStr).lte('createdAt', endStr),
    db.from('Contract').select('status')
      .gte('createdAt', startStr).lte('createdAt', endStr),
    db.from('Invoice').select('status, amount')
      .gte('createdAt', startStr).lte('createdAt', endStr),
    db.from('OperationsRecord').select('department')
      .gte('createdAt', startStr).lte('createdAt', endStr),
  ]);

  // Resolve company names for the user breakdown
  const companyIds = [...new Set(
    (userRowsRes.data ?? []).map((r: any) => r.companyId).filter(Boolean) as string[]
  )];
  let companyNames: Record<string, string> = {};
  if (companyIds.length > 0) {
    const { data: companies } = await db
      .from('Company')
      .select('id, name')
      .in('id', companyIds);
    (companies ?? []).forEach((c: any) => { companyNames[c.id] = c.name; });
  }

  // Group: users by company
  const userCompanyGroups: Record<string, number> = {};
  for (const r of userRowsRes.data ?? []) {
    const key = (r as any).companyId ?? '__none__';
    userCompanyGroups[key] = (userCompanyGroups[key] ?? 0) + 1;
  }
  const usersByCompany = Object.entries(userCompanyGroups)
    .map(([companyId, count]) => ({
      companyName: companyId === '__none__' ? 'No Company' : (companyNames[companyId] ?? 'Unknown'),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Group: contracts by status
  const contractStatusGroups: Record<string, number> = {};
  for (const r of contractRowsRes.data ?? []) {
    const s = (r as any).status as string;
    contractStatusGroups[s] = (contractStatusGroups[s] ?? 0) + 1;
  }
  const contractsByStatus = Object.entries(contractStatusGroups)
    .map(([status, count]) => ({ status, count }));

  // Group: invoices by status with amount sum
  const invoiceStatusGroups: Record<string, { count: number; total: number }> = {};
  for (const r of invoiceRowsRes.data ?? []) {
    const s = (r as any).status as string;
    if (!invoiceStatusGroups[s]) invoiceStatusGroups[s] = { count: 0, total: 0 };
    invoiceStatusGroups[s].count += 1;
    invoiceStatusGroups[s].total += Number((r as any).amount ?? 0);
  }
  const invoicesByStatus = Object.entries(invoiceStatusGroups)
    .map(([status, { count, total }]) => ({ status, count, total }));
  const invoiceTotalAmount = invoicesByStatus.reduce((s, r) => s + r.total, 0);

  // Group: top 5 departments
  const deptGroups: Record<string, number> = {};
  for (const r of deptRowsRes.data ?? []) {
    const dept = (r as any).department as string;
    deptGroups[dept] = (deptGroups[dept] ?? 0) + 1;
  }
  const topDepartments = Object.entries(deptGroups)
    .map(([department, entries]) => ({ department, entries }))
    .sort((a, b) => b.entries - a.entries)
    .slice(0, 5);

  return {
    weekLabel:         `Week ${week}, ${year}`,
    periodStart:       start.toISOString(),
    periodEnd:         end.toISOString(),
    generatedAt:       new Date().toISOString(),
    generatedBy:       actor,
    newUsers:          userCountRes.count          ?? 0,
    contractsCreated:  contractCountRes.count      ?? 0,
    invoicesGenerated: invoiceCountRes.count       ?? 0,
    operationsLogged:  opsCountRes.count           ?? 0,
    invoiceTotalAmount,
    usersByCompany,
    contractsByStatus,
    invoicesByStatus,
    topDepartments,
  };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

// GET  /api/v1/reports/weekly
export async function GET(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'analytics:read');
    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const preview = req.nextUrl.searchParams.get('preview') === '1';

    if (preview) {
      const { start, end, year, week } = getWeekBounds();
      const data = await computeReport(start, end, year, week, session.username);
      return NextResponse.json({ report: data, saved: false });
    }

    // Return all saved reports, newest first
    const { data: rows, error } = await db
      .from('SystemSetting')
      .select('key, updatedAt, value')
      .like('key', 'weekly_report_%')
      .is('companyId', null)
      .order('updatedAt', { ascending: false });

    if (error) throw error;

    const reports = (rows ?? []).map(row => ({
      key:       row.key,
      updatedAt: row.updatedAt,
      data:      JSON.parse(row.value) as WeeklyReportData,
    }));

    return NextResponse.json({ reports });
  } catch (err) {
    return handleAuthError(err);
  }
}

// POST /api/v1/reports/weekly
export async function POST(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'analytics:read');
    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let anchor: Date | undefined;
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.weekStart) anchor = new Date(body.weekStart);
    } catch {}

    const { start, end, year, week } = getWeekBounds(anchor);
    const key        = reportKey(year, week);
    const data       = await computeReport(start, end, year, week, session.username);
    const serialized = JSON.stringify(data);

    // Upsert into SystemSetting (NULL companyId)
    const { data: existing } = await db
      .from('SystemSetting')
      .select('id')
      .eq('key', key)
      .is('companyId', null)
      .maybeSingle();

    if (existing) {
      const { error } = await db
        .from('SystemSetting')
        .update({ value: serialized, updatedBy: session.userId })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await db
        .from('SystemSetting')
        .insert({
          id: randomUUID(),
          key,
          value: serialized,
          updatedBy: session.userId
         });
      if (error) throw error;
    }

    return NextResponse.json({ report: data, saved: true, key }, { status: 201 });
  } catch (err) {
    return handleAuthError(err);
  }
}
