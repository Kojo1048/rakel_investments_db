'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, X,
  LogIn, LogOut, FileUp, FileText,
  UserPlus, UserMinus, UserCheck, UserX,
  Building, Upload, Receipt, FileSignature, ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';

const LAST_SEEN_KEY = 'rakel_notifications_last_seen';
const POLL_INTERVAL = 30_000;

interface Notification {
  id: string;
  username: string;
  action: string;
  details: string | null;
  targetEntity: string | null;
  companyId: string | null;
  createdAt: string;
  company: { name: string } | null;
  /** Explicit route from aggregated notifications — takes priority over action-based routing. */
  link?: string;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  // Auth
  LOGIN:  { label: 'Login',  color: 'text-primary',          bg: 'bg-primary/10', icon: <LogIn  className="h-3.5 w-3.5" /> },
  LOGOUT: { label: 'Logout', color: 'text-muted-foreground', bg: 'bg-muted',       icon: <LogOut className="h-3.5 w-3.5" /> },
  // Documents
  DOCUMENT_UPLOAD:          { label: 'Doc Upload',       color: 'text-chart-2',    bg: 'bg-chart-2/10',     icon: <FileUp   className="h-3.5 w-3.5" /> },
  DOCUMENT_DELETE:          { label: 'Doc Deleted',      color: 'text-destructive', bg: 'bg-destructive/10', icon: <FileText className="h-3.5 w-3.5" /> },
  DOCUMENT_EXPIRY_REMINDER: { label: 'Expiry Reminder',  color: 'text-destructive', bg: 'bg-destructive/10', icon: <FileText className="h-3.5 w-3.5" /> },
  // Invoices
  INVOICE_CREATE: { label: 'Invoice Created', color: 'text-chart-3', bg: 'bg-chart-3/10', icon: <Receipt className="h-3.5 w-3.5" /> },
  INVOICE_UPDATE: { label: 'Invoice Updated', color: 'text-chart-2', bg: 'bg-chart-2/10', icon: <Receipt className="h-3.5 w-3.5" /> },
  // Contracts
  CONTRACT_CREATE: { label: 'Contract Created', color: 'text-chart-4', bg: 'bg-chart-4/10', icon: <FileSignature className="h-3.5 w-3.5" /> },
  CONTRACT_UPDATE: { label: 'Contract Updated', color: 'text-chart-3', bg: 'bg-chart-3/10', icon: <FileSignature className="h-3.5 w-3.5" /> },
  // Operations
  OPERATIONS_ENTRY: { label: 'Operations Log', color: 'text-primary', bg: 'bg-primary/10', icon: <ClipboardList className="h-3.5 w-3.5" /> },
  // Users
  USER_CREATE:  { label: 'User Created',  color: 'text-chart-3',    bg: 'bg-chart-3/10',     icon: <UserPlus  className="h-3.5 w-3.5" /> },
  USER_DELETE:  { label: 'User Deleted',  color: 'text-destructive', bg: 'bg-destructive/10', icon: <UserMinus className="h-3.5 w-3.5" /> },
  USER_APPROVE: { label: 'Approved',      color: 'text-primary',     bg: 'bg-primary/10',     icon: <UserCheck className="h-3.5 w-3.5" /> },
  USER_DECLINE: { label: 'Declined',      color: 'text-destructive', bg: 'bg-destructive/10', icon: <UserX    className="h-3.5 w-3.5" /> },
  // Companies
  COMPANY_CREATE: { label: 'Company Added',   color: 'text-chart-4', bg: 'bg-chart-4/10', icon: <Building className="h-3.5 w-3.5" /> },
  COMPANY_UPDATE: { label: 'Company Updated', color: 'text-chart-3', bg: 'bg-chart-3/10', icon: <Building className="h-3.5 w-3.5" /> },
  // Other
  DATA_IMPORT:         { label: 'Data Import',      color: 'text-chart-2', bg: 'bg-chart-2/10', icon: <Upload   className="h-3.5 w-3.5" /> },
  REGISTRATION_SUBMIT: { label: 'New Registration', color: 'text-chart-3', bg: 'bg-chart-3/10', icon: <UserPlus className="h-3.5 w-3.5" /> },
};

const FALLBACK_CONFIG = {
  label: 'System Event', color: 'text-muted-foreground', bg: 'bg-muted',
  icon: <Bell className="h-3.5 w-3.5" />,
};

