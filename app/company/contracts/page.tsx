'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Plus, FileText, FolderOpen, TrendingUp, Filter, Upload, Eye, Download, BookOpen, ArrowLeft, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import type { Contract, Company, ContractStatus, ReminderInterval } from '@/lib/types';
import { REMINDER_INTERVAL_LABELS } from '@/lib/types';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-config';
import { canSelectAnyCompany } from '@/lib/utils/rakel-staff';

const STATUS_COLORS: Record<ContractStatus, string> = {
  ACTIVE:    'bg-primary/10 text-primary',
  PENDING:   'bg-chart-3/10 text-chart-3',
  EXPIRED:   'bg-muted text-muted-foreground',
  COMPLETED: 'bg-chart-2/10 text-chart-2',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

// Helper: upload a file as a Document and return the document record.
// Reuses the same /api/v1/documents endpoint used by the Documents page.
async function uploadAttachment(file: File, title: string, category: string, companyId?: string) {
  const fd = new FormData();
  fd.append('file',     file);
  fd.append('title',    title);
  fd.append('category', category);
  if (companyId) fd.append('companyId', companyId);
  const res = await fetch('/api/v1/documents', { method: 'POST', credentials: 'include', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'File upload failed');
  }
  return res.json();
}

export default function CompanyContractsPage() {
  const { user } = useAuth();
  const [contracts,  setContracts]  = useState<Contract[]>([]);
  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [submitError,  setSubmitError]  = useState('');

  // Form state
  const [form, setForm] = useState({
    title: '', contractNumber: '', client: '', status: 'PENDING' as ContractStatus,
    startDate: '', expiryDate: '', description: '', companyId: '',
  });

  // File attachment + reminders
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [reminders,  setReminders]  = useState<ReminderInterval[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Company filter (for admin roles)
  const [companyFilter, setCompanyFilter] = useState('all');

  // Edit status modal
  const [editContract,    setEditContract]    = useState<Contract | null>(null);
  const [editStatus,      setEditStatus]      = useState<ContractStatus>('PENDING');
  const [editSubmitting,  setEditSubmitting]  = useState(false);

  // Contract view modal
  const [viewContract,    setViewContract]    = useState<Contract | null>(null);
  const [contractDoc,     setContractDoc]     = useState<any | null>(null);
  const [loadingDoc,      setLoadingDoc]      = useState(false);
  const [showPreview,     setShowPreview]     = useState(false);
  const [blobUrl,         setBlobUrl]         = useState<string | null>(null);
  const [previewLoading,  setPreviewLoading]  = useState(false);
  const [downloadingDoc,  setDownloadingDoc]  = useState(false);
  const blobRef = useRef<string | null>(null);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchContracts = () => {
    setLoading(true);
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch('/api/v1/contracts', { credentials: 'include', signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { contracts: [] })
      .then(d => setContracts(d.contracts ?? []))
      .catch(() => setContracts([]))
      .finally(() => { clearTimeout(timer); setLoading(false); });
  };

  useEffect(() => {
    fetchContracts();
    fetch('/api/v1/companies', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { companies: [] })
      .then(d => setCompanies(d.companies ?? []))
      .catch(() => {});
  }, [user?.companyId]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.title) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const companyId = form.companyId || user?.companyId || undefined;

      // 1. Upload attachment first (if any)
      if (attachFile) {
        await uploadAttachment(attachFile, form.title, 'Contracts', companyId);
      }

      // 2. Create the contract record
      const res = await fetch('/api/v1/contracts', {
        method:  'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:          form.title,
          contractNumber: form.contractNumber || undefined,
          client:         form.client         || undefined,
          status:         form.status,
          startDate:      form.startDate       || undefined,
          expiryDate:     form.expiryDate      || undefined,
          description:    form.description     || undefined,
          companyId:      companyId,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setSubmitError(d.error || 'Failed to create contract');
        return;
      }

      setIsFormOpen(false);
      setForm({ title: '', contractNumber: '', client: '', status: 'PENDING', startDate: '', expiryDate: '', description: '', companyId: '' });
      setAttachFile(null);
      setReminders([]);
      if (fileRef.current) fileRef.current.value = '';
      fetchContracts();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Modal handlers ──────────────────────────────────────────────────────────

  // ── Edit contract status ─────────────────────────────────────────────────────
  const handleStatusUpdate = async () => {
    if (!editContract) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/v1/contracts/${editContract.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus }),
      });
      if (res.ok) { setEditContract(null); fetchContracts(); }
    } catch { /* ignore */ }
    setEditSubmitting(false);
  };

  // ── Delete contract ───────────────────────────────────────────────────────────
  const handleDeleteContract = async (contract: Contract) => {
    if (!confirm(`Delete contract "${contract.title}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/v1/contracts/${contract.id}`, { method: 'DELETE', credentials: 'include' });
      fetchContracts();
    } catch { /* ignore */ }
  };

  const openContractView = async (contract: Contract) => {
    setViewContract(contract);
    setContractDoc(null);
    setShowPreview(false);
    setBlobUrl(null);
    setLoadingDoc(true);

    // Search for documents uploaded with this contract's company + Contracts category
    try {
      const params = new URLSearchParams({ category: 'Contracts', limit: '20' });
      if (contract.companyId) params.set('companyId', contract.companyId);
      const res = await fetch(`/api/v1/documents?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const docs: any[] = data.documents ?? [];
        // Prefer an exact title match, then fall back to any Contracts document
        const best = docs.find(d => d.title === contract.title) ?? docs[0] ?? null;
        setContractDoc(best);
      }
    } catch { /* silent — doc section will show "not available" */ }
    setLoadingDoc(false);
  };

  const closeContractView = () => {
    setViewContract(null);
    setContractDoc(null);
    setShowPreview(false);
    if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null; }
    setBlobUrl(null);
  };

  const handleReadDocument = async () => {
    if (!contractDoc) return;
    setShowPreview(true);
    setPreviewLoading(true);
    if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null; }
    try {
      const res = await fetch(`/api/v1/documents/${contractDoc.id}/download`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      blobRef.current = url;
      setBlobUrl(url);
    } catch { setBlobUrl(null); }
    setPreviewLoading(false);
  };

  const handleDownloadDoc = async () => {
    if (!contractDoc || downloadingDoc) return;
    setDownloadingDoc(true);
    try {
      const res = await fetch(`/api/v1/documents/${contractDoc.id}/download`, { credentials: 'include' });
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = window.document.createElement('a');
      a.href = url; a.download = contractDoc.filename; a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setDownloadingDoc(false);
  };

  // ── Computed ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => contracts.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.client ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.contractNumber ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus  = statusFilter  === 'all' || c.status      === statusFilter;
    const matchCompany = companyFilter === 'all' || c.companyId   === companyFilter;
    return matchSearch && matchStatus && matchCompany;
  }), [contracts, searchTerm, statusFilter, companyFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ACTIVE: 0, PENDING: 0, EXPIRED: 0, COMPLETED: 0, CANCELLED: 0 };
    contracts.forEach(c => { counts[c.status] = (counts[c.status] ?? 0) + 1; });
    return counts;
  }, [contracts]);

  const contractsOverTime = useMemo(() => {
    // Use createdAt (actual creation date), not upload timestamp
    const grouped: Record<string, { label: string; ts: number; count: number }> = {};
    contracts.forEach(c => {
      const d   = new Date(c.createdAt);
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!grouped[key]) grouped[key] = { label: key, ts: d.getTime(), count: 0 };
      grouped[key].count += 1;
    });
    // Sort oldest → newest so the line chart inclines correctly
    return Object.values(grouped)
      .sort((a, b) => a.ts - b.ts)
      .map(({ label, count }) => ({ month: label, count }));
  }, [contracts]);

  const canWrite             = user?.role === 'COMPANY_ADMIN' || user?.role === 'RAKEL_ADMIN' || user?.role === 'STAFF';
  const showCompanySelector  = canSelectAnyCompany(user);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contracts</h1>
          <p className="text-muted-foreground">Manage and track all company contracts.</p>
        </div>

        {canWrite && (
          <Dialog open={isFormOpen} onOpenChange={open => {
            setIsFormOpen(open);
            if (!open) { setAttachFile(null); setReminders([]); setSubmitError(''); }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />New Contract
              </Button>
            </DialogTrigger>

            <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-foreground">New Contract</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Add a new contract record.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">

                {/* Select Company — shown for admin roles, Rakel staff, or when user has no company */}
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

                {/* Contract Title */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Contract Title <span style={{ color: 'red' }}>*</span></label>
                  <Input placeholder="Enter contract title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-input border-border" />
                </div>

                {/* Contract Number */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Contract Number (Optional)</label>
                  <Input placeholder="e.g. CTR-2024-001" value={form.contractNumber} onChange={e => setForm(f => ({ ...f, contractNumber: e.target.value }))} className="bg-input border-border" />
                </div>

                {/* Client */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Client (Optional)</label>
                  <Input placeholder="Client or organization name" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} className="bg-input border-border" />
                </div>

                {/* Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Status</label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ContractStatus }))}>
                    <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {(['ACTIVE', 'PENDING', 'EXPIRED', 'COMPLETED', 'CANCELLED'] as ContractStatus[]).map(s => (
                        <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Start Date</label>
                    <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Expiry Date</label>
                    <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))' }} />
                  </div>
                </div>

                {/* Expiry reminder checkboxes — reuses same pattern as Documents page */}
                {form.expiryDate && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Remind me before expiry</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', background: 'hsl(var(--muted) / 0.3)' }}>
                      {(Object.entries(REMINDER_INTERVAL_LABELS) as [ReminderInterval, string][]).map(([key, label]) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={reminders.includes(key)}
                            onChange={e => setReminders(prev => e.target.checked ? [...prev, key] : prev.filter(r => r !== key))}
                            style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {reminders.length > 0 && (
                      <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                        {reminders.length} reminder{reminders.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                )}

                {/* Description */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Description (Optional)</label>
                  <Textarea placeholder="Contract details..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-input border-border" rows={3} />
                </div>

                {/* File attachment — reuses document upload system */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Attach Contract Document (Optional)</label>
                  <input
                    type="file"
                    ref={fileRef}
                    accept=".pdf,.doc,.docx,.xlsx,.csv"
                    onChange={e => setAttachFile(e.target.files?.[0] ?? null)}
                    style={{ fontSize: '14px' }}
                  />
                  {attachFile && (
                    <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                      <Upload className="h-3 w-3 inline mr-1" />
                      {attachFile.name} ({(attachFile.size / 1024 / 1024).toFixed(1)} MB)
                    </p>
                  )}
                </div>

                {submitError && <p className="text-sm text-destructive">{submitError}</p>}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 border-border" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                  <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleCreate} disabled={submitting || !form.title}>
                    {submitting ? <Spinner className="h-4 w-4" /> : 'Create Contract'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* ── Status summary cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {([['ACTIVE', 'text-primary'], ['PENDING', 'text-chart-3'], ['EXPIRED', 'text-muted-foreground'], ['COMPLETED', 'text-chart-2'], ['CANCELLED', 'text-destructive']] as const).map(([status, color]) => (
          <Card key={status} className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-foreground">{statusCounts[status] ?? 0}</p>
              <p className={`text-xs font-medium ${color}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Chart ──────────────────────────────────────────────────────────── */}
      {contractsOverTime.length > 1 && (
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Contracts Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={contractsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="count" name="Contracts" stroke="hsl(160, 60%, 45%)" strokeWidth={2} dot={{ fill: 'hsl(160, 60%, 45%)' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="relative flex-1 max-w-xs">
              <Input placeholder="Search contracts..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-input border-border" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] bg-input border-border"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Statuses</SelectItem>
                {(['ACTIVE', 'PENDING', 'EXPIRED', 'COMPLETED', 'CANCELLED'] as ContractStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Company filter — only shown when multiple companies are available */}
            {companies.length > 0 && (
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-[180px] bg-input border-border"><SelectValue placeholder="Filter by Company" /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map(co => (
                    <SelectItem key={co.id} value={co.id}>{co.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Contract list ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">{contracts.length === 0 ? 'No Contracts Yet' : 'No Contracts Found'}</h3>
            <p className="text-muted-foreground">{contracts.length === 0 ? 'Create your first contract using the button above.' : 'Try adjusting your search or filters.'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <Card key={c.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-foreground leading-tight">{c.title}</h3>
                      {c.contractNumber && <p className="text-xs text-muted-foreground">{c.contractNumber}</p>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[c.status]}`}>
                    {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                  </span>
                </div>
                {c.client && <p className="text-xs text-muted-foreground mb-2">Client: {c.client}</p>}
                {c.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{c.description}</p>}
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                  {c.startDate && <span>Start: {new Date(c.startDate).toLocaleDateString()}</span>}
                  {c.expiryDate && <span>Expires: {new Date(c.expiryDate).toLocaleDateString()}</span>}
                </div>
                {/* Action buttons */}
                <div className="flex gap-1.5 mt-3">
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 border-border text-foreground hover:bg-muted"
                    onClick={() => openContractView(c)}
                  >
                    <Eye className="h-3 w-3 mr-1" />View
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 border-border text-foreground hover:bg-muted"
                    onClick={async () => { await openContractView(c); handleDownloadDoc(); }}
                  >
                    <Download className="h-3 w-3 mr-1" />Download
                  </Button>
                  {/* Edit status — any writer role */}
                  {canWrite && (
                    <Button
                      variant="outline" size="sm"
                      className="border-border text-foreground hover:bg-muted px-2"
                      title="Edit status"
                      onClick={() => { setEditContract(c); setEditStatus(c.status); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  {/* Delete — admin only */}
                  {(user?.role === 'SUPER_ADMIN' || user?.role === 'RAKEL_ADMIN') && (
                    <Button
                      variant="outline" size="sm"
                      className="border-border text-muted-foreground hover:text-destructive hover:border-destructive px-2"
                      title="Delete contract"
                      onClick={() => handleDeleteContract(c)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* ── Edit Contract Status Modal ────────────────────────────────────── */}
      <Dialog open={editContract !== null} onOpenChange={open => { if (!open) setEditContract(null); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Contract Status</DialogTitle>
            <DialogDescription className="text-muted-foreground truncate">
              {editContract?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500 }}>Status</label>
              <Select value={editStatus} onValueChange={v => setEditStatus(v as ContractStatus)}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {(['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as ContractStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setEditContract(null)}>Cancel</Button>
              <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleStatusUpdate} disabled={editSubmitting}>
                {editSubmitting ? <Spinner className="h-4 w-4" /> : 'Save Status'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Contract Detail Modal ──────────────────────────────────────────── */}
      <Dialog open={viewContract !== null} onOpenChange={open => { if (!open) closeContractView(); }}>
        <DialogContent className="bg-card border-border max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogDescription className="sr-only">Contract details and document viewer</DialogDescription>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-foreground text-base leading-snug truncate">
                  {viewContract?.title}
                </DialogTitle>
                {viewContract?.contractNumber && (
                  <p className="text-xs text-muted-foreground mt-0.5">{viewContract.contractNumber}</p>
                )}
              </div>
              {viewContract && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase flex-shrink-0 ${STATUS_COLORS[viewContract.status]}`}>
                  {viewContract.status.charAt(0) + viewContract.status.slice(1).toLowerCase()}
                </span>
              )}
            </div>
          </DialogHeader>

          {viewContract && (
            <>
              {showPreview ? (
                /* ── Preview panel ────────────────────────────────────── */
                <div className="flex flex-col gap-3" style={{ minHeight: '55vh' }}>
                  <button
                    onClick={() => { setShowPreview(false); if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null; } setBlobUrl(null); }}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />Back to details
                  </button>
                  <div className="flex-1 rounded-lg border border-border overflow-hidden bg-muted/20" style={{ minHeight: '50vh' }}>
                    {previewLoading ? (
                      <div className="flex flex-col items-center justify-center gap-3 p-8" style={{ minHeight: '50vh' }}>
                        <Spinner className="h-7 w-7 text-primary" />
                        <p className="text-sm text-muted-foreground">Loading preview…</p>
                      </div>
                    ) : !blobUrl ? (
                      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" style={{ minHeight: '50vh' }}>
                        <AlertCircle className="h-10 w-10 text-muted-foreground opacity-60" />
                        <p className="text-foreground font-medium">Preview failed</p>
                        <p className="text-sm text-muted-foreground">Use the Download button to access this file.</p>
                      </div>
                    ) : ['DOCX', 'DOC', 'XLSX', 'CSV'].includes((contractDoc?.fileType ?? '').toUpperCase()) ? (
                      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" style={{ minHeight: '50vh' }}>
                        <FileText className="h-10 w-10 text-muted-foreground opacity-60" />
                        <p className="text-foreground font-medium">{contractDoc?.fileType?.toUpperCase()} files cannot be previewed in the browser</p>
                        <p className="text-sm text-muted-foreground">Download the file to open it in its native application.</p>
                      </div>
                    ) : (
                      /* PDF / image — blob URL bypasses Brave Shields */
                      <iframe
                        key={blobUrl}
                        src={blobUrl}
                        title={contractDoc?.title}
                        className="w-full border-0"
                        style={{ height: '50vh' }}
                      />
                    )}
                  </div>
                </div>
              ) : (
                /* ── Metadata + actions ────────────────────────────────── */
                <>
                  <div className="mt-2 rounded-lg border border-border bg-muted/10 px-4">
                    {[
                      ['Company',      viewContract.company?.name ?? '—'],
                      ['Client',       viewContract.client        ?? '—'],
                      ['Created By',   (viewContract.creator as any)?.fullName
                                         ? `${(viewContract.creator as any).fullName} (${viewContract.creator?.username})`
                                         : (viewContract.creator?.username ?? viewContract.createdBy)],
                      ['Start Date',   viewContract.startDate  ? new Date(viewContract.startDate).toLocaleDateString('en-GB',  { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
                      ['Expiry Date',  viewContract.expiryDate ? new Date(viewContract.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
                      ['Created',      new Date(viewContract.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
                        <p className="text-xs text-muted-foreground w-24 flex-shrink-0 mt-0.5">{label}</p>
                        <p className="text-sm font-medium text-foreground break-words flex-1">{value}</p>
                      </div>
                    ))}
                    {viewContract.description && (
                      <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
                        <p className="text-xs text-muted-foreground w-24 flex-shrink-0 mt-0.5">Description</p>
                        <p className="text-sm text-foreground flex-1">{viewContract.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Document section */}
                  <div className="rounded-lg border border-border bg-muted/5 px-4 py-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contract Document</p>
                    {loadingDoc ? (
                      <div className="flex items-center gap-2 py-2">
                        <Spinner className="h-4 w-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Looking for attached document…</span>
                      </div>
                    ) : contractDoc ? (
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{contractDoc.title}</p>
                          <p className="text-xs text-muted-foreground">{contractDoc.filename} · {contractDoc.fileType?.toUpperCase()}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-1">No document attached to this contract.</p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-1">
                    <Button
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={!contractDoc || loadingDoc}
                      onClick={handleReadDocument}
                    >
                      <BookOpen className="h-4 w-4 mr-2" />Read Document
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-border text-foreground hover:bg-muted"
                      disabled={!contractDoc || loadingDoc || downloadingDoc}
                      onClick={handleDownloadDoc}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {downloadingDoc ? 'Downloading…' : 'Download'}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
