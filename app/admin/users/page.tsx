'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { DataTable } from '@/components/data-table';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { Users, Plus, Search, Shield, Building, UserCog, Power, PowerOff, Edit } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { User, Company } from '@/lib/types';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'SUPER_ADMIN' | 'CEO' | 'COMPANY_ADMIN' | 'STAFF'>('STAFF');
  const [newCompanyId, setNewCompanyId] = useState('');

  const fetchUsers = () => {
    setLoading(true);
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000); // 8-second timeout
    fetch('/api/v1/users', { credentials: 'include', signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { users: [], total: 0 })
      .then(data => { setUsers(data.users ?? []); setTotal(data.total ?? 0); })
      .catch(() => { setUsers([]); setTotal(0); })         // never leave loading stuck
      .finally(() => { clearTimeout(timer); setLoading(false); });
  };

  useEffect(() => {
    fetchUsers();
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch('/api/v1/companies', { credentials: 'include', signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { companies: [] })
      .then(data => setCompanies(data.companies ?? []))
      .catch(() => setCompanies([]))
      .finally(() => clearTimeout(timer));
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, []);

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.fullName ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roleStats = {
    SUPER_ADMIN: users.filter(u => u.role === 'SUPER_ADMIN').length,
    CEO: users.filter(u => u.role === 'CEO').length,
    COMPANY_ADMIN: users.filter(u => u.role === 'COMPANY_ADMIN').length,
    STAFF: users.filter(u => u.role === 'STAFF').length,
  };

  const handleAddUser = async () => {
    if (!newUsername || !newPassword || !newFullName || !newEmail) return;
    setSubmitting(true);
    setAddError('');
    try {
      const payload: Record<string, unknown> = {
        username: newUsername,
        password: newPassword,
        fullName: newFullName,
        email: newEmail,
        role: newRole,
      };
      if (newCompanyId) payload.companyId = newCompanyId;
      const res = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        setAddError(data.error || 'Failed to create user');
        return;
      }
      setIsAddOpen(false);
      setNewUsername(''); setNewPassword(''); setNewFullName('');
      setNewEmail(''); setNewRole('STAFF'); setNewCompanyId('');
      fetchUsers();
    } catch {
      setAddError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await fetch(`/api/v1/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchUsers();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage system users and their access levels.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Add New User</DialogTitle>
              <DialogDescription className="text-muted-foreground">Manually create a new user account.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>Full Name</FieldLabel>
                  <Input placeholder="Enter full name" value={newFullName} onChange={e => setNewFullName(e.target.value)} className="bg-input border-border" />
                </Field>
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input type="email" placeholder="Enter email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="bg-input border-border" />
                </Field>
                <Field>
                  <FieldLabel>Username</FieldLabel>
                  <Input placeholder="Choose a username" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="bg-input border-border" />
                </Field>
                <Field>
                  <FieldLabel>Password</FieldLabel>
                  <PasswordInput placeholder="Choose a password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-input border-border" />
                </Field>
                <Field>
                  <FieldLabel>Role</FieldLabel>
                  <Select value={newRole} onValueChange={v => setNewRole(v as typeof newRole)}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="SUPER_ADMIN">Super Administrator</SelectItem>
                      <SelectItem value="CEO">CEO</SelectItem>
                      <SelectItem value="COMPANY_ADMIN">Company Admin</SelectItem>
                      <SelectItem value="STAFF">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {(newRole === 'COMPANY_ADMIN' || newRole === 'STAFF') && (
                  <Field>
                    <FieldLabel>Company</FieldLabel>
                    <Select value={newCompanyId} onValueChange={setNewCompanyId}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </FieldGroup>
              {addError && <p className="text-sm text-destructive">{addError}</p>}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1 border-border" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleAddUser} disabled={submitting || !newUsername || !newPassword || !newFullName || !newEmail}>
                  {submitting ? <Spinner className="h-4 w-4" /> : 'Create User'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Shield className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold text-foreground">{roleStats.SUPER_ADMIN}</p><p className="text-sm text-muted-foreground">Administrators</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10 text-chart-3"><Shield className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold text-foreground">{roleStats.CEO}</p><p className="text-sm text-muted-foreground">CEO</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2"><Building className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold text-foreground">{roleStats.COMPANY_ADMIN}</p><p className="text-sm text-muted-foreground">Company Admins</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10 text-chart-4"><UserCog className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold text-foreground">{roleStats.STAFF}</p><p className="text-sm text-muted-foreground">Staff Members</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              All Users ({total})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-input border-border" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Spinner className="h-6 w-6 text-primary" /></div>
          ) : (
            <DataTable
              data={filteredUsers}
              emptyMessage="No users found."
              columns={[
                {
                  key: 'username',
                  label: 'User',
                  render: (u) => (
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                        {((u.fullName || u.username) as string).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium text-foreground block">{u.fullName || u.username}</span>
                        <span className="text-xs text-muted-foreground">@{u.username as string}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'role',
                  label: 'Role',
                  render: (u) => (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'SUPER_ADMIN'   ? 'bg-primary/10 text-primary' :
                      u.role === 'CEO'           ? 'bg-chart-3/10 text-chart-3' :
                      u.role === 'COMPANY_ADMIN' ? 'bg-chart-2/10 text-chart-2' :
                      'bg-chart-4/10 text-chart-4'
                    }`}>
                      {u.role === 'SUPER_ADMIN' ? 'Admin' : u.role === 'COMPANY_ADMIN' ? 'Co. Admin' : u.role as string}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (u) => (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.status === 'ACTIVE' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {u.status as string}
                    </span>
                  ),
                },
                {
                  key: 'companyId',
                  label: 'Company',
                  render: (u) => (
                    <span className="text-sm text-muted-foreground">
                      {(u as any).company?.name ?? (u.companyId ? 'Loading…' : 'Unassigned')}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (u) => (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleUserStatus(u.id as string, u.status as string)}
                        title={u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        disabled={u.id === currentUser?.id}
                      >
                        {u.status === 'ACTIVE' ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
