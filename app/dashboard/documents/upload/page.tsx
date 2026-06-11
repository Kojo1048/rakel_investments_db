import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth/session';
import { db } from '@/lib/db';
import UploadForm from './UploadForm';

export const dynamic = 'force-dynamic';

export default async function UploadDocumentPage() {
  // ── Auth (server-side) ────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get('rakel_session')?.value;
  if (!token) redirect('/');

  const session = verifyToken(token);
  if (!session) redirect('/');

  // Only roles that can upload documents reach this page
  const canUpload = ['COMPANY_ADMIN', 'STAFF', 'RAKEL_ADMIN'].includes(session.role);
  if (!canUpload) redirect('/');

  // ── Fetch dropdown data (server-side, no waterfall) ───────────────────────
  const [companiesRes, servicesRes, contractsRes] = await Promise.all([
    (() => {
      let q = db.from('Company').select('id, name').order('name', { ascending: true });
      if ((session.role === 'COMPANY_ADMIN' || session.role === 'STAFF') && session.companyId) {
        q = q.eq('id', session.companyId);
      }
      return q;
    })(),
    db.from('Service').select('id, name').order('name', { ascending: true }),
    (() => {
      let q = db.from('Contract').select('id, title, contractNumber').order('createdAt', { ascending: false }).limit(50);
      if (session.companyId) q = q.eq('companyId', session.companyId);
      return q;
    })(),
  ]);
  const companies = companiesRes.data ?? [];
  const services  = servicesRes.data  ?? [];
  const contracts = contractsRes.data ?? [];

  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '32px 0',
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: '28px' }}>
        <a
          href="/dashboard/documents"
          style={{
            fontSize: '13px',
            color: '#6b7280',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '12px',
          }}
        >
          ← Back to Documents
        </a>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            margin: 0,
          }}
        >
          Upload Document
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: 4, marginBottom: 0 }}>
          Add a document record. Fields marked <span style={{ color: '#ef4444' }}>*</span> are
          required.
        </p>
      </div>

      {/* Form (client component) */}
      <UploadForm
        companies={companies}
        services={services}
        contracts={contracts}
      />
    </div>
  );
}
