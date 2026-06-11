'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { NotificationBell } from '@/components/notification-bell';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, WifiOff, RefreshCw } from 'lucide-react';
import type { Service } from '@/lib/types';

const ALLOWED          = ['COMPANY_ADMIN', 'STAFF', 'CEO', 'SUPER_ADMIN', 'RAKEL_ADMIN'];
// STAFF no longer require a company — they select one per-submission in the Upload Hub
const COMPANY_REQUIRED = ['COMPANY_ADMIN'];

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const { user, authStatus, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [services,  setServices]  = useState<Service[]>([]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/');
      return;
    }
    if (authStatus === 'authenticated' && user && !ALLOWED.includes(user.role)) {
      router.replace('/');
      return;
    }
    // Load company services once we know who the user is
    if (authStatus === 'authenticated' && user && ALLOWED.includes(user.role)) {
      if (!user.companyId) {
        if (COMPANY_REQUIRED.includes(user.role)) {
          setLoadError('Your account has not been assigned to a company. Please contact an administrator.');
        }
        return;
      }
      fetch(`/api/v1/companies/${user.companyId}`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => { setServices(data.company?.services ?? []); setLoadError(null); })
        .catch(() => {
          if (COMPANY_REQUIRED.includes(user.role)) {
            setLoadError('The company assigned to your account could not be found. Please contact an administrator.');
          }
        });
    }
  }, [authStatus, user, router]);

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (authStatus === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <WifiOff className="h-10 w-10 text-muted-foreground" />
        <p className="text-foreground font-medium">Unable to reach the server</p>
        <p className="text-sm text-muted-foreground">Check that the dev server and database are running.</p>
        <Button onClick={refreshUser} className="mt-2">
          <RefreshCw className="h-4 w-4 mr-2" />Retry
        </Button>
      </div>
    );
  }

  if (!user || !ALLOWED.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (loadError && COMPANY_REQUIRED.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive/50 bg-card">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Account Setup Incomplete</h2>
            <p className="text-muted-foreground mb-6">{loadError}</p>
            <Button onClick={() => { logout(); router.push('/'); }} variant="outline" className="w-full border-border">
              <ArrowLeft className="mr-2 h-4 w-4" />Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar services={services} />
      <div className="pl-64 flex flex-col min-h-screen">
        {(user.role === 'SUPER_ADMIN' || user.role === 'RAKEL_ADMIN') && (
          <header className="sticky top-0 z-10 h-12 flex items-center justify-end gap-3 px-6 border-b border-border bg-background">
            <span className="text-xs text-muted-foreground">
              {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Rakel Admin'}
            </span>
            <NotificationBell />
          </header>
        )}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
