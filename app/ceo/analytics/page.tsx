'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { BarChart3, TrendingUp, Filter, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend, PieChart, Pie, Cell
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AnalyticsRecord, Company } from '@/lib/types';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-config';
import { safeGet } from '@/lib/utils/safe-fetch';

const COLORS = ['hsl(160, 60%, 45%)', 'hsl(200, 60%, 50%)', 'hsl(80, 60%, 55%)', 'hsl(30, 70%, 50%)'];

export default function CEOAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<string>('30');
  const [analytics, setAnalytics] = useState<AnalyticsRecord[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      safeGet(`/api/v1/analytics?days=${timeRange}`, { records: [] }),
      safeGet('/api/v1/companies', { companies: [] }),
    ]).then(([ad, cd]) => {
      setAnalytics(ad.records ?? []);
      setCompanies(cd.companies ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [timeRange]);

  const totals = useMemo(() => ({
    revenue: analytics.reduce((s, r) => s + r.revenue, 0),
    orders: analytics.reduce((s, r) => s + r.orders, 0),
    deliveries: analytics.reduce((s, r) => s + r.deliveries, 0),
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

  const companyData = useMemo(() => {
    return companies.map(c => {
      const data = analytics.filter(r => r.companyId === c.id);
      return {
        name: c.name.replace('Rakel ', ''),
        revenue: data.reduce((s, r) => s + r.revenue, 0),
        orders: data.reduce((s, r) => s + r.orders, 0),
      };
    }).filter(c => c.revenue > 0);
  }, [analytics, companies]);

  const pieData = companyData.map(c => ({ name: c.name, value: c.revenue }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Executive Analytics</h1>
          <p className="text-muted-foreground">High-level performance insights across all operations.</p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Time Range:</span>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[200px] bg-input border-border"><SelectValue placeholder="Select range" /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
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
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenueCEOAnalytics" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${v / 1000}k`} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(160, 60%, 45%)" fillOpacity={1} fill="url(#colorRevenueCEOAnalytics)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-foreground">Revenue Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border lg:col-span-2">
              <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Company Comparison</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={companyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${v / 1000}k`} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue ($)" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="orders" name="Orders" fill="hsl(200, 60%, 50%)" radius={[4, 4, 0, 0]} />
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
