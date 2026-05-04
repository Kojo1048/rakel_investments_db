'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileSignature, Receipt, FileText, ClipboardList,
  Upload, ArrowLeft, CheckCircle, AlertCircle, Building2,
} from 'lucide-react';
import { canSelectAnyCompany } from '@/lib/utils/rakel-staff';
import type { Company } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type DataType = 'contract' | 'invoice' | 'document' | 'operation';

interface SubmissionItem {
  id:          string;
  type:        DataType;
  title:       string;
  status?:     string;
  companyName: string | null;
  createdAt:   string;
}

const TYPE_CONFIG: Record<DataType, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  description: string;
}> = {
  contract:  { label: 'Contract',       icon: <FileSignature className="h-7 w-7" />, color: 'text-chart-4', bg: 'bg-chart-4/10',     description: 'Create a new contract record'         },
  invoice:   { label: 'Invoice',        icon: <Receipt       className="h-7 w-7" />, color: 'text-chart-3', bg: 'bg-chart-3/10',     description: 'Generate a new invoice'               },
  document:  { label: 'Document',       icon: <FileText      className="h-7 w-7" />, color: 'text-chart-2', bg: 'bg-chart-2/10',     description: 'Upload a document or report'          },
  operation: { label: 'Operations Log', icon: <ClipboardList className="h-7 w-7" />, color: 'text-primary', bg: 'bg-primary/10',     description: 'Log a daily operational entry'        },
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-primary/10 text-primary',
  PENDING:   'bg-chart-3/10 text-chart-3',
  DRAFT:     'bg-muted text-muted-foreground',
  PAID:      'bg-primary/10 text-primary',
  OVERDUE:   'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
  EXPIRED:   'bg-muted text-muted-foreground',
  COMPLETED: 'bg-chart-2/10 text-chart-2',
};

