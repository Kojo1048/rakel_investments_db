'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[AdminError]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <h2 className="text-lg font-semibold text-foreground">Page error</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {error?.message ?? 'This page crashed. Check the browser console for the real error message.'}
      </p>
      {process.env.NODE_ENV === 'development' && error?.stack && (
        <pre className="mt-2 max-w-2xl overflow-auto rounded bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap">
          {error.stack}
        </pre>
      )}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.push('/admin')}>Go to Dashboard</Button>
        <Button onClick={reset}>Retry</Button>
      </div>
    </div>
  );
}
