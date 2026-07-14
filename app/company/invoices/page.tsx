'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, FolderOpen, TrendingUp, Filter, Upload, FileText, Receipt, Eye, Download, Pencil, Trash2, Paperclip } from 'lucide-react';
import { DocumentViewModal } from '@/components/document-view-modal';
import type { Invoice, Contract, Company, InvoiceStatus } from '@/lib/types';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-config';
import { canSelectAnyCompany } from '@/lib/utils/rakel-staff';
import { safeGet } from '@/lib/utils/safe-fetch';
import { CURRENCIES, CURRENCY_LABELS, fmtCurrency } from '@/lib/utils/currency';

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT:     'bg-muted text-muted-foreground',
  SENT:      'bg-chart-3/10 text-chart-3',
  PAID:      'bg-primary/10 text-primary',
  OVERDUE:   'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
};

// Reuses the existing /api/v1/documents upload endpoint
async function uploadAttachment(file: File, title: string, companyId?: string) {
  const fd = new FormData();
  fd.append('file',     file);
  fd.append('title',    title);
  fd.append('category', 'Invoices');
  if (companyId) fd.append('companyId', companyId);
  const res = await fetch('/api/v1/documents', { method: 'POST', credentials: 'include', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'File upload failed');
  }
  return res.json();
}

export default function CompanyInvoicesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    }>
      <CompanyInvoicesPageInner />
    </Suspense>
  );
}

