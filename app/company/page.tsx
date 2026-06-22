'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from '@/components/kpi-card';
import { Spinner } from '@/components/ui/spinner';
import { DollarSign, TrendingUp, Package, Truck, Activity, BarChart2, FileText, FileSignature, Receipt, ClipboardList, Eye, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DocumentViewModal } from '@/components/document-view-modal';
import type { AnalyticsRecord, Service, Document } from '@/lib/types';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-config';
import { safeGet } from '@/lib/utils/safe-fetch';

export default function CompanyOverviewPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { user, isLoading } = useAuth();
  const isStaff = user?.role === 'STAFF';

  // ── Analytics state (COMPANY_ADMIN + CEO) ─────────────────────────────────
  const [analytics, setAnalytics] = useState<AnalyticsRecord[]>([]);
  const [services,  setServices]  = useState<Service[]>([]);
  const [loading,   setLoading]   = useState(true);

  // ── Staff upload history state ────────────────────────────────────────────
  const [myDocs,       setMyDocs]       = useState<Document[]>([]);
  const [viewDoc,      setViewDoc]      = useState<Document | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    if (isStaff) {
      // Staff: load only their own uploaded documents
      setHistoryLoading(true);
      fetch('/api/v1/documents?limit=20', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { documents: [] })
        .then(d => setMyDocs(d.documents ?? []))
        .catch(() => {})
        .finally(() => { setHistoryLoading(false); setLoading(false); });
    } else {
      if (!user?.companyId) { setLoading(false); return; }
      Promise.all([
        safeGet(`/api/v1/analytics?days=30`,             { records: [] }),
        safeGet(`/api/v1/companies/${user.companyId}`,   { company: null }),
      ]).then(([ad, cd]) => {
        setAnalytics((ad as any).records ?? []);
        setServices((cd as any).company?.services ?? []);
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [user?.companyId, isStaff]);

  if (!mounted) return null;
  if (isLoading || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!isStaff && !user?.companyId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Unable to load company data. Please contact an administrator.</p>
      </div>
    );
  }

  // ── Staff dashboard ───────────────────────────────────────────────────────
  if (isStaff) {
    const staffModules: string[] = (user as any)?.staffModules ?? [];
    const MODULE_LABELS: Record<string, { label: string; icon: React.ReactNode; href: string }> = {
      contracts:  { label: 'Contracts',  icon: <FileSignature className="h-5 w-5" />, href: '/company/contracts'  },
      invoices:   { label: 'Invoices',   icon: <Receipt       className="h-5 w-5" />, href: '/company/invoices'   },
      documents:  { label: 'Documents',  icon: <FileText      className="h-5 w-5" />, href: '/company/documents'  },
      operations: { label: 'Operations', icon: <ClipboardList className="h-5 w-5" />, href: '/company/operations' },
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Workspace</h1>
          <p className="text-muted-foreground">Your assigned modules and recent upload history.</p>
        </div>

        {/* Module cards */}
        {staffModules.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {staffModules.map(mod => {
              const cfg = MODULE_LABELS[mod];
              if (!cfg) return null;
              return (
                <a key={mod} href={cfg.href} className="block">
                  <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {cfg.icon}
                      </div>
                      <p className="text-sm font-medium text-foreground">{cfg.label}</p>
                    </CardContent>
                  </Card>
                </a>
              );
            })}
          </div>
        )}

        {/* My upload history */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              My Upload History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex justify-center py-8"><Spinner className="h-6 w-6 text-primary" /></div>
            ) : myDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No uploads yet. Use the module pages above to upload documents.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-muted-foreground font-medium">Title</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Category</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Company</th>
                      <th className="text-left p-3 text-muted-foreground font-medium whitespace-nowrap">Upload Date</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myDocs.map(doc => (
                      <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-foreground font-medium truncate max-w-[160px]">{doc.title}</td>
                        <td className="p-3 text-muted-foreground">{doc.category}</td>
                        <td className="p-3 text-muted-foreground">{doc.company?.name ?? '—'}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <button
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="View"
                              onClick={() => setViewDoc(doc)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Download"
                              onClick={async () => {
                                if (!doc.storageKey) return;
                                const res = await fetch(`/api/v1/documents/${doc.id}/download`, { credentials: 'include' });
                                if (!res.ok) return;
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = window.document.createElement('a');
                                a.href = url; a.download = doc.filename; a.click();
                                URL.revokeObjectURL(url);
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <DocumentViewModal doc={viewDoc} open={viewDoc !== null} onClose={() => setViewDoc(null)} />
      </div>
    );
  }

  const totals = {
    revenue: analytics.reduce((s, r) => s + r.revenue, 0),
    orders: analytics.reduce((s, r) => s + r.orders, 0),
    deliveries: analytics.reduce((s, r) => s + r.deliveries, 0),
    avgPerformance: analytics.length > 0
      ? Math.round(analytics.reduce((s, r) => s + r.performance, 0) / analytics.length)
      : 0,
  };

  const revenueByService = services.map(service => {
    const data = analytics.filter(r => r.serviceId === service.id);
    return {
      name: (service.name ?? '').split(' ').slice(0, 2).join(' '),
      revenue: data.reduce((s, r) => s + r.revenue, 0),
      orders: data.reduce((s, r) => s + r.orders, 0),
    };
  });

  const hasAnalytics = analytics.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{user?.companyName ?? 'Company'} Dashboard</h1>
        <p className="text-muted-foreground">Overview of your company&apos;s performance and activities.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Revenue (30d)" value={`$${(totals.revenue / 1000).toFixed(0)}k`} icon={<DollarSign className="h-5 w-5" />} />
        <KPICard title="Total Orders" value={totals.orders.toLocaleString()} icon={<TrendingUp className="h-5 w-5" />} />
        <KPICard title="Deliveries" value={totals.deliveries.toLocaleString()} icon={<Truck className="h-5 w-5" />} />
        <KPICard title="Avg Performance" value={`${totals.avgPerformance}%`} icon={<Activity className="h-5 w-5" />} />
      </div>

      {!hasAnalytics ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <BarChart2 className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">No Analytics Data Yet</h3>
            <p className="text-muted-foreground">Upload data from the Upload page to see analytics here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Revenue by Service (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueByService}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${v / 1000}k`} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Your Services</CardTitle>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No services assigned to your company yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map((service, i) => {
                const data = analytics.filter(r => r.serviceId === service.id);
                const revenue = data.reduce((s, r) => s + r.revenue, 0);
                const orders = data.reduce((s, r) => s + r.orders, 0);
                const COLORS = ['hsl(210, 70%, 50%)', 'hsl(140, 60%, 45%)', 'hsl(30, 60%, 45%)', 'hsl(45, 90%, 50%)'];
                const color = COLORS[i % COLORS.length];
                return (
                  <div key={service.id} className="p-4 rounded-lg border border-border bg-muted/30 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                        <Package className="h-5 w-5" style={{ color }} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{service.name}</p>
                        <p className="text-xs text-muted-foreground">{service.description}</p>
                      </div>
                    </div>
                    {hasAnalytics && (
                      <div className="flex items-center justify-between text-sm mt-2">
                        <span className="text-muted-foreground">Revenue: <span className="font-medium text-foreground">${(revenue / 1000).toFixed(0)}k</span></span>
                        <span className="text-muted-foreground">Orders: <span className="font-medium text-foreground">{orders}</span></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
