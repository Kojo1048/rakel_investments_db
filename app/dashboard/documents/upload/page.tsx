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
  const [companies, services, contracts] = await Promise.all([
    (db as any).company.findMany({
      where: session.role === 'COMPANY_ADMIN' || session.role === 'STAFF'
        ? { id: session.companyId ?? undefined }
        : undefined,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    (db as any).service.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    (db as any).contract.findMany({
      where: session.companyId ? { companyId: session.companyId } : undefined,
      select: { id: true, title: true, contractNumber: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

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
