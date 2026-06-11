'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { Crown, Building2, FileSignature, FileText, ChevronRight, Receipt, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import type { Company, Contract, Document } from '@/lib/types';
import { safeGet } from '@/lib/utils/safe-fetch';
import { ContractsGrowthChart } from '@/components/contracts-growth-chart';

export default function CEODashboard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { user } = useAuth();
  const [companies,           setCompanies]           = useState<Company[]>([]);
  const [contracts,           setContracts]           = useState<Contract[]>([]);
  const [documents,           setDocuments]           = useState<Document[]>([]);
  const [totalInvoiceCount,   setTotalInvoiceCount]   = useState(0);
  const [loading,             setLoading]             = useState(true);

  useEffect(() => {
    Promise.all([
      safeGet('/api/v1/companies',         { companies: [] }),
      safeGet('/api/v1/documents?limit=5', { documents: [] }),
      safeGet('/api/v1/contracts',         { contracts: [] }),
      safeGet('/api/v1/invoices',          { invoices:  [] }),
    ]).then(([cd, dd, contractData, invoiceData]) => {
      setCompanies(cd.companies ?? []);
      setDocuments(dd.documents ?? []);
      setContracts(contractData.contracts ?? []);
      setTotalInvoiceCount((invoiceData.invoices ?? []).length);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!mounted) return null;
  const activeContractCount = contracts.filter(c => c.status === 'ACTIVE').length;

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Welcome header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Crown className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome, {user?.fullName ?? 'Mr. Jalloh'}
          </h1>
          <p className="text-muted-foreground">
            Executive Overview — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{companies.length}</p>
              <p className="text-sm text-muted-foreground">Active Companies</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-chart-2/10 flex items-center justify-center flex-shrink-0">
              <FileSignature className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{activeContractCount}</p>
              <p className="text-sm text-muted-foreground">Active Contracts</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-chart-3/10 flex items-center justify-center flex-shrink-0">
              <Receipt className="h-6 w-6 text-chart-3" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{totalInvoiceCount}</p>
              <p className="text-sm text-muted-foreground">Total Invoices</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Company grid with quick links ────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Companies</h2>
        {companies.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-10 text-center">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">No companies found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map(company => (
              <Card key={company.id} className="bg-card border-border hover:border-primary/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${company.colorPrimary ?? '#3b82f6'}20` }}
                    >
                      <Building2 className="h-5 w-5" style={{ color: company.colorPrimary ?? '#3b82f6' }} />
                    </div>
                    <p className="font-semibold text-foreground text-sm leading-tight">{company.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Link href={`/ceo/operations?company=${company.id}`}>
                      <button className="w-full flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left group">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground">
                          <ClipboardList className="h-3.5 w-3.5" />Operations
                        </span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </Link>
                    <Link href={`/ceo/invoices?company=${company.id}`}>
                      <button className="w-full flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left group">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground">
                          <Receipt className="h-3.5 w-3.5" />Invoices
                        </span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Contracts Growth ─────────────────────────────────────────────── */}
      <ContractsGrowthChart contracts={contracts} multiCompany />

      {/* ── Recent Documents ─────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />Recent Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="h-9 w-9 rounded-lg bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-chart-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.category} — {doc.company?.name ?? 'All Companies'}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground uppercase flex-shrink-0">
                    {doc.fileType}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
