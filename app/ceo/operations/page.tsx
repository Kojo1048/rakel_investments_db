'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Building2, ClipboardList, ChevronRight, BarChart2 } from 'lucide-react';
import type { Company, OperationsRecord } from '@/lib/types';
import { safeGet } from '@/lib/utils/safe-fetch';

interface CompanyOpsRow {
  company: Company;
  totalEntries: number;
  avgPerformance: number;
  latestDate: string | Date | null;
}

export default function CEOOperationsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [records,   setRecords]   = useState<OperationsRecord[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      safeGet('/api/v1/companies',           { companies: [] }),
      safeGet('/api/v1/operations?days=3650', { records:   [] }),
    ]).then(([cd, od]) => {
      setCompanies(cd.companies ?? []);
      setRecords((od as any).records ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const rows = useMemo((): CompanyOpsRow[] => {
    return companies.map(company => {
      const compRecs = records.filter(r => r.companyId === company.id);
      const avgPerf  = compRecs.length > 0
        ? Math.round(compRecs.reduce((s, r) => s + r.performanceScore, 0) / compRecs.length)
        : 0;
      const dates    = compRecs.map(r => r.date).sort();
      return {
        company,
        totalEntries:   compRecs.length,
        avgPerformance: avgPerf,
        latestDate:     dates[dates.length - 1] ?? null,
      };
    });
  }, [companies, records]);

  // If overview page passed ?company=id, auto-navigate to that detail
  useEffect(() => {
    const companyId = searchParams.get('company');
    if (companyId && !loading) {
      router.replace(`/ceo/operations/${companyId}`);
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
        <h1 className="text-2xl font-bold text-foreground">Operations</h1>
        <p className="text-muted-foreground">Select a company to view its operational analytics.</p>
      </div>

      {rows.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-16 text-center">
            <BarChart2 className="h-14 w-14 mx-auto text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-lg font-medium text-foreground">No Companies Found</h3>
            <p className="text-muted-foreground">Companies will appear here once they are added to the system.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />All Companies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    {['Company', 'Total Operations', 'Avg Performance', 'Last Entry', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ company, totalEntries, avgPerformance, latestDate }) => (
                    <tr
                      key={company.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => router.push(`/ceo/operations/${company.id}`)}
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
                      <td className="px-4 py-3 text-foreground">
                        {totalEntries > 0
                          ? <span className="font-semibold">{totalEntries}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {totalEntries > 0 ? (
                          <span className={`font-semibold ${
                            avgPerformance >= 80 ? 'text-primary' :
                            avgPerformance >= 60 ? 'text-chart-3' : 'text-destructive'
                          }`}>
                            {avgPerformance}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {latestDate
                          ? new Date(latestDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          company.isActive !== false
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {company.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border hover:border-primary/50 gap-1"
                          onClick={e => { e.stopPropagation(); router.push(`/ceo/operations/${company.id}`); }}
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
