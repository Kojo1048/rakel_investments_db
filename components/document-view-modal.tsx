'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  FileText, Download, BookOpen, Building2, Briefcase,
  User, Calendar, Clock, Tag, ArrowLeft, AlertCircle,
  Maximize2, Minimize2,
} from 'lucide-react';
import type { Document } from '@/lib/types';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(val?: Date | string | null): string {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtSize(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FILE_TYPE_COLORS: Record<string, string> = {
  PDF:  'bg-chart-4/10 text-chart-4',
  DOC:  'bg-chart-2/10 text-chart-2',
  DOCX: 'bg-chart-2/10 text-chart-2',
  XLSX: 'bg-primary/10 text-primary',
  CSV:  'bg-chart-3/10 text-chart-3',
};

const IMAGE_TYPES = new Set(['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG']);
const EMBED_TYPES = new Set(['PDF', ...IMAGE_TYPES]);

// ── MetaRow ───────────────────────────────────────────────────────────────────

function MetaRow({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{value || '—'}</p>
      </div>
    </div>
  );
}

// ── Preview panel ─────────────────────────────────────────────────────────────
// Serves files directly from their public /uploads/ path — no fetch needed.

function PreviewPanel({ doc, onBack, onDownload }: {
  doc: Document;
  onBack: () => void;
  onDownload: () => void;
}) {
  const [loadFailed,   setLoadFailed]   = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const previewUrl = `/api/v1/documents/${doc.id}/download`;

  useEffect(() => { setLoadFailed(false); }, [doc.id, doc.storageKey]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  const type     = (doc.fileType ?? '').toUpperCase();
  const canEmbed = Boolean(doc.storageKey) && EMBED_TYPES.has(type);
  const isImage  = IMAGE_TYPES.has(type);

  return (
    <div ref={containerRef} className="flex flex-col gap-3" style={{ minHeight: '75vh' }}>

      {/* Back bar + fullscreen toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to details
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Preview area */}
      <div
        className="flex-1 rounded-lg border border-border overflow-hidden bg-muted/20"
        style={{ minHeight: '80vh' }}
      >
        {!doc.storageKey && (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" style={{ minHeight: '80vh' }}>
            <AlertCircle className="h-10 w-10 text-muted-foreground opacity-60" />
            <p className="text-foreground font-medium">No file attached</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              This document was saved as metadata only. Re-upload to enable preview.
            </p>
          </div>
        )}

        {doc.storageKey && !canEmbed && (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" style={{ minHeight: '80vh' }}>
            <FileText className="h-10 w-10 text-muted-foreground opacity-60" />
            <p className="text-foreground font-medium">{type} files cannot be previewed in the browser</p>
            <p className="text-sm text-muted-foreground">Download the file to open it in its native application.</p>
            <Button variant="outline" size="sm" className="mt-2 border-border" onClick={onDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5" />Download {type}
            </Button>
          </div>
        )}

        {doc.storageKey && canEmbed && loadFailed && (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" style={{ minHeight: '80vh' }}>
            <AlertCircle className="h-10 w-10 text-destructive opacity-70" />
            <p className="text-foreground font-medium">Preview failed</p>
            <p className="text-sm text-muted-foreground max-w-sm">Could not load the file for preview. Use the Download button instead.</p>
            <Button variant="outline" size="sm" className="mt-2 border-border" onClick={onDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5" />Download instead
            </Button>
          </div>
        )}

        {doc.storageKey && canEmbed && !loadFailed && isImage && (
          <div className="flex items-center justify-center p-4" style={{ minHeight: '80vh' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={doc.title}
              className="max-w-full max-h-full object-contain rounded"
              style={{ maxHeight: '78vh' }}
              onError={() => setLoadFailed(true)}
            />
          </div>
        )}

        {doc.storageKey && canEmbed && !loadFailed && !isImage && (
          <iframe
            key={doc.id}
            src={previewUrl}
            title={doc.title}
            className="w-full border-0"
            style={{ height: '80vh' }}
            onError={() => setLoadFailed(true)}
          />
        )}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  doc: Document | null;
  open: boolean;
  onClose: () => void;
}

export function DocumentViewModal({ doc, open, onClose }: Props) {
  const [showPreview,   setShowPreview]   = useState(false);
  const [downloading,   setDownloading]   = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const handleOpenChange = (next: boolean) => {
    if (!next) { setShowPreview(false); setDownloadError(''); onClose(); }
  };

  const handleDownload = async () => {
    if (!doc) return;
    if (!doc.storageKey) { setDownloadError('No file is attached to this document.'); return; }
    setDownloading(true);
    setDownloadError('');
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}/download`, { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDownloadError(body.error ?? 'Download failed. Please try again.');
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = window.document.createElement('a');
      a.href = url; a.download = doc.filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('Network error. Please check your connection.');
    } finally {
      setDownloading(false);
    }
  };

  if (!doc) return null;

  const typeKey   = (doc.fileType ?? '').toUpperCase();
  const typeColor = FILE_TYPE_COLORS[typeKey] ?? 'bg-muted text-muted-foreground';
  const hasFile   = Boolean(doc.storageKey);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Wider + taller: style overrides Radix's built-in sm:max-w-lg class */}
      <DialogContent
        className="bg-card border-border overflow-y-auto"
        style={{
          width:     'min(92vw, 1400px)',
          maxWidth:  'min(92vw, 1400px)',
          maxHeight: '92vh',
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColor}`}>
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-foreground text-base leading-snug truncate">
                {doc.title}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.filename}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 uppercase ${typeColor}`}>
              {typeKey}
            </span>
          </div>
        </DialogHeader>

        {showPreview ? (
          <PreviewPanel
            doc={doc}
            onBack={() => setShowPreview(false)}
            onDownload={handleDownload}
          />
        ) : (
          <>
            {/* Metadata */}
            <div className="mt-2 rounded-lg border border-border bg-muted/10 px-4">
              <MetaRow icon={<FileText className="h-3.5 w-3.5" />} label="Document Title" value={doc.title} />
              <MetaRow icon={<Building2 className="h-3.5 w-3.5" />} label="Company" value={doc.company?.name ?? '—'} />
              {doc.service?.name && (
                <MetaRow icon={<Briefcase className="h-3.5 w-3.5" />} label="Linked Service" value={doc.service.name} />
              )}
              <MetaRow icon={<Tag className="h-3.5 w-3.5" />} label="Category" value={doc.category} />
              <MetaRow
                icon={<User className="h-3.5 w-3.5" />}
                label="Uploaded By"
                value={
                  (doc.uploader as any)?.fullName
                    ? `${(doc.uploader as any).fullName} (${doc.uploader?.username})`
                    : (doc.uploader?.username ?? doc.uploadedBy)
                }
              />
              <MetaRow icon={<Calendar className="h-3.5 w-3.5" />} label="Upload Date" value={fmtDate(doc.uploadedAt)} />
              {doc.dateReceived && (
                <MetaRow icon={<Calendar className="h-3.5 w-3.5" />} label="Date Received" value={fmtDate(doc.dateReceived)} />
              )}
              {doc.expiryDate && (
                <MetaRow
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Expiry Date"
                  value={
                    <span className={new Date(doc.expiryDate) < new Date() ? 'text-destructive font-semibold' : 'text-foreground'}>
                      {fmtDate(doc.expiryDate)}
                      {new Date(doc.expiryDate) < new Date() && ' (Expired)'}
                    </span>
                  }
                />
              )}
              <MetaRow icon={<FileText className="h-3.5 w-3.5" />} label="File Size" value={fmtSize(doc.fileSize)} />
              {doc.description && (
                <MetaRow icon={<FileText className="h-3.5 w-3.5" />} label="Description" value={doc.description} />
              )}
            </div>

            {!hasFile && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2.5">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-chart-3" />
                <span>
                  No file attached. This document was saved as metadata only.
                  Re-upload to enable preview and download.
                </span>
              </div>
            )}

            {downloadError && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {downloadError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!hasFile}
                onClick={() => { setDownloadError(''); setShowPreview(true); }}
              >
                <BookOpen className="h-4 w-4 mr-2" />Read Document
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-border text-foreground hover:bg-muted"
                disabled={!hasFile || downloading}
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                {downloading ? 'Downloading…' : 'Download'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
