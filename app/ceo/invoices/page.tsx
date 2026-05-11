'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Building2, Receipt, ChevronRight, FolderOpen } from 'lucide-react';
import type { Company, Invoice } from '@/lib/types';
import { safeGet } from '@/lib/utils/safe-fetch';
import { fmtCurrency } from '@/lib/utils/currency';

interface CompanyInvoiceRow {
  company:  Company;
  total:    number;
  paid:     number;
  pending:  number;
  overdue:  number;
  totalAmt: number;
}

export default function CEOInvoicesPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      safeGet('/api/v1/companies', { companies: [] }),
      safeGet('/api/v1/invoices',  { invoices:  [] }),
    ]).then(([cd, id]) => {
      setCompanies(cd.companies ?? []);
      setInvoices((id as any).invoices ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const rows = useMemo((): CompanyInvoiceRow[] => {
    return companies.map(company => {
      const inv     = invoices.filter(i => i.companyId === company.id);
      const paid    = inv.filter(i => i.status === 'PAID').length;
      const pending = inv.filter(i => i.status === 'DRAFT' || i.status === 'SENT').length;
      const overdue = inv.filter(i => i.status === 'OVERDUE').length;
      // Total Value = NLE only — do NOT sum USD or other currencies
      const nleAmt  = inv
        .filter(i => i.currency === 'NLE')
        .reduce((s, i) => s + Number(i.amount), 0);
      return { company, total: inv.length, paid, pending, overdue, totalAmt: nleAmt };
    });
  }, [companies, invoices]);

  // If overview page passed ?company=id, auto-navigate to that detail
  useEffect(() => {
    const companyId = searchParams.get('company');
    if (companyId && !loading) {
      router.replace(`/ceo/invoices/${companyId}`);
    }
  }, [searchParams, loading, router]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
        <p className="text-muted-foreground">Select a company to view its invoice analytics.</p>
      </div>

      {rows.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <FolderOpen className="h-14 w-14 mx-auto text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-lg font-medium text-foreground">No Companies Found</h3>
            <p className="text-muted-foreground">Companies will appear here once they are added.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />All Companies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    {['Company', 'Total Invoices', 'Paid', 'Pending', 'Overdue', 'Total Value (NLE)', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ company, total, paid, pending, overdue, totalAmt }) => (
                    <tr
                      key={company.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => router.push(`/ceo/invoices/${company.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${company.colorPrimary ?? '#3b82f6'}20` }}
                          >
                            <Building2 className="h-4 w-4" style={{ color: company.colorPrimary ?? '#3b82f6' }} />
                          </div>
                          <span className="font-medium text-foreground">{company.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground font-semibold">{total}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${paid > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{paid}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${pending > 0 ? 'text-chart-3' : 'text-muted-foreground'}`}>{pending}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{overdue}</span>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {total > 0 ? fmtCurrency(totalAmt, 'NLE') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border hover:border-primary/50 gap-1"
                          onClick={e => { e.stopPropagation(); router.push(`/ceo/invoices/${company.id}`); }}
                        >
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
