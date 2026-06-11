// lib/repositories/company.repository.ts
// Confirmed against actual Supabase schema:
//   table → "Company"
//   quoted columns: "isActive", "colorPrimary", "colorSecondary", "createdAt", "updatedAt"
//   join table → "CompanyService" with FK CompanyService_companyId_fkey, CompanyService_serviceId_fkey
import { randomUUID } from 'crypto';
import { db } from '../db';

const COMPANY_COLS = `
  id, name, slug, description, isActive,
  colorPrimary, colorSecondary, createdAt, updatedAt,
  services:CompanyService(
    assignedAt,
    service:Service!CompanyService_serviceId_fkey(id, name, slug, icon, description)
  )
`.trim();

// ── findCompanyById ───────────────────────────────────────────────────────────
export async function findCompanyById(id: string) {
  const { data, error } = await db
    .from('Company')
    .select(COMPANY_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── findCompanyBySlug ─────────────────────────────────────────────────────────
export async function findCompanyBySlug(slug: string) {
  const { data, error } = await db
    .from('Company')
    .select(COMPANY_COLS)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── findCompanies ─────────────────────────────────────────────────────────────
export async function findCompanies(
  filters: { isActive?: boolean; search?: string; page?: number; limit?: number } = {}
) {
  const { isActive, search, page = 1, limit = 20 } = filters;

  let query = db.from('Company').select(COMPANY_COLS, { count: 'exact' });

  if (isActive !== undefined) query = query.eq('isActive', isActive);
  if (search) {
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  }

  const { data, error, count } = await query
    .order('createdAt', { ascending: true })
    .range((page - 1) * limit, page * limit - 1);

  if (error) throw error;
  const total = count ?? 0;
  return { companies: data ?? [], total, page, limit, pages: Math.ceil(total / limit) };
}

// ── createCompany ─────────────────────────────────────────────────────────────
export async function createCompany(
  data: {
    name:            string;
    slug:            string;
    description?:    string;
    colorPrimary?:   string;
    colorSecondary?: string;
  },
  serviceIds: string[]
) {
  const newId = randomUUID();
  const { data: company, error: cErr } = await db
    .from('Company')
    .insert({ id: newId, ...data, updatedAt: new Date().toISOString() } as any)
    .select('id')
    .single();
  if (cErr) throw cErr;

  const companyId: string = (company as any)?.id ?? newId;

  if (serviceIds.length > 0) {
    const { error: sErr } = await db
      .from('CompanyService')
      .insert(serviceIds.map(serviceId => ({ companyId, serviceId })) as any);
    if (sErr) throw sErr;
  }

  return findCompanyById(companyId);
}

// ── updateCompany ─────────────────────────────────────────────────────────────
export async function updateCompany(
  id: string,
  data: Partial<{
    name:            string;
    slug:            string;
    description:     string;
    isActive:        boolean;
    colorPrimary:    string;
    colorSecondary:  string;
  }>,
  serviceIds?: string[]
) {
  if (serviceIds !== undefined) {
    const { error: delErr } = await db
      .from('CompanyService')
      .delete()
      .eq('companyId', id);
    if (delErr) throw delErr;

    if (serviceIds.length > 0) {
      const { error: insErr } = await db
        .from('CompanyService')
        .insert(serviceIds.map(serviceId => ({ companyId: id, serviceId })) as any);
      if (insErr) throw insErr;
    }
  }

  const { error } = await db
    .from('Company')
    .update({ ...data, updatedAt: new Date().toISOString() } as any)
    .eq('id', id);
  if (error) throw error;

  return findCompanyById(id);
}

// ── deleteCompany ─────────────────────────────────────────────────────────────
export async function deleteCompany(id: string) {
  const { error } = await db.from('Company').delete().eq('id', id);
  if (error) throw error;
}
