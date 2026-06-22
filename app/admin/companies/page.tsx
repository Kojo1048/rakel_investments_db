'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Building, Plus, Search, Package, Eye, BarChart3, Trash2, Pencil } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { Company, Service } from '@/lib/types';

export default function CompaniesPage() {
  const router = useRouter();
  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [services,   setServices]   = useState<Service[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // ── Add company ────────────────────────────────────────────────────────────
  const [isAddOpen,    setIsAddOpen]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [addError,     setAddError]     = useState('');
  const [newName,      setNewName]      = useState('');
  const [newSlug,      setNewSlug]      = useState('');
  const [newServiceIds, setNewServiceIds] = useState<string[]>([]);

  // ── View company ───────────────────────────────────────────────────────────
  const [isViewOpen,       setIsViewOpen]       = useState(false);
  const [selectedCompany,  setSelectedCompany]  = useState<Company | null>(null);

  // ── Edit company ───────────────────────────────────────────────────────────
  const [isEditOpen,     setIsEditOpen]     = useState(false);
  const [editCompany,    setEditCompany]    = useState<Company | null>(null);
  const [editName,       setEditName]       = useState('');
  const [editServiceIds, setEditServiceIds] = useState<string[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError,      setEditError]      = useState('');

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Data loading ───────────────────────────────────────────────────────────
  const fetchCompanies = () => {
    setLoading(true);
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch('/api/v1/companies', { credentials: 'include', signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { companies: [] })
      .then(data => setCompanies(data.companies ?? []))
      .catch(() => setCompanies([]))
      .finally(() => { clearTimeout(timer); setLoading(false); });
  };

  useEffect(() => {
    fetchCompanies();
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch('/api/v1/services', { credentials: 'include', signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { services: [] })
      .then(data => setServices(data.services ?? []))
      .catch(() => setServices([]))
      .finally(() => clearTimeout(timer));
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, []);

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Add helpers ────────────────────────────────────────────────────────────
  const toggleNewService = (id: string) => {
    setNewServiceIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleAddCompany = async () => {
    if (!newName || !newSlug) return;
    setSubmitting(true);
    setAddError('');
    try {
      const res = await fetch('/api/v1/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName, slug: newSlug, serviceIds: newServiceIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAddError(data.error || 'Failed to create company');
        return;
      }
      setIsAddOpen(false);
      setNewName(''); setNewSlug(''); setNewServiceIds([]);
      fetchCompanies();
    } catch {
      setAddError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit helpers ───────────────────────────────────────────────────────────
  const openEditCompany = (company: Company) => {
    setEditCompany(company);
    setEditName(company.name);
    const currentIds = (company.services ?? [])
      .map((s: any) => {
        const svc = s.service ?? s;
        return svc.id ?? s.serviceId;
      })
      .filter(Boolean) as string[];
    setEditServiceIds(currentIds);
    setEditError('');
    setIsEditOpen(true);
  };

  const toggleEditService = (id: string) => {
    setEditServiceIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleEditCompany = async () => {
    if (!editCompany || !editName.trim()) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      const res = await fetch(`/api/v1/companies/${editCompany.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editName.trim(), serviceIds: editServiceIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error || 'Failed to update company');
        return;
      }
      setIsEditOpen(false);
      fetchCompanies();
    } catch {
      setEditError('Network error');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Delete helper ──────────────────────────────────────────────────────────
  const handleDeleteCompany = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will remove all associated data and cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/companies/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) fetchCompanies();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  // ── Shared service badge renderer ─────────────────────────────────────────
  const renderServiceBadge = (s: any, prefix = '') => {
    const svc = s.service ?? s;
    const key = (prefix || '') + (svc.id ?? s.serviceId ?? svc.name);
    return (
      <span key={key} className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-secondary text-secondary-foreground">
        {svc.name ?? s.name}
      </span>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Companies</h1>
          <p className="text-muted-foreground">Manage all registered companies in the system.</p>
        </div>

        {/* ── Add Company dialog ──────────────────────────────────────────── */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Add New Company</DialogTitle>
              <DialogDescription className="text-muted-foreground">Create a new company in the Rakel Investments network.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>Company Name</FieldLabel>
                  <Input
                    placeholder="e.g., Rakel Logistics"
                    value={newName}
                    onChange={e => {
                      setNewName(e.target.value);
                      setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                    }}
                    className="bg-input border-border"
                  />
                </Field>
                <Field>
                  <FieldLabel>URL Slug</FieldLabel>
                  <Input placeholder="e.g., logistics" value={newSlug} onChange={e => setNewSlug(e.target.value)} className="bg-input border-border" />
                </Field>
                <Field>
                  <FieldLabel>
                    Assigned Services
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(optional — can be assigned later)</span>
                  </FieldLabel>
                  <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto pr-1">
                    {services.map(s => (
                      <div key={s.id} className="flex items-center gap-2">
                        <Checkbox id={`new-${s.id}`} checked={newServiceIds.includes(s.id)} onCheckedChange={() => toggleNewService(s.id)} />
                        <label htmlFor={`new-${s.id}`} className="text-sm text-foreground cursor-pointer leading-tight">
                          {s.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{newServiceIds.length} selected</p>
                </Field>
              </FieldGroup>
              {addError && <p className="text-sm text-destructive">{addError}</p>}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1 border-border" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground"
                  onClick={handleAddCompany}
                  disabled={submitting || !newName || !newSlug}
                >
                  {submitting ? <Spinner className="h-4 w-4" /> : 'Create Company'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search companies..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-input border-border" />
          </div>
        </CardContent>
      </Card>

      {/* ── Company cards ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">No Companies Found</h3>
            <p className="text-muted-foreground">{searchTerm ? 'Try a different search term.' : 'Add your first company to get started.'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(company => (
            <Card key={company.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground text-lg">{company.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">/{company.slug}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {(company.services?.length ?? 0) === 0
                      ? 'No services assigned'
                      : `${company.services?.length} service${company.services?.length === 1 ? '' : 's'}`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(company.services ?? []).map(s => renderServiceBadge(s))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 border-border text-foreground hover:bg-muted"
                    onClick={() => { setSelectedCompany(company); setIsViewOpen(true); }}>
                    <Eye className="h-3 w-3 mr-1" />View
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 border-border text-foreground hover:bg-muted"
                    onClick={() => openEditCompany(company)}>
                    <Pencil className="h-3 w-3 mr-1" />Edit
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 border-border text-foreground hover:bg-muted"
                    onClick={() => router.push(`/admin/analytics?company=${company.id}`)}>
                    <BarChart3 className="h-3 w-3 mr-1" />Stats
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive"
                    onClick={() => handleDeleteCompany(company.id, company.name)}
                    disabled={deletingId === company.id}
                  >
                    {deletingId === company.id
                      ? <span className="h-3 w-3 border border-destructive border-t-transparent rounded-full animate-spin" />
                      : <Trash2 className="h-3 w-3" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── View Company dialog ──────────────────────────────────────────────── */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Company Details</DialogTitle>
            <DialogDescription className="text-muted-foreground">Detailed information about this company.</DialogDescription>
          </DialogHeader>
          {selectedCompany && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedCompany.name}</h3>
                  <p className="text-sm text-muted-foreground">/{selectedCompany.slug}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm font-medium text-foreground">{new Date(selectedCompany.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Services</p>
                  <p className="text-sm font-medium text-foreground">{selectedCompany.services?.length ?? 0}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Assigned Services</p>
                {(selectedCompany.services ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No services assigned.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(selectedCompany.services ?? []).map(s => {
                      const svc = (s as any).service ?? s;
                      const key = svc.id ?? (s as any).serviceId ?? svc.name;
                      return (
                        <span key={key} className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm bg-primary/10 text-primary">
                          {svc.name ?? (s as any).name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1 border-border" onClick={() => setIsViewOpen(false)}>Close</Button>
                <Button className="flex-1 bg-primary text-primary-foreground"
                  onClick={() => { setIsViewOpen(false); router.push(`/admin/analytics?company=${selectedCompany.id}`); }}>
                  View Analytics
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Company dialog ──────────────────────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Company</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update the company name and service assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Company Name</FieldLabel>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="bg-input border-border"
                />
              </Field>
              <Field>
                <FieldLabel>
                  Assigned Services
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(companies with 0 services are allowed)</span>
                </FieldLabel>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto pr-1">
                  {services.map(s => (
                    <div key={s.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-${s.id}`}
                        checked={editServiceIds.includes(s.id)}
                        onCheckedChange={() => toggleEditService(s.id)}
                      />
                      <label htmlFor={`edit-${s.id}`} className="text-sm text-foreground cursor-pointer leading-tight">
                        {s.name}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {editServiceIds.length} service{editServiceIds.length !== 1 ? 's' : ''} selected
                </p>
              </Field>
            </FieldGroup>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground"
                onClick={handleEditCompany}
                disabled={editSubmitting || !editName.trim()}
              >
                {editSubmitting ? <Spinner className="h-4 w-4" /> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
