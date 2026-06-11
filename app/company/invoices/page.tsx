'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useRef } from 'react';
// ... rest of file unchanged
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, FolderOpen, TrendingUp, Filter, Upload, FileText, Receipt, Eye, Download, Pencil, Trash2 } from 'lucide-react';
import { DocumentViewModal } from '@/components/document-view-modal';
import type { Invoice, Contract, Company, InvoiceStatus } from '@/lib/types';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-config';
import { canSelectAnyCompany } from '@/lib/utils/rakel-staff';
import { safeGet } from '@/lib/utils/safe-fetch';

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

  // Invoice files for Generate Invoice modal
  const [invoiceDocs,         setInvoiceDocs]         = useState<any[]>([]);
  const [loadingInvoiceDocs,  setLoadingInvoiceDocs]  = useState(false);
  const [selectedDocId,       setSelectedDocId]       = useState('');
  const [generateCompanyId,   setGenerateCompanyId]   = useState('');

  const [form, setForm] = useState({
    client: '', contractId: '', amount: '',
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

  // ── View document state ──────────────────────────────────────────────────────
  const [viewDoc,      setViewDoc]      = useState<any | null>(null);
  const [loadingView,  setLoadingView]  = useState(false);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchData = () => {
    setLoading(true);
    Promise.all([
      safeGet('/api/v1/invoices',  { invoices:  [] }),
      safeGet('/api/v1/contracts', { contracts: [] }),
      safeGet('/api/v1/companies', { companies: [] }),
    ]).then(([id, cd, cod]) => {
      setInvoices((id as any).invoices   ?? []);
      setContracts((cd as any).contracts  ?? []);
      setCompanies((cod as any).companies ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [user?.companyId]);

  if (!mounted) return null;
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
          status:     form.status,
          issueDate:  form.issueDate,
          dueDate:    form.dueDate,
          notes:      form.notes,
          companyId,
        }),
      });
      if (!res.ok) { const d = await res.json(); setSubmitError(d.error || 'Failed'); return; }
      setIsFormOpen(false);
      setForm({ client: '', contractId: '', amount: '', status: 'DRAFT', issueDate: new Date().toISOString().split('T')[0], dueDate: '', notes: '', companyId: '' });
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
    try {
      await fetch(`/api/v1/invoices/${inv.id}`, { method: 'DELETE', credentials: 'include' });
      fetchData();
    } catch { /* ignore */ }
  };

  // ── Find & open document viewer for an invoice ───────────────────────────────
  const handleViewInvoice = async (inv: Invoice) => {
    setLoadingView(true);
    try {
      const params = new URLSearchParams({ category: 'Invoices', limit: '10' });
      if (inv.companyId) params.set('companyId', inv.companyId);
      const res = await fetch(`/api/v1/documents?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const docs: any[] = data.documents ?? [];
        const match = docs.find(d => d.title.includes(inv.client) || d.title.includes(inv.invoiceNumber))
          ?? docs[0] ?? null;
        setViewDoc(match);
      }
    } catch { /* ignore */ }
    setLoadingView(false);
  };

  // ── Computed ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => invoices.filter(inv => {
    const matchSearch = inv.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  }), [invoices, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const paid    = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0);
    const overdue = invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.amount, 0);
    const pending = invoices.filter(i => i.status === 'SENT').reduce((s, i) => s + i.amount, 0);
    return { paid, overdue, pending, total: invoices.length };
  }, [invoices]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach(i => { counts[i.status] = (counts[i.status] ?? 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({
      status: status.charAt(0) + status.slice(1).toLowerCase(), count,
    }));
  }, [invoices]);

  const canWrite            = user?.role === 'COMPANY_ADMIN' || user?.role === 'RAKEL_ADMIN' || user?.role === 'STAFF';
  const showCompanySelector = canSelectAnyCompany(user);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground">Manage and track company invoices.</p>
        </div>

        {canWrite && (
          <div className="flex items-center gap-2">
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

                  {/* Select Company */}
                  {(showCompanySelector || !user?.companyId) && companies.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Select Company</label>
                      <select
                        value={form.companyId}
                        onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                        style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', width: '100%', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))' }}
                      >
                        <option value="">— Select company —</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Client */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Client <span style={{ color: 'red' }}>*</span></label>
                    <Input placeholder="Client or organization name" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} className="bg-input border-border" />
                  </div>

                  {/* Amount + Currency — input stores raw number, preview shows formatted */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Amount <span style={{ color: 'red' }}>*</span></label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', flexShrink: 0 }}>NLE</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={form.amount}
                        onChange={e => {
                          // Allow digits, one decimal point, and commas (strip commas for storage)
                          const raw = e.target.value.replace(/,/g, '');
                          if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                            setForm(f => ({ ...f, amount: raw }));
                          }
                        }}
                        onBlur={() => {
                          const num = parseFloat(form.amount);
                          if (!isNaN(num)) {
                            // Format with commas on blur, store raw on submit via parseFloat
                            setForm(f => ({
                              ...f,
                              amount: num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                            }));
                          }
                        }}
                        onFocus={() => {
                          // Strip formatting when focused so user can edit the raw number
                          setForm(f => ({ ...f, amount: f.amount.replace(/,/g, '') }));
                        }}
                        className="bg-input border-border flex-1"
                      />
                    </div>
                    {form.amount && !isNaN(parseFloat(form.amount.replace(/,/g, ''))) && (
                      <p style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                        USD {parseFloat(form.amount.replace(/,/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Status</label>
                    <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as InvoiceStatus }))}>
                      <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'] as InvoiceStatus[]).map(s => (
                          <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Dates */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Issue Date <span style={{ color: 'red' }}>*</span></label>
                      <input type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Due Date (Optional)</label>
                      <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))' }} />
                    </div>
                  </div>

                  {/* Linked Contract */}
                  {contracts.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Linked Contract (Optional)</label>
                      <Select
                        value={form.contractId || undefined}
                        onValueChange={v => setForm(f => ({ ...f, contractId: v }))}
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
                      </Select>
                    </div>
                  )}

                  {/* Notes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Notes </label>
                    <Textarea placeholder="Additional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-input border-border" rows={2} />
                  </div>

                  {/* File attachment — reuses document upload system */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Attach Invoice File </label>
                    <input type="file" ref={fileRef} accept=".pdf,.doc,.docx,.xlsx,.csv" onChange={e => setAttachFile(e.target.files?.[0] ?? null)} style={{ fontSize: '14px' }} />
                    {attachFile && (
                      <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                        <Upload className="h-3 w-3 inline mr-1" />{attachFile.name} ({(attachFile.size / 1024 / 1024).toFixed(1)} MB)
                      </p>
                    )}
                  </div>

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
        )}
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
            {/* Company filter inside generate modal */}
            {showCompanySelector && companies.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Filter by Company</label>
                <select
                  value={generateCompanyId}
                  onChange={e => handleGenerateCompanyChange(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', width: '100%', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))' }}
                >
                  <option value="">All Companies</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
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

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Invoices</p><p className="text-2xl font-bold text-foreground">{summary.total}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Paid (USD)</p><p className="text-2xl font-bold text-primary">{Number(summary.paid).toLocaleString()}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending (USD)</p><p className="text-2xl font-bold text-chart-3">{Number(summary.pending).toLocaleString()}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Overdue (USD)</p><p className="text-2xl font-bold text-destructive">{Number(summary.overdue).toLocaleString()}</p></CardContent></Card>
      </div>

      {/* ── Chart ──────────────────────────────────────────────────────────── */}
      {statusData.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Invoice Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="status" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Invoices" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Filters ────────────────────────────────────────────────────────── */}
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

      {/* ── Invoice table ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">{invoices.length === 0 ? 'No Invoices Yet' : 'No Invoices Found'}</h3>
            <p className="text-muted-foreground">{invoices.length === 0 ? 'Create your first invoice using the button above.' : 'Try adjusting your search or filters.'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    {['Invoice #', 'Client', 'Contract', 'Amount (USD)', 'Status', 'Issue Date', 'Due Date', 'Actions'].map(h => (
                      <th key={h} className="text-left p-4 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => (
                    <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-mono text-sm text-foreground">{inv.invoiceNumber}</td>
                      <td className="p-4 text-foreground">{inv.client}</td>
                      <td className="p-4 text-muted-foreground">{inv.contract?.title ?? '—'}</td>
                      {/* Amount — no $ prefix, comma-formatted */}
                      <td className="p-4 font-medium text-foreground">
                        {Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                          {inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground whitespace-nowrap">{new Date(inv.issueDate).toLocaleDateString()}</td>
                      <td className="p-4 text-muted-foreground whitespace-nowrap">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          {/* Edit status */}
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Edit status"
                            onClick={() => { setEditInvoice(inv); setEditStatus(inv.status); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {/* View document */}
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="View document"
                            disabled={loadingView}
                            onClick={() => handleViewInvoice(inv)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {/* Download */}
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Download"
                            onClick={() => handleViewInvoice(inv)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          {/* Delete — admin only */}
                          {(user?.role === 'SUPER_ADMIN' || user?.role === 'RAKEL_ADMIN') && (
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              title="Delete invoice"
                              onClick={() => handleDeleteInvoice(inv)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

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

      {/* ── Document viewer for invoice files ─────────────────────────────── */}
      <DocumentViewModal doc={viewDoc} open={viewDoc !== null} onClose={() => setViewDoc(null)} />
    </div>
  );
}