// Returns the dashboard route to navigate to when a notification is clicked.
// If the aggregated feed supplied an explicit `link` we use it directly;
// otherwise we fall back to deriving the route from the action type.
function getNotificationRoute(n: Notification): string {
  if (n.link) return n.link;

  switch (n.action) {
    case 'DOCUMENT_UPLOAD':
    case 'DOCUMENT_DELETE':
    case 'DOCUMENT_EXPIRY_REMINDER':
      return n.companyId
        ? `/admin/company-documents/${n.companyId}`
        : '/admin/documents';

    case 'INVOICE_CREATE':
    case 'INVOICE_UPDATE':
      return n.companyId
        ? `/admin/invoices/${n.companyId}`
        : '/admin/invoices';

    case 'CONTRACT_CREATE':
    case 'CONTRACT_UPDATE':
      return '/company/contracts';

    case 'OPERATIONS_ENTRY':
      return n.companyId
        ? `/admin/operations/${n.companyId}`
        : '/company/operations';

    case 'USER_CREATE':
    case 'USER_DELETE':
    case 'USER_APPROVE':
    case 'USER_DECLINE':
      return '/admin/users';

    case 'COMPANY_CREATE':
    case 'COMPANY_UPDATE':
      return '/admin/companies';

    case 'REGISTRATION_SUBMIT':
      return '/admin/registrations';

    case 'DATA_IMPORT':
    case 'LOGIN':
    case 'LOGOUT':
    default:
      return '/admin/audit';
  }
}

function getLastSeen(): Date {
  try {
    const v = localStorage.getItem(LAST_SEEN_KEY);
    return v ? new Date(v) : new Date(0);
  } catch { return new Date(0); }
}

function persistLastSeen(d: Date) {
  try { localStorage.setItem(LAST_SEEN_KEY, d.toISOString()); } catch {}
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return 'Just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const router   = useRouter();

  const [open, setOpen]                   = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(false);

  const wrapperRef  = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<Date>(new Date(0));

  const countUnread = useCallback(
    (items: Notification[]) => items.filter(n => new Date(n.createdAt) > lastSeenRef.current).length,
    []
  );

  const fetchNotifications = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      // RAKEL_ADMIN uses the rich aggregated feed (Contract + Invoice + Operations + AuditLog).
      // SUPER_ADMIN keeps the AuditLog-only feed which already works for them.
      const endpoint =
        user?.role === 'RAKEL_ADMIN'
          ? '/api/notifications/rakel?limit=20'
          : '/api/v1/notifications?limit=30';

      const res = await fetch(endpoint, { credentials: 'include' });
      if (!res.ok) return;
      const { notifications: items = [] }: { notifications: Notification[] } = await res.json();
      setNotifications(items);
      setUnreadCount(countUnread(items));
    } catch {
      // network error — keep existing state
    } finally {
      if (showSpinner) setLoading(false);
    }
  // user?.role is stable per session; include it so the correct endpoint is
  // used if the component mounts before the auth state fully resolves.
  }, [countUnread, user?.role]);

  // Initial load + 30-second polling
  useEffect(() => {
    lastSeenRef.current = getLastSeen();
    fetchNotifications(true);
    const id = setInterval(() => fetchNotifications(false), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close panel when user clicks outside the widget
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const handleBellClick = useCallback(() => {
    const opening = !open;
    setOpen(opening);
    if (opening) {
      fetchNotifications(false).then(() => {
        const now = new Date();
        persistLastSeen(now);
        lastSeenRef.current = now;
        setUnreadCount(0);
      });
    }
  }, [open, fetchNotifications]);

  const handleMarkAllRead = useCallback(() => {
    const now = new Date();
    persistLastSeen(now);
    lastSeenRef.current = now;
    setUnreadCount(0);
    setNotifications(prev => [...prev]);
  }, []);

  const handleNotificationClick = useCallback((n: Notification) => {
    setOpen(false);
    router.push(getNotificationRoute(n));
  }, [router]);

  // All hooks must be above this guard (React rules of hooks)
  if (!user) return null;

  return (
    <div ref={wrapperRef} className="relative inline-flex">

      {/* Bell button */}
      <Button
        variant="ghost"
        size="sm"
        className="relative h-9 w-9 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
        onClick={handleBellClick}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white px-1 leading-none"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[380px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">

          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleMarkAllRead}
                >
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[440px] overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner className="h-5 w-5 text-primary" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-40" />
                <p className="text-sm font-medium text-foreground">All caught up</p>
                <p className="text-xs text-muted-foreground mt-1">No system notifications yet</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n, i) => {
                  const cfg     = ACTION_CONFIG[n.action] ?? FALLBACK_CONFIG;
                  const isUnread = new Date(n.createdAt) > lastSeenRef.current;
                  return (
                    <li
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={[
                        'px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors',
                        i < notifications.length - 1 ? 'border-b border-border/40' : '',
                        isUnread ? 'bg-primary/[0.04]' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-3">
                        {/* Unread dot */}
                        <span className={`mt-2 h-1.5 w-1.5 rounded-full flex-shrink-0 ${isUnread ? 'bg-primary' : 'bg-transparent'}`} />

                        {/* Action icon */}
                        <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                          {cfg.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[11px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                            <span className="text-xs font-medium text-foreground truncate max-w-[140px]">{n.username}</span>
                          </div>
                          {(n.details || n.targetEntity) && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                              {n.details ?? n.targetEntity}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                            {n.company && (
                              <>
                                <span className="text-muted-foreground/30 text-xs">·</span>
                                <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{n.company.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Last {notifications.length} events</p>
              <p className="text-[11px] text-muted-foreground">Auto-refreshes every 30s</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
