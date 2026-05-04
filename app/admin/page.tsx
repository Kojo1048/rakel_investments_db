'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from '@/components/kpi-card';
import { DataTable } from '@/components/data-table';
import { Building, Users, Activity, Clock, BarChart2, Bell, LogIn, LogOut, FileUp, UserPlus, UserMinus, UserCheck, UserX, Upload, FileText, RefreshCw, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';
import type { Company, AuditLog } from '@/lib/types';

interface Notification {
  id: string;
  username: string;
  action: string;
  details: string | null;
  targetEntity: string | null;
  companyId: string | null;
  createdAt: string;
  company: { name: string } | null;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  LOGIN:               { label: 'Login',            color: 'bg-primary/10 text-primary',          icon: <LogIn className="h-3.5 w-3.5" /> },
  LOGOUT:              { label: 'Logout',           color: 'bg-muted text-muted-foreground',       icon: <LogOut className="h-3.5 w-3.5" /> },
  DOCUMENT_UPLOAD:     { label: 'Doc Upload',       color: 'bg-chart-2/10 text-chart-2',          icon: <FileUp className="h-3.5 w-3.5" /> },
  DOCUMENT_DELETE:     { label: 'Doc Delete',       color: 'bg-destructive/10 text-destructive',  icon: <FileText className="h-3.5 w-3.5" /> },
  USER_CREATE:         { label: 'User Created',     color: 'bg-chart-3/10 text-chart-3',          icon: <UserPlus className="h-3.5 w-3.5" /> },
  USER_DELETE:         { label: 'User Deleted',     color: 'bg-destructive/10 text-destructive',  icon: <UserMinus className="h-3.5 w-3.5" /> },
  USER_APPROVE:        { label: 'Approved',         color: 'bg-primary/10 text-primary',          icon: <UserCheck className="h-3.5 w-3.5" /> },
  USER_DECLINE:        { label: 'Declined',         color: 'bg-destructive/10 text-destructive',  icon: <UserX className="h-3.5 w-3.5" /> },
  COMPANY_CREATE:      { label: 'Company Added',    color: 'bg-chart-4/10 text-chart-4',          icon: <Building className="h-3.5 w-3.5" /> },
  COMPANY_UPDATE:      { label: 'Company Updated',  color: 'bg-chart-3/10 text-chart-3',          icon: <Building className="h-3.5 w-3.5" /> },
  DATA_IMPORT:         { label: 'Data Import',      color: 'bg-chart-2/10 text-chart-2',          icon: <Upload className="h-3.5 w-3.5" /> },
  REGISTRATION_SUBMIT: { label: 'New Registration', color: 'bg-chart-3/10 text-chart-3',          icon: <UserPlus className="h-3.5 w-3.5" /> },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [companies,           setCompanies]           = useState<Company[]>([]);
  const [auditLogs,           setAuditLogs]           = useState<AuditLog[]>([]);
  const [userCount,           setUserCount]           = useState(0);
  const [activeContractCount, setActiveContractCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading]   = useState(false);
  const [loading, setLoading]             = useState(true);

  const fetchNotifications = useCallback(async (showSpinner = false) => {
    if (!isSuperAdmin) return;
    if (showSpinner) setNotifLoading(true);
    try {
      const res = await fetch('/api/v1/notifications?limit=10', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {}
    finally { if (showSpinner) setNotifLoading(false); }
  }, [isSuperAdmin]);

  useEffect(() => {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000); // 10-second hard timeout
    const opts  = { credentials: 'include' as const, signal: ctrl.signal };

    const safe = (url: string, fallback: object) =>
      fetch(url, opts).then(r => r.ok ? r.json() : fallback).catch(() => fallback);

    Promise.all([
      safe('/api/v1/companies',               { companies: [] }),
      safe('/api/v1/audit?limit=5',           { logs:      [] }),
      safe('/api/v1/users/count',             { total:       0 }),  // dedicated count — never fails from schema drift
      safe('/api/v1/contracts?status=ACTIVE', { contracts: [] }),
    ]).then(([cd, ad, ud, contractData]) => {
      setCompanies((cd as any).companies ?? []);
      setAuditLogs((ad as any).logs      ?? []);
      setUserCount((ud as any).total     ??  0);
      setActiveContractCount(((contractData as any).contracts ?? []).length);
    }).catch(() => { /* fallbacks already set */ }).finally(() => {
      clearTimeout(timer);
      setLoading(false);
    });

    fetchNotifications(true);
  }, [fetchNotifications]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Welcome back. Here&apos;s an overview of all company activities.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard title="Active Companies"   value={companies.length}      icon={<Building       className="h-5 w-5" />} />
        <KPICard title="Total Users"        value={userCount}             icon={<Users          className="h-5 w-5" />} />
        <KPICard title="Active Contracts"   value={activeContractCount}   icon={<FileSignature  className="h-5 w-5" />} />
      </div>

      {/* Companies Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {companies.length === 0 ? (
          <Card className="col-span-full bg-card border-border">
            <CardContent className="p-12 text-center">
              <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground">No Companies Yet</h3>
              <p className="text-muted-foreground">Add companies to see them here.</p>
            </CardContent>
          </Card>
        ) : (
          companies.map(company => (
            <Card key={company.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{company.name}</p>
                    <p className="text-xs text-muted-foreground">{company.services?.length ?? 0} services</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(company.services ?? []).slice(0, 2).map(s => (
                    <span key={s.id} className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                      {(s.name ?? '').split(' ').slice(0, 2).join(' ')}
                    </span>
                  ))}
                  {(company.services?.length ?? 0) > 2 && (
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      +{(company.services?.length ?? 0) - 2} more
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Two-column: Notifications (Super Admin only) + Recent Activity */}
      <div className={`grid grid-cols-1 ${isSuperAdmin ? 'lg:grid-cols-2' : ''} gap-6`}>

        {/* Notifications Panel — Super Admin only */}
        {isSuperAdmin && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground flex items-center justify-between">
                <span className="flex items-center gap-2 text-base">
                  <Bell className="h-5 w-5 text-primary" />
                  Notifications
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => fetchNotifications(true)}
                  title="Refresh"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${notifLoading ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {notifLoading ? (
                <div className="flex justify-center py-10">
                  <Spinner className="h-5 w-5 text-primary" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-10 text-center px-4">
                  <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No notifications yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Logins, uploads, and user actions will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {notifications.map(n => {
                    const cfg = ACTION_CONFIG[n.action] ?? {
                      label: n.action,
                      color: 'bg-muted text-muted-foreground',
                      icon: <Bell className="h-3.5 w-3.5" />,
                    };
                    return (
                      <li key={n.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 ${cfg.color}`}>
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${cfg.color}`}>
                                {cfg.label}
                              </span>
                              <span className="text-xs font-medium text-foreground">{n.username}</span>
                            </div>
                            {(n.details || n.targetEntity) && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {n.details ?? n.targetEntity}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                              {n.company && (
                                <>
                                  <span className="text-muted-foreground/40">·</span>
                                  <span className="text-[11px] text-muted-foreground truncate">{n.company.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {notifications.length > 0 && (
                <div className="border-t border-border px-4 py-2 text-center">
                  <p className="text-xs text-muted-foreground">
                    Latest {notifications.length} notifications · Stored in audit history
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <div className="text-center py-8">
                <BarChart2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No activity logged yet.</p>
              </div>
            ) : (
              <DataTable
                data={auditLogs}
                columns={[
                  {
                    key: 'username',
                    label: 'User',
                    render: (log) => <span className="font-medium text-foreground">{log.username}</span>,
                  },
                  {
                    key: 'action',
                    label: 'Action',
                    render: (log) => (
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                        log.action === 'LOGIN'  ? 'bg-primary/10 text-primary' :
                        log.action === 'LOGOUT' ? 'bg-muted text-muted-foreground' :
                        'bg-chart-4/10 text-chart-4'
                      }`}>
                        {log.action}
                      </span>
                    ),
                  },
                  {
                    key: 'details',
                    label: 'Details',
                    render: (log) => <span className="text-muted-foreground">{log.details}</span>,
                  },
                  {
                    key: 'createdAt',
                    label: 'Time',
                    render: (log) => (
                      <span className="text-muted-foreground text-sm">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
