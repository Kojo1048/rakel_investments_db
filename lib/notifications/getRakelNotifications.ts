import { db } from '../db';

export interface RakelNotification {
  id:          string;
  action:      string;       // matches ACTION_CONFIG keys in the bell
  username:    string;       // actor (for bell display)
  details:     string;       // rich human-readable message
  targetEntity: string | null;
  companyId:   string | null;
  createdAt:   string;       // ISO string
  company:     { name: string } | null;
  link:        string;       // route to navigate to on click
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/**
 * Aggregates real activity across Contracts, Invoices, OperationsRecords, and
 * AuditLog into a single sorted list.  No new tables are created or modified.
 */
export async function getRakelNotifications(limit = 20): Promise<RakelNotification[]> {
  const since = new Date(Date.now() - THIRTY_DAYS);

  // ── Parallel fetch from all source tables ─────────────────────────────────
  const [contracts, invoices, operations, auditLogs] = await Promise.all([

    // ── Contracts ────────────────────────────────────────────────────────────
    (db as any).contract.findMany({
      where:   { createdAt: { gte: since } },
      select:  {
        id: true, title: true, contractNumber: true, status: true,
        companyId: true, createdAt: true,
        company: { select: { name: true } },
        creator: { select: { username: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take:    15,
    }) as Promise<any[]>,

    // ── Invoices ─────────────────────────────────────────────────────────────
    (db as any).invoice.findMany({
      where:   { createdAt: { gte: since } },
      select:  {
        id: true, invoiceNumber: true, client: true, amount: true,
        status: true, companyId: true, createdAt: true,
        company: { select: { name: true } },
        creator: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take:    15,
    }) as Promise<any[]>,

    // ── Operations records ────────────────────────────────────────────────────
    (db as any).operationsRecord.findMany({
      where:   { createdAt: { gte: since } },
      select:  {
        id: true, activityType: true, department: true,
        companyId: true, createdAt: true,
        company:  { select: { name: true } },
        recorder: { select: { username: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take:    15,
    }) as Promise<any[]>,

    // ── AuditLog — supplementary events (document uploads, user actions, etc.) ─
    (db as any).auditLog.findMany({
      where: {
        createdAt: { gte: since },
        action:    {
          in: [
            'DOCUMENT_UPLOAD', 'DOCUMENT_DELETE',
            'USER_CREATE', 'USER_APPROVE', 'USER_DECLINE',
            'COMPANY_CREATE', 'COMPANY_UPDATE',
            'REGISTRATION_SUBMIT', 'DATA_IMPORT',
          ],
        },
      },
      select: {
        id: true, action: true, username: true,
        details: true, targetEntity: true,
        companyId: true, createdAt: true,
        company: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take:    10,
    }) as Promise<any[]>,
  ]);

  const notifications: RakelNotification[] = [];

  // ── Map contracts ─────────────────────────────────────────────────────────
  for (const c of contracts) {
    const actor = c.creator?.fullName ?? c.creator?.username ?? 'Unknown';
    const ref   = c.contractNumber ? ` (${c.contractNumber})` : '';
    const status = c.status.charAt(0) + c.status.slice(1).toLowerCase();
    notifications.push({
      id:           `contract-${c.id}`,
      action:       'CONTRACT_CREATE',
      username:     c.creator?.username ?? 'system',
      details:      `${actor} created contract "${c.title}"${ref} — Status: ${status}`,
      targetEntity: c.title,
      companyId:    c.companyId ?? null,
      createdAt:    new Date(c.createdAt).toISOString(),
      company:      c.company ?? null,
      link:         '/company/contracts',
    });
  }

  // ── Map invoices ─────────────────────────────────────────────────────────
  for (const inv of invoices) {
    const actor  = inv.creator?.username ?? 'Unknown';
    const amount = `$${Number(inv.amount).toLocaleString()}`;
    const status = inv.status.charAt(0) + inv.status.slice(1).toLowerCase();
    notifications.push({
      id:           `invoice-${inv.id}`,
      action:       'INVOICE_CREATE',
      username:     actor,
      details:      `${actor} created invoice ${inv.invoiceNumber} — ${inv.client} · ${amount} · ${status}`,
      targetEntity: inv.invoiceNumber,
      companyId:    inv.companyId ?? null,
      createdAt:    new Date(inv.createdAt).toISOString(),
      company:      inv.company ?? null,
      link:         '/company/invoices',
    });
  }

  // ── Map operations records ────────────────────────────────────────────────
  for (const op of operations) {
    const actor = op.recorder?.fullName ?? op.recorder?.username ?? 'Unknown';
    notifications.push({
      id:           `operations-${op.id}`,
      action:       'OPERATIONS_ENTRY',
      username:     op.recorder?.username ?? 'system',
      details:      `${actor} logged ${op.activityType} — ${op.department}`,
      targetEntity: op.activityType,
      companyId:    op.companyId ?? null,
      createdAt:    new Date(op.createdAt).toISOString(),
      company:      op.company ?? null,
      link:         '/company/operations',
    });
  }

  // ── Map audit log entries ─────────────────────────────────────────────────
  for (const log of auditLogs) {
    const link =
      log.action === 'DOCUMENT_UPLOAD' || log.action === 'DOCUMENT_DELETE'
        ? '/admin/company-documents'
        : log.action === 'USER_CREATE'  || log.action === 'USER_APPROVE' || log.action === 'USER_DECLINE'
        ? '/admin/users'
        : log.action === 'COMPANY_CREATE' || log.action === 'COMPANY_UPDATE'
        ? '/admin/companies'
        : log.action === 'REGISTRATION_SUBMIT'
        ? '/admin/registrations'
        : '/admin';

    notifications.push({
      id:           `audit-${log.id}`,
      action:       log.action,
      username:     log.username,
      details:      log.details ?? log.targetEntity ?? log.action.replace(/_/g, ' ').toLowerCase(),
      targetEntity: log.targetEntity ?? null,
      companyId:    log.companyId ?? null,
      createdAt:    new Date(log.createdAt).toISOString(),
      company:      log.company ?? null,
      link,
    });
  }

  // ── Sort newest → oldest, deduplicate by id, limit ────────────────────────
  const seen = new Set<string>();
  return notifications
    .filter(n => { const dup = seen.has(n.id); seen.add(n.id); return !dup; })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
