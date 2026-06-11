'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console so the real crash message is visible in the terminal
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-8">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {error?.message ?? 'An unexpected error occurred. Check the browser console for details.'}
      </p>
      {error?.stack && (
        <pre className="mt-2 max-w-2xl overflow-auto rounded bg-muted p-4 text-xs text-muted-foreground whitespace-pre-wrap">
          {error.stack}
        </pre>
      )}
      <Button onClick={reset} className="mt-4">Try again</Button>
    </div>
  );
}