const ACTIVITY_TYPES = ['Excavation','Concreting','Welding','Installation','Inspection','Maintenance','Survey','Delivery','Assembly','Testing','Other'];
const DEPARTMENTS    = ['Engineering','Construction','Logistics','Maintenance','Quality Control','Health & Safety','Administration','Procurement','Site Operations','Other'];
const DOC_CATEGORIES = ['Reports','Guidelines','Plans','Manuals','Standards','Contracts','Other'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Company Selector ──────────────────────────────────────────────────────────

function CompanySelector({ companies, value, onChange }: {
  companies: Company[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '14px', fontWeight: 600 }}>
        Select Company <span style={{ color: 'red' }}>*</span>
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', width: '100%', background: 'var(--input)', color: 'var(--foreground)' }}
      >
        <option value="">— Select company —</option>
        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UploadHubPage() {
  const { user } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [companies,     setCompanies]     = useState<Company[]>([]);
  const [submissions,   setSubmissions]   = useState<SubmissionItem[]>([]);
  const [loadingSubs,   setLoadingSubs]   = useState(true);

  const [selectedType,    setSelectedType]    = useState<DataType | null>(null);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [submitting,      setSubmitting]      = useState(false);
  const [submitError,     setSubmitError]     = useState('');
  const [submitSuccess,   setSubmitSuccess]   = useState(false);

  const showCompanySelector = canSelectAnyCompany(user);

  // Contract fields
  const [cTitle,    setCTitle]    = useState('');
  const [cNumber,   setCNumber]   = useState('');
  const [cClient,   setCClient]   = useState('');
  const [cStart,    setCStart]    = useState('');
  const [cExpiry,   setCExpiry]   = useState('');
  const [cDesc,     setCDesc]     = useState('');

  // Invoice fields
  const [iClient,   setIClient]   = useState('');
  const [iAmount,   setIAmount]   = useState('');
  const [iStatus,   setIStatus]   = useState<'DRAFT'|'SENT'|'PAID'|'OVERDUE'|'CANCELLED'>('DRAFT');
  const [iIssue,    setIIssue]    = useState(new Date().toISOString().split('T')[0]);
  const [iDue,      setIDue]      = useState('');
  const [iNotes,    setINotes]    = useState('');

  // Document fields
  const [dTitle,    setDTitle]    = useState('');
  const [dDesc,     setDDesc]     = useState('');
  const [dCategory, setDCategory] = useState('');
  const [dReceived, setDReceived] = useState('');
  const [dExpiry,   setDExpiry]   = useState('');
  const [dFile,     setDFile]     = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Operations fields
  const [oActivity,  setOActivity]  = useState('');
  const [oDesc,      setODesc]      = useState('');
  const [oDate,      setODate]      = useState(new Date().toISOString().split('T')[0]);
  const [oDept,      setODept]      = useState('');
  const [oManpower,  setOManpower]  = useState('');
  const [oEqTotal,   setOEqTotal]   = useState('');
  const [oEqOp,      setOEqOp]      = useState('');
  const [oScore,     setOScore]     = useState('');
  const [oNotes,     setONotes]     = useState('');

  // ── Fetch data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (showCompanySelector) {
      fetch('/api/v1/companies', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { companies: [] })
        .then(d => setCompanies(d.companies ?? []))
        .catch(() => {});
    }
    loadSubmissions();
  }, []);

  const loadSubmissions = () => {
    setLoadingSubs(true);
    fetch('/api/v1/my-submissions', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setSubmissions(d.items ?? []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoadingSubs(false));
  };

  // ── Reset form ─────────────────────────────────────────────────────────────
  const resetForm = () => {
    setCTitle(''); setCNumber(''); setCClient(''); setCStart(''); setCExpiry(''); setCDesc('');
    setIClient(''); setIAmount(''); setIStatus('DRAFT'); setIIssue(new Date().toISOString().split('T')[0]); setIDue(''); setINotes('');
    setDTitle(''); setDDesc(''); setDCategory(''); setDReceived(''); setDExpiry(''); setDFile(null);
    setOActivity(''); setODesc(''); setODate(new Date().toISOString().split('T')[0]);
    setODept(''); setOManpower(''); setOEqTotal(''); setOEqOp(''); setOScore(''); setONotes('');
    setSelectedCompany('');
    setSubmitError('');
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);

    const companyId = selectedCompany || user?.companyId || undefined;

    try {
      let res: Response;

      if (selectedType === 'contract') {
        if (!cTitle) { setSubmitError('Contract title is required.'); setSubmitting(false); return; }
        res = await fetch('/api/v1/contracts', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: cTitle.trim(),
            contractNumber: cNumber || undefined,
            client: cClient || undefined,
            status: 'PENDING',
            startDate: cStart || undefined,
            expiryDate: cExpiry || undefined,
            description: cDesc || undefined,
            companyId,
          }),
        });

      } else if (selectedType === 'invoice') {
        if (!iClient || !iAmount) { setSubmitError('Client and amount are required.'); setSubmitting(false); return; }
        res = await fetch('/api/v1/invoices', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: iClient.trim(),
            amount: parseFloat(iAmount.replace(/,/g, '')),
            status: iStatus,
            issueDate: iIssue,
            dueDate: iDue || undefined,
            notes: iNotes || undefined,
            companyId,
          }),
        });

      } else if (selectedType === 'document') {
        if (!dTitle || !dFile || !dCategory) { setSubmitError('Title, category and file are required.'); setSubmitting(false); return; }
        const fd = new FormData();
        fd.append('file', dFile);
        fd.append('title', dTitle.trim());
        fd.append('category', dCategory);
        if (dDesc)     fd.append('description',  dDesc.trim());
        if (dReceived) fd.append('dateReceived', dReceived);
        if (dExpiry)   fd.append('expiryDate',   dExpiry);
        if (companyId) fd.append('companyId',    companyId);
        res = await fetch('/api/v1/documents', { method: 'POST', credentials: 'include', body: fd });

      } else if (selectedType === 'operation') {
        if (!oActivity || !oDept || !oManpower || !oScore) {
          setSubmitError('Activity type, department, manpower count, and performance score are required.');
          setSubmitting(false); return;
        }
        res = await fetch('/api/v1/operations', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityType:         oActivity,
            activityDescription:  oDesc || undefined,
            date:                 oDate,
            department:           oDept,
            manpowerCount:        parseInt(oManpower),
            equipmentTotal:       parseInt(oEqTotal) || 0,
            equipmentOperational: parseInt(oEqOp)    || 0,
            performanceScore:     parseFloat(oScore),
            notes:                oNotes || undefined,
            companyId,
          }),
        });

      } else { setSubmitting(false); return; }

      if (res!.ok) {
        setSubmitSuccess(true);
        resetForm();
        loadSubmissions();
        setTimeout(() => { setSubmitSuccess(false); setSelectedType(null); }, 2000);
      } else {
        const body = await res!.json().catch(() => ({}));
        const detail = body.issues
          ? Object.values(body.issues as Record<string, string[]>).flat()[0]
          : body.error;
        setSubmitError(detail ?? 'Submission failed. Please try again.');
      }
    } catch {
      setSubmitError('Network error. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderForm = () => {
    if (!selectedType) return null;
    const cfg = TYPE_CONFIG[selectedType];

    return (
      <div className="space-y-6">
        {/* Form header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedType(null); setSubmitError(''); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
            {cfg.icon}
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">New {cfg.label}</p>
            <p className="text-xs text-muted-foreground">{cfg.description}</p>
          </div>
        </div>

        {/* Company selector */}
        {showCompanySelector && companies.length > 0 && (
          <CompanySelector companies={companies} value={selectedCompany} onChange={setSelectedCompany} />
        )}

        {/* ── Dynamic form ── */}
        <div className="space-y-4">
          {selectedType === 'contract' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Contract Title <span style={{ color: 'red' }}>*</span></label>
                <Input placeholder="e.g. Service Agreement 2026" value={cTitle} onChange={e => setCTitle(e.target.value)} className="bg-input border-border" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Contract Number</label>
                  <Input placeholder="CTR-2026-001" value={cNumber} onChange={e => setCNumber(e.target.value)} className="bg-input border-border" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Client</label>
                  <Input placeholder="Client name" value={cClient} onChange={e => setCClient(e.target.value)} className="bg-input border-border" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Start Date</label>
                  <input type="date" value={cStart} onChange={e => setCStart(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', background: 'var(--input)', color: 'var(--foreground)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Expiry Date</label>
                  <input type="date" value={cExpiry} onChange={e => setCExpiry(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', background: 'var(--input)', color: 'var(--foreground)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Description</label>
                <Textarea placeholder="Contract details..." value={cDesc} onChange={e => setCDesc(e.target.value)} className="bg-input border-border" rows={3} />
              </div>
            </>
          )}

          {selectedType === 'invoice' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Client <span style={{ color: 'red' }}>*</span></label>
                <Input placeholder="Client or organisation" value={iClient} onChange={e => setIClient(e.target.value)} className="bg-input border-border" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Amount (USD) <span style={{ color: 'red' }}>*</span></label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--muted-foreground)', background: 'var(--muted)', flexShrink: 0 }}>USD</span>
                  <Input type="text" placeholder="0.00" value={iAmount}
                    onChange={e => { const raw = e.target.value.replace(/[^0-9.]/g, ''); setIAmount(raw); }}
                    className="bg-input border-border flex-1" />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Status</label>
                <Select value={iStatus} onValueChange={v => setIStatus(v as any)}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {(['DRAFT','SENT','PAID','OVERDUE','CANCELLED'] as const).map(s => (
                      <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Issue Date <span style={{ color: 'red' }}>*</span></label>
                  <input type="date" value={iIssue} onChange={e => setIIssue(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', background: 'var(--input)', color: 'var(--foreground)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Due Date</label>
                  <input type="date" value={iDue} onChange={e => setIDue(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', background: 'var(--input)', color: 'var(--foreground)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Notes</label>
                <Textarea placeholder="Optional notes..." value={iNotes} onChange={e => setINotes(e.target.value)} className="bg-input border-border" rows={2} />
              </div>
            </>
          )}

          {selectedType === 'document' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Document Title <span style={{ color: 'red' }}>*</span></label>
                <Input placeholder="Enter document title" value={dTitle} onChange={e => setDTitle(e.target.value)} className="bg-input border-border" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Category <span style={{ color: 'red' }}>*</span></label>
                <Select value={dCategory} onValueChange={setDCategory}>
                  <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Description</label>
                <Textarea placeholder="Brief description" value={dDesc} onChange={e => setDDesc(e.target.value)} className="bg-input border-border" rows={2} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Date Received</label>
                  <input type="date" value={dReceived} onChange={e => setDReceived(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', background: 'var(--input)', color: 'var(--foreground)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Expiry Date</label>
                  <input type="date" value={dExpiry} onChange={e => setDExpiry(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', background: 'var(--input)', color: 'var(--foreground)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>File <span style={{ color: 'red' }}>*</span></label>
                <input type="file" ref={fileRef} accept=".pdf,.doc,.docx,.xlsx,.csv" onChange={e => setDFile(e.target.files?.[0] ?? null)} style={{ fontSize: '14px' }} />
                {dFile && <p style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>{dFile.name} ({(dFile.size / 1024 / 1024).toFixed(1)} MB)</p>}
              </div>
            </>
          )}

          {selectedType === 'operation' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Activity Type <span style={{ color: 'red' }}>*</span></label>
                <Select value={oActivity} onValueChange={setOActivity}>
                  <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select activity" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {ACTIVITY_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Description</label>
                <Textarea placeholder="Activity description..." value={oDesc} onChange={e => setODesc(e.target.value)} className="bg-input border-border" rows={2} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Department <span style={{ color: 'red' }}>*</span></label>
                  <Select value={oDept} onValueChange={setODept}>
                    <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Date</label>
                  <input type="date" value={oDate} onChange={e => setODate(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', background: 'var(--input)', color: 'var(--foreground)' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Manpower *', value: oManpower, set: setOManpower, placeholder: '0' },
                  { label: 'Equip. Total', value: oEqTotal, set: setOEqTotal, placeholder: '0' },
                  { label: 'Operational', value: oEqOp, set: setOEqOp, placeholder: '0' },
                  { label: 'Score (0–100) *', value: oScore, set: setOScore, placeholder: '85' },
                ].map(({ label, value, set, placeholder }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500 }}>{label}</label>
                    <Input type="number" min="0" placeholder={placeholder} value={value} onChange={e => set(e.target.value)} className="bg-input border-border" />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Notes</label>
                <Textarea placeholder="Additional notes..." value={oNotes} onChange={e => setONotes(e.target.value)} className="bg-input border-border" rows={2} />
              </div>
            </>
          )}
        </div>

        {/* Error / Success */}
        {submitError && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{submitError}
          </div>
        )}
        {submitSuccess && (
          <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-lg px-3 py-2.5">
            <CheckCircle className="h-4 w-4" />Submitted successfully!
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <Button variant="outline" className="border-border" onClick={() => { setSelectedType(null); resetForm(); }}>Cancel</Button>
          <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <><Spinner className="h-4 w-4 mr-2" />Submitting…</> : `Submit ${TYPE_CONFIG[selectedType].label}`}
          </Button>
        </div>
      </div>
    );
  };

  // ── Page ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload Data</h1>
        <p className="text-muted-foreground mt-1">
          Submit records on behalf of any company. All submissions are tracked to your account.
        </p>
      </div>

      {/* ── Step 1: Type selector or form ──────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardContent className="p-5">
          {!selectedType ? (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-foreground">Select data type to upload:</p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(TYPE_CONFIG) as [DataType, typeof TYPE_CONFIG[DataType]][]).map(([type, cfg]) => (
                  <button
                    key={type}
                    onClick={() => { setSelectedType(type); setSubmitError(''); setSubmitSuccess(false); }}
                    className={`flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 transition-colors text-left group`}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
                      <p className="text-xs text-muted-foreground">{cfg.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            renderForm()
          )}
        </CardContent>
      </Card>

      {/* ── My Submissions ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">My Submissions</h2>
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {loadingSubs ? (
              <div className="flex justify-center py-10"><Spinner className="h-6 w-6 text-primary" /></div>
            ) : submissions.length === 0 ? (
              <div className="py-12 text-center">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-40" />
                <p className="text-sm font-medium text-foreground">No submissions yet</p>
                <p className="text-xs text-muted-foreground mt-1">Your uploaded records will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      {['Type', 'Title', 'Company', 'Status', 'Date'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map(s => {
                      const cfg = TYPE_CONFIG[s.type];
                      return (
                        <tr key={`${s.type}-${s.id}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                              {cfg.icon && <span className="scale-75">{cfg.icon}</span>}
                              {cfg.label}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground max-w-[200px]">
                            <span className="truncate block">{s.title}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{s.companyName ?? '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {s.status && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] ?? 'bg-muted text-muted-foreground'}`}>
                                {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(s.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
