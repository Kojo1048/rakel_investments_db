'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Building2, ChevronRight, FolderOpen,
  AlertCircle, RefreshCw, Plus, CheckCircle,
} from 'lucide-react';
import type { Company, ReminderInterval, Document } from '@/lib/types';
import { REMINDER_INTERVAL_LABELS } from '@/lib/types';
import { safeGet } from '@/lib/utils/safe-fetch';

interface CompanyWithCount extends Company {
  _count?: { documents: number };
}

export default function AdminCompanyDocumentsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const router = useRouter();
  const { user } = useAuth();

  // ── company list ──────────────────────────────────────────────────────────
  const [companies, setCompanies] = useState<CompanyWithCount[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);

  // ── upload dialog (Rakel Admin only) ─────────────────────────────────────
  const [dialogOpen,    setDialogOpen]    = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [uploadError,   setUploadError]   = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [title,         setTitle]         = useState('');
  const [description,   setDescription]   = useState('');
  const [category,      setCategory]      = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [dateReceived,  setDateReceived]  = useState('');
  const [expiryDate,    setExpiryDate]    = useState('');
  const [reminders,     setReminders]     = useState<ReminderInterval[]>([]);
  const [file,          setFile]          = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── fetch companies ───────────────────────────────────────────────────────
  const load = useCallback(() => {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    setLoading(true);
    setError(false);
    Promise.all([
      fetch('/api/v1/companies', { credentials: 'include', signal: ctrl.signal })
        .then(r => r.ok ? r.json() : Promise.reject(r.status)),
      safeGet('/api/v1/documents', { documents: [] }, 8000, 1),
    ])
      .then(([companyData, docData]) => {
        setCompanies(companyData.companies ?? []);
        setDocuments((docData as any).documents ?? []);
      })
      .catch(err => {
        if ((err as { name?: string })?.name !== 'AbortError') setError(true);
        setCompanies([]);
      })
      .finally(() => { clearTimeout(timer); setLoading(false); });
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, []);

  useEffect(() => { load(); }, [load]);

  // Per-company document counts — derived from the same document list already loaded above
  const rows = useMemo(() => companies.map(company => {
    const docs = documents.filter(d => d.companyId === company.id);
    return {
      company,
      total:          docs.length,
      bidding:        docs.filter(d => d.category === 'Submitted Bidding Documents').length,
      contracts:      docs.filter(d => d.category === 'Contracts Signed' || d.category === 'Contracts').length,
      invoices:       docs.filter(d => d.category === 'Invoice' || d.category === 'Invoices').length,
      pastExperience: docs.filter(d => d.category === 'Past Experiences').length,
    };
  }), [companies, documents]);

  if (!mounted) return null;

  // ── upload dialog helpers ─────────────────────────────────────────────────
  const resetDialog = () => {
    setTitle(''); setDescription(''); setCategory('');
    setSelectedCompany(''); setFile(null);
    setDateReceived(''); setExpiryDate(''); setReminders([]);
    setUploadError(''); setUploadSuccess(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetDialog();
  };

  const handleUpload = async () => {
    if (!title.trim() || !file || !category) return;

    // companyId is required for Rakel Admin uploads
    if (!selectedCompany || selectedCompany.trim() === '') {
      setUploadError('Please select a company for this document.');
      return;
    }

    // Quick client-side extension check
    const ext = file.name.split('.').pop()?.toUpperCase() ?? '';
    if (!['PDF', 'DOC', 'DOCX', 'XLSX', 'CSV'].includes(ext)) {
      setUploadError('Unsupported file type. Use PDF, DOC, DOCX, XLSX, or CSV.');
      return;
    }

    setSubmitting(true);
    setUploadError('');

    try {
      // Build FormData — the API reads the actual file bytes
      const fd = new FormData();
      fd.append('file',        file);
      fd.append('title',       title.trim());
      fd.append('category',    category);
      fd.append('companyId',   selectedCompany.trim());     // always required here
      if (description.trim()) fd.append('description',  description.trim());
      if (dateReceived)        fd.append('dateReceived', dateReceived);
      if (expiryDate)          fd.append('expiryDate',   expiryDate);
      reminders.forEach(r =>   fd.append('reminderSettings', r));

      // Do NOT set Content-Type — browser sets multipart/form-data with boundary
      const res = await fetch('/api/v1/documents', {
        method:      'POST',
        credentials: 'include',
        body:        fd,
      });

      if (res.ok) {
        setUploadSuccess(true);
        setTimeout(() => { onDialogChange(false); }, 900);
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

  // ── error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
        <Card className="bg-card border-border">
          <CardContent className="p-10 text-center">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
            <p className="text-foreground font-medium">Could not load companies</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check that the server is running and try again.
            </p>
            <Button className="mt-4" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-2" />Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground">
            Select a company to view and manage its documents.
          </p>
        </div>

        {/* Upload button — Rakel Admin only, not Super Admin */}
        {user?.role === 'RAKEL_ADMIN' && (
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
                  Add a document record to the system.
                </DialogDescription>
              </DialogHeader>

              {uploadSuccess ? (
                <div className="flex flex-col items-center gap-3 py-10">
                  <CheckCircle className="h-14 w-14 text-primary" />
                  <p className="text-foreground font-semibold text-lg">Document uploaded successfully!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>

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

                  {/* Company selector (uses the already-loaded companies list) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Company</label>
                    <select
                      value={selectedCompany}
                      onChange={e => setSelectedCompany(e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                    >
                      <option value="">— None —</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
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

                  {/* Reminder Settings */}
                  {expiryDate && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Remind me before expiry</label>
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

                  {/* Error banner */}
                  {uploadError && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#dc2626', fontSize: '13px', padding: '8px 10px', background: '#fef2f2', borderRadius: '6px' }}>
                      <AlertCircle style={{ width: '14px', height: '14px', flexShrink: 0, marginTop: '1px' }} />
                      {uploadError}
                    </div>
                  )}

                  {/* Action buttons */}
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
                      disabled={submitting || !title.trim() || !file || !category || !selectedCompany}
                      style={{
                        flex: 1, padding: '10px', background: '#2563eb', color: '#fff',
                        border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
                        opacity: (submitting || !title.trim() || !file || !category || !selectedCompany) ? 0.5 : 1,
                      }}
                    >
                      {submitting ? 'Uploading…' : 'Upload'}
                    </button>
                  </div>

                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* ── Company list ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <FolderOpen className="h-14 w-14 mx-auto text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-lg font-medium text-foreground">No Companies Found</h3>
            <p className="text-muted-foreground">No companies are registered in the system.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />All Companies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    {['Company', 'Total Documents', 'Submitted Bidding Documents', 'Signed Contracts', 'Invoices', 'Past Experiences', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ company, total, bidding, contracts, invoices, pastExperience }) => (
                    <tr key={company.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/company-documents/${company.id}`)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${company.colorPrimary ?? '#3b82f6'}20` }}>
                            <Building2 className="h-4 w-4" style={{ color: company.colorPrimary ?? '#3b82f6' }} />
                          </div>
                          <span className="font-medium text-foreground">{company.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground font-semibold">{total}</td>
                      <td className="px-4 py-3"><span className={`font-semibold ${bidding > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{bidding}</span></td>
                      <td className="px-4 py-3"><span className={`font-semibold ${contracts > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{contracts}</span></td>
                      <td className="px-4 py-3"><span className={`font-semibold ${invoices > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{invoices}</span></td>
                      <td className="px-4 py-3"><span className={`font-semibold ${pastExperience > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{pastExperience}</span></td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" className="border-border hover:border-primary/50 gap-1"
                          onClick={e => { e.stopPropagation(); router.push(`/admin/company-documents/${company.id}`); }}>
                          View <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
