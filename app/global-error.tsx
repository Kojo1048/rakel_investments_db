'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
     
      <body>
        <div className="card">
          <div className="icon">⚠️</div>
          <h2>Something went wrong</h2>
          <p>
            {error?.message ?? 'An unexpected error occurred. Check the browser console for details.'}
          </p>
          {error?.digest && (
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Error ID: {error.digest}
            </p>
          )}
          {error?.stack && process.env.NODE_ENV !== 'production' && (
            <pre>{error.stack}</pre>
          )}
          <div className="actions">
            <button className="primary" onClick={reset}>Try again</button>
            <button
              className="secondary"
              onClick={() => { window.location.href = '/'; }}
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
