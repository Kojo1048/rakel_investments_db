'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Users, FileSignature, Receipt, ClipboardList,
  RefreshCw, Download, Calendar, TrendingUp,
  Building, CheckCircle, AlertCircle, FileBarChart2,
} from 'lucide-react';

// ─── Types defined locally — never import from a server route file ─────────────
// Importing from /app/api/... causes Next.js to traverse server-only modules
// (db → pg → Node.js internals) into the client bundle, crashing React.

interface UsersByCompany  { companyName: string; count: number }
interface ByStatus        { status: string; count: number }
interface InvoiceByStatus { status: string; count: number; total: number }
interface ByDepartment    { department: string; entries: number }

interface WeeklyReportData {
  weekLabel: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  generatedBy: string;
  newUsers: number;
  contractsCreated: number;
  invoicesGenerated: number;
  operationsLogged: number;
  invoiceTotalAmount: number;
  usersByCompany:    UsersByCompany[];
  contractsByStatus: ByStatus[];
  invoicesByStatus:  InvoiceByStatus[];
  topDepartments:    ByDepartment[];
}

interface SavedReport {
  key: string;
  updatedAt: string;
  data: WeeklyReportData;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-primary',    PAID:      'text-primary',
  PENDING: 'text-chart-3',   SENT:      'text-chart-3',  DRAFT: 'text-chart-3',
  EXPIRED: 'text-muted-foreground', CANCELLED: 'text-muted-foreground',
  COMPLETED: 'text-chart-2',
  OVERDUE: 'text-destructive',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: number | string; sub?: string
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{value ?? 0}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            {sub && <p className="text-xs text-primary mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportCard({ report, isSaved }: { report: WeeklyReportData; isSaved: boolean }) {
  const [expanded, setExpanded] = useState(false);

  // Guard: ensure arrays are always defined (old saved reports may lack new fields)
  const usersByCompany    = Array.isArray(report.usersByCompany)    ? report.usersByCompany    : [];
  const contractsByStatus = Array.isArray(report.contractsByStatus) ? report.contractsByStatus : [];
  const invoicesByStatus  = Array.isArray(report.invoicesByStatus)  ? report.invoicesByStatus  : [];
  const topDepartments    = Array.isArray(report.topDepartments)    ? report.topDepartments    : [];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-foreground text-base">{report.weekLabel}</CardTitle>
              {isSaved ? (
                <span className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  <CheckCircle className="h-3 w-3" />Saved
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-chart-3/10 text-chart-3 font-medium">
                  <AlertCircle className="h-3 w-3" />Live preview
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {fmtDate(report.periodStart)} — {fmtDate(report.periodEnd)}
            </p>
            <p className="text-xs text-muted-foreground">
              Generated {new Date(report.generatedAt).toLocaleString()} by {report.generatedBy}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground text-xs shrink-0"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? 'Hide details' : 'Show details'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={<Users        className="h-5 w-5 text-primary" />} label="New Users"          value={report.newUsers} />
          <MetricCard icon={<FileSignature className="h-5 w-5 text-primary" />} label="Contracts Created" value={report.contractsCreated} />
          <MetricCard icon={<Receipt      className="h-5 w-5 text-primary" />} label="Invoices Generated" value={report.invoicesGenerated}
            sub={report.invoiceTotalAmount > 0 ? fmt(report.invoiceTotalAmount) : undefined}
          />
          <MetricCard icon={<ClipboardList className="h-5 w-5 text-primary" />} label="Operations Logged" value={report.operationsLogged} />
        </div>

        {expanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-border">
            {usersByCompany.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">New Users by Company</p>
                <ul className="space-y-1">
                  {usersByCompany.map(row => (
                    <li key={row.companyName} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-foreground">
                        <Building className="h-3 w-3 text-muted-foreground" />{row.companyName}
                      </span>
                      <span className="font-medium text-foreground">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {contractsByStatus.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contracts by Status</p>
                <ul className="space-y-1">
                  {contractsByStatus.map(row => (
                    <li key={row.status} className="flex items-center justify-between text-sm">
                      <span className={`font-medium ${STATUS_COLORS[row.status] ?? 'text-foreground'}`}>
                        {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                      </span>
                      <span className="text-foreground">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {invoicesByStatus.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Invoices by Status</p>
                <ul className="space-y-1">
                  {invoicesByStatus.map(row => (
                    <li key={row.status} className="flex items-center justify-between text-sm gap-2">
                      <span className={`font-medium ${STATUS_COLORS[row.status] ?? 'text-foreground'}`}>
                        {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                      </span>
                      <span className="text-muted-foreground text-xs">{row.count} · {fmt(row.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {topDepartments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top Departments (Operations)</p>
                <ul className="space-y-1">
                  {topDepartments.map(row => (
                    <li key={row.department} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{row.department}</span>
                      <span className="text-muted-foreground">{row.entries} entries</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {usersByCompany.length === 0 && contractsByStatus.length === 0 &&
             invoicesByStatus.length === 0 && topDepartments.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full py-2">
                No detailed breakdown available for this period.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [preview,       setPreview]       = useState<WeeklyReportData | null>(null);
  const [savedReports,  setSavedReports]  = useState<SavedReport[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating,    setGenerating]    = useState(false);
  const [generateMsg,   setGenerateMsg]   = useState('');

  // Track mounted state so async callbacks don't update state after unmount
  const mountedRef    = useRef(true);
  const msgTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    };
  }, []);

  // ── Data loaders with AbortController + 10 s timeout ──────────────────────

  const loadPreview = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoadingPreview(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch('/api/v1/reports/weekly?preview=1', {
        credentials: 'include',
        signal: controller.signal,
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        setPreview(data.report ?? null);
      }
    } catch {
      // AbortError or network error — leave preview as null
    } finally {
      clearTimeout(timer);
      if (mountedRef.current) setLoadingPreview(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoadingHistory(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch('/api/v1/reports/weekly', {
        credentials: 'include',
        signal: controller.signal,
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        setSavedReports(data.reports ?? []);
      }
    } catch {
      // AbortError or network error — leave list empty
    } finally {
      clearTimeout(timer);
      if (mountedRef.current) setLoadingHistory(false);
    }
  }, []);

  // ── Mount: load both, with stable refs so the effect only runs once ─────────
  const loadPreviewRef = useRef(loadPreview);
  const loadHistoryRef = useRef(loadHistory);
  loadPreviewRef.current = loadPreview;
  loadHistoryRef.current = loadHistory;

  useEffect(() => {
    loadPreviewRef.current();
    loadHistoryRef.current();
  }, []); // empty — intentional; callbacks are stable and accessed via ref

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!mountedRef.current) return;
    setGenerating(true);
    setGenerateMsg('');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000); // reports can be slow

    try {
      const res = await fetch('/api/v1/reports/weekly', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      if (!mountedRef.current) return;
      if (res.ok) {
        setGenerateMsg('Report saved successfully.');
        await loadHistory();
      } else {
        setGenerateMsg('Failed to save report. Please try again.');
      }
    } catch {
      if (mountedRef.current) setGenerateMsg('Network error. Please try again.');
    } finally {
      clearTimeout(timer);
      if (mountedRef.current) {
        setGenerating(false);
        // Clear the status message after 4 seconds, guarded by mountedRef
        msgTimerRef.current = setTimeout(() => {
          if (mountedRef.current) setGenerateMsg('');
        }, 4000);
      }
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Weekly Reports</h1>
          <p className="text-muted-foreground">System-wide activity summary across all companies.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border text-foreground hover:bg-muted"
            onClick={() => { loadPreview(); loadHistory(); }}
            disabled={loadingPreview || loadingHistory}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingPreview || loadingHistory ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating
              ? <><Spinner className="h-4 w-4 mr-2" />Generating…</>
              : <><Download className="h-4 w-4 mr-2" />Generate &amp; Save Report</>}
          </Button>
        </div>
      </div>

      {generateMsg && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${
          generateMsg.includes('success')
            ? 'bg-primary/10 text-primary border border-primary/20'
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {generateMsg.includes('success')
            ? <CheckCircle className="h-4 w-4" />
            : <AlertCircle className="h-4 w-4" />}
          {generateMsg}
        </div>
      )}

      {/* Current Week Live Preview */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Current Week</h2>
          <span className="text-xs text-muted-foreground">(live, not yet saved)</span>
        </div>

        {loadingPreview ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-7 w-7 text-primary" />
          </div>
        ) : preview ? (
          <ReportCard report={preview} isSaved={false} />
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="p-10 text-center">
              <FileBarChart2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-foreground font-medium">Could not load current week data</p>
              <p className="text-sm text-muted-foreground mt-1">The preview timed out or the server is unavailable.</p>
              <Button variant="outline" size="sm" className="mt-4 border-border" onClick={loadPreview}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Saved Report History */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Saved Reports</h2>
          <span className="text-xs text-muted-foreground">({savedReports.length} total)</span>
        </div>

        {loadingHistory ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-7 w-7 text-primary" />
          </div>
        ) : savedReports.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-10 text-center">
              <FileBarChart2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-base font-medium text-foreground">No saved reports yet</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Click &ldquo;Generate &amp; Save Report&rdquo; to save the current week&apos;s data.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {savedReports.map(r => (
              <ReportCard key={r.key} report={r.data} isSaved />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
