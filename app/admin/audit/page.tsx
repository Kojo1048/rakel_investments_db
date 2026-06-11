'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table';
import { Spinner } from '@/components/ui/spinner';
import { FileText, Search, Filter, Clock, User, Activity, BarChart2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AuditLog } from '@/lib/types';

const actionTypes = ['ALL', 'LOGIN', 'LOGOUT', 'DOCUMENT_UPLOAD', 'USER_CREATE', 'USER_APPROVE', 'USER_DECLINE', 'SETTINGS_UPDATE', 'DATA_IMPORT'];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    fetch('/api/v1/audit?limit=200', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { logs: [] })
      .then(data => setLogs(data.logs ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredLogs = useMemo(() => {
    let data = [...logs];
    if (searchTerm) data = data.filter(l =>
      l.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (actionFilter !== 'ALL') data = data.filter(l => l.action === actionFilter);
    return data;
  }, [logs, searchTerm, actionFilter]);

  const actionStats = useMemo(() => {
    const stats: Record<string, number> = {};
    logs.forEach(l => { stats[l.action] = (stats[l.action] || 0) + 1; });
    return stats;
  }, [logs]);

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'LOGIN':    return 'bg-primary/10 text-primary';
      case 'LOGOUT':   return 'bg-muted text-muted-foreground';
      case 'DOCUMENT_UPLOAD': case 'DATA_IMPORT': return 'bg-chart-2/10 text-chart-2';
      case 'USER_CREATE': case 'USER_APPROVE': return 'bg-chart-3/10 text-chart-3';
      case 'USER_DECLINE': return 'bg-destructive/10 text-destructive';
      case 'SETTINGS_UPDATE': return 'bg-chart-4/10 text-chart-4';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-muted-foreground">Track all system activities and user actions.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Activity className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold text-foreground">{logs.length}</p><p className="text-sm text-muted-foreground">Total Events</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2"><User className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold text-foreground">{actionStats['LOGIN'] || 0}</p><p className="text-sm text-muted-foreground">Logins</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10 text-chart-3"><FileText className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold text-foreground">{(actionStats['DOCUMENT_UPLOAD'] || 0) + (actionStats['DATA_IMPORT'] || 0)}</p><p className="text-sm text-muted-foreground">Uploads</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10 text-chart-4"><Clock className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold text-foreground">{actionStats['SETTINGS_UPDATE'] || 0}</p><p className="text-sm text-muted-foreground">Updates</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />Activity Log
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search logs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-input border-border" />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[160px] bg-input border-border">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {actionTypes.map(a => <SelectItem key={a} value={a}>{a === 'ALL' ? 'All Actions' : a.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Spinner className="h-6 w-6 text-primary" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <BarChart2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No audit logs yet. Activity will appear here as users interact with the system.</p>
            </div>
          ) : (
            <DataTable
              data={filteredLogs}
              emptyMessage="No logs match your search."
              columns={[
                {
                  key: 'createdAt',
                  label: 'Timestamp',
                  render: (log) => (
                    <div className="text-sm">
                      <p className="text-foreground">{new Date(log.createdAt).toLocaleDateString()}</p>
                      <p className="text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</p>
                    </div>
                  ),
                },
                {
                  key: 'username',
                  label: 'User',
                  render: (log) => (
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                        {(log.username as string).charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">{log.username as string}</span>
                    </div>
                  ),
                },
                {
                  key: 'action',
                  label: 'Action',
                  render: (log) => (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadgeClass(log.action as string)}`}>
                      {(log.action as string).replace(/_/g, ' ')}
                    </span>
                  ),
                },
                {
                  key: 'details',
                  label: 'Details',
                  render: (log) => <span className="text-muted-foreground">{log.details as string}</span>,
                },
                {
                  key: 'ipAddress',
                  label: 'IP Address',
                  render: (log) => log.ipAddress
                    ? <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">{log.ipAddress as string}</code>
                    : <span className="text-muted-foreground">—</span>,
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
