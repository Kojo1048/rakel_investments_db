'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getTimeoutConfig, WARNING_SECONDS } from '@/lib/session-timeout';
import { Button } from '@/components/ui/button';
import { Clock, LogOut } from 'lucide-react';

const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click',
] as const;

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_SECONDS);

  // Refs for timer handles so callbacks never go stale
  const logoutTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningActiveRef = useRef(false); // mirrors showWarning without closure staleness
  const logoutRef        = useRef(logout);
  logoutRef.current = logout;

  const clearAll = useCallback(() => {
    if (logoutTimerRef.current)  clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current)    clearInterval(countdownRef.current);
  }, []);

  const startTimers = useCallback(() => {
    clearAll();
    setShowWarning(false);
    warningActiveRef.current = false;

    const { enabled, minutes } = getTimeoutConfig();
    if (!enabled) return;

    const totalMs   = minutes * 60 * 1000;
    // For very short timeouts the warning fires immediately (warningMs = 0)
    const warningMs = Math.max(0, totalMs - WARNING_SECONDS * 1000);
    // Actual countdown length shown in UI
    const warningSecs = Math.min(WARNING_SECONDS, Math.round((totalMs - warningMs) / 1000));

    // Schedule warning dialog
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      warningActiveRef.current = true;
      setCountdown(warningSecs);

      countdownRef.current = setInterval(() => {
        setCountdown(c => Math.max(0, c - 1));
      }, 1000);
    }, warningMs);

    // Schedule actual logout
    logoutTimerRef.current = setTimeout(() => {
      clearAll();
      logoutRef.current();
    }, totalMs);
  }, [clearAll]);

  // Re-read config and restart when user saves new settings (same-tab custom event)
  useEffect(() => {
    const handler = () => { if (user) startTimers(); };
    window.addEventListener('rakel:timeout-config-changed', handler);
    return () => window.removeEventListener('rakel:timeout-config-changed', handler);
  }, [user, startTimers]);

  useEffect(() => {
    if (!user) {
      clearAll();
      setShowWarning(false);
      warningActiveRef.current = false;
      return;
    }

    startTimers();

    const onActivity = () => {
      // When the warning is showing, only the "Stay Logged In" button resets — not passive activity
      if (warningActiveRef.current) return;
      startTimers();
    };

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      clearAll();
    };
  }, [user, startTimers, clearAll]);

  const handleStayLoggedIn = useCallback(() => {
    startTimers();
  }, [startTimers]);

  const handleLogoutNow = useCallback(() => {
    clearAll();
    logoutRef.current();
  }, [clearAll]);

  return (
    <>
      {children}

      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Dialog */}
          <div className="relative z-10 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-full bg-chart-3/15 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-foreground font-semibold text-sm">Session Expiring</p>
                <p className="text-muted-foreground text-xs">You have been inactive</p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg py-5 px-4 mb-5 text-center">
              <p className="text-5xl font-bold text-foreground tabular-nums leading-none">
                {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
              </p>
              <p className="text-xs text-muted-foreground mt-2">until automatic logout</p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-border text-foreground hover:bg-muted"
                onClick={handleLogoutNow}
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                Log Out
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleStayLoggedIn}
              >
                Stay Logged In
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
