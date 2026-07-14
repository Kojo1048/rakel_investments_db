/**
 * Fetch wrapper that ALWAYS resolves — never rejects.
 *
 * • Adds an AbortController timeout (default 8 s) so spinners never freeze.
 * • Returns `fallback` on network error, non-OK response, or timeout.
 * • Safe to use inside Promise.all — a failing request won't crash siblings.
 * • Optional `retries` (default 0, unchanged for existing callers) re-attempts
 *   on failure/timeout — guards against transient cold-start/latency blips
 *   that would otherwise silently render an empty page until manual refresh.
 *
 * Usage:
 *   const data = await safeFetch('/api/v1/companies', { companies: [] }, 8000, { credentials: 'include' });
 */
export async function safeFetch<T>(
  url: string,
  fallback: T,
  timeoutMs = 8000,
  init: RequestInit = {},
  retries = 0
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      if (res.ok) return (await res.json()) as T;
    } catch {
      // fall through — retry (if attempts remain) or return fallback below
    } finally {
      clearTimeout(timer);
    }
  }
  return fallback;
}

/** Convenience: authenticated safeFetch with credentials: 'include'. */
export function safeGet<T>(url: string, fallback: T, timeoutMs = 8000, retries = 0): Promise<T> {
  return safeFetch(url, fallback, timeoutMs, { credentials: 'include' }, retries);
}
