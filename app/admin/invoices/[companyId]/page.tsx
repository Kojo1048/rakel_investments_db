'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Receipt, Search, Building2, Calendar, DollarSign, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import type { Invoice, Company, InvoiceStatus } from '@/lib/types';

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT:     'bg-muted text-muted-foreground',
  SENT:      'bg-chart-3/10 text-chart-3',
  PAID:      'bg-primary/10 text-primary',
  OVERDUE:   'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
};

const STATUS_ICONS: Record<InvoiceStatus, React.ReactNode> = {
  DRAFT:     <Clock className="h-3 w-3" />,
  SENT:      <Clock className="h-3 w-3" />,
  PAID:      <CheckCircle className="h-3 w-3" />,
  OVERDUE:   <AlertCircle className="h-3 w-3" />,
  CANCELLED: <AlertCircle className="h-3 w-3" />,
};

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);
}

function fmtDate(val: Date | string | null | undefined) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(val: Date | string) {
  const d = new Date(val);
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function CompanyInvoicesDetailPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();

  const [company, setCompany] = useState<Company | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch(`/api/v1/companies/${companyId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { company: null })
      .then(data => setCompany(data.company))
      .catch(() => {});
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/invoices?companyId=${companyId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { invoices: [] })
      .then(data => setInvoices(data.invoices ?? []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, [companyId]);

  const summary = useMemo(() => {
    const paid    = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.amount), 0);
    const pending = invoices.filter(i => i.status === 'SENT').reduce((s, i) => s + Number(i.amount), 0);
    const overdue = invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + Number(i.amount), 0);
    const draft   = invoices.filter(i => i.status === 'DRAFT').reduce((s, i) => s + Number(i.amount), 0);
    return { total: invoices.length, paid, pending, overdue, draft };
  }, [invoices]);

  const filtered = useMemo(() => invoices.filter(inv => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      inv.invoiceNumber.toLowerCase().includes(term) ||
      inv.client.toLowerCase().includes(term) ||
      (inv.contract?.title ?? '').toLowerCase().includes(term) ||
      (inv.notes ?? '').toLowerCase().includes(term) ||
      inv.id.toLowerCase().includes(term);
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  }), [invoices, searchTerm, statusFilter]);

  const clearFilters = () => { setSearchTerm(''); setStatusFilter('all'); };
  const hasFilters = searchTerm || statusFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="outline"
          size="sm"
          className="border-border text-foreground hover:bg-muted mt-1 flex-shrink-0"
          onClick={() => router.push('/admin/invoices')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          All Companies
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">
              {company ? company.name : <span className="text-muted-foreground">Loading…</span>}
            </h1>
          </div>
          <p className="text-muted-foreground mt-0.5">All invoices · {summary.total} records</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Total Invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-primary">{fmt(summary.paid)}</p>
                <p className="text-xs text-muted-foreground">Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-lg font-bold text-chart-3">{fmt(summary.pending)}</p>
                <p className="text-xs text-muted-foreground">Pending (Sent)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-lg font-bold text-destructive">{fmt(summary.overdue)}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by invoice #, client, contract…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 bg-input border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] bg-input border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Statuses</SelectItem>
                {(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'] as InvoiceStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {invoices.length === 0 ? 'No Invoices Found' : 'No Records Match Filters'}
            </h3>
            <p className="text-muted-foreground">
              {invoices.length === 0
                ? 'This company has no invoices yet.'
                : 'Try adjusting your search or status filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Invoices
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {filtered.length} of {invoices.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Invoice #</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Invoice ID</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Client</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Contract</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Amount</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Issue Date</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Due Date</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Paid Date</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Notes</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Created By</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Created At</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => {
                    const created = fmtDateTime(inv.createdAt);
                    return (
                      <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-sm text-foreground whitespace-nowrap font-medium">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {inv.id}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">{inv.client}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {inv.contract
                            ? <span>{inv.contract.title}{inv.contract.contractNumber ? <span className="text-xs ml-1">({inv.contract.contractNumber})</span> : null}</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                          {fmt(Number(inv.amount))}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                            {STATUS_ICONS[inv.status]}
                            {inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(inv.issueDate)}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(inv.dueDate)}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(inv.paidDate)}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[160px]">
                          <span className="line-clamp-2">{inv.notes ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {inv.creator?.username ?? inv.createdBy}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          <div className="text-xs">
                            <div>{created.date}</div>
                            <div>{created.time}</div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
