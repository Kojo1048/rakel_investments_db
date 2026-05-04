import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { db } from '@/lib/db/index';

// ─── Week helpers ────────────────────────────────────────────────────────────

function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7; // Sunday = 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekBounds(anchor: Date = new Date()): { start: Date; end: Date; year: number; week: number } {
  const d = new Date(anchor);
  d.setHours(12, 0, 0, 0); // normalise to midday so DST doesn't shift the day
  const dow = d.getDay(); // 0 = Sun
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
  // Core metrics
  newUsers: number;
  contractsCreated: number;
  invoicesGenerated: number;
  operationsLogged: number;
  // Detail breakdowns
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
  const range = { gte: start, lte: end };

  const [
    newUsers,
    contractsCreated,
    invoicesGenerated,
    operationsLogged,
    userRows,
    contractStatusRows,
    invoiceStatusRows,
    deptRows,
  ] = await Promise.all([
    // Core counts
    db.user.count({ where: { createdAt: range } }),
    db.contract.count({ where: { createdAt: range } }),
    db.invoice.count({ where: { createdAt: range } }),
    db.operationsRecord.count({ where: { createdAt: range } }),

    // New users grouped by company
    db.user.groupBy({
      by: ['companyId'],
      where: { createdAt: range },
      _count: true,
    }),

    // Contracts by status
    db.contract.groupBy({
      by: ['status'],
      where: { createdAt: range },
      _count: true,
    }),

    // Invoices by status with amount sum
    db.invoice.groupBy({
      by: ['status'],
      where: { createdAt: range },
      _count: true,
      _sum: { amount: true },
    }),

    // Top 5 departments by operations entries
    db.operationsRecord.groupBy({
      by: ['department'],
      where: { createdAt: range },
      _count: true,
      orderBy: { _count: { department: 'desc' } },
      take: 5,
    }),
  ]);

  // Resolve companyIds → names for usersByCompany
  const companyIds = userRows.map(r => r.companyId).filter(Boolean) as string[];
  let companyNames: Record<string, string> = {};
  if (companyIds.length > 0) {
    const companies = await db.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true },
    });
    companies.forEach(c => { companyNames[c.id] = c.name; });
  }

  const usersByCompany = userRows.map(r => ({
    companyName: r.companyId ? (companyNames[r.companyId] ?? 'Unknown') : 'No Company',
    count: r._count,
  })).sort((a, b) => b.count - a.count);

  const contractsByStatus = contractStatusRows.map(r => ({
    status: r.status as string,
    count: r._count,
  }));

  const invoicesByStatus = invoiceStatusRows.map(r => ({
    status: r.status as string,
    count: r._count,
    total: Number(r._sum.amount ?? 0),
  }));

  const invoiceTotalAmount = invoicesByStatus.reduce((s, r) => s + r.total, 0);

  const topDepartments = deptRows.map(r => ({
    department: r.department,
    entries: r._count,
  }));

  return {
    weekLabel: `Week ${week}, ${year}`,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    generatedAt: new Date().toISOString(),
    generatedBy: actor,
    newUsers,
    contractsCreated,
    invoicesGenerated,
    operationsLogged,
    invoiceTotalAmount,
    usersByCompany,
    contractsByStatus,
    invoicesByStatus,
    topDepartments,
  };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

// GET  /api/v1/reports/weekly  — list all saved reports + current-week live preview
export async function GET(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'analytics:read');
    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const preview = req.nextUrl.searchParams.get('preview') === '1';

    if (preview) {
      // Return live current-week data without saving
      const { start, end, year, week } = getWeekBounds();
      const data = await computeReport(start, end, year, week, session.username);
      return NextResponse.json({ report: data, saved: false });
    }

    // Return all saved reports, newest first
    const rows = await db.systemSetting.findMany({
      where: { key: { startsWith: 'weekly_report_' }, companyId: null },
      orderBy: { updatedAt: 'desc' },
    });

    const reports = rows.map(row => ({
      key: row.key,
      updatedAt: row.updatedAt,
      data: JSON.parse(row.value) as WeeklyReportData,
    }));

    return NextResponse.json({ reports });
  } catch (err) {
    return handleAuthError(err);
  }
}

// POST /api/v1/reports/weekly  — generate & save report (current week or supplied date)
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
    const key = reportKey(year, week);

    const data = await computeReport(start, end, year, week, session.username);

    // Save into SystemSetting (upsert manually — NULL in compound unique is unreliable)
    const serialized = JSON.stringify(data);
    const existing = await db.systemSetting.findFirst({ where: { key, companyId: null } });
    if (existing) {
      await db.systemSetting.update({
        where: { id: existing.id },
        data: { value: serialized, updatedBy: session.userId },
      });
    } else {
      await db.systemSetting.create({
        data: { key, value: serialized, updatedBy: session.userId },
      });
    }

    return NextResponse.json({ report: data, saved: true, key }, { status: 201 });
  } catch (err) {
    return handleAuthError(err);
  }
}
