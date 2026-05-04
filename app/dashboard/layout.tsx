'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw } from 'lucide-react';

const ALLOWED = ['COMPANY_ADMIN', 'STAFF', 'SUPER_ADMIN', 'RAKEL_ADMIN', 'CEO'];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, authStatus, refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/');
    if (authStatus === 'authenticated' && user && !ALLOWED.includes(user.role)) router.replace('/');
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

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
