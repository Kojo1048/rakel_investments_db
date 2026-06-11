'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { BarChart3, TrendingUp, Filter, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AnalyticsRecord, Service } from '@/lib/types';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-config';
import { safeGet } from '@/lib/utils/safe-fetch';

export default function CompanyAnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsRecord[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('30');

  useEffect(() => {
    if (!user?.companyId) return;
    setLoading(true);
    const params = new URLSearchParams({ days: timeRange });
    if (selectedService !== 'all') params.set('serviceId', selectedService);

    Promise.all([
      safeGet(`/api/v1/analytics?${params}`, { records: [] }),
      safeGet(`/api/v1/companies/${user.companyId}`, { company: null }),
    ]).then(([ad, cd]) => {
      setAnalytics(ad.records ?? []);
      setServices(cd.company?.services ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user?.companyId, selectedService, timeRange]);

  const dailyData = useMemo(() => {
    const grouped: Record<string, { date: string; revenue: number; orders: number; deliveries: number }> = {};
    analytics.forEach(r => {
      const key = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!grouped[key]) grouped[key] = { date: key, revenue: 0, orders: 0, deliveries: 0 };
      grouped[key].revenue += r.revenue;
      grouped[key].orders += r.orders;
      grouped[key].deliveries += r.deliveries;
    });
    return Object.values(grouped).slice(-14);
  }, [analytics]);

  const serviceComparison = useMemo(() => {
    return services.map(s => {
      const data = analytics.filter(r => r.serviceId === s.id);
      return {
        name: (s.name ?? '').split(' ').slice(0, 2).join(' '),
        revenue: data.reduce((sum, r) => sum + r.revenue, 0),
        orders: data.reduce((sum, r) => sum + r.orders, 0),
        deliveries: data.reduce((sum, r) => sum + r.deliveries, 0),
      };
    });
  }, [analytics, services]);

  const totals = useMemo(() => ({
    revenue: analytics.reduce((s, r) => s + r.revenue, 0),
    orders: analytics.reduce((s, r) => s + r.orders, 0),
    deliveries: analytics.reduce((s, r) => s + r.deliveries, 0),
    avgPerformance: analytics.length > 0
      ? Math.round(analytics.reduce((s, r) => s + r.performance, 0) / analytics.length)
      : 0,
  }), [analytics]);
  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground">Detailed analytics for your company.</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="w-[200px] bg-input border-border"><SelectValue placeholder="Select service" /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Services</SelectItem>
                {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[150px] bg-input border-border"><SelectValue placeholder="Time range" /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-primary" /></div>
      ) : analytics.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <BarChart2 className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">No Analytics Data</h3>
            <p className="text-muted-foreground">Upload data to see analytics here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold text-foreground">${(totals.revenue / 1000).toFixed(0)}k</p></CardContent></Card>
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
                      <linearGradient id="colorRevenue2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${v / 1000}k`} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(160, 60%, 45%)" fillOpacity={1} fill="url(#colorRevenue2)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Service Comparison</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={serviceComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${v / 1000}k`} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border lg:col-span-2">
              <CardHeader><CardTitle className="text-foreground">Orders & Deliveries Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend />
                    <Line type="monotone" dataKey="orders" name="Orders" stroke="hsl(200, 60%, 50%)" strokeWidth={2} />
                    <Line type="monotone" dataKey="deliveries" name="Deliveries" stroke="hsl(80, 60%, 55%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
