'use client';
export const dynamic = 'force-dynamic';

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
  Upload, ArrowLeft, CheckCircle, AlertCircle, Building2, Paperclip, X,
} from 'lucide-react';
import type { Company } from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────

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
  contract:  { label: 'Contract',       icon: <FileSignature className="h-7 w-7" />, color: 'text-chart-4', bg: 'bg-chart-4/10', description: 'Create a new contract record'  },
  invoice:   { label: 'Invoice',        icon: <Receipt       className="h-7 w-7" />, color: 'text-chart-3', bg: 'bg-chart-3/10', description: 'Generate a new invoice'          },
  document:  { label: 'Document',       icon: <FileText      className="h-7 w-7" />, color: 'text-chart-2', bg: 'bg-chart-2/10', description: 'Upload a document or report'    },
  operation: { label: 'Operations Log', icon: <ClipboardList className="h-7 w-7" />, color: 'text-primary', bg: 'bg-primary/10',  description: 'Log a daily operational entry' },
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
const DOC_CATEGORIES = ['Contracts Signed','Invoice','Business Documents','Submitted Bidding Documents','Past Experiences'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── File picker component ─────────────────────────────────────────────────────

function FilePicker({ file, onChange, label = 'Attachment' }: {
  file: File | null;
  onChange: (f: File | null) => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '14px', fontWeight: 500 }}>
        <Paperclip className="inline h-3.5 w-3.5 mr-1 opacity-60" />
        {label} <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
      </label>
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--muted)' }}>
          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
          <span style={{ fontSize: '13px', color: 'var(--foreground)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name} <span style={{ color: 'var(--muted-foreground)' }}>({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
          </span>
          <button
            type="button"
            onClick={() => { onChange(null); if (ref.current) ref.current.value = ''; }}
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: '1px dashed var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
        >
          <Upload className="h-4 w-4 flex-shrink-0" />
          Click to attach a file (PDF, DOC, DOCX, XLSX, CSV — max 50 MB)
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept=".pdf,.doc,.docx,.xlsx,.csv"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
        style={{ display: 'none' }}
      />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UploadHubPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { user } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [companies,      setCompanies]      = useState<Company[]>([]);
  const [submissions,    setSubmissions]    = useState<SubmissionItem[]>([]);
  const [loadingSubs,    setLoadingSubs]    = useState(true);

  const [selectedType,    setSelectedType]    = useState<DataType | null>(null);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [submitting,       setSubmitting]       = useState(false);
  const [submitError,      setSubmitError]      = useState('');
  const [submitSuccess,    setSubmitSuccess]    = useState(false);
  const [submitAttempted,  setSubmitAttempted]  = useState(false);

  // Contract fields
  const [cTitle,  setCTitle]  = useState('');
  const [cNumber, setCNumber] = useState('');
  const [cClient, setCClient] = useState('');
  const [cStart,  setCStart]  = useState('');
  const [cExpiry, setCExpiry] = useState('');
  const [cDesc,   setCDesc]   = useState('');
  const [cFile,   setCFile]   = useState<File | null>(null);

  // Invoice fields
  const [iClient,   setIClient]   = useState('');
  const [iAmount,   setIAmount]   = useState('');
  const [iCurrency, setICurrency] = useState<'NLE' | 'USD' | 'GBP' | 'EUR'>('NLE');
  const [iStatus,   setIStatus]   = useState<'DRAFT' | 'PAID' | 'OVERDUE'>('DRAFT');
  const [iIssue,    setIIssue]    = useState(new Date().toISOString().split('T')[0]);
  const [iDue,      setIDue]      = useState('');
  const [iNotes,    setINotes]    = useState('');
  const [iFile,     setIFile]     = useState<File | null>(null);

  // Document fields
  const [dTitle,    setDTitle]    = useState('');
  const [dDesc,     setDDesc]     = useState('');
  const [dCategory, setDCategory] = useState('');
  const [dReceived, setDReceived] = useState('');
  const [dExpiry,   setDExpiry]   = useState('');
  const [dFile,     setDFile]     = useState<File | null>(null);

  // Operations fields
  const [oActivity, setOActivity] = useState('');
  const [oDesc,     setODesc]     = useState('');
  const [oDate,     setODate]     = useState(new Date().toISOString().split('T')[0]);
  const [oDept,     setODept]     = useState('');
  const [oManpower, setOManpower] = useState('');
  const [oEqTotal,  setOEqTotal]  = useState('');
  const [oEqOp,     setOEqOp]     = useState('');
  const [oScore,    setOScore]    = useState('');
  const [oNotes,    setONotes]    = useState('');
  const [oFile,     setOFile]     = useState<File | null>(null);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  // Declared before the useEffect that calls it so the const binding is
  // initialized when the effect fires (avoids TDZ ReferenceError on first render).
  const loadSubmissions = () => {
    setLoadingSubs(true);
    fetch('/api/v1/my-submissions', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setSubmissions(d.items ?? []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoadingSubs(false));
  };

  useEffect(() => {
    // All users need the company list now
    fetch('/api/v1/companies', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { companies: [] })
      .then(d => {
        const list: Company[] = d.companies ?? [];
        setCompanies(list);
        // Pre-select user's own company if they have one
        if (user?.companyId && !selectedCompany) {
          const own = list.find(c => c.id === user.companyId);
          if (own) setSelectedCompany(own.id);
        }
      })
      .catch(() => {});
    loadSubmissions();
  }, []);

  if (!mounted) return null;

  // ── Field-level validation ─────────────────────────────────────────────────
  // Returns a map of fieldKey → error message for every missing required field.
  const getErrors = (type: DataType | null): Record<string, string> => {
    const e: Record<string, string> = {};
    if (type === 'contract') {
      if (!cTitle.trim())   e.cTitle   = 'Contract title is required';
      if (!cNumber.trim())  e.cNumber  = 'Contract number is required';
      if (!cClient.trim())  e.cClient  = 'Client name is required';
      if (!cStart)          e.cStart   = 'Start date is required';
      if (!cExpiry)         e.cExpiry  = 'Expiry date is required';
      if (!cDesc.trim())    e.cDesc    = 'Description is required';
      if (!cFile)           e.cFile    = 'Contract file is required';
    }
    if (type === 'invoice') {
      if (!iClient.trim())  e.iClient  = 'Client is required';
      if (!iAmount)         e.iAmount  = 'Amount is required';
      if (!iDue)            e.iDue     = 'Due date is required';
      if (!iNotes.trim())   e.iNotes   = 'Notes are required';
      if (!iFile)           e.iFile    = 'Invoice file is required (name must contain "invoice")';
    }
    if (type === 'document') {
      if (!dTitle.trim())   e.dTitle    = 'Document title is required';
      if (!dCategory)       e.dCategory = 'Category is required';
      if (!dReceived)       e.dReceived = 'Date received is required';
      if (!dExpiry)         e.dExpiry   = 'Expiry date is required';
      if (!dDesc.trim())    e.dDesc     = 'Description is required';
      if (!dFile)           e.dFile     = 'File is required (name must match document title)';
    }
    if (type === 'operation') {
      if (!oActivity)          e.oActivity  = 'Activity type is required';
      if (!oDept)              e.oDept      = 'Department is required';
      if (!oManpower)          e.oManpower  = 'Manpower count is required';
      if (!oEqTotal)           e.oEqTotal   = 'Equipment total is required';
      if (!oEqOp)              e.oEqOp      = 'Operational status (equipment operational) is required';
      if (!oScore)             e.oScore     = 'Performance score is required';
      if (!oNotes.trim())      e.oNotes     = 'Notes are required';
      if (!oFile)              e.oFile      = 'Operations file is required';
    }
    return e;
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setSubmitAttempted(false);
    setCTitle(''); setCNumber(''); setCClient(''); setCStart(''); setCExpiry(''); setCDesc(''); setCFile(null);
    setIClient(''); setIAmount(''); setICurrency('NLE'); setIStatus('DRAFT');
    setIIssue(new Date().toISOString().split('T')[0]); setIDue(''); setINotes(''); setIFile(null);
    setDTitle(''); setDDesc(''); setDCategory(''); setDReceived(''); setDExpiry(''); setDFile(null);
    setOActivity(''); setODesc(''); setODate(new Date().toISOString().split('T')[0]);
    setODept(''); setOManpower(''); setOEqTotal(''); setOEqOp(''); setOScore(''); setONotes(''); setOFile(null);
    setSubmitError('');
  };

  // ── Upload a file as a Document attachment ─────────────────────────────────
  const uploadAttachment = async (file: File, opts: {
    title: string;
    category: string;
    companyId?: string;
    contractId?: string;
    description?: string;
  }) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', opts.title);
    fd.append('category', opts.category);
    if (opts.companyId)  fd.append('companyId',  opts.companyId);
    if (opts.contractId) fd.append('contractId', opts.contractId);
    if (opts.description) fd.append('description', opts.description);
    const res = await fetch('/api/v1/documents', { method: 'POST', credentials: 'include', body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.warn('[upload-hub] attachment upload failed:', body.error);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitAttempted(true);

    if (!selectedCompany) {
      setSubmitError('Please select a company before submitting.');
      return;
    }

    // ── Mandatory field validation ───────────────────────────────────────────
    const validationErrors = getErrors(selectedType);
    if (Object.keys(validationErrors).length > 0) {
      const first = Object.values(validationErrors)[0];
      setSubmitError(`Please complete all required fields. ${first}`);
      return;
    }

    // ── File-name validation (frontend, before upload) ──────────────────────
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const baseOf = (f: File) => f.name.replace(/\.[^.]+$/, '').trim();

    if (selectedType === 'contract' && cFile) {
      if (norm(baseOf(cFile)) !== norm(cTitle)) {
        setSubmitError(`File name must match the Contract Title. Expected: "${cTitle}"`);
        return;
      }
    }
    if (selectedType === 'invoice' && iFile) {
      if (!iFile.name.toLowerCase().includes('invoice')) {
        setSubmitError('Invoice file name must contain the word "invoice" (e.g. invoice_2026.pdf).');
        return;
      }
    }
    if (selectedType === 'document' && dFile) {
      if (norm(baseOf(dFile)) !== norm(dTitle)) {
        setSubmitError(`File name must match the Document Title. Expected: "${dTitle}"`);
        return;
      }
    }

    setSubmitting(true);
    try {
      let res: Response;

      // ── Contract ────────────────────────────────────────────────────────
      if (selectedType === 'contract') {
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
            companyId: selectedCompany,
          }),
        });
        if (res.ok && cFile) {
          const { contract } = await res.clone().json();
          await uploadAttachment(cFile, {
            title:      cTitle.trim(),
            category:   'Contracts',
            companyId:  selectedCompany,
            contractId: contract?.id,
          });
        }

      // ── Invoice ─────────────────────────────────────────────────────────
      } else if (selectedType === 'invoice') {
        res = await fetch('/api/v1/invoices', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client:    iClient.trim(),
            amount:    parseFloat(iAmount.replace(/,/g, '')),
            currency:  iCurrency,
            status:    iStatus,
            issueDate: iIssue,
            dueDate:   iDue || undefined,
            notes:     iNotes || undefined,
            companyId: selectedCompany,
          }),
        });
        if (res.ok && iFile) {
          const { invoice } = await res.clone().json();
          await uploadAttachment(iFile, {
            title:       `Invoice: ${invoice?.invoiceNumber ?? iClient.trim()}`,
            category:    'Invoices',
            companyId:   selectedCompany,
            description: iNotes || undefined,
          });
        }

      // ── Document ─────────────────────────────────────────────────────────
      } else if (selectedType === 'document') {
        const fd = new FormData();
        fd.append('file', dFile!);  // validated non-null above
        fd.append('title', dTitle.trim());
        fd.append('category', dCategory);
        if (dDesc)           fd.append('description',  dDesc.trim());
        if (dReceived)       fd.append('dateReceived', dReceived);
        if (dExpiry)         fd.append('expiryDate',   dExpiry);
        fd.append('companyId', selectedCompany);
        res = await fetch('/api/v1/documents', { method: 'POST', credentials: 'include', body: fd });

      // ── Operation ────────────────────────────────────────────────────────
      } else if (selectedType === 'operation') {
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
            companyId:            selectedCompany,
          }),
        });
        if (res.ok && oFile) {
          await uploadAttachment(oFile, {
            title:     `Operations Log: ${oDate}`,
            category:  'Operations',
            companyId: selectedCompany,
            description: oDesc || undefined,
          });
        }

      } else { setSubmitting(false); return; }

      if (res!.ok) {
        setSubmitSuccess(true);
        resetForm();
        loadSubmissions();
        setTimeout(() => { setSubmitSuccess(false); setSelectedType(null); }, 2500);
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

  // ── Form renderer ──────────────────────────────────────────────────────────

  // Live error map — updates whenever form fields change
  const currentErrors = getErrors(selectedType);
  const isFormValid   = Object.keys(currentErrors).length === 0;

  // errMsg: show error for a given field key after the user has attempted submit
  const errMsg = (key: string) =>
    submitAttempted && currentErrors[key]
      ? <p style={{ fontSize: '12px', color: 'hsl(var(--destructive))', marginTop: '2px' }}>{currentErrors[key]}</p>
      : null;

  const field = (label: string, children: React.ReactNode, required = false, errKey?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '14px', fontWeight: 500 }}>
        {label}{required && <span style={{ color: 'red' }}> *</span>}
      </label>
      {children}
      {errKey && errMsg(errKey)}
    </div>
  );

  const dateInput = (value: string, onChange: (v: string) => void) => (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', background: 'var(--input)', color: 'var(--foreground)', width: '100%' }}
    />
  );

  const grid2 = (children: React.ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>{children}</div>
  );

  const renderForm = () => {
    if (!selectedType) return null;
    const cfg = TYPE_CONFIG[selectedType];

    return (
      <div className="space-y-5">
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

        {/* ── Contract ──────────────────────────────────────────────────── */}
        {selectedType === 'contract' && (
          <div className="space-y-4">
            {field('Contract Title', <Input placeholder="e.g. Service Agreement 2026" value={cTitle} onChange={e => setCTitle(e.target.value)} className="bg-input border-border" />, true, 'cTitle')}
            {grid2(<>
              {field('Contract Number', <Input placeholder="CTR-2026-001" value={cNumber} onChange={e => setCNumber(e.target.value)} className="bg-input border-border" />, true, 'cNumber')}
              {field('Client Name', <Input placeholder="Client name" value={cClient} onChange={e => setCClient(e.target.value)} className="bg-input border-border" />, true, 'cClient')}
            </>)}
            {grid2(<>
              {field('Start Date', dateInput(cStart, setCStart), true, 'cStart')}
              {field('Expiry Date', dateInput(cExpiry, setCExpiry), true, 'cExpiry')}
            </>)}
            {field('Description', <Textarea placeholder="Contract details..." value={cDesc} onChange={e => setCDesc(e.target.value)} className="bg-input border-border" rows={3} />, true, 'cDesc')}
            {field('Contract File', <FilePicker file={cFile} onChange={setCFile} label="Attach Contract File (name must match title)" />, true, 'cFile')}
          </div>
        )}

        {/* ── Invoice ───────────────────────────────────────────────────── */}
        {selectedType === 'invoice' && (
          <div className="space-y-4">
            {field('Client', <Input placeholder="Client or organisation" value={iClient} onChange={e => setIClient(e.target.value)} className="bg-input border-border" />, true, 'iClient')}
            {field('Amount',
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--muted-foreground)', background: 'var(--muted)', flexShrink: 0 }}>
                  {iCurrency}
                </span>
                <Input type="text" placeholder="0.00" value={iAmount}
                  onChange={e => setIAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="bg-input border-border flex-1" />
              </div>, true, 'iAmount')}
            {field('Currency',
              <Select value={iCurrency} onValueChange={v => setICurrency(v as typeof iCurrency)}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="NLE">NLE — Leones (Le)</SelectItem>
                  <SelectItem value="USD">USD — US Dollar ($)</SelectItem>
                  <SelectItem value="GBP">GBP — British Pound (£)</SelectItem>
                  <SelectItem value="EUR">EUR — Euro (€)</SelectItem>
                </SelectContent>
              </Select>, true)}
            {field('Status',
              <Select value={iStatus} onValueChange={v => setIStatus(v as typeof iStatus)}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="DRAFT">Pending</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                </SelectContent>
              </Select>, true)}
            {grid2(<>
              {field('Issue Date', dateInput(iIssue, setIIssue), true)}
              {field('Due Date', dateInput(iDue, setIDue), true, 'iDue')}
            </>)}
            {field('Notes', <Textarea placeholder="Add invoice notes..." value={iNotes} onChange={e => setINotes(e.target.value)} className="bg-input border-border" rows={2} />, true, 'iNotes')}
            {field('Invoice File', <FilePicker file={iFile} onChange={setIFile} label="Attach Invoice File (name must contain 'invoice')" />, true, 'iFile')}
          </div>
        )}

        {/* ── Document ──────────────────────────────────────────────────── */}
        {selectedType === 'document' && (
          <div className="space-y-4">
            {field('Document Title', <Input placeholder="Enter document title" value={dTitle} onChange={e => setDTitle(e.target.value)} className="bg-input border-border" />, true, 'dTitle')}
            {field('Category',
              <Select value={dCategory} onValueChange={setDCategory}>
                <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>, true, 'dCategory')}
            {field('Description', <Textarea placeholder="Brief description" value={dDesc} onChange={e => setDDesc(e.target.value)} className="bg-input border-border" rows={2} />, true, 'dDesc')}
            {grid2(<>
              {field('Date Received', dateInput(dReceived, setDReceived), true, 'dReceived')}
              {field('Expiry Date', dateInput(dExpiry, setDExpiry), true, 'dExpiry')}
            </>)}
            {field('File',
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input type="file" accept=".pdf,.doc,.docx,.xlsx,.csv"
                  onChange={e => setDFile(e.target.files?.[0] ?? null)}
                  style={{ fontSize: '14px' }} />
                {dFile && <p style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>{dFile.name} ({(dFile.size / 1024 / 1024).toFixed(1)} MB)</p>}
              </div>, true, 'dFile')}
          </div>
        )}

        {/* ── Operations ────────────────────────────────────────────────── */}
        {selectedType === 'operation' && (
          <div className="space-y-4">
            {field('Activity Type',
              <Select value={oActivity} onValueChange={setOActivity}>
                <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select activity" /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {ACTIVITY_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>, true, 'oActivity')}
            {field('Description', <Textarea placeholder="Activity description..." value={oDesc} onChange={e => setODesc(e.target.value)} className="bg-input border-border" rows={2} />)}
            {grid2(<>
              {field('Department',
                <Select value={oDept} onValueChange={setODept}>
                  <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>, true, 'oDept')}
              {field('Date', dateInput(oDate, setODate), true)}
            </>)}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
              {[
                { label: 'Manpower',      value: oManpower, set: setOManpower, req: true,  ek: 'oManpower' },
                { label: 'Equip. Total',  value: oEqTotal,  set: setOEqTotal,  req: true,  ek: 'oEqTotal'  },
                { label: 'Operational',   value: oEqOp,     set: setOEqOp,     req: true,  ek: 'oEqOp'     },
                { label: 'Score (0–100)', value: oScore,    set: setOScore,    req: true,  ek: 'oScore'    },
              ].map(({ label, value, set, req, ek }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500 }}>
                    {label}{req && <span style={{ color: 'red' }}> *</span>}
                  </label>
                  <Input type="number" min="0" value={value} onChange={e => set(e.target.value)} className="bg-input border-border" />
                  {ek && errMsg(ek)}
                </div>
              ))}
            </div>
            {field('Notes', <Textarea placeholder="Additional notes..." value={oNotes} onChange={e => setONotes(e.target.value)} className="bg-input border-border" rows={2} />, true, 'oNotes')}
            {field('Operations File', <FilePicker file={oFile} onChange={setOFile} label="Attach Operations File" />, true, 'oFile')}
          </div>
        )}

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

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="border-border" onClick={() => { setSelectedType(null); resetForm(); }}>Cancel</Button>
          <Button
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleSubmit}
            disabled={submitting || !selectedCompany || !isFormValid}
            title={!isFormValid ? `${Object.keys(currentErrors).length} required field(s) missing` : undefined}
          >
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
          Submit records on behalf of a company. All submissions are tracked to your account.
        </p>
      </div>

      {/* ── Step 1 (always visible): Company selector ─────────────────────── */}
      <Card className="bg-card border-border">
        <CardContent className="p-5">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600 }}>
              <Building2 className="inline h-4 w-4 mr-1.5 text-primary" />
              Select Company <span style={{ color: 'red' }}>*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-1">All submitted data will be stored under the selected company.</p>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="— Choose a company —" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {!selectedCompany && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                You must select a company before submitting any data.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Step 2: Type selector or active form ──────────────────────────── */}
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
                    disabled={!selectedCompany}
                    className={`flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 transition-colors text-left group disabled:opacity-40 disabled:cursor-not-allowed`}
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
              {!selectedCompany && (
                <p className="text-xs text-center text-muted-foreground">Select a company above to enable data entry.</p>
              )}
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
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-foreground max-w-[180px]">
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
                                {s.status === 'DRAFT' ? 'Pending' : s.status.charAt(0) + s.status.slice(1).toLowerCase()}
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
