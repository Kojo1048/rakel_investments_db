'use client';


import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { NotificationBell } from '@/components/notification-bell';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw } from 'lucide-react';

const ALLOWED = ['SUPER_ADMIN', 'RAKEL_ADMIN'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, authStatus, refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect when the server explicitly confirmed "no session".
    // Do NOT redirect on 'error' — that would loop back via the middleware.
    if (authStatus === 'unauthenticated') {
      router.replace('/');
      return;
    }
    if (authStatus === 'authenticated' && user && !ALLOWED.includes(user.role)) {
      router.replace('/');
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

  // 'unauthenticated' or wrong role — show spinner while redirect fires
  if (!user || !ALLOWED.includes(user.role)) {
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
