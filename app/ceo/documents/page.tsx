'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Building2, FolderOpen, ChevronRight } from 'lucide-react';
import type { Company, Document } from '@/lib/types';
import { safeGet } from '@/lib/utils/safe-fetch';

interface CompanyDocumentRow {
  company:        Company;
  total:          number;
  bidding:        number;
  contracts:      number;
  invoices:       number;
  pastExperience: number;
}

export default function CEODocumentsPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      safeGet('/api/v1/companies', { companies: [] }, 8000, 1),
      safeGet('/api/v1/documents', { documents: [] }, 8000, 1),
    ]).then(([cd, dd]) => {
      setCompanies((cd as any).companies ?? []);
      setDocuments((dd as any).documents ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const rows = useMemo((): CompanyDocumentRow[] =>
    companies.map(company => {
      const docs = documents.filter(d => d.companyId === company.id);
      return {
        company,
        total:          docs.length,
        bidding:        docs.filter(d => d.category === 'Submitted Bidding Documents').length,
        contracts:      docs.filter(d => d.category === 'Contracts Signed' || d.category === 'Contracts').length,
        invoices:       docs.filter(d => d.category === 'Invoice' || d.category === 'Invoices').length,
        pastExperience: docs.filter(d => d.category === 'Past Experiences').length,
      };
    }), [companies, documents]);

  if (loading) {
    return <div className="min-h-[50vh] flex items-center justify-center"><Spinner className="h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
        <p className="text-muted-foreground">Select a company to view and manage its documents.</p>
      </div>

      {rows.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <FolderOpen className="h-14 w-14 mx-auto text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-lg font-medium text-foreground">No Companies Found</h3>
            <p className="text-muted-foreground">Companies will appear here once added to the system.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />All Companies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    {['Company', 'Total Documents', 'Submitted Bidding Documents', 'Signed Contracts', 'Invoices', 'Past Experiences', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ company, total, bidding, contracts, invoices, pastExperience }) => (
                    <tr key={company.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => router.push(`/ceo/documents/${company.id}`)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${company.colorPrimary ?? '#3b82f6'}20` }}>
                            <Building2 className="h-4 w-4" style={{ color: company.colorPrimary ?? '#3b82f6' }} />
                          </div>
                          <span className="font-medium text-foreground">{company.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground font-semibold">{total}</td>
                      <td className="px-4 py-3"><span className={`font-semibold ${bidding > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{bidding}</span></td>
                      <td className="px-4 py-3"><span className={`font-semibold ${contracts > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{contracts}</span></td>
                      <td className="px-4 py-3"><span className={`font-semibold ${invoices > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{invoices}</span></td>
                      <td className="px-4 py-3"><span className={`font-semibold ${pastExperience > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{pastExperience}</span></td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" className="border-border hover:border-primary/50 gap-1"
                          onClick={e => { e.stopPropagation(); router.push(`/ceo/documents/${company.id}`); }}>
                          View <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
