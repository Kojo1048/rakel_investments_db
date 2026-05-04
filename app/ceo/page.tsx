'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { KPICard } from '@/components/kpi-card';
import { Spinner } from '@/components/ui/spinner';
import { Crown, TrendingUp, Building, Package, FileText, BarChart2, FileSignature } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import type { Company, AnalyticsRecord, Document } from '@/lib/types';
import { safeGet } from '@/lib/utils/safe-fetch';

export default function CEODashboard() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRecord[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeContractCount, setActiveContractCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      safeGet('/api/v1/companies', { companies: [] }),
      safeGet('/api/v1/analytics?days=30', { records: [] }),
      safeGet('/api/v1/documents?limit=4', { documents: [] }),
      safeGet('/api/v1/contracts?status=ACTIVE', { contracts: [] }),
    ]).then(([cd, ad, dd, contractData]) => {
      setCompanies(cd.companies ?? []);
      setAnalytics(ad.records ?? []);
      setDocuments(dd.documents ?? []);
      setActiveContractCount((contractData.contracts ?? []).length);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => ({
    revenue: analytics.reduce((s, r) => s + r.revenue, 0),
    orders: analytics.reduce((s, r) => s + r.orders, 0),
    avgPerformance: analytics.length > 0
      ? Math.round(analytics.reduce((s, r) => s + r.performance, 0) / analytics.length)
      : 0,
  }), [analytics]);

  const revenueData = useMemo(() => {
    const grouped: Record<string, { date: string; revenue: number }> = {};
    analytics.forEach(r => {
      const key = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!grouped[key]) grouped[key] = { date: key, revenue: 0 };
      grouped[key].revenue += r.revenue;
    });
    return Object.values(grouped).slice(-14);
  }, [analytics]);

  const companyPerformance = useMemo(() => {
    return companies.map(c => {
      const data = analytics.filter(r => r.companyId === c.id);
      return {
        name: c.name.replace('Rakel ', '').replace(' & ', '/'),
        revenue: data.reduce((s, r) => s + r.revenue, 0),
        orders: data.reduce((s, r) => s + r.orders, 0),
      };
    }).filter(c => c.revenue > 0);
  }, [analytics, companies]);

  const hasAnalytics = analytics.length > 0;

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Crown className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome {user?.fullName ?? 'Mr. Jalloh'}
          </h1>
          <p className="text-muted-foreground">
            Executive Overview — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard title="Total Active Contracts" value={activeContractCount.toString()} icon={<FileSignature className="h-5 w-5" />} />
        <KPICard title="Total Orders (30d)" value={totals.orders.toLocaleString()} icon={<Package className="h-5 w-5" />} />
        <KPICard title="Active Companies" value={companies.length.toString()} icon={<Building className="h-5 w-5" />} />
      </div>

      {!hasAnalytics ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <BarChart2 className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">No Analytics Data Yet</h3>
            <p className="text-muted-foreground">Analytics will appear here once company admins upload data.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Revenue Overview (Last 14 Days)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenueCEO" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(210, 70%, 50%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(210, 70%, 50%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${v / 1000}k`} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(220, 20%, 20%)', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(210, 70%, 50%)" fillOpacity={1} fill="url(#colorRevenueCEO)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Building className="h-5 w-5 text-primary" />Company Performance Comparison</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={companyPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${v / 1000}k`} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(220, 20%, 20%)', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(210, 70%, 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Company Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {companyPerformance.map(company => (
                <Card key={company.name} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium text-foreground">{company.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-bold text-foreground">${(company.revenue / 1000).toFixed(0)}k</p>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-bold text-foreground">{company.orders}</p>
                        <p className="text-xs text-muted-foreground">Orders</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Recent Documents</CardTitle></CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-chart-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.category} — {doc.company?.name ?? 'All Companies'}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground uppercase">{doc.fileType}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
