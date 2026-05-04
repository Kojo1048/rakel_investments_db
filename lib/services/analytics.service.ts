import * as AnalyticsRepo from '../repositories/analytics.repository';
import type { AnalyticsQueryInput } from '../validations/analytics.schema';
import type { SessionPayload } from '../auth/session';
import { requireCompanyAccess } from '../auth/permissions';

export async function getAnalytics(query: AnalyticsQueryInput, session: SessionPayload) {
  // Non-superadmin/CEO users can only access their own company
  if (query.companyId) {
    requireCompanyAccess(session, query.companyId);
  } else if (session.role !== 'SUPER_ADMIN' && session.role !== 'CEO') {
    // Scope automatically to their company
    query.companyId = session.companyId ?? undefined;
  }

  const to = query.to ?? new Date();
  const from = query.from ?? new Date(to.getTime() - query.days * 24 * 60 * 60 * 1000);

  const [records, summary] = await Promise.all([
    AnalyticsRepo.findAnalytics({ ...query, from, to }),
    AnalyticsRepo.getAnalyticsSummary({ ...query, from, to }),
  ]);

  return { records, summary, from, to };
}

export async function getRevenueByCompany(days: number, session: SessionPayload) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = await AnalyticsRepo.getRevenueByCompany(from, to);
  return { rows, from, to };
}
