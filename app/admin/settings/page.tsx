'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Settings, Bell, Shield, Database, CheckCircle, Package, Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  getTimeoutConfig, saveTimeoutConfig, clearTimeoutConfig,
  DEFAULT_TIMEOUT_MINUTES, MINIMUM_TIMEOUT_MINUTES,
} from '@/lib/session-timeout';
import type { Service } from '@/lib/types';

export default function SettingsPage() {
  // ── Security state ────────────────────────────────────────────────────────
  const [timeoutEnabled, setTimeoutEnabled] = useState(true);
  const [timeoutMinutes, setTimeoutMinutes] = useState(DEFAULT_TIMEOUT_MINUTES);
  const [securitySaved,  setSecuritySaved]  = useState(false);

  useEffect(() => {
    const config = getTimeoutConfig();
    setTimeoutEnabled(config.enabled);
    setTimeoutMinutes(config.minutes);
  }, []);

  const handleSaveSecurity = () => {
    const minutes = Math.max(MINIMUM_TIMEOUT_MINUTES, timeoutMinutes || DEFAULT_TIMEOUT_MINUTES);
    setTimeoutMinutes(minutes);
    saveTimeoutConfig(timeoutEnabled, minutes);
    setSecuritySaved(true);
    setTimeout(() => setSecuritySaved(false), 2500);
  };

  const handleResetTimeout = () => {
    clearTimeoutConfig();
    setTimeoutEnabled(true);
    setTimeoutMinutes(DEFAULT_TIMEOUT_MINUTES);
  };

  // ── Services state ────────────────────────────────────────────────────────
  const [services,        setServices]        = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  // Add service
  const [newSvcName,    setNewSvcName]    = useState('');
  const [newSvcDesc,    setNewSvcDesc]    = useState('');
  const [addingSvc,     setAddingSvc]     = useState(false);
  const [addSvcError,   setAddSvcError]   = useState('');

  // Edit service dialog
  const [editSvc,       setEditSvc]       = useState<Service | null>(null);
  const [editSvcName,   setEditSvcName]   = useState('');
  const [editSvcDesc,   setEditSvcDesc]   = useState('');
  const [savingSvc,     setSavingSvc]     = useState(false);
  const [editSvcError,  setEditSvcError]  = useState('');

  // Delete
  const [deletingSvcId, setDeletingSvcId] = useState<string | null>(null);

  const fetchServices = () => {
    setServicesLoading(true);
    fetch('/api/v1/services', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { services: [] })
      .then(d => setServices(d.services ?? []))
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  };

  useEffect(() => { fetchServices(); }, []);

  const handleAddService = async () => {
    if (!newSvcName.trim()) return;
    setAddingSvc(true);
    setAddSvcError('');
    try {
      const res = await fetch('/api/v1/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newSvcName.trim(), description: newSvcDesc.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setAddSvcError(data.error || 'Failed to create service'); return; }
      setNewSvcName('');
      setNewSvcDesc('');
      fetchServices();
    } catch {
      setAddSvcError('Network error');
    } finally {
      setAddingSvc(false);
    }
  };

  const openEditSvc = (svc: Service) => {
    setEditSvc(svc);
    setEditSvcName(svc.name);
    setEditSvcDesc((svc as any).description ?? '');
    setEditSvcError('');
  };

  const handleEditService = async () => {
    if (!editSvc || !editSvcName.trim()) return;
    setSavingSvc(true);
    setEditSvcError('');
    try {
      const res = await fetch(`/api/v1/services/${editSvc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editSvcName.trim(), description: editSvcDesc.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setEditSvcError(data.error || 'Failed to update service'); return; }
      setEditSvc(null);
      fetchServices();
    } catch {
      setEditSvcError('Network error');
    } finally {
      setSavingSvc(false);
    }
  };

  const handleDeleteService = async (id: string, name: string) => {
    if (!confirm(`Delete service "${name}"? It will be removed from all companies.`)) return;
    setDeletingSvcId(id);
    try {
      await fetch(`/api/v1/services/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchServices();
    } catch { /* ignore */ }
    setDeletingSvcId(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
        <p className="text-muted-foreground">Configure system-wide settings and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              General Settings
            </CardTitle>
            <CardDescription className="text-muted-foreground">Basic system configuration options.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>System Name</FieldLabel>
                <Input defaultValue="Rakel Investments DBMS" className="bg-input border-border" />
              </Field>
              <Field>
                <FieldLabel>Admin Email</FieldLabel>
                <Input type="email" defaultValue="admin@rakelinvestments.com" className="bg-input border-border" />
              </Field>
              <Field>
                <FieldLabel>Support Contact</FieldLabel>
                <Input defaultValue="+1 (555) 123-4567" className="bg-input border-border" />
              </Field>
            </FieldGroup>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Save Changes</Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription className="text-muted-foreground">Configure notification preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Email Notifications',  desc: 'Receive email alerts for system events',  defaultOn: true  },
              { label: 'Login Alerts',          desc: 'Get notified on new user logins',         defaultOn: true  },
              { label: 'Data Upload Alerts',    desc: 'Notifications for data uploads',          defaultOn: false },
              { label: 'Weekly Reports',        desc: 'Receive weekly analytics summary',        defaultOn: true  },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch defaultChecked={item.defaultOn} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Security
            </CardTitle>
            <CardDescription className="text-muted-foreground">Security and access control settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">Require 2FA for all users</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium text-foreground">Session Timeout</p>
                <p className="text-xs text-muted-foreground">Auto-logout users after inactivity</p>
              </div>
              <Switch checked={timeoutEnabled} onCheckedChange={setTimeoutEnabled} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium text-foreground">IP Whitelisting</p>
                <p className="text-xs text-muted-foreground">Restrict access by IP address</p>
              </div>
              <Switch />
            </div>
            <FieldGroup>
              <Field>
                <FieldLabel>
                  Session Duration (minutes)
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    default: {DEFAULT_TIMEOUT_MINUTES} min &mdash; min: {MINIMUM_TIMEOUT_MINUTES} min
                  </span>
                </FieldLabel>
                <Input
                  type="number"
                  min={MINIMUM_TIMEOUT_MINUTES}
                  max={480}
                  value={timeoutMinutes}
                  disabled={!timeoutEnabled}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10);
                    setTimeoutMinutes(isNaN(v) ? DEFAULT_TIMEOUT_MINUTES : v);
                  }}
                  className="bg-input border-border disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {timeoutEnabled
                    ? `Users will be warned 2 minutes before the ${timeoutMinutes}-minute limit and logged out automatically.`
                    : 'Enable session timeout to configure the duration.'}
                </p>
              </Field>
            </FieldGroup>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-border text-foreground hover:bg-muted"
                onClick={handleResetTimeout}
                title={`Clear stored override — restores ${DEFAULT_TIMEOUT_MINUTES}-minute default`}
              >
                Reset to Default
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                onClick={handleSaveSecurity}
              >
                {securitySaved ? <><CheckCircle className="h-4 w-4" />Saved</> : 'Save Security Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Database */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Database
            </CardTitle>
            <CardDescription className="text-muted-foreground">Database configuration and maintenance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Database Status</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Backup</span>
                <span className="text-sm text-foreground">Today, 03:00 AM</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Storage Used</span>
                <span className="text-sm text-foreground">2.4 GB / 10 GB</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-muted">Backup Now</Button>
              <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-muted">Optimize</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Services Management ─────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Services Management
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1">
                Create, edit, and delete services. Changes apply immediately to company assignments.
              </CardDescription>
            </div>
            <span className="text-sm text-muted-foreground">{services.length} service{services.length !== 1 ? 's' : ''}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Add new service */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Add New Service
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Service Name <span className="text-destructive">*</span></label>
                <Input
                  placeholder="e.g., Procurement of Vehicles"
                  value={newSvcName}
                  onChange={e => setNewSvcName(e.target.value)}
                  className="bg-input border-border"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddService(); }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
                <Input
                  placeholder="Brief description"
                  value={newSvcDesc}
                  onChange={e => setNewSvcDesc(e.target.value)}
                  className="bg-input border-border"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddService(); }}
                />
              </div>
            </div>
            {addSvcError && <p className="text-sm text-destructive">{addSvcError}</p>}
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleAddService}
              disabled={addingSvc || !newSvcName.trim()}
            >
              {addingSvc ? <Spinner className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Service
            </Button>
          </div>

          {/* Services list */}
          {servicesLoading ? (
            <div className="flex justify-center py-8"><Spinner className="h-6 w-6 text-primary" /></div>
          ) : services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No services yet. Add one above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Service Name</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium hidden sm:table-cell">Description</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium hidden md:table-cell">Slug</th>
                    <th className="px-4 py-2.5 text-muted-foreground font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(svc => (
                    <tr key={svc.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{svc.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell max-w-xs">
                        <span className="line-clamp-1">{(svc as any).description ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{svc.slug}</code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          <Button
                            variant="outline" size="sm"
                            className="h-7 px-2.5 border-border text-foreground hover:bg-muted"
                            onClick={() => openEditSvc(svc)}
                          >
                            <Pencil className="h-3 w-3 mr-1" />Edit
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            className="h-7 px-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive"
                            onClick={() => handleDeleteService(svc.id, svc.name)}
                            disabled={deletingSvcId === svc.id}
                          >
                            {deletingSvcId === svc.id
                              ? <span className="h-3 w-3 border border-destructive border-t-transparent rounded-full animate-spin" />
                              : <Trash2 className="h-3 w-3" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Service dialog ──────────────────────────────────────────────── */}
      <Dialog open={editSvc !== null} onOpenChange={open => { if (!open) setEditSvc(null); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Service</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update the service name or description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Service Name <span className="text-destructive">*</span></label>
              <Input
                value={editSvcName}
                onChange={e => setEditSvcName(e.target.value)}
                className="bg-input border-border"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Description (optional)</label>
              <Input
                value={editSvcDesc}
                onChange={e => setEditSvcDesc(e.target.value)}
                className="bg-input border-border"
              />
            </div>
            {editSvcError && <p className="text-sm text-destructive">{editSvcError}</p>}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setEditSvc(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground"
                onClick={handleEditService}
                disabled={savingSvc || !editSvcName.trim()}
              >
                {savingSvc ? <Spinner className="h-4 w-4" /> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
