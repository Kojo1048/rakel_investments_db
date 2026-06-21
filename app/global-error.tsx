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
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Error — Rakel Investments DBMS</title>
        <style dangerouslySetInnerHTML={{ __html: `
          *,*::before,*::after{box-sizing:border-box}
          body{margin:0;font-family:system-ui,-apple-system,sans-serif;
               background:#0f172a;color:#f1f5f9;
               display:flex;min-height:100vh;align-items:center;justify-content:center}
          .card{text-align:center;padding:2.5rem;max-width:560px;width:100%}
          .icon{font-size:3rem;margin-bottom:1rem}
          h2{margin:0 0 0.75rem;font-size:1.375rem;font-weight:600}
          p{margin:0 0 1.5rem;color:#94a3b8;font-size:0.9375rem;line-height:1.6}
          pre{text-align:left;background:#1e293b;border:1px solid #334155;border-radius:0.5rem;
              padding:1rem;font-size:0.75rem;color:#94a3b8;overflow:auto;
              max-height:200px;white-space:pre-wrap;word-break:break-word;margin:0 0 1.5rem}
          .actions{display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap}
          button{padding:0.5rem 1.25rem;border:none;border-radius:0.375rem;
                 font-size:0.875rem;font-weight:500;cursor:pointer;transition:opacity .15s}
          button:hover{opacity:0.85}
          .primary{background:#3b82f6;color:#fff}
          .secondary{background:#1e293b;color:#f1f5f9;border:1px solid #334155}
        ` }} />
      </head>
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
