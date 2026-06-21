'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  FileText, Search, Download, Eye, Filter, FolderOpen,
  Plus, Upload, X, AlertCircle, CheckCircle, Trash2,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { DocumentViewModal } from '@/components/document-view-modal';
import type { Document, ReminderInterval, Company } from '@/lib/types';
import { REMINDER_INTERVAL_LABELS } from '@/lib/types';
import { canSelectAnyCompany } from '@/lib/utils/rakel-staff';

// ─── helpers ─────────────────────────────────────────────────────────────────


// ─── page ─────────────────────────────────────────────────────────────────────

export default function CompanyDocumentsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { user } = useAuth();

  // ── list state ───────────────────────────────────────────────────────────
  const [documents,      setDocuments]      = useState<Document[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter,     setDateFilter]     = useState('all');

  // ── document view modal state ────────────────────────────────────────────
  const [viewDoc, setViewDoc] = useState<Document | null>(null);

  // ── delete handler (SUPER_ADMIN + RAKEL_ADMIN only) ───────────────────────
  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        loadDocuments();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? 'Delete failed.');
      }
    } catch {
      alert('Network error — could not delete document.');
    }
  };

  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'RAKEL_ADMIN';

  // ── upload dialog state ──────────────────────────────────────────────────
  const [dialogOpen,    setDialogOpen]    = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [uploadError,   setUploadError]   = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [title,         setTitle]         = useState('');
  const [description,   setDescription]   = useState('');
  const [category,      setCategory]      = useState('');
  const [dateReceived,  setDateReceived]  = useState('');
  const [expiryDate,    setExpiryDate]    = useState('');
  const [reminders,     setReminders]     = useState<ReminderInterval[]>([]);
  const [file,          setFile]          = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Rakel staff: override target company ─────────────────────────────────
  const [companies,          setCompanies]          = useState<Company[]>([]);
  const [uploadCompanyId,    setUploadCompanyId]     = useState('');
  const showCompanySelector = canSelectAnyCompany(user);

  // ── data fetching ────────────────────────────────────────────────────────

  const loadDocuments = () => {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch('/api/v1/documents', { credentials: 'include', signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(d => setDocuments(d.documents ?? []))
      .catch(() => setDocuments([]))
      .finally(() => { clearTimeout(timer); setLoading(false); });
  };

  useEffect(() => {
    if (!user?.companyId) { setLoading(false); return; }
    loadDocuments();
    // Rakel Investments staff need the company list so they can pick a target
    if (showCompanySelector) {
      fetch('/api/v1/companies', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { companies: [] })
        .then(d => setCompanies(d.companies ?? []))
        .catch(() => {});
    }
  }, [user?.companyId, showCompanySelector]);

  if (!mounted) return null;
  // ── dialog helpers ───────────────────────────────────────────────────────

  const resetDialog = () => {
    setTitle(''); setDescription(''); setCategory('');
    setFile(null); setDateReceived(''); setExpiryDate(''); setReminders([]);
    setUploadError(''); setUploadSuccess(false); setUploadCompanyId('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const onDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetDialog();
  };

  // ── upload handler ───────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!title.trim() || !file || !category) return;

    // Quick client-side extension check (API enforces it too)
    const ext = file.name.split('.').pop()?.toUpperCase() ?? '';
    if (!['PDF', 'DOC', 'DOCX', 'XLSX', 'CSV'].includes(ext)) {
      setUploadError('Unsupported file type. Use PDF, DOC, DOCX, XLSX, or CSV.');
      return;
    }

    setSubmitting(true);
    setUploadError('');

    try {
      // Build FormData — the API now reads the actual file bytes
      const fd = new FormData();
      fd.append('file',        file);
      fd.append('title',       title.trim());
      fd.append('category',    category);
      if (description.trim())      fd.append('description',  description.trim());
      // Rakel staff may override the target company; all others pin to their own
      const effectiveCompanyId = uploadCompanyId.trim() || user?.companyId?.trim() || '';
      if (effectiveCompanyId)  fd.append('companyId', effectiveCompanyId);
      if (dateReceived)            fd.append('dateReceived', dateReceived);
      if (expiryDate)              fd.append('expiryDate',   expiryDate);
      reminders.forEach(r =>       fd.append('reminderSettings', r));

      // Do NOT set Content-Type manually — browser sets multipart/form-data with boundary
      const res = await fetch('/api/v1/documents', {
        method:      'POST',
        credentials: 'include',
        body:        fd,
      });

      if (res.ok) {
        setUploadSuccess(true);
        setTimeout(() => { onDialogChange(false); loadDocuments(); }, 900);
      } else {
        const body = await res.json().catch(() => ({}));
        const detail = body.issues
          ? (Object.values(body.issues as Record<string, string[]>).flat()[0] ?? null)
          : null;
        setUploadError(detail ?? body.error ?? 'Upload failed. Please try again.');
      }
    } catch {
      setUploadError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── derived state ────────────────────────────────────────────────────────

  const categories = useMemo(() => [...new Set(documents.map(d => d.category))], [documents]);

  const filtered = useMemo(() => documents.filter(doc => {
    const matchSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat  = categoryFilter === 'all' || doc.category === categoryFilter;
    let   matchDate = true;
    if (dateFilter !== 'all') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(dateFilter));
      matchDate = new Date(doc.uploadedAt) >= cutoff;
    }
    return matchSearch && matchCat && matchDate;
  }), [documents, searchTerm, categoryFilter, dateFilter]);

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documents &amp; Reports</h1>
          <p className="text-muted-foreground">Manage your company documents and reports.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={onDialogChange}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />Upload Document
            </Button>
          </DialogTrigger>

          <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Upload Document</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Add a document record for your company.
              </DialogDescription>
            </DialogHeader>

            {uploadSuccess ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <CheckCircle className="h-14 w-14 text-primary" />
                <p className="text-foreground font-semibold text-lg">Document uploaded successfully!</p>
              </div>
            ) : (
              /* Native HTML only — no Radix field components inside DialogPortal */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>

                {/* Target company — Rakel Investments staff + admins only */}
                {showCompanySelector && companies.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>
                      Upload for Company <span style={{ color: 'red' }}>*</span>
                    </label>
                    <select
                      value={uploadCompanyId}
                      onChange={e => setUploadCompanyId(e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))' }}
                    >
                      <option value="">— Select target company —</option>
                      {companies
                        .filter(c => c.id !== user?.companyId)   // don't show Rakel Investments itself
                        .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <p style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
                      Document will be owned by the selected company, not by Rakel Investments.
                    </p>
                  </div>
                )}

                {/* Title */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>
                    Document Title <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter document title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Description */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Description</label>
                  <textarea
                    placeholder="Brief description (optional)"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>

                {/* Category */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>
                    Category <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value="">Select category</option>
                    {['Contracts Signed', 'Invoice', 'Business Documents', 'Submitted Bidding Documents', 'Past Experiences'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Date Received */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Date Received</label>
                  <input
                    type="date"
                    value={dateReceived}
                    onChange={e => setDateReceived(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Expiry Date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={e => setExpiryDate(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Reminder Settings — shown only when an expiry date is set */}
                {expiryDate && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>
                      Remind me before expiry
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px', border: '1px solid #ccc', borderRadius: '6px', background: '#f9f9f9' }}>
                      {(Object.entries(REMINDER_INTERVAL_LABELS) as [ReminderInterval, string][]).map(([key, label]) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={reminders.includes(key)}
                            onChange={e => {
                              if (e.target.checked) setReminders(prev => [...prev, key]);
                              else setReminders(prev => prev.filter(r => r !== key));
                            }}
                            style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {reminders.length > 0 && (
                      <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                        {reminders.length} reminder{reminders.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                )}

                {/* File */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>
                    File <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="file"
                    name="file"
                    ref={fileRef}
                    accept=".pdf,.doc,.docx,.xlsx,.csv"
                    onChange={e => { setFile(e.target.files?.[0] ?? null); setUploadError(''); }}
                    style={{ fontSize: '14px' }}
                  />
                  {file && (
                    <p style={{ fontSize: '12px', color: '#666' }}>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    </p>
                  )}
                </div>

                {/* Error */}
                {uploadError && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#dc2626', fontSize: '13px', padding: '8px 10px', background: '#fef2f2', borderRadius: '6px' }}>
                    <AlertCircle style={{ width: '14px', height: '14px', flexShrink: 0, marginTop: '1px' }} />
                    {uploadError}
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => onDialogChange(false)}
                    style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', background: 'transparent' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={submitting || !title.trim() || !file || !category}
                    style={{
                      flex: 1, padding: '10px', background: '#2563eb', color: '#fff',
                      border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
                      opacity: (submitting || !title.trim() || !file || !category) ? 0.5 : 1,
                    }}
                  >
                    {submitting ? 'Uploading…' : 'Upload'}
                  </button>
                </div>

              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 bg-input border-border"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px] bg-input border-border">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[150px] bg-input border-border">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Document grid ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {documents.length === 0 ? 'No Documents Yet' : 'No Documents Found'}
            </h3>
            <p className="text-muted-foreground text-sm mt-1">
              {documents.length === 0
                ? 'Upload your first document using the button above.'
                : 'Try adjusting your search or filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <Card key={doc.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    doc.fileType?.toLowerCase() === 'pdf'
                      ? 'bg-chart-4/10 text-chart-4'
                      : 'bg-chart-2/10 text-chart-2'
                  }`}>
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">{doc.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{doc.filename}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                        {doc.category}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                        {doc.fileType}
                      </span>
                    </div>
                  </div>
                </div>
                {doc.description && (
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{doc.description}</p>
                )}
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>By {doc.uploader?.username ?? doc.uploadedBy}</span>
                    <span>{doc.fileSize ? `${(doc.fileSize / 1_000_000).toFixed(1)} MB` : ''}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-border text-foreground hover:bg-muted"
                      onClick={() => setViewDoc(doc)}
                    >
                      <Eye className="h-3 w-3 mr-1" />View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-border text-foreground hover:bg-muted"
                      onClick={() => {
                        if (doc.storageKey) {
                          const a = window.document.createElement('a');
                          a.href = doc.storageKey;
                          a.download = doc.filename;
                          a.click();
                        }
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" />Download
                    </Button>
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border text-muted-foreground hover:text-destructive hover:border-destructive px-2"
                        title="Delete document"
                        onClick={() => handleDelete(doc)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Document view / read modal ──────────────────────────────────────── */}
      <DocumentViewModal
        doc={viewDoc}
        open={viewDoc !== null}
        onClose={() => setViewDoc(null)}
      />
    </div>
  );
}
