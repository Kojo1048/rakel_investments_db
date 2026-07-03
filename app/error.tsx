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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem',
        fontFamily: 'system-ui',
      }}
    >
      <h2>Something went wrong</h2>

      <p>{error.message}</p>

      <button
        onClick={reset}
        style={{
          padding: '10px 20px',
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  );
}