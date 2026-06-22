'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft, Building2, ClipboardList, Users, Wrench, Activity, TrendingUp, BarChart2,
  Eye, Trash2, Paperclip, Download, FileText,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { Company, OperationsRecord } from '@/lib/types';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-config';
import { safeGet } from '@/lib/utils/safe-fetch';

export default function CEOOperationsDetailPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();

  const [company,    setCompany]   = useState<Company | null>(null);
  const [records,    setRecords]   = useState<OperationsRecord[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [timeRange,  setTimeRange] = useState('90');
  const [viewEntry,       setViewEntry]       = useState<OperationsRecord | null>(null);
  const [entryDoc,        setEntryDoc]        = useState<any | null>(null);
  const [entryDocLoading, setEntryDocLoading] = useState(false);
  const [docDownloading,  setDocDownloading]  = useState(false);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      safeGet(`/api/v1/companies/${companyId}`,              { company: null }),
      safeGet(`/api/v1/operations?companyId=${companyId}&days=${timeRange}`, { records: [] }),
    ]).then(([cd, od]) => {
      setCompany((cd as any).company ?? null);
      setRecords((od as any).records ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId, timeRange]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this operations entry? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/v1/operations/${id}`, { method: 'DELETE', credentials: 'include' });
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  // Fetch attached document when View modal opens
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

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const summary = useMemo(() => ({
    totalEntries: records.length,
    avgManpower: records.length > 0
      ? Math.round(records.reduce((s, r) => s + r.manpowerCount, 0) / records.length) : 0,
    avgPerformance: records.length > 0
      ? Math.round(records.reduce((s, r) => s + r.performanceScore, 0) / records.length) : 0,
    avgEquipmentUtil: (() => {
      const withEq = records.filter(r => r.equipmentTotal > 0);
      return withEq.length > 0
        ? Math.round(withEq.reduce((s, r) => s + (r.equipmentOperational / r.equipmentTotal) * 100, 0) / withEq.length)
        : 0;
    })(),
  }), [records]);

  // ── Charts ────────────────────────────────────────────────────────────────
  const manpowerTrend = useMemo(() => {
    const g: Record<string, { date: string; manpower: number; performance: number; count: number }> = {};
    records.forEach(r => {
      const k = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!g[k]) g[k] = { date: k, manpower: 0, performance: 0, count: 0 };
      g[k].manpower += r.manpowerCount;
      g[k].performance += r.performanceScore;
      g[k].count += 1;
    });
    return Object.values(g)
      .map(d => ({ date: d.date, manpower: d.manpower, performance: Math.round(d.performance / d.count) }))
      .reverse();
  }, [records]);

  const equipmentTrend = useMemo(() => {
    const g: Record<string, { date: string; total: number; operational: number }> = {};
    records.filter(r => r.equipmentTotal > 0).forEach(r => {
      const k = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!g[k]) g[k] = { date: k, total: 0, operational: 0 };
      g[k].total += r.equipmentTotal;
      g[k].operational += r.equipmentOperational;
    });
    return Object.values(g)
      .map(d => ({ date: d.date, utilization: d.total > 0 ? Math.round((d.operational / d.total) * 100) : 0 }))
      .reverse();
  }, [records]);

  const activityFreq = useMemo(() => {
    const freq: Record<string, number> = {};
    records.forEach(r => { freq[r.activityType] = (freq[r.activityType] ?? 0) + 1; });
    return Object.entries(freq)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [records]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/ceo/operations')}
          >
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${company?.colorPrimary ?? '#3b82f6'}20` }}
          >
            <Building2 className="h-5 w-5" style={{ color: company?.colorPrimary ?? '#3b82f6' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{company?.name ?? 'Company'}</h1>
            <p className="text-muted-foreground text-sm">Operations Analytics</p>
          </div>
        </div>

        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[150px] bg-input border-border">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
            <SelectItem value="3650">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Entries',      value: summary.totalEntries.toString(),     icon: <ClipboardList className="h-5 w-5 text-primary" />,  bg: 'bg-primary/10' },
          { label: 'Avg Manpower / Day', value: summary.avgManpower.toString(),      icon: <Users         className="h-5 w-5 text-chart-2" />,  bg: 'bg-chart-2/10' },
          { label: 'Equip. Utilization', value: `${summary.avgEquipmentUtil}%`,      icon: <Wrench        className="h-5 w-5 text-chart-3" />,  bg: 'bg-chart-3/10' },
          { label: 'Avg Performance',    value: `${summary.avgPerformance}%`,        icon: <Activity      className="h-5 w-5 text-chart-4" />,  bg: 'bg-chart-4/10' },
        ].map(({ label, value, icon, bg }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${bg} flex items-center justify-center`}>{icon}</div>
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {records.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <BarChart2 className="h-14 w-14 mx-auto text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-lg font-medium text-foreground">No Operations Data</h3>
            <p className="text-muted-foreground">No operational records found for this company in the selected period.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Charts ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Manpower Trend */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />Manpower Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={manpowerTrend}>
                    <defs>
                      <linearGradient id="ceoManpower" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(200,60%,50%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(200,60%,50%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="manpower" name="Manpower" stroke="hsl(200,60%,50%)" fillOpacity={1} fill="url(#ceoManpower)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Trend */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />Performance Trend
                </CardTitle>
              </CardHeader>
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

            {/* Equipment Utilization */}
            {equipmentTrend.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" />Equipment Utilization
                  </CardTitle>
                </CardHeader>
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

            {/* Activity Frequency */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />Activity Frequency
                </CardTitle>
              </CardHeader>
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

          {/* ── Recent entries table ───────────────────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />Recent Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Date', 'Department', 'Activity', 'Manpower', 'Equipment', 'Performance', 'Actions'].map(h => (
                        <th key={h} className="text-left p-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 20).map(r => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-foreground whitespace-nowrap">
                          {new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="p-3 text-foreground">{r.department}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
                            {r.activityType}
                          </span>
                        </td>
                        <td className="p-3 text-foreground">{r.manpowerCount}</td>
                        <td className="p-3 text-muted-foreground">
                          {r.equipmentTotal > 0 ? `${r.equipmentOperational}/${r.equipmentTotal}` : '—'}
                        </td>
                        <td className="p-3">
                          <span className={`font-semibold ${r.performanceScore >= 80 ? 'text-primary' : r.performanceScore >= 60 ? 'text-chart-3' : 'text-destructive'}`}>
                            {r.performanceScore}%
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="View" onClick={() => setViewEntry(r)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" title="Delete"
                              disabled={deletingId === r.id} onClick={() => handleDelete(r.id)}>
                              {deletingId === r.id ? <Spinner className="h-3 w-3" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {records.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center mt-3 pb-2">
                    Showing 20 of {records.length} entries
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── View Entry dialog ────────────────────────────────────────────── */}
      <Dialog open={!!viewEntry} onOpenChange={open => { if (!open) setViewEntry(null); }}>
        <DialogContent className="bg-card border-border w-full max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-foreground">Operations Entry</DialogTitle>
            <DialogDescription className="text-muted-foreground truncate">
              {viewEntry && new Date(viewEntry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} — {viewEntry?.activityType}
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable body — header stays pinned */}
          <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-1">
            {viewEntry && (
              <div className="rounded-lg border border-border divide-y divide-border/50 overflow-hidden">
                {([
                  ['Date',        new Date(viewEntry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
                  ['Activity',    viewEntry.activityType],
                  ['Department',  viewEntry.department],
                  ['Description', viewEntry.activityDescription ?? '—'],
                  ['Manpower',    viewEntry.manpowerCount.toString()],
                  ['Equipment',   viewEntry.equipmentTotal > 0 ? `${viewEntry.equipmentOperational} / ${viewEntry.equipmentTotal} operational` : '—'],
                  ['Performance', `${viewEntry.performanceScore}%`],
                  ['Notes',       viewEntry.notes ?? '—'],
                  ['Logged By',   viewEntry.recorder?.username ?? viewEntry.recordedBy],
                ] as [string, string][]).map(([label, value]) => (
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
