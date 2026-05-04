'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, FolderOpen, Search, Building2, Download, Eye, Calendar, Trash2 } from 'lucide-react';
import { DocumentViewModal } from '@/components/document-view-modal';
import { useAuth } from '@/lib/auth-context';
import type { Document, Company } from '@/lib/types';

const FILE_TYPE_COLORS: Record<string, string> = {
  PDF:  'bg-chart-4/10 text-chart-4',
  DOC:  'bg-chart-2/10 text-chart-2',
  DOCX: 'bg-chart-2/10 text-chart-2',
  XLSX: 'bg-primary/10 text-primary',
  CSV:  'bg-chart-3/10 text-chart-3',
};

function fmtSize(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDateTime(val: Date | string) {
  const d = new Date(val);
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function CompanyDocumentsDetailPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'RAKEL_ADMIN';

  const [company, setCompany] = useState<Company | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewDoc, setViewDoc] = useState<Document | null>(null);

  const LIMIT = 100;

  useEffect(() => {
    fetch(`/api/v1/companies/${companyId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { company: null })
      .then(data => setCompany(data.company))
      .catch(() => {});
  }, [companyId]);

  useEffect(() => {
    console.log('[company-documents] fetching for companyId:', companyId, 'page:', page);
    setLoading(true);
    const params = new URLSearchParams({
      companyId,
      limit: String(LIMIT),
      page: String(page),
    });
    fetch(`/api/v1/documents?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { documents: [], total: 0 })
      .then(data => {
        console.log('[company-documents] received', data.total ?? 0, 'docs for company', companyId);
        setDocuments(data.documents ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [companyId, page]);

  const refreshDocuments = () => {
    setLoading(true);
    const params = new URLSearchParams({ companyId, limit: String(LIMIT), page: String(page) });
    fetch(`/api/v1/documents?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { documents: [], total: 0 })
      .then(data => { setDocuments(data.documents ?? []); setTotal(data.total ?? 0); })
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) refreshDocuments();
      else { const b = await res.json().catch(() => ({})); alert(b.error ?? 'Delete failed.'); }
    } catch { alert('Network error.'); }
  };

  const categories = useMemo(
    () => [...new Set(documents.map(d => d.category))].sort(),
    [documents]
  );

  const fileTypes = useMemo(
    () => [...new Set(documents.map(d => d.fileType?.toUpperCase()).filter(Boolean))].sort(),
    [documents]
  );

  const filtered = useMemo(() => documents.filter(doc => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      doc.title.toLowerCase().includes(term) ||
      doc.filename.toLowerCase().includes(term) ||
      (doc.description ?? '').toLowerCase().includes(term) ||
      (doc.uploader?.username ?? doc.uploadedBy ?? '').toLowerCase().includes(term);
    const matchType = fileTypeFilter === 'all' || doc.fileType?.toUpperCase() === fileTypeFilter;
    const matchCat  = categoryFilter === 'all' || doc.category === categoryFilter;
    return matchSearch && matchType && matchCat;
  }), [documents, searchTerm, fileTypeFilter, categoryFilter]);

  const clearFilters = () => { setSearchTerm(''); setFileTypeFilter('all'); setCategoryFilter('all'); };
  const hasFilters = searchTerm || fileTypeFilter !== 'all' || categoryFilter !== 'all';
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="outline"
          size="sm"
          className="border-border text-foreground hover:bg-muted mt-1 flex-shrink-0"
          onClick={() => router.push('/admin/company-documents')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          All Companies
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">
              {company ? company.name : <span className="text-muted-foreground">Loading…</span>}
            </h1>
          </div>
          <p className="text-muted-foreground mt-0.5">
            Documents · {total} {total === 1 ? 'file' : 'files'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, uploader…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 bg-input border-border"
              />
            </div>
            <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
              <SelectTrigger className="w-[140px] bg-input border-border">
                <SelectValue placeholder="File type" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Types</SelectItem>
                {fileTypes.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] bg-input border-border">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
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

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {documents.length === 0 ? 'No Documents Found' : 'No Records Match Filters'}
            </h3>
            <p className="text-muted-foreground">
              {documents.length === 0
                ? 'This company has not uploaded any documents yet.'
                : 'Try adjusting your search or filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                Documents
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {filtered.length} of {documents.length} shown
                {total > LIMIT && ` · ${total} total`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Document Name</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">File Type</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Category</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Size</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Description</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Uploader</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />Upload Date
                      </span>
                    </th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => {
                    const uploaded = fmtDateTime(doc.uploadedAt);
                    const typeKey = doc.fileType?.toUpperCase() ?? '';
                    return (
                      <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`h-8 w-8 rounded flex items-center justify-center flex-shrink-0 ${FILE_TYPE_COLORS[typeKey] ?? 'bg-muted text-muted-foreground'}`}>
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-foreground font-medium text-sm truncate max-w-[200px]">{doc.title}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{doc.filename}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${FILE_TYPE_COLORS[typeKey] ?? 'bg-muted text-muted-foreground'}`}>
                            {doc.fileType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{doc.category}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtSize(doc.fileSize)}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[180px]">
                          <span className="line-clamp-2">{doc.description ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {doc.uploader ? (
                            <div className="text-xs">
                              <div className="font-medium text-foreground">{doc.uploader.username}</div>
                              {(doc.uploader as any).fullName && (
                                <div className="text-muted-foreground">{(doc.uploader as any).fullName}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">{doc.uploadedBy ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-xs">
                            <div className="text-foreground">{uploaded.date}</div>
                            <div className="text-muted-foreground">{uploaded.time}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 border-border text-foreground hover:bg-muted"
                              onClick={() => setViewDoc(doc)}
                            >
                              <Eye className="h-3 w-3 mr-1" />View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 border-border text-foreground hover:bg-muted"
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
                                className="h-7 px-2 border-border text-muted-foreground hover:text-destructive hover:border-destructive"
                                title="Delete"
                                onClick={() => handleDelete(doc)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages} · {total} total documents
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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
