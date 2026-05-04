'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { UserCheck, UserX, Clock, Mail, Building, FileText, CheckCircle, XCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { PendingRegistration } from '@/lib/types';
import { safeGet } from '@/lib/utils/safe-fetch';

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [activeUserCount, setActiveUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedReg, setSelectedReg] = useState<PendingRegistration | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      safeGet('/api/v1/registrations', { registrations: [] }),
      safeGet('/api/v1/users?status=ACTIVE&limit=1', { total: 0 }),
    ]).then(([regData, userData]) => {
      setRegistrations(regData.registrations ?? []);
      setActiveUserCount(userData.total ?? 0);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (regId: string, action: 'approve' | 'decline') => {
    setProcessing(regId);
    try {
      const res = await fetch(`/api/v1/registrations/${regId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setIsViewOpen(false);
        fetchData();
      }
    } catch {
      // ignore
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pending Registrations</h1>
        <p className="text-muted-foreground">Review and approve or decline user registration requests.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10 text-chart-3"><Clock className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold text-foreground">{loading ? '…' : registrations.length}</p><p className="text-sm text-muted-foreground">Pending</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><CheckCircle className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold text-foreground">{loading ? '…' : activeUserCount}</p><p className="text-sm text-muted-foreground">Active Users</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><XCircle className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold text-foreground">—</p><p className="text-sm text-muted-foreground">Declined (historical)</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-primary" /></div>
      ) : registrations.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-primary mb-4" />
            <h3 className="text-lg font-medium text-foreground">No Pending Registrations</h3>
            <p className="text-muted-foreground">All registration requests have been processed.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {registrations.map((reg) => (
            <Card key={reg.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-chart-3/10 text-chart-3 flex-shrink-0">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-foreground">{reg.fullName}</h3>
                    <p className="text-sm text-muted-foreground">@{reg.username}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground">
                        <Mail className="h-3 w-3" />{reg.email}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-chart-2/10 text-chart-2">
                        {reg.requestedRole === 'STAFF' ? 'Staff' : 'Company Admin'}
                      </span>
                    </div>
                    {reg.companyName && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                        <Building className="h-3 w-3" />{reg.companyName}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-3">
                    Submitted {new Date(reg.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 border-border text-foreground hover:bg-muted" onClick={() => { setSelectedReg(reg); setIsViewOpen(true); }}>
                      <FileText className="h-3 w-3 mr-1" />View Details
                    </Button>
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => handleAction(reg.id, 'approve')} disabled={processing === reg.id}>
                      {processing === reg.id ? <Spinner className="h-3 w-3 mr-1" /> : <UserCheck className="h-3 w-3 mr-1" />}Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleAction(reg.id, 'decline')} disabled={processing === reg.id}>
                      <UserX className="h-3 w-3 mr-1" />Decline
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Registration Details</DialogTitle>
            <DialogDescription className="text-muted-foreground">Review the registration request details.</DialogDescription>
          </DialogHeader>
          {selectedReg && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Full Name</p><p className="text-sm font-medium text-foreground">{selectedReg.fullName}</p></div>
                <div><p className="text-xs text-muted-foreground">Username</p><p className="text-sm font-medium text-foreground">{selectedReg.username}</p></div>
                <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-medium text-foreground">{selectedReg.email}</p></div>
                <div><p className="text-xs text-muted-foreground">Requested Role</p><p className="text-sm font-medium text-foreground">{selectedReg.requestedRole === 'STAFF' ? 'Staff' : 'Company Admin'}</p></div>
                {selectedReg.companyName && (
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Company</p><p className="text-sm font-medium text-foreground">{selectedReg.companyName}</p></div>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reason for Access</p>
                <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">{selectedReg.reason}</p>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1 border-border" onClick={() => setIsViewOpen(false)}>Close</Button>
                <Button className="flex-1 bg-primary text-primary-foreground" onClick={() => handleAction(selectedReg.id, 'approve')} disabled={processing === selectedReg.id}>Approve</Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleAction(selectedReg.id, 'decline')} disabled={processing === selectedReg.id}>Decline</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
