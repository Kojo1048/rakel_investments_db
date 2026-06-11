'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/kpi-card';
import { Spinner } from '@/components/ui/spinner';
import { DollarSign, TrendingUp, Truck, Activity, Upload, Package, ArrowLeft, FileSpreadsheet, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import type { AnalyticsRecord, Service } from '@/lib/types';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-config';

export default function ServiceDashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const slug = params.slug as string;

  const [service, setService] = useState<Service | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user?.companyId) return;
    fetch(`/api/v1/companies/${user.companyId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const found = (data.company?.services ?? []).find((s: Service) => s.slug === slug);
        if (!found) { setNotFound(true); setLoading(false); return; }
        setService(found);
        return fetch(`/api/v1/analytics?days=30&serviceId=${found.id}`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : { records: [] })
          .then(ad => setAnalytics(ad.records ?? []));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [user?.companyId, slug]);

  const totals = useMemo(() => ({
    revenue: analytics.reduce((s, r) => s + r.revenue, 0),
    orders: analytics.reduce((s, r) => s + r.orders, 0),
    deliveries: analytics.reduce((s, r) => s + r.deliveries, 0),
    avgPerformance: analytics.length > 0
      ? Math.round(analytics.reduce((s, r) => s + r.performance, 0) / analytics.length)
      : 0,
  }), [analytics]);

  const dailyData = useMemo(() => {
    const grouped: Record<string, { date: string; revenue: number; orders: number; deliveries: number; performance: number }> = {};
    analytics.forEach(r => {
      const key = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!grouped[key]) grouped[key] = { date: key, revenue: 0, orders: 0, deliveries: 0, performance: 0 };
      grouped[key].revenue += r.revenue;
      grouped[key].orders += r.orders;
      grouped[key].deliveries += r.deliveries;
      grouped[key].performance = r.performance;
    });
    return Object.values(grouped).slice(-14);
  }, [analytics]);
  if (!mounted) return null;

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-primary" /></div>;
  }

  if (notFound || !service) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">Service not found</p>
        <Button onClick={() => router.push('/company')} variant="outline" className="border-border text-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/company">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{service.name}</h1>
            <p className="text-muted-foreground">{service.description}</p>
          </div>
        </div>
        <Link href="/company/upload">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Upload className="h-4 w-4 mr-2" />Upload Data
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Revenue" value={`$${(totals.revenue / 1000).toFixed(0)}k`} icon={<DollarSign className="h-5 w-5" />} />
        <KPICard title="Orders" value={totals.orders.toLocaleString()} icon={<TrendingUp className="h-5 w-5" />} />
        <KPICard title="Deliveries" value={totals.deliveries.toLocaleString()} icon={<Truck className="h-5 w-5" />} />
        <KPICard title="Performance" value={`${totals.avgPerformance}%`} icon={<Activity className="h-5 w-5" />} />
      </div>

      {analytics.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <BarChart2 className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">No Analytics Data Yet</h3>
            <p className="text-muted-foreground">Upload data from the Upload page to see analytics here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Revenue Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="colorServiceRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${v / 1000}k`} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(160, 60%, 45%)" fillOpacity={1} fill="url(#colorServiceRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Logistics Tracking</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="orders" name="Orders" fill="hsl(200, 60%, 50%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="deliveries" name="Deliveries" fill="hsl(80, 60%, 55%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Performance Metrics</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'Performance']} />
                  <Line type="monotone" dataKey="performance" stroke="hsl(30, 70%, 50%)" strokeWidth={2} dot={{ fill: 'hsl(30, 70%, 50%)' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" />Recent Uploads</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Upload data from the Upload page to track history here.</p>
            <Link href="/company/upload">
              <Button variant="outline" size="sm" className="mt-3 border-border text-foreground">
                <Upload className="h-4 w-4 mr-2" />Upload Now
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
