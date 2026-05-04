'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, AuthContextType, AuthStatus } from './types';

const AUTH_CACHE_KEY = 'rakel_auth_user';

function readCache(): User | null {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCache(user: User | null) {
  try {
    if (user) sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(AUTH_CACHE_KEY);
  } catch {}
}

// Resolve authStatus + isLoading in the same render so layouts and pages
// never see a transient state where authStatus='authenticated' but isLoading=true.
function resolveAuth(
  setUser: (u: User | null) => void,
  setAuthStatus: (s: AuthStatus) => void,
  setIsLoading: (v: boolean) => void,
  data: { user?: User } | null
) {
  if (data?.user) {
    writeCache(data.user);
    setUser(data.user);
    setAuthStatus('authenticated');
  } else {
    writeCache(null);
    setUser(null);
    setAuthStatus('unauthenticated');
  }
  setIsLoading(false); // always set last — React 18 batches all three in one render
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,       setUser]       = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [isLoading,  setIsLoading]  = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Restore cached user immediately — no spinner on page navigation
    const cached = readCache();
    if (cached) {
      setUser(cached);
      setAuthStatus('authenticated');
      setIsLoading(false);
    }

    // Safety timer: if the API call never settles (hung network, server crash)
    // resolve with 'error' so layouts can show a Retry button instead of
    // spinning forever. 3 s is ample on localhost; 7 s for slow connections.
    const TIMEOUT_MS = 3500;
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setIsLoading(false);
        setAuthStatus(prev => prev === 'loading' ? 'error' : prev);
      }
    }, TIMEOUT_MS);

    const controller = new AbortController();

    fetch('/api/v1/auth/me', { credentials: 'include', signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        clearTimeout(safetyTimer);
        if (cancelled) return;
        // Resolve auth + isLoading in one synchronous batch so the layouts
        // and child pages never see mismatched loading/auth state.
        resolveAuth(setUser, setAuthStatus, setIsLoading, data);
      })
      .catch(err => {
        clearTimeout(safetyTimer);
        if (cancelled || err?.name === 'AbortError') return;
        // Network error — keep cached user if present but mark loading done
        setIsLoading(false);
        setAuthStatus(prev => prev === 'authenticated' ? 'authenticated' : 'error');
      });

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(safetyTimer);
    };
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data?.user) {
        writeCache(data.user);
        setUser(data.user);
        setAuthStatus('authenticated');
        setIsLoading(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    writeCache(null);
    setUser(null);
    setAuthStatus('unauthenticated');
    setIsLoading(false);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    window.location.href = '/';
  };

  const refreshUser = async () => {
    setIsLoading(true);
    setAuthStatus('loading');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch('/api/v1/auth/me', { credentials: 'include', signal: controller.signal });
      const data = res.ok ? await res.json() : null;
      resolveAuth(setUser, setAuthStatus, setIsLoading, data);
    } catch (err: any) {
      if (err?.name !== 'AbortError') setAuthStatus('error');
      setIsLoading(false);
    } finally {
      clearTimeout(timer);
    }
  };

  return (
    <AuthContext.Provider value={{ user, authStatus, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
