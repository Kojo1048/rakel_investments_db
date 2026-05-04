'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { uploadDocument, type UploadState } from './actions';
import { REMINDER_INTERVAL_LABELS, type ReminderInterval } from '@/lib/types';
import type { Company, Service } from '@/lib/types';

// ── Submit button — shows spinner while server action is pending ──────────────
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '10px 24px',
        background: pending ? '#93c5fd' : '#2563eb',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        cursor: pending ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: 600,
        transition: 'background 0.2s',
      }}
    >
      {pending ? 'Uploading…' : 'Upload Document'}
    </button>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '14px', fontWeight: 500, color: 'inherit' }}>
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--input, #fff)',
  color: 'inherit',
};

interface Props {
  companies: Pick<Company, 'id' | 'name'>[];
  services: Pick<Service, 'id' | 'name'>[];
  contracts: { id: string; title: string; contractNumber?: string | null }[];
}

export default function UploadForm({ companies, services, contracts }: Props) {
  const initialState: UploadState = { error: null };
  const [state, formAction] = useActionState(uploadDocument, initialState);

  const [expiryDate, setExpiryDate] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Clear file input on successful submission attempt (error resets form)
  useEffect(() => {
    if (state.error && fileRef.current) {
      // keep file — user will want to retry without re-selecting
    }
  }, [state.error]);

  return (
    <form
      action={formAction}
      style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '560px' }}
    >
      {/* Error banner */}
      {state.error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            color: '#b91c1c',
            fontSize: '13px',
          }}
        >
          {state.error}
        </div>
      )}

      {/* Document Name */}
      <Field label="Document Name" required>
        <input
          type="text"
          name="title"
          placeholder="Enter document title"
          required
          style={INPUT_STYLE}
        />
      </Field>

      {/* File Upload */}
      <Field label="File" required>
        <input
          type="file"
          name="file"
          ref={fileRef}
          accept=".pdf,.doc,.docx,.xlsx,.csv"
          required
          style={{ fontSize: '14px' }}
        />
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: 2 }}>
          PDF, DOC, DOCX, XLSX or CSV — max 50 MB
        </p>
      </Field>

      {/* Category */}
      <Field label="Category" required>
        <select name="category" required style={INPUT_STYLE}>
          <option value="">Select category</option>
          {['Reports', 'Guidelines', 'Plans', 'Manuals', 'Standards', 'Contracts', 'Other'].map(
            (c) => (
              <option key={c} value={c}>
                {c}
              </option>
            )
          )}
        </select>
      </Field>

      {/* Description */}
      <Field label="Description">
        <textarea
          name="description"
          placeholder="Brief description (optional)"
          rows={2}
          style={{ ...INPUT_STYLE, resize: 'vertical' }}
        />
      </Field>

      {/* Date Received */}
      <Field label="Date Received">
        <input type="date" name="dateReceived" style={INPUT_STYLE} />
      </Field>

      {/* Expiry Date */}
      <Field label="Expiry Date">
        <input
          type="date"
          name="expiryDate"
          style={INPUT_STYLE}
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
        />
      </Field>

      {/* Reminder Settings — only shown when expiry date is set */}
      {expiryDate && (
        <Field label="Remind me before expiry">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              background: '#f9fafb',
            }}
          >
            {(
              Object.entries(REMINDER_INTERVAL_LABELS) as [ReminderInterval, string][]
            ).map(([key, label]) => (
              <label
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  name="reminderSettings"
                  value={key}
                  style={{ width: 15, height: 15, cursor: 'pointer' }}
                />
                {label}
              </label>
            ))}
          </div>
        </Field>
      )}

      {/* Company */}
      {companies.length > 0 && (
        <Field label="Company">
          <select name="companyId" style={INPUT_STYLE} defaultValue="all">
            <option value="all">— None —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Service */}
      {services.length > 0 && (
        <Field label="Service">
          <select name="serviceId" style={INPUT_STYLE} defaultValue="all">
            <option value="all">— None —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Contract */}
      {contracts.length > 0 && (
        <Field label="Contract">
          <select name="contractId" style={INPUT_STYLE} defaultValue="all">
            <option value="all">— None —</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {c.contractNumber ? ` (${c.contractNumber})` : ''}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Submit */}
      <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
        <SubmitButton />
        <a
          href="/dashboard/documents"
          style={{
            padding: '10px 20px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            color: 'inherit',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
