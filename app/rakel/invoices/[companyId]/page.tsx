'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Building2, Receipt, TrendingUp, FolderOpen, Plus, Upload, Eye, Pencil, Trash2, Paperclip, Download, FileText } from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { Company, Invoice, InvoiceStatus } from '@/lib/types';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-config';
import { safeGet } from '@/lib/utils/safe-fetch';
import { CURRENCIES, CURRENCY_LABELS, fmtCurrency } from '@/lib/utils/currency';

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT:     'bg-muted text-muted-foreground',
  SENT:      'bg-chart-3/10 text-chart-3',
  PAID:      'bg-primary/10 text-primary',
  OVERDUE:   'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
};

const EMPTY_FORM = {
  client:    '',
  amount:    '',
  currency:  'NLE',
  status:    'DRAFT' as InvoiceStatus,
  issueDate: new Date().toISOString().split('T')[0],
  dueDate:   '',
  notes:     '',
};

export default function RakelInvoicesDetailPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();

  const [company,    setCompany]    = useState<Company | null>(null);
  const [invoices,   setInvoices]   = useState<Invoice[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [attachFile, setAttachFile] = useState<File | null>(null);

  // Currency filter
  const [viewCurrency, setViewCurrency] = useState<string>('NLE');

  // View / Edit / Delete state
  const [viewInvoice,      setViewInvoice]      = useState<Invoice | null>(null);
  const [invoiceDoc,       setInvoiceDoc]       = useState<any | null>(null);
  const [invoiceDocLoading,setInvoiceDocLoading]= useState(false);
  const [docDownloading,   setDocDownloading]   = useState(false);
  const [editInvoice,      setEditInvoice]      = useState<Invoice | null>(null);
  const [editStatus,       setEditStatus]       = useState<InvoiceStatus>('DRAFT');
  const [editSaving,       setEditSaving]       = useState(false);
  const [deletingId,       setDeletingId]       = useState<string | null>(null);

  // Fetch attached document when View Invoice modal opens
  useEffect(() => {
    if (!viewInvoice) { setInvoiceDoc(null); return; }
    setInvoiceDocLoading(true);
    const params = new URLSearchParams({ category: 'Invoices', limit: '20' });
    params.set('companyId', viewInvoice.companyId);
    fetch(`/api/v1/documents?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(d => {
        const docs: any[] = d.documents ?? [];
        const match = docs.find(doc =>
          doc.title?.includes(viewInvoice.client) ||
          doc.title?.includes(viewInvoice.invoiceNumber)
        ) ?? docs[0] ?? null;
        setInvoiceDoc(match);
      })
      .catch(() => setInvoiceDoc(null))
      .finally(() => setInvoiceDocLoading(false));
  }, [viewInvoice]);

  const handleViewDoc = (doc: any) => {
    if (doc.storageKey) window.open(doc.storageKey, '_blank');
  };

  const handleDownloadDoc = async (doc: any) => {
    setDocDownloading(true);
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}/download`, { credentials: 'include' });
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = window.document.createElement('a');
      a.href = url; a.download = doc.filename; a.click();
      URL.revokeObjectURL(url);
    } finally { setDocDownloading(false); }
  };

  const handleStatusSave = async () => {
    if (!editInvoice) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/v1/invoices/${editInvoice.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus }),
      });
      if (res.ok) { setEditInvoice(null); loadData(); }
    } catch { /* ignore */ }
    finally { setEditSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/v1/invoices/${id}`, { method: 'DELETE', credentials: 'include' });
      loadData();
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  const loadData = () => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      safeGet(`/api/v1/companies/${companyId}`,           { company:  null }),
      safeGet(`/api/v1/invoices?companyId=${companyId}`,  { invoices: [] }),
    ]).then(([cd, id]) => {
      setCompany((cd as any).company ?? null);
      setInvoices((id as any).invoices ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [companyId]);

  // ── Create invoice ────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const missing: string[] = [];
    if (!form.client.trim()) missing.push('Client');
    if (!form.amount)        missing.push('Amount');
    if (!form.dueDate)       missing.push('Due Date');
    if (!form.notes.trim())  missing.push('Notes');
    if (!attachFile)         missing.push('Invoice File');
    if (missing.length > 0) {
      setSubmitError(`Required fields missing: ${missing.join(', ')}.`);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      if (attachFile) {
        const fd = new FormData();
        fd.append('file', attachFile); fd.append('title', `Invoice — ${form.client}`);
        fd.append('category', 'Invoices'); fd.append('companyId', companyId);
        await fetch('/api/v1/documents', { method: 'POST', credentials: 'include', body: fd });
      }
      const res = await fetch('/api/v1/invoices', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          client:    form.client,
          amount:    parseFloat(form.amount.replace(/,/g, '')),
          currency:  (form as any).currency ?? 'NLE',
          status:    form.status,
          issueDate: form.issueDate,
          dueDate:   form.dueDate  || undefined,
          notes:     form.notes    || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); setSubmitError(d.error || 'Failed'); return; }
      setIsFormOpen(false);
      setForm(EMPTY_FORM);
      setAttachFile(null);
      loadData();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Network error');
    } finally { setSubmitting(false); }
  };

  // ── Analytics ─────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    // Counts are GLOBAL (all currencies — operational metrics)
    const paidAll    = invoices.filter(i => i.status === 'PAID');
    const pendingAll = invoices.filter(i => i.status === 'DRAFT' || i.status === 'SENT');
    const overdueAll = invoices.filter(i => i.status === 'OVERDUE');
    // Amounts filter by selected currency
    const currInv    = invoices.filter(i => i.currency === viewCurrency);
    const paidC      = currInv.filter(i => i.status === 'PAID');
    const pendingC   = currInv.filter(i => i.status === 'DRAFT' || i.status === 'SENT');
    const overdueC   = currInv.filter(i => i.status === 'OVERDUE');
    // NLE total is ALWAYS NLE regardless of the selected view currency
    const nleTotal   = invoices
      .filter(i => i.currency === 'NLE')
      .reduce((s, i) => s + Number(i.amount), 0);
    return {
      total:        invoices.length,
      paidCount:    paidAll.length,
      pendingCount: pendingAll.length,
      overdueCount: overdueAll.length,
      paidAmt:      paidC.reduce((s, i) => s + Number(i.amount), 0),
      pendingAmt:   pendingC.reduce((s, i) => s + Number(i.amount), 0),
      overdueAmt:   overdueC.reduce((s, i) => s + Number(i.amount), 0),
      nleTotal,
    };
  }, [invoices, viewCurrency]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach(i => { counts[i.status] = (counts[i.status] ?? 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status: status.charAt(0) + status.slice(1).toLowerCase(), count }));
  }, [invoices]);

  const revenueTrend = useMemo(() => {
    // Only include invoices matching the selected view currency
    const currInv = invoices.filter(i => i.currency === viewCurrency);
    const g: Record<string, { month: string; paid: number; pending: number }> = {};
    currInv.forEach(i => {
      const key = new Date(i.issueDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!g[key]) g[key] = { month: key, paid: 0, pending: 0 };
      if (i.status === 'PAID') g[key].paid += Number(i.amount);
      if (i.status === 'SENT' || i.status === 'DRAFT') g[key].pending += Number(i.amount);
    });
    return Object.values(g).slice(-12);
  }, [invoices, viewCurrency]);

  const fmt = (n: number) => fmtCurrency(n, viewCurrency);

  if (loading) {
    return <div className="min-h-[50vh] flex items-center justify-center"><Spinner className="h-8 w-8 text-primary" /></div>;
  }

  const f = (label: string, children: React.ReactNode, required = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '14px', fontWeight: 500 }}>{label}{required && <span style={{ color: 'red' }}> *</span>}</label>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/rakel/invoices')}>
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
          <div className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${company?.colorPrimary ?? '#3b82f6'}20` }}>
            <Building2 className="h-5 w-5" style={{ color: company?.colorPrimary ?? '#3b82f6' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{company?.name ?? 'Company'}</h1>
            <p className="text-muted-foreground text-sm">Invoice Analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={viewCurrency} onValueChange={setViewCurrency}>
            <SelectTrigger className="w-[160px] bg-input border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {CURRENCIES.map(c => (
                <SelectItem key={c} value={c}>{CURRENCY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            onClick={() => { setForm(EMPTY_FORM); setSubmitError(''); setIsFormOpen(true); }}>
            <Plus className="h-4 w-4" />New Invoice
          </Button>
        </div>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Invoices</p><p className="text-3xl font-bold text-foreground mt-1">{summary.total}</p><p className="text-xs text-muted-foreground mt-1">{fmtCurrency(summary.nleTotal, 'NLE')} Total Value (NLE)</p></CardContent></Card>
        {/* Paid — amount is primary, count secondary */}
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Paid ({viewCurrency})</p><p className="text-2xl font-bold text-primary mt-1">{fmtCurrency(summary.paidAmt, viewCurrency)}</p><p className="text-xs text-muted-foreground mt-1">{summary.paidCount} invoice{summary.paidCount !== 1 ? 's' : ''}</p></CardContent></Card>
        {/* Pending — amount is primary, count secondary */}
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending ({viewCurrency})</p><p className="text-2xl font-bold text-chart-3 mt-1">{fmtCurrency(summary.pendingAmt, viewCurrency)}</p><p className="text-xs text-muted-foreground mt-1">{summary.pendingCount} invoice{summary.pendingCount !== 1 ? 's' : ''}</p></CardContent></Card>
        {/* Overdue — amount is primary, count secondary */}
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Overdue ({viewCurrency})</p><p className="text-2xl font-bold text-destructive mt-1">{fmtCurrency(summary.overdueAmt, viewCurrency)}</p><p className="text-xs text-muted-foreground mt-1">{summary.overdueCount} invoice{summary.overdueCount !== 1 ? 's' : ''}</p></CardContent></Card>
      </div>

      {invoices.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <FolderOpen className="h-14 w-14 mx-auto text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-lg font-medium text-foreground">No Invoices Yet</h3>
            <p className="text-muted-foreground">Use "New Invoice" to create the first invoice for this company.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {statusData.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" />Status Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={statusData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="status" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Bar dataKey="count" name="Invoices" fill="hsl(160,60%,45%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            {revenueTrend.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Revenue Summary</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={revenueTrend}>
                      <defs>
                        <linearGradient id="rakelPaid" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(160,60%,45%)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(160,60%,45%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={fmt} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [fmt(v)]} />
                      <Area type="monotone" dataKey="paid" name="Paid" stroke="hsl(160,60%,45%)" fillOpacity={1} fill="url(#rakelPaid)" />
                      <Area type="monotone" dataKey="pending" name="Pending" stroke="hsl(45,70%,50%)" fill="none" strokeDasharray="4 2" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Invoice table */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" />Invoices</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      {['Invoice #', 'Client', 'Currency', 'Amount', 'Status', 'Issue Date', 'Due Date', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-sm text-foreground">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3 text-foreground">{inv.client}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-medium">{inv.currency ?? 'NLE'}</td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {fmtCurrency(Number(inv.amount), inv.currency ?? 'NLE')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                            {inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(inv.issueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="View"
                              onClick={() => setViewInvoice(inv)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="Edit status"
                              onClick={() => { setEditInvoice(inv); setEditStatus(inv.status); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" title="Delete"
                              disabled={deletingId === inv.id} onClick={() => handleDelete(inv.id)}>
                              {deletingId === inv.id ? <Spinner className="h-3 w-3" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── View Invoice dialog ──────────────────────────────────────────── */}
      <Dialog open={!!viewInvoice} onOpenChange={open => { if (!open) setViewInvoice(null); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">{viewInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription className="text-muted-foreground">{viewInvoice?.client}</DialogDescription>
          </DialogHeader>
          {viewInvoice && (
            <div className="mt-2 rounded-lg border border-border divide-y divide-border/50">
              {([
                ['Invoice #',  viewInvoice.invoiceNumber],
                ['Client',     viewInvoice.client],
                ['Currency',   viewInvoice.currency ?? 'NLE'],
                ['Amount',     fmtCurrency(Number(viewInvoice.amount), viewInvoice.currency ?? 'NLE')],
                ['Status',     viewInvoice.status.charAt(0) + viewInvoice.status.slice(1).toLowerCase()],
                ['Issue Date', new Date(viewInvoice.issueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
                ['Due Date',   viewInvoice.dueDate ? new Date(viewInvoice.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
                ['Notes',      viewInvoice.notes ?? '—'],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex items-start gap-3 px-4 py-2.5">
                  <p className="text-xs text-muted-foreground w-24 flex-shrink-0 mt-0.5">{label}</p>
                  <p className="text-sm text-foreground flex-1">{value}</p>
                </div>
              ))}
            </div>
          )}
          {/* ── Document Actions ── */}
          <div className="mt-3 rounded-lg border border-border p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" />Document Actions
            </p>
            {invoiceDocLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="h-3.5 w-3.5 animate-spin" />Looking for attachment…
              </div>
            ) : invoiceDoc ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{invoiceDoc.filename}</span>
                  <span className="flex-shrink-0 uppercase text-[10px] bg-muted px-1.5 py-0.5 rounded">{invoiceDoc.fileType}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 border-border gap-1.5 text-xs"
                    onClick={() => handleViewDoc(invoiceDoc)}>
                    <Eye className="h-3.5 w-3.5" />View Document
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 border-border gap-1.5 text-xs"
                    onClick={() => handleDownloadDoc(invoiceDoc)} disabled={docDownloading}>
                    {docDownloading ? <Spinner className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                    Download
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No document attached to this invoice.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Status dialog ───────────────────────────────────────────── */}
      <Dialog open={!!editInvoice} onOpenChange={open => { if (!open) setEditInvoice(null); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Invoice Status</DialogTitle>
            <DialogDescription className="text-muted-foreground">{editInvoice?.invoiceNumber} — {editInvoice?.client}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={editStatus} onValueChange={v => setEditStatus(v as InvoiceStatus)}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'] as InvoiceStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setEditInvoice(null)}>Cancel</Button>
              <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleStatusSave} disabled={editSaving}>
                {editSaving ? <Spinner className="h-4 w-4" /> : 'Save Status'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── New Invoice dialog ───────────────────────────────────────────── */}
      <Dialog open={isFormOpen} onOpenChange={open => { if (!open) { setIsFormOpen(false); setAttachFile(null); setSubmitError(''); } }}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">New Invoice</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Creating invoice for: <strong>{company?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {f('Client', <Input placeholder="Client or organisation name" value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))} className="bg-input border-border" />, true)}
            {f('Currency',
              <Select value={(form as any).currency ?? 'NLE'} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{CURRENCY_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>)}
            {f('Amount',
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--muted-foreground)', background: 'var(--muted)', flexShrink: 0 }}>{(form as any).currency ?? 'NLE'}</span>
                <Input type="text" inputMode="decimal" placeholder="0.00" value={form.amount}
                  onChange={e => { const r = e.target.value.replace(/,/g,''); if (r === '' || /^\d*\.?\d*$/.test(r)) setForm(p => ({ ...p, amount: r })); }}
                  className="bg-input border-border flex-1" />
              </div>, true)}
            {f('Status',
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as InvoiceStatus }))}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'] as InvoiceStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>)}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {f('Issue Date', <input type="date" value={form.issueDate} onChange={e => setForm(p => ({ ...p, issueDate: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))', width: '100%' }} />, true)}
              {f('Due Date', <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))', width: '100%' }} />, true)}
            </div>
            {f('Notes', <Textarea placeholder="Add invoice notes…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="bg-input border-border" rows={2} />, true)}
            {f('Attach Invoice File (name must contain "invoice")',
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input type="file" accept=".pdf,.doc,.docx,.xlsx,.csv" onChange={e => setAttachFile(e.target.files?.[0] ?? null)} style={{ fontSize: '14px' }} />
                {attachFile && <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}><Upload className="h-3 w-3 inline mr-1" />{attachFile.name}</p>}
              </div>)}
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleCreate}
                disabled={submitting || !form.client || !form.amount || !form.dueDate || !form.notes || !attachFile}>
                {submitting ? <Spinner className="h-4 w-4" /> : 'Create Invoice'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
