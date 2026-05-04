'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Activity, Users, Wrench, ClipboardList, Search, Building2, Calendar,
} from 'lucide-react';
import type { OperationsRecord, Company } from '@/lib/types';

const PERFORMANCE_COLOR = (score: number) =>
  score >= 80 ? 'text-primary' : score >= 60 ? 'text-chart-3' : 'text-destructive';

export default function CompanyOperationsDetailPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();

  const [company, setCompany] = useState<Company | null>(null);
  const [records, setRecords] = useState<OperationsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');

  useEffect(() => {
    fetch(`/api/v1/companies/${companyId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { company: null })
      .then(data => setCompany(data.company))
      .catch(() => {});
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/operations?companyId=${companyId}&days=${timeRange}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { records: [] })
      .then(data => setRecords(data.records ?? []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [companyId, timeRange]);

  const departments = useMemo(() => [...new Set(records.map(r => r.department))].sort(), [records]);
  const activityTypes = useMemo(() => [...new Set(records.map(r => r.activityType))].sort(), [records]);

  const filtered = useMemo(() => records.filter(r => {
    const matchSearch =
      r.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.activityType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.activityDescription ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.notes ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.recorder?.username ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = deptFilter === 'all' || r.department === deptFilter;
    const matchActivity = activityFilter === 'all' || r.activityType === activityFilter;
    return matchSearch && matchDept && matchActivity;
  }), [records, searchTerm, deptFilter, activityFilter]);

  const summary = useMemo(() => {
    if (records.length === 0) return { totalEntries: 0, avgManpower: 0, avgPerformance: 0, avgEquipUtil: 0 };
    const avgManpower = Math.round(records.reduce((s, r) => s + r.manpowerCount, 0) / records.length);
    const avgPerformance = Math.round(records.reduce((s, r) => s + r.performanceScore, 0) / records.length);
    const withEquip = records.filter(r => r.equipmentTotal > 0);
    const avgEquipUtil = withEquip.length > 0
      ? Math.round(withEquip.reduce((s, r) => s + (r.equipmentOperational / r.equipmentTotal) * 100, 0) / withEquip.length)
      : 0;
    return { totalEntries: records.length, avgManpower, avgPerformance, avgEquipUtil };
  }, [records]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="outline"
          size="sm"
          className="border-border text-foreground hover:bg-muted mt-1 flex-shrink-0"
          onClick={() => router.push('/admin/operations')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          All Companies
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">
              {company ? company.name : <span className="text-muted-foreground">Loading...</span>}
            </h1>
          </div>
          <p className="text-muted-foreground mt-0.5">
            Operational records · Last {timeRange} days
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[150px] bg-input border-border flex-shrink-0">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.totalEntries}</p>
                <p className="text-xs text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.avgManpower}</p>
                <p className="text-xs text-muted-foreground">Avg Manpower/Day</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                <Wrench className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.avgEquipUtil}%</p>
                <p className="text-xs text-muted-foreground">Equip. Utilization</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.avgPerformance}%</p>
                <p className="text-xs text-muted-foreground">Avg Performance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search records..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 bg-input border-border"
              />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[180px] bg-input border-border">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-[180px] bg-input border-border">
                <SelectValue placeholder="Activity" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Activities</SelectItem>
                {activityTypes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            {(searchTerm || deptFilter !== 'all' || activityFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => { setSearchTerm(''); setDeptFilter('all'); setActivityFilter('all'); }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {records.length === 0 ? 'No Operations Data' : 'No Records Match Filters'}
            </h3>
            <p className="text-muted-foreground">
              {records.length === 0
                ? 'This company has no operational records in the selected period.'
                : 'Try adjusting your search or filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                Operations Records
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {filtered.length} of {records.length} entries
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Department</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Activity</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Description</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Manpower</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Equipment</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Performance</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Notes</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Recorded By</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Logged At</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-foreground whitespace-nowrap font-medium">
                        {new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">{r.department}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          {r.activityType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                        <span className="line-clamp-2">{r.activityDescription ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap text-center">
                        {r.manpowerCount}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {r.equipmentTotal > 0
                          ? <span>{r.equipmentOperational}/{r.equipmentTotal} <span className="text-xs">({Math.round((r.equipmentOperational / r.equipmentTotal) * 100)}%)</span></span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`font-semibold ${PERFORMANCE_COLOR(r.performanceScore)}`}>
                          {r.performanceScore}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[160px]">
                        <span className="line-clamp-2">{r.notes ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        <div className="text-xs">
                          <div className="font-medium text-foreground">{r.recorder?.username ?? r.recordedBy}</div>
                          {r.recorder?.fullName && (
                            <div className="text-muted-foreground">{r.recorder.fullName}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        <div className="text-xs">
                          <div>{new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                          <div>{new Date(r.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
