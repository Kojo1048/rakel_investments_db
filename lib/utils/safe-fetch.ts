/**
 * Fetch wrapper that ALWAYS resolves — never rejects.
 *
 * • Adds an AbortController timeout (default 8 s) so spinners never freeze.
 * • Returns `fallback` on network error, non-OK response, or timeout.
 * • Safe to use inside Promise.all — a failing request won't crash siblings.
 *
 * Usage:
 *   const data = await safeFetch('/api/v1/companies', { companies: [] }, 8000, { credentials: 'include' });
 */
export async function safeFetch<T>(
  url: string,
  fallback: T,
  timeoutMs = 8000,
  init: RequestInit = {}
): Promise<T> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

/** Convenience: authenticated safeFetch with credentials: 'include'. */
export function safeGet<T>(url: string, fallback: T, timeoutMs = 8000): Promise<T> {
  return safeFetch(url, fallback, timeoutMs, { credentials: 'include' });
}
