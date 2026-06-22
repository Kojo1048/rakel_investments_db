'use client';


import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { FileText, Search, Download, Eye, Filter, FolderOpen } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DocumentViewModal } from '@/components/document-view-modal';
import type { Document, Company } from '@/lib/types';
import { safeGet } from '@/lib/utils/safe-fetch';

export default function CEODocumentsPage() {
  const [documents,  setDocuments]  = useState<Document[]>([]);
  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [companyFilter,  setCompanyFilter]  = useState('all');

  // Shared document viewer — same modal used in Rakel Admin and Company dashboards
  const [viewDoc, setViewDoc] = useState<Document | null>(null);

  useEffect(() => {
    Promise.all([
      safeGet('/api/v1/documents', { documents: [] }),
      safeGet('/api/v1/companies', { companies: [] }),
    ]).then(([dd, cd]) => {
      setDocuments((dd as any).documents ?? []);
      setCompanies((cd as any).companies ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => [...new Set(documents.map(d => d.category))], [documents]);

  const filtered = useMemo(() => documents.filter(doc => {
    const matchSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = categoryFilter === 'all' || doc.category === categoryFilter;
    const matchCo  = companyFilter  === 'all' || doc.companyId === companyFilter;
    return matchSearch && matchCat && matchCo;
  }), [documents, searchTerm, categoryFilter, companyFilter]);

  const handleDownload = async (doc: Document) => {
    if (!doc.storageKey) return;
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}/download`, { credentials: 'include' });
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = window.document.createElement('a');
      a.href = url; a.download = doc.filename; a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Documents &amp; Reports</h1>
        <p className="text-muted-foreground">View all company documents and reports.</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search documents..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-input border-border" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] bg-input border-border"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-[200px] bg-input border-border"><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
            <h3 className="text-lg font-medium text-foreground">No Documents Found</h3>
            <p className="text-muted-foreground">
              {documents.length === 0 ? 'No documents have been uploaded yet.' : 'Try adjusting your search or filters.'}
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
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>{doc.company?.name ?? 'All Companies'}</span>
                    <span>{doc.fileSize ? `${(doc.fileSize / 1_000_000).toFixed(1)} MB` : ''}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 border-border text-foreground hover:bg-muted" onClick={() => setViewDoc(doc)}>
                      <Eye className="h-3 w-3 mr-1" />View
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 border-border text-foreground hover:bg-muted" onClick={() => handleDownload(doc)}>
                      <Download className="h-3 w-3 mr-1" />Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DocumentViewModal doc={viewDoc} open={viewDoc !== null} onClose={() => setViewDoc(null)} />
    </div>
  );
}
