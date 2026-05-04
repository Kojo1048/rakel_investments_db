'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { NotificationBell } from '@/components/notification-bell';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw } from 'lucide-react';

// RAKEL_ADMIN is allowed read-only access to /superadmin/documents specifically.
// All other /superadmin/* routes remain SUPER_ADMIN only.
const SUPERADMIN_ALLOWED = ['SUPER_ADMIN', 'RAKEL_ADMIN'];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, authStatus, refreshUser } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/');
      return;
    }
    if (authStatus === 'authenticated' && user) {
      // RAKEL_ADMIN may only access /superadmin/documents; bounce all other routes
      if (user.role === 'RAKEL_ADMIN' && !window.location.pathname.startsWith('/superadmin/documents')) {
        router.replace('/admin');
        return;
      }
      if (!SUPERADMIN_ALLOWED.includes(user.role)) {
        router.replace('/');
      }
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

  if (!user || user.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 h-12 flex items-center justify-between px-6 border-b border-border bg-background">
          <span className="text-xs font-medium text-muted-foreground">Super Admin</span>
          <NotificationBell />
        </header>
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
