'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Legend,
} from 'recharts';
import {
  Plus, Activity, Users, Wrench, TrendingUp, ClipboardList, BarChart2, Upload,
} from 'lucide-react';
import type { OperationsRecord, Contract, Company } from '@/lib/types';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-config';
import { canSelectAnyCompany } from '@/lib/utils/rakel-staff';
import { safeGet } from '@/lib/utils/safe-fetch';

const ACTIVITY_TYPES = [
  'Excavation', 'Concreting', 'Welding', 'Installation', 'Inspection',
  'Maintenance', 'Survey', 'Delivery', 'Assembly', 'Testing', 'Other',
];

const DEPARTMENTS = [
  'Engineering', 'Construction', 'Logistics', 'Maintenance', 'Quality Control',
  'Health & Safety', 'Administration', 'Procurement', 'Site Operations', 'Other',
];

export default function OperationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    }>
      <OperationsPageInner />
    </Suspense>
  );
}

function OperationsPageInner() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [records,   setRecords]   = useState<OperationsRecord[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Auto-open the form when navigated here with ?new=true (e.g. from admin quick-action button)
  useEffect(() => {
    if (searchParams.get('new') === 'true') setIsFormOpen(true);
  }, [searchParams]);
  const [timeRange,  setTimeRange]  = useState('30');
  const [submitError, setSubmitError] = useState('');

  // File attachment
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    department: '',
    manpowerCount: '',
    equipmentTotal: '',
    equipmentOperational: '',
    activityType: '',
    activityDescription: '',
    performanceScore: '',
    contractId: '',
    companyId: '',
    notes: '',
  });

  // Reuses /api/v1/documents upload endpoint (same as Documents / Invoices / Contracts pages)
  const uploadAttachment = async (file: File, title: string, companyId?: string) => {
    const fd = new FormData();
    fd.append('file',     file);
    fd.append('title',    title);
    fd.append('category', 'Operations');
    if (companyId) fd.append('companyId', companyId);
    const res = await fetch('/api/v1/documents', { method: 'POST', credentials: 'include', body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'File upload failed');
    }
    return res.json();
  };

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      safeGet(`/api/v1/operations?days=${timeRange}`, { records: [] }),
      safeGet('/api/v1/contracts',  { contracts: [] }),
      safeGet('/api/v1/companies',  { companies: [] }),
    ]).then(([od, cd, cod]) => {
      setRecords((od as any).records   ?? []);
      setContracts((cd as any).contracts ?? []);
      setCompanies((cod as any).companies ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [user?.companyId, timeRange]);

  if (!mounted) return null;
  const handleSubmit = async () => {
    if (!form.department || !form.manpowerCount || !form.activityType || !form.performanceScore) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const companyId = form.companyId || user?.companyId || undefined;

      // Upload supporting document first (reuses document system)
      if (attachFile) {
        await uploadAttachment(attachFile, form.activityType || 'Operations Entry', companyId);
      }

      const res = await fetch('/api/v1/operations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:                 form.date,
          department:           form.department,
          manpowerCount:        parseInt(form.manpowerCount),
          equipmentTotal:       parseInt(form.equipmentTotal) || 0,
          equipmentOperational: parseInt(form.equipmentOperational) || 0,
          activityType:         form.activityType,
          activityDescription:  form.activityDescription || undefined,
          performanceScore:     parseFloat(form.performanceScore),
          contractId:           form.contractId || undefined,
          notes:                form.notes      || undefined,
          companyId,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSubmitError(d.error || 'Failed to save entry');
        return;
      }
      setIsFormOpen(false);
      setForm({
        date: new Date().toISOString().split('T')[0],
        department: '', manpowerCount: '', equipmentTotal: '',
        equipmentOperational: '', activityType: '', activityDescription: '',
        performanceScore: '', contractId: '', companyId: '', notes: '',
      });
      setAttachFile(null);
      if (fileRef.current) fileRef.current.value = '';
      fetchData();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Analytics computations ───────────────────────────────────────────
  const summary = useMemo(() => ({
    totalEntries: records.length,
    avgManpower: records.length > 0
      ? Math.round(records.reduce((s, r) => s + r.manpowerCount, 0) / records.length) : 0,
    avgPerformance: records.length > 0
      ? Math.round(records.reduce((s, r) => s + r.performanceScore, 0) / records.length) : 0,
    avgEquipmentUtil: records.length > 0
      ? Math.round(records
          .filter(r => r.equipmentTotal > 0)
          .reduce((s, r) => s + (r.equipmentOperational / r.equipmentTotal) * 100, 0) /
          Math.max(records.filter(r => r.equipmentTotal > 0).length, 1)) : 0,
  }), [records]);

  // Manpower trend over time (grouped by date)
  const manpowerTrend = useMemo(() => {
    const grouped: Record<string, { date: string; manpower: number; performance: number; count: number }> = {};
    records.forEach(r => {
      const key = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!grouped[key]) grouped[key] = { date: key, manpower: 0, performance: 0, count: 0 };
      grouped[key].manpower += r.manpowerCount;
      grouped[key].performance += r.performanceScore;
      grouped[key].count += 1;
    });
    return Object.values(grouped).map(d => ({
      date: d.date,
      manpower: d.manpower,
      performance: Math.round(d.performance / d.count),
    })).reverse();
  }, [records]);

  // Equipment utilization trend
  const equipmentTrend = useMemo(() => {
    const grouped: Record<string, { date: string; total: number; operational: number }> = {};
    records.filter(r => r.equipmentTotal > 0).forEach(r => {
      const key = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!grouped[key]) grouped[key] = { date: key, total: 0, operational: 0 };
      grouped[key].total += r.equipmentTotal;
      grouped[key].operational += r.equipmentOperational;
    });
    return Object.values(grouped).map(d => ({
      date: d.date,
      utilization: d.total > 0 ? Math.round((d.operational / d.total) * 100) : 0,
      total: d.total,
      operational: d.operational,
    })).reverse();
  }, [records]);

  // Activity frequency
  const activityFreq = useMemo(() => {
    const freq: Record<string, number> = {};
    records.forEach(r => { freq[r.activityType] = (freq[r.activityType] ?? 0) + 1; });
    return Object.entries(freq)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [records]);

  // Workload by department
  const deptWorkload = useMemo(() => {
    const dept: Record<string, { manpower: number; entries: number }> = {};
    records.forEach(r => {
      if (!dept[r.department]) dept[r.department] = { manpower: 0, entries: 0 };
      dept[r.department].manpower += r.manpowerCount;
      dept[r.department].entries += 1;
    });
    return Object.entries(dept)
      .map(([name, v]) => ({ name, manpower: v.manpower, entries: v.entries }))
      .sort((a, b) => b.manpower - a.manpower);
  }, [records]);

  const canWrite            = user?.role === 'COMPANY_ADMIN' || user?.role === 'STAFF' || user?.role === 'RAKEL_ADMIN';
  const showCompanySelector = canSelectAnyCompany(user);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Operations</h1>
          <p className="text-muted-foreground">Daily operational data and live performance analytics.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px] bg-input border-border">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
              <SelectItem value="3650">All time</SelectItem>
            </SelectContent>
          </Select>
          {canWrite && (
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />Log Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Log Operational Entry</DialogTitle>
                  <DialogDescription className="text-muted-foreground">Record daily operational data for your company.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">

                  {/* 1 — Activity Type (title) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Activity Type <span style={{ color: 'red' }}>*</span></label>
                    <Select value={form.activityType} onValueChange={v => setForm(f => ({ ...f, activityType: v }))}>
                      <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select activity" /></SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {ACTIVITY_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 2 — Activity Description */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Activity Description (Optional)</label>
                    <Textarea placeholder="Brief description of activities performed..." value={form.activityDescription} onChange={e => setForm(f => ({ ...f, activityDescription: e.target.value }))} className="bg-input border-border" rows={2} />
                  </div>

                  {/* 3 — Select Company (new) */}
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

                  {/* 4 — Attach supporting document (new) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Attach Supporting Document (Optional)</label>
                    <input type="file" ref={fileRef} accept=".pdf,.doc,.docx,.xlsx,.csv" onChange={e => setAttachFile(e.target.files?.[0] ?? null)} style={{ fontSize: '14px' }} />
                    {attachFile && (
                      <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                        <Upload className="h-3 w-3 inline mr-1" />{attachFile.name} ({(attachFile.size / 1024 / 1024).toFixed(1)} MB)
                      </p>
                    )}
                  </div>

                  {/* 5 — Date */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Date</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))' }} />
                  </div>

                  {/* 6 — Department */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Department <span style={{ color: 'red' }}>*</span></label>
                    <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                      <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 7 — Manpower */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Manpower Count <span style={{ color: 'red' }}>*</span></label>
                    <Input type="number" min="0" placeholder="Number of workers" value={form.manpowerCount} onChange={e => setForm(f => ({ ...f, manpowerCount: e.target.value }))} className="bg-input border-border" />
                  </div>

                  {/* 8 — Equipment */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Equipment Total</label>
                      <Input type="number" min="0" placeholder="0" value={form.equipmentTotal} onChange={e => setForm(f => ({ ...f, equipmentTotal: e.target.value }))} className="bg-input border-border" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Operational</label>
                      <Input type="number" min="0" placeholder="0" value={form.equipmentOperational} onChange={e => setForm(f => ({ ...f, equipmentOperational: e.target.value }))} className="bg-input border-border" />
                    </div>
                  </div>

                  {/* 9 — Performance Score */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Performance Score (0–100) <span style={{ color: 'red' }}>*</span></label>
                    <Input type="number" min="0" max="100" placeholder="e.g. 85" value={form.performanceScore} onChange={e => setForm(f => ({ ...f, performanceScore: e.target.value }))} className="bg-input border-border" />
                  </div>

                  {/* 10 — Linked Contract */}
                  {contracts.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Linked Contract (Optional)</label>
                      <Select
                        value={form.contractId || undefined}
                        onValueChange={v => setForm(f => ({ ...f, contractId: v }))}
                      >
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="No contract (optional)" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {contracts
                            .filter(c => c.id)
                            .map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.title}{c.contractNumber ? ` (${c.contractNumber})` : ''}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* 11 — Notes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Notes (Optional)</label>
                    <Textarea placeholder="Additional notes or remarks..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-input border-border" rows={2} />
                  </div>

                  {submitError && <p className="text-sm text-destructive">{submitError}</p>}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1 border-border" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                    <Button
                      className="flex-1 bg-primary text-primary-foreground"
                      onClick={handleSubmit}
                      disabled={submitting || !form.department || !form.manpowerCount || !form.activityType || !form.performanceScore}
                    >
                      {submitting ? <Spinner className="h-4 w-4" /> : 'Save Entry'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><ClipboardList className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.totalEntries}</p>
                <p className="text-sm text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center"><Users className="h-5 w-5 text-chart-2" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.avgManpower}</p>
                <p className="text-sm text-muted-foreground">Avg Manpower/Day</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center"><Wrench className="h-5 w-5 text-chart-3" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.avgEquipmentUtil}%</p>
                <p className="text-sm text-muted-foreground">Equip. Utilization</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center"><Activity className="h-5 w-5 text-chart-4" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.avgPerformance}%</p>
                <p className="text-sm text-muted-foreground">Avg Performance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-primary" /></div>
      ) : records.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <BarChart2 className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">No Operations Data</h3>
            <p className="text-muted-foreground">Log your first operational entry using the button above.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Charts ───────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Manpower Trend */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />Manpower Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={manpowerTrend}>
                    <defs>
                      <linearGradient id="colorManpower" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(200, 60%, 50%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(200, 60%, 50%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="manpower" name="Manpower" stroke="hsl(200, 60%, 50%)" fillOpacity={1} fill="url(#colorManpower)" />
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
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={manpowerTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'Performance']} />
                    <Line type="monotone" dataKey="performance" name="Performance" stroke="hsl(30, 70%, 50%)" strokeWidth={2} dot={false} />
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
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={equipmentTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'Utilization']} />
                      <Bar dataKey="utilization" name="Utilization %" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
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
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={activityFreq} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={90} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Entries" fill="hsl(80, 60%, 45%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Workload by Department */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-primary" />Workload by Department
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={deptWorkload}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Legend />
                  <Bar dataKey="manpower" name="Total Manpower" fill="hsl(200, 60%, 50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="entries" name="Log Entries" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Entries Table */}
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
                      <th className="text-left p-3 text-muted-foreground font-medium">Date</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Department</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Activity</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Manpower</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Equipment</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Performance</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Logged By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 20).map(r => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-foreground">{new Date(r.date).toLocaleDateString()}</td>
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
                          <span className={`font-medium ${r.performanceScore >= 80 ? 'text-primary' : r.performanceScore >= 60 ? 'text-chart-3' : 'text-destructive'}`}>
                            {r.performanceScore}%
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{r.recorder?.username ?? r.recordedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {records.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center mt-3">Showing 20 of {records.length} entries</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