function CompanyInvoicesPageInner() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [invoices,   setInvoices]   = useState<Invoice[]>([]);
  const [contracts,  setContracts]  = useState<Contract[]>([]);
  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isFormOpen,     setIsFormOpen]     = useState(false);

  // Auto-open the New Invoice dialog when navigated here with ?new=true
  useEffect(() => {
    if (searchParams.get('new') === 'true') setIsFormOpen(true);
  }, [searchParams]);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [submitError,    setSubmitError]    = useState('');

  // Currency filter — drives the KPI cards + Revenue Summary chart, matches Rakel Admin's invoice dashboard
  const [viewCurrency, setViewCurrency] = useState<string>('NLE');

  // Invoice files for Generate Invoice modal
  const [invoiceDocs,         setInvoiceDocs]         = useState<any[]>([]);
  const [loadingInvoiceDocs,  setLoadingInvoiceDocs]  = useState(false);
  const [selectedDocId,       setSelectedDocId]       = useState('');
  const [generateCompanyId,   setGenerateCompanyId]   = useState('');

  const [form, setForm] = useState({
    client: '', contractId: '', amount: '', currency: 'NLE',
    status: 'DRAFT' as InvoiceStatus,
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '', notes: '', companyId: '',
  });

  const [attachFile, setAttachFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Edit status state ────────────────────────────────────────────────────────
  const [editInvoice,    setEditInvoice]    = useState<Invoice | null>(null);
  const [editStatus,     setEditStatus]     = useState<InvoiceStatus>('DRAFT');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ── Delete state ─────────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── View Invoice detail modal state ─────────────────────────────────────────
  const [viewInvoice,       setViewInvoice]       = useState<Invoice | null>(null);
  const [invoiceDoc,        setInvoiceDoc]        = useState<any | null>(null);
  const [invoiceDocLoading, setInvoiceDocLoading] = useState(false);
  const [docDownloading,    setDocDownloading]    = useState(false);

  // ── Document preview state (reuses the existing DocumentViewModal) ──────────
  const [viewDoc, setViewDoc] = useState<any | null>(null);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchData = () => {
    setLoading(true);
    Promise.all([
      safeGet('/api/v1/invoices',  { invoices:  [] }, 8000, 1),
      safeGet('/api/v1/contracts', { contracts: [] }, 8000, 1),
      safeGet('/api/v1/companies', { companies: [] }, 8000, 1),
    ]).then(([id, cd, cod]) => {
      setInvoices((id as any).invoices   ?? []);
      setContracts((cd as any).contracts  ?? []);
      setCompanies((cod as any).companies ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [user?.companyId]);

  // Fetch the attached document when the View Invoice modal opens
  useEffect(() => {
    if (!viewInvoice) { setInvoiceDoc(null); return; }
    setInvoiceDocLoading(true);
    const params = new URLSearchParams({ category: 'Invoices', limit: '20' });
    if (viewInvoice.companyId) params.set('companyId', viewInvoice.companyId);
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

  // ── Create invoice ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const missing: string[] = [];
    if (!form.client.trim())  missing.push('Client');
    if (!form.amount)         missing.push('Amount');
    if (!form.issueDate)      missing.push('Issue Date');
    if (!form.dueDate)        missing.push('Due Date');
    if (!form.notes.trim())   missing.push('Notes');
    if (!attachFile)          missing.push('Invoice File');
    if (missing.length > 0) {
      setSubmitError(`Required fields missing: ${missing.join(', ')}.`);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const companyId = form.companyId || user?.companyId || undefined;

      if (attachFile) {
        await uploadAttachment(attachFile, `Invoice — ${form.client}`, companyId);
      }

      const res = await fetch('/api/v1/invoices', {
        method:  'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client:     form.client,
          contractId: form.contractId || undefined,
          amount:     parseFloat(form.amount.replace(/,/g, '')),
          currency:   form.currency,
          status:     form.status,
          issueDate:  form.issueDate,
          dueDate:    form.dueDate,
          notes:      form.notes,
          companyId,
        }),
      });
      if (!res.ok) { const d = await res.json(); setSubmitError(d.error || 'Failed'); return; }
      setIsFormOpen(false);
      setForm({ client: '', contractId: '', amount: '', currency: 'NLE', status: 'DRAFT', issueDate: new Date().toISOString().split('T')[0], dueDate: '', notes: '', companyId: '' });
      setAttachFile(null);
      if (fileRef.current) fileRef.current.value = '';
      fetchData();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Network error');
    } finally { setSubmitting(false); }
  };

  // ── Generate Invoice modal ─────────────────────────────────────────────────
  const openGenerateModal = () => {
    setIsGenerateOpen(true);
    setSelectedDocId('');
    setGenerateCompanyId('');
    loadInvoiceFiles();
  };

  const loadInvoiceFiles = (cid?: string) => {
    setLoadingInvoiceDocs(true);
    const params = new URLSearchParams({ limit: '50' });
    if (cid) params.set('companyId', cid);
    fetch(`/api/v1/documents?${params}&category=Invoices`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(d => setInvoiceDocs(d.documents ?? []))
      .catch(() => setInvoiceDocs([]))
      .finally(() => setLoadingInvoiceDocs(false));
  };

  const handleGenerateCompanyChange = (cid: string) => {
    setGenerateCompanyId(cid);
    setSelectedDocId('');
    loadInvoiceFiles(cid || undefined);
  };

  const handleGenerateInvoice = async () => {
    if (!selectedDocId) return;
    const doc = invoiceDocs.find(d => d.id === selectedDocId);
    if (!doc) return;
    setSubmitting(true);
    try {
      const companyId = generateCompanyId || doc.companyId || user?.companyId || undefined;
      const res = await fetch('/api/v1/invoices', {
        method:  'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client:    doc.company?.name ?? doc.title,
          amount:    0,
          status:    'DRAFT',
          issueDate: new Date().toISOString().split('T')[0],
          notes:     `Generated from uploaded file: ${doc.filename}`,
          companyId,
        }),
      });
      if (res.ok) {
        setIsGenerateOpen(false);
        fetchData();
      }
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  // ── Edit status handler ──────────────────────────────────────────────────────
  const handleStatusUpdate = async () => {
    if (!editInvoice) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/v1/invoices/${editInvoice.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus }),
      });
      if (res.ok) { setEditInvoice(null); fetchData(); }
    } catch { /* ignore */ }
    setEditSubmitting(false);
  };

  // ── Delete invoice handler ───────────────────────────────────────────────────
  const handleDeleteInvoice = async (inv: Invoice) => {
    if (!confirm(`Delete invoice ${inv.invoiceNumber}? This cannot be undone.`)) return;
    setDeletingId(inv.id);
    try {
      await fetch(`/api/v1/invoices/${inv.id}`, { method: 'DELETE', credentials: 'include' });
      fetchData();
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  // ── Document actions (inside the View Invoice modal) ─────────────────────────
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

  // ── Computed ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => invoices.filter(inv => {
    const matchSearch = inv.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  }), [invoices, searchTerm, statusFilter]);

  // Matches Rakel Admin's Invoice Analytics cards exactly: counts are global,
  // amounts are scoped to the selected view currency, NLE total is always NLE.
  const summary = useMemo(() => {
    const paidAll    = invoices.filter(i => i.status === 'PAID');
    const pendingAll = invoices.filter(i => i.status === 'DRAFT' || i.status === 'SENT');
    const overdueAll = invoices.filter(i => i.status === 'OVERDUE');
    const currInv    = invoices.filter(i => i.currency === viewCurrency);
    const paidC      = currInv.filter(i => i.status === 'PAID');
    const pendingC   = currInv.filter(i => i.status === 'DRAFT' || i.status === 'SENT');
    const overdueC   = currInv.filter(i => i.status === 'OVERDUE');
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
    return Object.entries(counts).map(([status, count]) => ({
      status: status.charAt(0) + status.slice(1).toLowerCase(), count,
    }));
  }, [invoices]);

  const revenueTrend = useMemo(() => {
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

  const canWrite            = user?.role === 'COMPANY_ADMIN' || user?.role === 'RAKEL_ADMIN' || user?.role === 'STAFF';
  const showCompanySelector = canSelectAnyCompany(user);

  if (!mounted) return null;

  const f = (label: string, children: React.ReactNode, required = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '14px', fontWeight: 500 }}>{label}{required && <span style={{ color: 'red' }}> *</span>}</label>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground">Manage and track company invoices.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Currency selector */}
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

          {canWrite && (
            <>
              {/* Generate Invoice button */}
              <Button variant="outline" className="border-border" onClick={openGenerateModal}>
                <Receipt className="h-4 w-4 mr-2" />Generate Invoice
              </Button>

              {/* New Invoice dialog */}
              <Dialog open={isFormOpen} onOpenChange={open => {
                setIsFormOpen(open);
                if (!open) { setAttachFile(null); setSubmitError(''); }
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />New Invoice
                  </Button>
                </DialogTrigger>

                <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">New Invoice</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Create a new invoice. A unique invoice number will be auto-generated.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 pt-2">

                    {/* Select Company — shown for admin roles / Rakel staff sharing this page */}
                    {(showCompanySelector || !user?.companyId) && companies.length > 0 && (
                      f('Select Company',
                        <select
                          value={form.companyId}
                          onChange={e => setForm(fm => ({ ...fm, companyId: e.target.value }))}
                          style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', width: '100%', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))' }}
                        >
                          <option value="">— Select company —</option>
                          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>)
                    )}

                    {f('Client', <Input placeholder="Client or organization name" value={form.client} onChange={e => setForm(fm => ({ ...fm, client: e.target.value }))} className="bg-input border-border" />, true)}

                    {f('Currency',
                      <Select value={form.currency} onValueChange={v => setForm(fm => ({ ...fm, currency: v }))}>
                        <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {CURRENCIES.map(c => (
                            <SelectItem key={c} value={c}>{CURRENCY_LABELS[c]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>)}

                    {f('Amount',
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', flexShrink: 0 }}>{form.currency}</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={form.amount}
                          onChange={e => {
                            const raw = e.target.value.replace(/,/g, '');
                            if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                              setForm(fm => ({ ...fm, amount: raw }));
                            }
                          }}
                          onBlur={() => {
                            const num = parseFloat(form.amount);
                            if (!isNaN(num)) {
                              setForm(fm => ({
                                ...fm,
                                amount: num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                              }));
                            }
                          }}
                          onFocus={() => {
                            setForm(fm => ({ ...fm, amount: fm.amount.replace(/,/g, '') }));
                          }}
                          className="bg-input border-border flex-1"
                        />
                      </div>, true)}
                    {form.amount && !isNaN(parseFloat(form.amount.replace(/,/g, ''))) && (
                      <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '-8px' }}>
                        {form.currency} {parseFloat(form.amount.replace(/,/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    )}

                    {f('Status',
                      <Select value={form.status} onValueChange={v => setForm(fm => ({ ...fm, status: v as InvoiceStatus }))}>
                        <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'] as InvoiceStatus[]).map(s => (
                            <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>)}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {f('Issue Date', <input type="date" value={form.issueDate} onChange={e => setForm(fm => ({ ...fm, issueDate: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))', width: '100%' }} />, true)}
                      {f('Due Date', <input type="date" value={form.dueDate} onChange={e => setForm(fm => ({ ...fm, dueDate: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))', width: '100%' }} />, true)}
                    </div>

                    {contracts.length > 0 && (
                      f('Linked Contract (Optional)',
                        <Select
                          value={form.contractId || undefined}
                          onValueChange={v => setForm(fm => ({ ...fm, contractId: v }))}
                        >
                          <SelectTrigger className="bg-input border-border">
                            <SelectValue placeholder="No contract (optional)" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border">
                            {contracts
                              .filter(c => c.id && c.status === 'ACTIVE')
                              .map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.title}{c.contractNumber ? ` (${c.contractNumber})` : ''}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>)
                    )}

                    {f('Notes', <Textarea placeholder="Additional notes..." value={form.notes} onChange={e => setForm(fm => ({ ...fm, notes: e.target.value }))} className="bg-input border-border" rows={2} />, true)}

                    {f('Attach Invoice File',
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <input type="file" ref={fileRef} accept=".pdf,.doc,.docx,.xlsx,.csv" onChange={e => setAttachFile(e.target.files?.[0] ?? null)} style={{ fontSize: '14px' }} />
                        {attachFile && (
                          <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                            <Upload className="h-3 w-3 inline mr-1" />{attachFile.name} ({(attachFile.size / 1024 / 1024).toFixed(1)} MB)
                          </p>
                        )}
                      </div>, true)}

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
            </>
          )}
        </div>
      </div>

      {/* ── Generate Invoice modal ─────────────────────────────────────────── */}
      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Generate Invoice from File</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Select an uploaded invoice file to generate an invoice record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {showCompanySelector && companies.length > 0 && (
              f('Filter by Company',
                <select
                  value={generateCompanyId}
                  onChange={e => handleGenerateCompanyChange(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', width: '100%', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))' }}
                >
                  <option value="">All Companies</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>)
            )}

            {loadingInvoiceDocs ? (
              <div className="flex justify-center py-8"><Spinner className="h-6 w-6 text-primary" /></div>
            ) : invoiceDocs.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-40" />
                <p className="text-sm font-medium text-foreground">No invoice files found</p>
                <p className="text-xs text-muted-foreground mt-1">Upload invoice files using "New Invoice" first.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoiceDocs.map(doc => (
                  <label key={doc.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedDocId === doc.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'}`}>
                    <input type="radio" name="invoiceDoc" value={doc.id} checked={selectedDocId === doc.id} onChange={() => setSelectedDocId(doc.id)} className="h-4 w-4" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">{doc.filename}{doc.company ? ` · ${doc.company.name}` : ''}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setIsGenerateOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleGenerateInvoice} disabled={!selectedDocId || submitting}>
                {submitting ? <Spinner className="h-4 w-4" /> : 'Generate Invoice'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Invoice Analytics cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Invoices</p><p className="text-3xl font-bold text-foreground mt-1">{summary.total}</p><p className="text-xs text-muted-foreground mt-1">{fmtCurrency(summary.nleTotal, 'NLE')} Total Value (NLE)</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Paid ({viewCurrency})</p><p className="text-2xl font-bold text-primary mt-1">{fmtCurrency(summary.paidAmt, viewCurrency)}</p><p className="text-xs text-muted-foreground mt-1">{summary.paidCount} invoice{summary.paidCount !== 1 ? 's' : ''}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending ({viewCurrency})</p><p className="text-2xl font-bold text-chart-3 mt-1">{fmtCurrency(summary.pendingAmt, viewCurrency)}</p><p className="text-xs text-muted-foreground mt-1">{summary.pendingCount} invoice{summary.pendingCount !== 1 ? 's' : ''}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Overdue ({viewCurrency})</p><p className="text-2xl font-bold text-destructive mt-1">{fmtCurrency(summary.overdueAmt, viewCurrency)}</p><p className="text-xs text-muted-foreground mt-1">{summary.overdueCount} invoice{summary.overdueCount !== 1 ? 's' : ''}</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-primary" /></div>
      ) : invoices.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <FolderOpen className="h-14 w-14 mx-auto text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-lg font-medium text-foreground">No Invoices Yet</h3>
            <p className="text-muted-foreground">Create your first invoice using the button above.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Status Breakdown + Revenue Summary charts ──────────────────── */}
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
                        <linearGradient id="companyInvoicesPaid" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(160,60%,45%)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(160,60%,45%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={fmt} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [fmt(v)]} />
                      <Area type="monotone" dataKey="paid" name="Paid" stroke="hsl(160,60%,45%)" fillOpacity={1} fill="url(#companyInvoicesPaid)" />
                      <Area type="monotone" dataKey="pending" name="Pending" stroke="hsl(45,70%,50%)" fill="none" strokeDasharray="4 2" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Filters ─────────────────────────────────────────────────────── */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search invoices..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 max-w-xs bg-input border-border" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px] bg-input border-border"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="all">All Statuses</SelectItem>
                    {(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'] as InvoiceStatus[]).map(s => (
                      <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* ── Invoice table ───────────────────────────────────────────────── */}
          {filtered.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-12 text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground">No Invoices Found</h3>
                <p className="text-muted-foreground">Try adjusting your search or filters.</p>
              </CardContent>
            </Card>
          ) : (
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
                      {filtered.map(inv => (
                        <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-sm text-foreground">{inv.invoiceNumber}</td>
                          <td className="px-4 py-3 text-foreground">{inv.client}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-medium">{inv.currency ?? 'NLE'}</td>
                          <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
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
                              {/* Delete — admin only (unchanged permission gate) */}
                              {(user?.role === 'SUPER_ADMIN' || user?.role === 'RAKEL_ADMIN') && (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" title="Delete"
                                  disabled={deletingId === inv.id} onClick={() => handleDeleteInvoice(inv)}>
                                  {deletingId === inv.id ? <Spinner className="h-3 w-3" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
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
                ['Contract',   viewInvoice.contract?.title ?? '—'],
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
                <Spinner className="h-3.5 w-3.5" />Looking for attachment…
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
                    onClick={() => setViewDoc(invoiceDoc)}>
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

      {/* ── Edit Invoice Status Modal ──────────────────────────────────────── */}
      <Dialog open={editInvoice !== null} onOpenChange={open => { if (!open) setEditInvoice(null); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Invoice Status</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editInvoice?.invoiceNumber} — {editInvoice?.client}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500 }}>Status</label>
              <Select value={editStatus} onValueChange={v => setEditStatus(v as InvoiceStatus)}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'] as InvoiceStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setEditInvoice(null)}>Cancel</Button>
              <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleStatusUpdate} disabled={editSubmitting}>
                {editSubmitting ? <Spinner className="h-4 w-4" /> : 'Save Status'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Document preview modal (existing app-wide preview component) ────── */}
      <DocumentViewModal doc={viewDoc} open={viewDoc !== null} onClose={() => setViewDoc(null)} />
    </div>
  );
}
