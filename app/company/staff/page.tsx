'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { DataTable } from '@/components/data-table';
import { Users, UserCheck, UserX } from 'lucide-react';
import type { User } from '@/lib/types';

export default function CompanyStaffPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { user } = useAuth();
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.companyId) return;
    fetch(`/api/v1/users?companyId=${user.companyId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { users: [] })
      .then(data => setStaff(data.users ?? []))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  }, [user?.companyId]);

  if (!mounted) return null;
  const active = staff.filter(s => s.status === 'ACTIVE').length;
  const inactive = staff.filter(s => s.status !== 'ACTIVE').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Staff Management</h1>
        <p className="text-muted-foreground">Staff members for {user?.companyName}.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{staff.length}</p>
                <p className="text-sm text-muted-foreground">Total Staff</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{active}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <UserX className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{inactive}</p>
                <p className="text-sm text-muted-foreground">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Staff Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Spinner className="h-6 w-6 text-primary" /></div>
          ) : (
            <DataTable
              data={staff}
              columns={[
                {
                  key: 'username',
                  label: 'Name',
                  render: (s) => (
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                        {(s.fullName ?? s.username).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{s.fullName ?? s.username}</p>
                        <p className="text-xs text-muted-foreground">@{s.username}</p>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'role',
                  label: 'Role',
                  render: (s) => (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-chart-3/10 text-chart-3">
                      {s.role === 'COMPANY_ADMIN' ? 'Admin' : 'Staff'}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (s) => (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      s.status === 'ACTIVE' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {s.status}
                    </span>
                  ),
                },
                {
                  key: 'email',
                  label: 'Email',
                  render: (s) => <span className="text-muted-foreground text-sm">{s.email ?? '—'}</span>,
                },
              ]}
              emptyMessage="No staff members found."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
