'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { DataTable } from '@/components/data-table';
import { Upload, FileSpreadsheet, FileText, CheckCircle, AlertCircle, Trash2, Download, File } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Service, Document } from '@/lib/types';

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
}

export default function UploadDataPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { user } = useAuth();
  const [selectedService, setSelectedService] = useState<string>('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [uploads, setUploads] = useState<Document[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(true);

  useEffect(() => {
    if (!user?.companyId) return;
    fetch(`/api/v1/companies/${user.companyId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { company: null })
      .then(data => setServices(data.company?.services ?? []))
      .catch(() => {});
    fetch('/api/v1/documents', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(data => setUploads(data.documents ?? []))
      .catch(() => setUploads([]))
      .finally(() => setUploadsLoading(false));
  }, [user?.companyId]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
  }, []);

  if (!mounted) return null;
  const processFiles = (newFiles: File[]) => {
    const valid = newFiles.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ext === 'csv' || ext === 'xlsx' || ext === 'xls';
    });
    setFiles(prev => [...prev, ...valid.map(f => ({
      name: f.name,
      size: f.size,
      type: f.name.split('.').pop()?.toLowerCase() || '',
      status: 'pending' as const,
    }))]);
  };

  const handleUpload = async () => {
    if (!selectedService || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== 'pending') continue;
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));
      await new Promise(resolve => setTimeout(resolve, 800));
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'success' } : f));
    }
    fetch('/api/v1/documents', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(data => setUploads(data.documents ?? []))
      .catch(() => {});
  };

  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload Data</h1>
        <p className="text-muted-foreground">Upload CSV or Excel files to import operational data.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload Files
            </CardTitle>
            <CardDescription className="text-muted-foreground">Supported formats: CSV, XLSX, XLS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Select Service</label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger className="w-full bg-input border-border">
                  <SelectValue placeholder="Choose a service for this upload" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <input type="file" accept=".csv,.xlsx,.xls" multiple onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground font-medium mb-1">Drag and drop files here</p>
              <p className="text-sm text-muted-foreground">or click to browse your files</p>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Selected Files</h4>
                {files.map((file, index) => (
                  <div key={`${file.name}-${file.size}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-3">
                      {file.type === 'csv'
                        ? <FileText className="h-5 w-5 text-chart-2" />
                        : <FileSpreadsheet className="h-5 w-5 text-chart-3" />
                      }
                      <div>
                        <p className="text-sm font-medium text-foreground">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'pending' && (
                        <Button variant="ghost" size="sm" onClick={() => removeFile(index)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {file.status === 'uploading' && <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                      {file.status === 'success' && <CheckCircle className="h-5 w-5 text-primary" />}
                      {file.status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!selectedService || files.filter(f => f.status === 'pending').length === 0 || files.some(f => f.status === 'uploading')}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload {files.filter(f => f.status === 'pending').length} File(s)
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-foreground">Upload Guidelines</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                'Select the service category for your data upload.',
                'Ensure your file is in CSV or Excel format.',
                'Include headers in the first row of your file.',
                'Maximum file size: 10MB per file.',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">{i + 1}</div>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-2">Supported Formats</p>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-chart-2/10 text-chart-2"><FileText className="h-3 w-3 mr-1" />CSV</span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-chart-3/10 text-chart-3"><FileSpreadsheet className="h-3 w-3 mr-1" />XLSX</span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-chart-3/10 text-chart-3"><FileSpreadsheet className="h-3 w-3 mr-1" />XLS</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <File className="h-5 w-5 text-primary" />
            Upload History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {uploadsLoading ? (
            <div className="flex justify-center py-8"><Spinner className="h-6 w-6 text-primary" /></div>
          ) : (
            <DataTable
              data={uploads}
              columns={[
                {
                  key: 'filename',
                  label: 'Filename',
                  render: (u) => (
                    <div className="flex items-center gap-3">
                      {u.filename.endsWith('.csv') ? <FileText className="h-5 w-5 text-chart-2" /> : <FileSpreadsheet className="h-5 w-5 text-chart-3" />}
                      <span className="font-medium text-foreground">{u.filename}</span>
                    </div>
                  ),
                },
                {
                  key: 'category',
                  label: 'Category',
                  render: (u) => <span className="text-muted-foreground">{u.category}</span>,
                },
                {
                  key: 'uploadedBy',
                  label: 'Uploaded By',
                  render: (u) => <span className="text-muted-foreground">{u.uploader?.username ?? u.uploadedBy}</span>,
                },
                {
                  key: 'uploadedAt',
                  label: 'Date',
                  render: (u) => <span className="text-muted-foreground text-sm">{new Date(u.uploadedAt).toLocaleDateString()}</span>,
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: () => (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                      <Download className="h-4 w-4" />
                    </Button>
                  ),
                },
              ]}
              emptyMessage="No uploads found."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
