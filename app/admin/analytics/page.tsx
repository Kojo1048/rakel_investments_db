'use client';
export const dynamic = 'force-dynamic';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { BarChart3, TrendingUp, Filter, Calendar, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { Company, Service, AnalyticsRecord } from '@/lib/types';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-config';
import { safeGet } from '@/lib/utils/safe-fetch';

export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    }>
      <AnalyticsPageInner />
    </Suspense>
  );
}

function AnalyticsPageInner() {
  const searchParams = useSearchParams();
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('30');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      safeGet('/api/v1/companies', { companies: [] }),
      safeGet('/api/v1/services', { services: [] }),
    ]).then(([compData, svcData]) => {
      setCompanies(compData.companies ?? []);
      setServices(svcData.services ?? []);
      const cp = searchParams.get('company');
      if (cp) setSelectedCompany(cp);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ days: timeRange });
    if (selectedCompany !== 'all') params.set('companyId', selectedCompany);
    if (selectedService !== 'all') params.set('serviceId', selectedService);

    fetch(`/api/v1/analytics?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { records: [] })
      .then(data => setAnalytics(data.records ?? []))
      .catch(() => setAnalytics([]))
      .finally(() => setLoading(false));
  }, [selectedCompany, selectedService, timeRange]);

  const dailyData = useMemo(() => {
    const grouped: Record<string, { date: string; revenue: number; orders: number; deliveries: number }> = {};
    analytics.forEach(record => {
      const dateKey = new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey, revenue: 0, orders: 0, deliveries: 0 };
      grouped[dateKey].revenue += record.revenue;
      grouped[dateKey].orders += record.orders;
      grouped[dateKey].deliveries += record.deliveries;
    });
    return Object.values(grouped).slice(-14);
  }, [analytics]);

  const companyComparison = useMemo(() => {
    return companies.map(company => {
      const data = analytics.filter(r => r.companyId === company.id);
      return {
        name: company.name.replace('Rakel ', '').replace(' & ', '/'),
        revenue: data.reduce((s, r) => s + r.revenue, 0),
        orders: data.reduce((s, r) => s + r.orders, 0),
      };
    }).filter(c => c.revenue > 0);
  }, [analytics, companies]);

  const totals = useMemo(() => ({
    revenue: analytics.reduce((s, r) => s + r.revenue, 0),
    orders: analytics.reduce((s, r) => s + r.orders, 0),
    deliveries: analytics.reduce((s, r) => s + r.deliveries, 0),
    avgPerformance: analytics.length > 0
      ? Math.round(analytics.reduce((s, r) => s + r.performance, 0) / analytics.length)
      : 0,
  }), [analytics]);

  const quickFilters = [
    { label: 'Last 7 days', value: '7' },
    { label: 'Last 30 days', value: '30' },
    { label: 'Last year', value: '365' },
  ];

  const hasData = analytics.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Comprehensive analytics across all companies and services.</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Quick Filters:</span>
              {quickFilters.map(f => (
                <Button
                  key={f.value}
                  variant={timeRange === f.value ? 'default' : 'outline'}
                  size="sm"
                  className={timeRange === f.value ? 'bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted'}
                  onClick={() => setTimeRange(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[200px] bg-input border-border">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger className="w-[200px] bg-input border-border">
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">All Services</SelectItem>
                  {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-primary" /></div>
      ) : !hasData ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <BarChart2 className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">No Analytics Data</h3>
            <p className="text-muted-foreground">Analytics will appear here once company admins upload data.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold text-foreground">${(totals.revenue / 1000000).toFixed(2)}M</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Orders</p><p className="text-2xl font-bold text-foreground">{totals.orders.toLocaleString()}</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Deliveries</p><p className="text-2xl font-bold text-foreground">{totals.deliveries.toLocaleString()}</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Avg Performance</p><p className="text-2xl font-bold text-foreground">{totals.avgPerformance}%</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Revenue Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${v / 1000}k`} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(160, 60%, 45%)" fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Company Comparison</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={companyComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${v / 1000}k`} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
