'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft, Building2, ClipboardList, Users, Wrench, Activity,
  TrendingUp, BarChart2, Plus, Upload, Eye, Trash2, Paperclip, Download, FileText,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { Company, OperationsRecord } from '@/lib/types';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-config';
import { safeGet } from '@/lib/utils/safe-fetch';

const ACTIVITY_TYPES = ['Excavation','Concreting','Welding','Installation','Inspection','Maintenance','Survey','Delivery','Assembly','Testing','Other'];
const DEPARTMENTS    = ['Engineering','Construction','Logistics','Maintenance','Quality Control','Health & Safety','Administration','Procurement','Site Operations','Other'];

const EMPTY_FORM = {
  date:                 new Date().toISOString().split('T')[0],
  department:           '',
  activityType:         '',
  activityDescription:  '',
  manpowerCount:        '',
  equipmentTotal:       '',
  equipmentOperational: '',
  performanceScore:     '',
  notes:                '',
};

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RakelOperationsDetailPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();

  const [company,    setCompany]    = useState<Company | null>(null);
  const [records,    setRecords]    = useState<OperationsRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [timeRange,  setTimeRange]  = useState('90');

  // Log Entry form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // View modal + attached document
  const [viewEntry,       setViewEntry]       = useState<OperationsRecord | null>(null);
  const [entryDoc,        setEntryDoc]        = useState<any | null>(null);
  const [entryDocLoading, setEntryDocLoading] = useState(false);
  const [docDownloading,  setDocDownloading]  = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = () => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      safeGet(`/api/v1/companies/${companyId}`,                          { company: null }),
      safeGet(`/api/v1/operations?companyId=${companyId}&days=${timeRange}`, { records: [] }),
    ]).then(([cd, od]) => {
      setCompany((cd as any).company ?? null);
      setRecords((od as any).records ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [companyId, timeRange]);

  // Fetch attached document whenever the View modal opens
  useEffect(() => {
    if (!viewEntry) { setEntryDoc(null); return; }
    setEntryDocLoading(true);
    const params = new URLSearchParams({ category: 'Operations', limit: '20' });
    params.set('companyId', viewEntry.companyId);
    fetch(`/api/v1/documents?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(d => {
        const docs: any[] = d.documents ?? [];
        const match = docs.find(doc =>
          doc.title === viewEntry.activityType ||
          doc.title?.toLowerCase().includes(viewEntry.activityType.toLowerCase())
        ) ?? docs[0] ?? null;
        setEntryDoc(match);
      })
      .catch(() => setEntryDoc(null))
      .finally(() => setEntryDocLoading(false));
  }, [viewEntry]);

  const handleViewDoc = async (doc: any) => {
    const res = await fetch(`/api/v1/documents/${doc.id}/download`, { credentials: 'include' });
    if (!res.ok) return;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

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

  // ── Log Entry submit ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!form.activityType)    missing.push('Activity Type');
    if (!form.department)      missing.push('Department');
    if (!form.manpowerCount)   missing.push('Manpower Count');
    if (!form.equipmentTotal)  missing.push('Equipment Total');
    if (!form.equipmentOperational) missing.push('Operational Status (Equipment Operational)');
    if (!form.performanceScore) missing.push('Performance Score');
    if (!form.notes.trim())    missing.push('Notes');
    if (!attachFile)           missing.push('Operations File');
    if (missing.length > 0) {
      setSubmitError(`Required fields missing: ${missing.join(', ')}.`);
      return;
    }
    setSubmitting(true); setSubmitError('');
    try {
      if (attachFile) {
        const fd = new FormData();
        fd.append('file', attachFile); fd.append('title', form.activityType);
        fd.append('category', 'Operations'); fd.append('companyId', companyId);
        await fetch('/api/v1/documents', { method: 'POST', credentials: 'include', body: fd });
      }
      const res = await fetch('/api/v1/operations', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          date: form.date, department: form.department,
          activityType: form.activityType,
          activityDescription: form.activityDescription || undefined,
          manpowerCount: parseInt(form.manpowerCount),
          equipmentTotal: parseInt(form.equipmentTotal) || 0,
          equipmentOperational: parseInt(form.equipmentOperational) || 0,
          performanceScore: parseFloat(form.performanceScore),
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); setSubmitError(d.error || 'Failed'); return; }
      setIsFormOpen(false); setForm(EMPTY_FORM); setAttachFile(null);
      if (fileRef.current) fileRef.current.value = '';
      loadData();
    } catch (err) { setSubmitError(err instanceof Error ? err.message : 'Network error'); }
    finally { setSubmitting(false); }
  };

  // ── Delete entry ──────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this operations entry? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/v1/operations/${id}`, { method: 'DELETE', credentials: 'include' });
      loadData();
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  // ── Analytics ─────────────────────────────────────────────────────────────
  const summary = useMemo(() => ({
    totalEntries:     records.length,
    avgManpower:      records.length > 0 ? Math.round(records.reduce((s, r) => s + r.manpowerCount, 0) / records.length) : 0,
    avgPerformance:   records.length > 0 ? Math.round(records.reduce((s, r) => s + r.performanceScore, 0) / records.length) : 0,
    avgEquipmentUtil: (() => {
      const w = records.filter(r => r.equipmentTotal > 0);
      return w.length > 0 ? Math.round(w.reduce((s, r) => s + (r.equipmentOperational / r.equipmentTotal) * 100, 0) / w.length) : 0;
    })(),
  }), [records]);

  const manpowerTrend = useMemo(() => {
    const g: Record<string, { date: string; manpower: number; performance: number; count: number }> = {};
    records.forEach(r => {
      const k = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!g[k]) g[k] = { date: k, manpower: 0, performance: 0, count: 0 };
      g[k].manpower += r.manpowerCount; g[k].performance += r.performanceScore; g[k].count += 1;
    });
    return Object.values(g).map(d => ({ date: d.date, manpower: d.manpower, performance: Math.round(d.performance / d.count) })).reverse();
  }, [records]);

  const equipmentTrend = useMemo(() => {
    const g: Record<string, { date: string; total: number; operational: number }> = {};
    records.filter(r => r.equipmentTotal > 0).forEach(r => {
      const k = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!g[k]) g[k] = { date: k, total: 0, operational: 0 };
      g[k].total += r.equipmentTotal; g[k].operational += r.equipmentOperational;
    });
    return Object.values(g).map(d => ({ date: d.date, utilization: d.total > 0 ? Math.round((d.operational / d.total) * 100) : 0 })).reverse();
  }, [records]);

  const activityFreq = useMemo(() => {
    const freq: Record<string, number> = {};
    records.forEach(r => { freq[r.activityType] = (freq[r.activityType] ?? 0) + 1; });
    return Object.entries(freq).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [records]);

  if (loading) return <div className="min-h-[50vh] flex items-center justify-center"><Spinner className="h-8 w-8 text-primary" /></div>;

  const fld = (label: string, children: React.ReactNode, required = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '14px', fontWeight: 500 }}>{label}{required && <span style={{ color: 'red' }}> *</span>}</label>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/rakel/operations')}>
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
          <div className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${company?.colorPrimary ?? '#3b82f6'}20` }}>
            <Building2 className="h-5 w-5" style={{ color: company?.colorPrimary ?? '#3b82f6' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{company?.name ?? 'Company'}</h1>
            <p className="text-muted-foreground text-sm">Operations Analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px] bg-input border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
              <SelectItem value="3650">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            onClick={() => { setForm(EMPTY_FORM); setSubmitError(''); setIsFormOpen(true); }}>
            <Plus className="h-4 w-4" />Log Entry
          </Button>
        </div>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Entries',      value: summary.totalEntries.toString(),  icon: <ClipboardList className="h-5 w-5 text-primary" />,  bg: 'bg-primary/10' },
          { label: 'Avg Manpower / Day', value: summary.avgManpower.toString(),   icon: <Users         className="h-5 w-5 text-chart-2" />,  bg: 'bg-chart-2/10' },
          { label: 'Equip. Utilization', value: `${summary.avgEquipmentUtil}%`,   icon: <Wrench        className="h-5 w-5 text-chart-3" />,  bg: 'bg-chart-3/10' },
          { label: 'Avg Performance',    value: `${summary.avgPerformance}%`,     icon: <Activity      className="h-5 w-5 text-chart-4" />,  bg: 'bg-chart-4/10' },
        ].map(({ label, value, icon, bg }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${bg} flex items-center justify-center`}>{icon}</div>
              <div><p className="text-2xl font-bold text-foreground">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {records.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <BarChart2 className="h-14 w-14 mx-auto text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-lg font-medium text-foreground">No Operations Data</h3>
            <p className="text-muted-foreground">Use "Log Entry" to record the first operational entry for this company.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Manpower Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={manpowerTrend}>
                    <defs>
                      <linearGradient id="rakelManpower" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(200,60%,50%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(200,60%,50%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="manpower" name="Manpower" stroke="hsl(200,60%,50%)" fillOpacity={1} fill="url(#rakelManpower)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Performance Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={manpowerTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'Performance']} />
                    <Line type="monotone" dataKey="performance" name="Performance" stroke="hsl(30,70%,50%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {equipmentTrend.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Wrench className="h-5 w-5 text-primary" />Equipment Utilization</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={equipmentTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'Utilization']} />
                      <Bar dataKey="utilization" name="Utilization %" fill="hsl(160,60%,45%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Activity Frequency</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={activityFreq} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={90} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Entries" fill="hsl(80,60%,45%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* ── Recent Entries table with actions ─────────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Recent Entries</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Date', 'Department', 'Activity', 'Manpower', 'Equipment', 'Performance', 'Logged By', 'Actions'].map(h => (
                        <th key={h} className="text-left p-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 20).map(r => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-foreground whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="p-3 text-foreground">{r.department}</td>
                        <td className="p-3"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">{r.activityType}</span></td>
                        <td className="p-3 text-foreground">{r.manpowerCount}</td>
                        <td className="p-3 text-muted-foreground">{r.equipmentTotal > 0 ? `${r.equipmentOperational}/${r.equipmentTotal}` : '—'}</td>
                        <td className="p-3">
                          <span className={`font-semibold ${r.performanceScore >= 80 ? 'text-primary' : r.performanceScore >= 60 ? 'text-chart-3' : 'text-destructive'}`}>
                            {r.performanceScore}%
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{r.recorder?.username ?? r.recordedBy}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="View" onClick={() => setViewEntry(r)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" title="Delete"
                              disabled={deletingId === r.id}
                              onClick={() => handleDelete(r.id)}>
                              {deletingId === r.id ? <Spinner className="h-3 w-3" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {records.length > 20 && <p className="text-xs text-muted-foreground text-center mt-3 pb-2">Showing 20 of {records.length} entries</p>}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Log Entry dialog ─────────────────────────────────────────────── */}
      <Dialog open={isFormOpen} onOpenChange={open => { if (!open) { setIsFormOpen(false); setAttachFile(null); setSubmitError(''); } }}>
        <DialogContent className="bg-card border-border w-full max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-foreground">Log Operational Entry</DialogTitle>
            <DialogDescription className="text-muted-foreground">Recording for: <strong>{company?.name}</strong></DialogDescription>
          </DialogHeader>
          {/* Scrollable form body — isolated from the DialogContent so the header stays pinned */}
          <div className="max-h-[75vh] overflow-y-auto pr-1 space-y-4 pt-2">
            {fld('Activity Type',
              <Select value={form.activityType} onValueChange={v => setForm(p => ({ ...p, activityType: v }))}>
                <SelectTrigger className="bg-input border-border w-full"><SelectValue placeholder="Select activity" /></SelectTrigger>
                <SelectContent className="bg-popover border-border">{ACTIVITY_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>, true)}

            {fld('Description',
              <Textarea placeholder="Brief description…" value={form.activityDescription}
                onChange={e => setForm(p => ({ ...p, activityDescription: e.target.value }))}
                className="bg-input border-border w-full resize-none" rows={2} />)}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                {fld('Department',
                  <Select value={form.department} onValueChange={v => setForm(p => ({ ...p, department: v }))}>
                    <SelectTrigger className="bg-input border-border w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>, true)}
              </div>
              <div className="min-w-0">
                {fld('Date',
                  <input type="date" value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full min-w-0 px-3 py-2 text-sm rounded-md border border-border bg-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />)}
              </div>
            </div>

            {fld('Manpower Count',
              <Input type="number" min="0" placeholder="Number of workers" value={form.manpowerCount}
                onChange={e => setForm(p => ({ ...p, manpowerCount: e.target.value }))}
                className="bg-input border-border w-full" />, true)}

            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                {fld('Equipment Total',
                  <Input type="number" min="0" placeholder="0" value={form.equipmentTotal}
                    onChange={e => setForm(p => ({ ...p, equipmentTotal: e.target.value }))}
                    className="bg-input border-border w-full min-w-0" />)}
              </div>
              <div className="min-w-0">
                {fld('Operational',
                  <Input type="number" min="0" placeholder="0" value={form.equipmentOperational}
                    onChange={e => setForm(p => ({ ...p, equipmentOperational: e.target.value }))}
                    className="bg-input border-border w-full min-w-0" />)}
              </div>
            </div>

            {fld('Performance Score (0–100)',
              <Input type="number" min="0" max="100" placeholder="e.g. 85" value={form.performanceScore}
                onChange={e => setForm(p => ({ ...p, performanceScore: e.target.value }))}
                className="bg-input border-border w-full" />, true)}

            {fld('Notes',
              <Textarea placeholder="Operational notes (required)…" value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="bg-input border-border w-full resize-none" rows={2} />, true)}

            {fld('Operations File',
              <div className="space-y-1">
                <input type="file" ref={fileRef} accept=".pdf,.doc,.docx,.xlsx,.csv"
                  onChange={e => setAttachFile(e.target.files?.[0] ?? null)}
                  className="text-sm w-full" />
                {attachFile && (
                  <p className="text-xs text-muted-foreground truncate">
                    <Upload className="h-3 w-3 inline mr-1" />{attachFile.name}
                  </p>
                )}
              </div>)}

            {submitError && <p className="text-sm text-destructive break-words">{submitError}</p>}

            <div className="flex gap-2 pt-2 pb-1">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleSubmit}
                disabled={submitting || !form.activityType || !form.department || !form.manpowerCount || !form.equipmentTotal || !form.equipmentOperational || !form.performanceScore || !form.notes.trim() || !attachFile}>
                {submitting ? <Spinner className="h-4 w-4" /> : 'Save Entry'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── View Entry dialog ────────────────────────────────────────────── */}
      <Dialog open={!!viewEntry} onOpenChange={open => { if (!open) setViewEntry(null); }}>
        <DialogContent className="bg-card border-border w-full max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-foreground">Operations Entry</DialogTitle>
            <DialogDescription className="text-muted-foreground truncate">
              {viewEntry && fmtDate(viewEntry.date)} — {viewEntry?.activityType}
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable body — header stays pinned */}
          <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-1">
            {viewEntry && (
              <div className="rounded-lg border border-border divide-y divide-border/50 overflow-hidden">
                {[
                  ['Date',        fmtDate(viewEntry.date)],
                  ['Activity',    viewEntry.activityType],
                  ['Department',  viewEntry.department],
                  ['Description', viewEntry.activityDescription ?? '—'],
                  ['Manpower',    viewEntry.manpowerCount.toString()],
                  ['Equipment',   viewEntry.equipmentTotal > 0 ? `${viewEntry.equipmentOperational} / ${viewEntry.equipmentTotal} operational` : '—'],
                  ['Performance', `${viewEntry.performanceScore}%`],
                  ['Notes',       viewEntry.notes ?? '—'],
                  ['Logged By',   viewEntry.recorder?.username ?? viewEntry.recordedBy],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start gap-3 px-4 py-2.5 min-w-0">
                    <p className="text-xs text-muted-foreground w-24 flex-shrink-0 mt-0.5">{label}</p>
                    <p className="text-sm text-foreground flex-1 min-w-0 break-words whitespace-normal">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Document Actions ── */}
            <div className="rounded-lg border border-border p-4 space-y-3 overflow-hidden">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />Document Actions
              </p>
              {entryDocLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-3.5 w-3.5 animate-spin flex-shrink-0" />Looking for attachment…
                </div>
              ) : entryDoc ? (
                <div className="space-y-2 min-w-0">
                  {/* Filename row — min-w-0 on parent enables truncate on child */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                    <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate min-w-0 flex-1">{entryDoc.filename}</span>
                    <span className="flex-shrink-0 uppercase text-[10px] bg-muted px-1.5 py-0.5 rounded">{entryDoc.fileType}</span>
                  </div>
                  {/* Action buttons — flex-wrap so they reflow on narrow screens */}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="flex-1 shrink-0 border-border gap-1.5 text-xs"
                      onClick={() => handleViewDoc(entryDoc)}>
                      <Eye className="h-3.5 w-3.5" />View Document
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 shrink-0 border-border gap-1.5 text-xs"
                      onClick={() => handleDownloadDoc(entryDoc)} disabled={docDownloading}>
                      {docDownloading ? <Spinner className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                      Download
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No document attached to this entry.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
