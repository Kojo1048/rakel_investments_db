'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';
import { FileText, Search, Download, Eye, Filter, FolderOpen, Plus, Upload, X, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Document, Company, Service, ReminderInterval } from '@/lib/types';
import { REMINDER_INTERVAL_LABELS } from '@/lib/types';
import { safeGet } from '@/lib/utils/safe-fetch';

export default function AdminDocumentsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [uploadError,  setUploadError]  = useState('');

  const [uploadTitle,       setUploadTitle]       = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategory,    setUploadCategory]    = useState('');
  const [uploadCompanyId,   setUploadCompanyId]   = useState('all');
  const [uploadServiceId,   setUploadServiceId]   = useState('all');
  const [uploadDateReceived, setUploadDateReceived] = useState('');
  const [uploadExpiryDate,   setUploadExpiryDate]   = useState('');
  const [uploadReminders,    setUploadReminders]    = useState<ReminderInterval[]>([]);
  const [uploadFile,        setUploadFile]        = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = () => {
    setLoading(true);
    fetch('/api/v1/documents', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(data => setDocuments(data.documents ?? []))
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocuments();
    Promise.all([
      safeGet('/api/v1/companies', { companies: [] }),
      safeGet('/api/v1/services', { services: [] }),
    ]).then(([c, s]) => {
      setCompanies(c.companies ?? []);
      setServices(s.services ?? []);
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return documents.filter(doc => {
      const matchSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.filename.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCompany = companyFilter === 'all' || doc.companyId === companyFilter;
      let matchDate = true;
      if (dateFilter !== 'all') {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - parseInt(dateFilter));
        matchDate = new Date(doc.uploadedAt) >= cutoff;
      }
      return matchSearch && matchCompany && matchDate;
    });
  }, [documents, searchTerm, companyFilter, dateFilter]);

  if (!mounted) return null;
  const handleUpload = async () => {
    if (!uploadTitle || !uploadFile || !uploadCategory) return;

    // Local const so TypeScript can definitively narrow away null
    // (async functions can confuse the compiler's state-narrowing pass)
    const file = uploadFile;

    const ALLOWED = ['PDF', 'DOC', 'DOCX', 'XLSX', 'CSV'] as const;
    const ext = file.name.split('.').pop()?.toUpperCase() ?? '';
    const fileType = (ALLOWED as readonly string[]).includes(ext)
      ? (ext as typeof ALLOWED[number])
      : null;

    if (!fileType) {
      setUploadError('Unsupported file type. Use PDF, DOC, DOCX, XLSX, or CSV.');
      return;
    }

    setSubmitting(true);
    setUploadError('');

    try {
      const res = await fetch('/api/v1/documents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:            uploadTitle.trim(),
          filename:         file.name,
          fileType,
          fileSize:         file.size,
          category:         uploadCategory,
          description:      uploadDescription.trim()   || undefined,
          companyId:        uploadCompanyId && uploadCompanyId !== 'all' ?uploadCompanyId : undefined,
          serviceId:        uploadServiceId && uploadServiceId!== 'all' ?uploadServiceId: undefined,
          dateReceived:     uploadDateReceived         || undefined,
          expiryDate:       uploadExpiryDate           || undefined,
          reminderSettings: uploadReminders.length > 0 ? uploadReminders : undefined,
        }),
      });

      if (res.ok) {
        setIsUploadOpen(false);
        setUploadTitle(''); setUploadDescription(''); setUploadCategory('');
        setUploadCompanyId(''); setUploadServiceId(''); setUploadFile(null);
        setUploadDateReceived(''); setUploadExpiryDate(''); setUploadReminders([]);
        setUploadError('');
        fetchDocuments();
      } else {
        const data = await res.json().catch(() => ({}));
        const firstIssue = data.issues
          ? Object.values(data.issues as Record<string, string[]>).flat()[0]
          : null;
        setUploadError(firstIssue ?? data.error ?? 'Upload failed. Please try again.');
      }
    } catch {
      setUploadError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documents & Reports</h1>
          <p className="text-muted-foreground">Manage all company documents and reports.</p>
        </div>
        {user?.role !== 'SUPER_ADMIN' && (
        <Link href="/dashboard/documents/upload">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />Upload Document
          </Button>
        </Link>
        )}
        {false && (
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button>hidden</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Upload Document</DialogTitle>
              <DialogDescription className="text-muted-foreground">Upload a new document to the system.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Document Title <span className="text-destructive">*</span></label>
                  <Input placeholder="Enter document title" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} className="bg-input border-border" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Description (Optional)</label>
                  <textarea placeholder="Brief description..." value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} rows={2} className="flex w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Category <span className="text-destructive">*</span></label>
                  <Select value={uploadCategory} onValueChange={setUploadCategory}>
                    <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {['Contracts Signed', 'Invoice', 'Business Documents', 'Submitted Bidding Documents', 'Past Experiences'].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Company (Optional)</label>
                  <Select
                    value={uploadCompanyId || undefined}
                    onValueChange={setUploadCompanyId}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="All Companies (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {companies
                        .filter(c => c.id)
                        .map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Service (Optional)</label>
                  <Select value={uploadServiceId} onValueChange={setUploadServiceId}>
                    <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select service" /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="all">All Services</SelectItem>
                      {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Date Received */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Date Received</label>
                  <input type="date" value={uploadDateReceived} onChange={e => setUploadDateReceived(e.target.value)} className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>

                {/* Expiry Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Expiry Date</label>
                  <input type="date" value={uploadExpiryDate} onChange={e => setUploadExpiryDate(e.target.value)} className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>

                {/* Reminder Settings */}
                {uploadExpiryDate && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-foreground">Remind me before expiry</label>
                    <div className="flex flex-col gap-2 p-3 rounded-md border border-border bg-muted/30">
                      {(Object.entries(REMINDER_INTERVAL_LABELS) as [ReminderInterval, string][]).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={uploadReminders.includes(key)}
                            onChange={e => {
                              if (e.target.checked) {
                                setUploadReminders(prev => [...prev, key]);
                              } else {
                                setUploadReminders(prev => prev.filter(r => r !== key));
                              }
                            }}
                            className="h-4 w-4 cursor-pointer"
                          />
                          <span className="text-foreground">{label}</span>
                        </label>
                      ))}
                    </div>
                    {uploadReminders.length > 0 && (
                      <p className="text-xs text-muted-foreground">{uploadReminders.length} reminder{uploadReminders.length !== 1 ? 's' : ''} selected</p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">File <span className="text-destructive">*</span></label>
                  <input type="file" ref={fileInputRef} accept=".pdf,.doc,.docx,.xlsx,.csv" onChange={e => { setUploadFile(e.target.files?.[0] || null); setUploadError(''); }} className="hidden" />
                  <div role="button" tabIndex={0} onClick={() => fileInputRef.current?.click()} onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()} className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                    {uploadFile ? (
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="text-foreground text-sm truncate max-w-[180px]">{uploadFile.name}</span>
                        <button type="button" className="p-0.5 rounded text-muted-foreground hover:text-foreground" onClick={e => { e.stopPropagation(); setUploadFile(null); setUploadError(''); }}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to select file</p>
                        <p className="text-xs text-muted-foreground">PDF, DOC, DOCX</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {uploadError && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2.5 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {uploadError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 border-border" onClick={() => { setIsUploadOpen(false); setUploadError(''); }}>Cancel</Button>
                <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleUpload} disabled={submitting || !uploadTitle || !uploadFile || !uploadCategory}>
                  {submitting ? <><Spinner className="h-4 w-4 mr-2" />Uploading…</> : 'Upload'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search documents..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-input border-border" />
            </div>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-[180px] bg-input border-border"><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[150px] bg-input border-border"><SelectValue placeholder="Date range" /></SelectTrigger>
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

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">{documents.length === 0 ? 'No Documents Yet' : 'No Documents Found'}</h3>
            <p className="text-muted-foreground">{documents.length === 0 ? 'Upload the first document using the button above.' : 'Try adjusting your search or filters.'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <Card key={doc.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    doc.fileType?.toLowerCase() === 'pdf' ? 'bg-chart-4/10 text-chart-4' : 'bg-chart-2/10 text-chart-2'
                  }`}>
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">{doc.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{doc.filename}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{doc.category}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">{doc.fileType}</span>
                    </div>
                  </div>
                </div>
                {doc.description && <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{doc.description}</p>}
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>{doc.company?.name ?? 'All Companies'}</span>
                    <span>{doc.fileSize ? `${(doc.fileSize / 1000000).toFixed(1)} MB` : ''}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">
                    Uploaded by {doc.uploader?.username ?? doc.uploadedBy} on {new Date(doc.uploadedAt).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 border-border text-foreground hover:bg-muted">
                      <Eye className="h-3 w-3 mr-1" />View
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 border-border text-foreground hover:bg-muted">
                      <Download className="h-3 w-3 mr-1" />Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
