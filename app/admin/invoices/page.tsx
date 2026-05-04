'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Building2, ChevronRight, Receipt, Search } from 'lucide-react';
import type { Company } from '@/lib/types';

export default function AdminInvoicesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/v1/companies', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { companies: [] })
      .then(data => setCompanies(data.companies ?? []))
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
        <p className="text-muted-foreground">Select a company to view its invoices.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 bg-input border-border"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {companies.length === 0 ? 'No Companies Found' : 'No Matches'}
            </h3>
            <p className="text-muted-foreground">
              {companies.length === 0
                ? 'No companies are registered in the system.'
                : 'Try a different search term.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(company => (
            <Card
              key={company.id}
              className="bg-card border-border hover:border-primary/50 transition-colors"
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate">{company.name}</h3>
                    <span className={`text-xs font-medium ${company.isActive !== false ? 'text-primary' : 'text-muted-foreground'}`}>
                      {company.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 justify-between"
                  onClick={() => router.push(`/admin/invoices/${company.id}`)}
                >
                  <span className="flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    View Company Invoices
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {companies.length} {companies.length === 1 ? 'company' : 'companies'} total
      </p>
    </div>
  );
}
