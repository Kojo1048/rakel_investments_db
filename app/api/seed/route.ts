/**
 * GET /api/seed
 *
 * Full idempotent seed — safe to call multiple times.
 * Detects old company/service slugs from the original seed, removes them,
 * then upserts the canonical dataset of 25 services and 15 companies.
 * No authentication required (public startup helper).
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic  = 'force-dynamic';

// ── Old slugs to clean up (from original scripts/seed.ts) ────────────────────

const OLD_COMPANY_SLUGS = ['rakel', 'agriculture', 'construction', 'globalinv', 't&s', 'solar', 'climate', 'rugy'];
const OLD_SERVICE_SLUGS = ['medical-supplies', 'hospital-hygiene', 'logistics-delivery', 'general-supplies', 'water-systems', 'climate-monitoring', 'greenhouse', 'community-dev'];

// ── Canonical dataset ─────────────────────────────────────────────────────────

const SERVICES = [
  { id: 's01', name: 'Pharmaceutical Supplies',              slug: 'pharmaceutical-supplies',     icon: 'Pill',        description: 'Supply of pharmaceutical products and medicines' },
  { id: 's02', name: 'Construction Works',                   slug: 'construction-works',          icon: 'Building2',   description: 'Civil engineering and construction services' },
  { id: 's03', name: 'Office Equipment Supply',              slug: 'office-equipment-supply',     icon: 'Monitor',     description: 'Supply of office equipment and accessories' },
  { id: 's04', name: 'Procurement of Office Equipment',      slug: 'proc-office-equipment',       icon: 'Briefcase',   description: 'Procurement and sourcing of office equipment' },
  { id: 's05', name: 'Procurement of Furniture',             slug: 'proc-furniture',              icon: 'Package',     description: 'Procurement and supply of office and institutional furniture' },
  { id: 's06', name: 'Procurement of ICT Equipment',         slug: 'proc-ict-equipment',          icon: 'Cpu',         description: 'Sourcing and supply of ICT equipment and accessories' },
  { id: 's07', name: 'Procurement of Toners and Cartridges', slug: 'proc-toners-cartridges',      icon: 'Printer',     description: 'Supply of printer toners and cartridges' },
  { id: 's08', name: 'Procurement of Sundries',              slug: 'proc-sundries',               icon: 'ShoppingBag', description: 'Miscellaneous goods and sundry items procurement' },
  { id: 's09', name: 'Procurement of Motor Bikes',           slug: 'proc-motor-bikes',            icon: 'Bike',        description: 'Supply and procurement of motor bikes' },
  { id: 's10', name: 'Procurement of Vehicles',              slug: 'proc-vehicles',               icon: 'Car',         description: 'Procurement and supply of vehicles' },
  { id: 's11', name: 'Renewable Energy Solutions',           slug: 'renewable-energy',            icon: 'Zap',         description: 'Renewable and clean energy solutions' },
  { id: 's12', name: 'Solar Installation',                   slug: 'solar-installation',          icon: 'Sun',         description: 'Solar panel installation and commissioning' },
  { id: 's13', name: 'Electrical Equipment Supply',          slug: 'electrical-equipment-supply', icon: 'Plug',        description: 'Supply of electrical equipment and materials' },
  { id: 's14', name: 'Electrical Installation Services',     slug: 'electrical-installation',     icon: 'Cable',       description: 'Electrical wiring and installation services' },
  { id: 's15', name: 'Procurement of Agricultural Inputs',   slug: 'proc-agricultural-inputs',    icon: 'Leaf',        description: 'Agricultural inputs and farm supplies procurement' },
  { id: 's16', name: 'Seeds Supply',                         slug: 'seeds-supply',                icon: 'Leaf',        description: 'Supply of quality agricultural seeds' },
  { id: 's17', name: 'Fertilizer Supply',                    slug: 'fertilizer-supply',           icon: 'Droplets',    description: 'Supply of fertilizers and soil amendments' },
  { id: 's18', name: 'Rice Supply',                          slug: 'rice-supply',                 icon: 'Package',     description: 'Procurement and supply of rice' },
  { id: 's19', name: 'Tractor Supply',                       slug: 'tractor-supply',              icon: 'Truck',       description: 'Supply and procurement of tractors and farm machinery' },
  { id: 's20', name: 'Farming Tools and Equipment Supply',   slug: 'farming-tools-equipment',     icon: 'Wrench',      description: 'Supply of farming tools and agricultural equipment' },
  { id: 's21', name: 'Gold Dust Trading',                    slug: 'gold-dust-trading',           icon: 'Gem',         description: 'Trading and export of gold dust' },
  { id: 's22', name: 'Gold Mining Operations',               slug: 'gold-mining-operations',      icon: 'Mountain',    description: 'Gold mining and mineral extraction operations' },
  { id: 's23', name: 'Procurement of Medical Items',         slug: 'proc-medical-items',          icon: 'Stethoscope', description: 'Procurement of medical supplies and equipment' },
  { id: 's24', name: 'Hospital Furniture Supply',            slug: 'hospital-furniture-supply',   icon: 'Package',     description: 'Supply of hospital and medical facility furniture' },
  { id: 's25', name: 'Medical Equipment Supply',             slug: 'medical-equipment-supply',    icon: 'Activity',    description: 'Supply of medical devices and equipment' },
];

const COMPANIES: { id: string; name: string; slug: string; colorPrimary: string; colorSecondary: string; serviceIds: string[] }[] = [
  { id: 'c01', name: 'Rakel Investments',           slug: 'rakel-investments',       colorPrimary: '#2563eb', colorSecondary: '#60a5fa', serviceIds: ['s01','s02','s03'] },
  { id: 'c02', name: 'FAJ Investment',              slug: 'faj-investment',          colorPrimary: '#0d9488', colorSecondary: '#2dd4bf', serviceIds: ['s04','s05','s06','s07'] },
  { id: 'c03', name: 'Sahid and Cherry Investment', slug: 'sahid-cherry-investment', colorPrimary: '#92400e', colorSecondary: '#d97706', serviceIds: ['s08','s09','s04','s10'] },
  { id: 'c04', name: 'Jalloh Global Investment',    slug: 'jalloh-global',           colorPrimary: '#1d4ed8', colorSecondary: '#93c5fd', serviceIds: ['s10','s09'] },
  { id: 'c05', name: 'B&J Energy Solution',         slug: 'bj-energy',               colorPrimary: '#b45309', colorSecondary: '#fbbf24', serviceIds: ['s11','s12','s13','s14'] },
  { id: 'c06', name: 'GreenFAJ Solutions',          slug: 'greenfaj-solutions',      colorPrimary: '#16a34a', colorSecondary: '#4ade80', serviceIds: ['s15','s16','s17','s18','s19','s20'] },
  { id: 'c07', name: 'Tesat & Sillah Enterprise',  slug: 'tesat-sillah',            colorPrimary: '#0369a1', colorSecondary: '#38bdf8', serviceIds: ['s08','s09','s04','s10'] },
  { id: 'c08', name: 'Kie Kiz Investment',          slug: 'kie-kiz',                 colorPrimary: '#0d9488', colorSecondary: '#2dd4bf', serviceIds: ['s08','s09','s04','s10'] },
  { id: 'c09', name: 'Ruguy Enterprise',            slug: 'ruguy-enterprise',        colorPrimary: '#8b5cf6', colorSecondary: '#a78bfa', serviceIds: ['s08','s09','s04','s10'] },
  { id: 'c10', name: 'FG Gold',                     slug: 'fg-gold',                 colorPrimary: '#d97706', colorSecondary: '#fbbf24', serviceIds: ['s21','s22'] },
  { id: 'c11', name: 'Korse Holdings',              slug: 'korse-holdings',          colorPrimary: '#6d28d9', colorSecondary: '#a78bfa', serviceIds: ['s08','s09','s04','s10'] },
  { id: 'c12', name: 'Apler Medikal',               slug: 'apler-medikal',           colorPrimary: '#dc2626', colorSecondary: '#f87171', serviceIds: ['s23','s01','s24','s25'] },
  { id: 'c13', name: 'C-MAT',                       slug: 'c-mat',                   colorPrimary: '#374151', colorSecondary: '#6b7280', serviceIds: ['s09'] },
  { id: 'c14', name: 'Pro Max',                     slug: 'pro-max',                 colorPrimary: '#1e3a8a', colorSecondary: '#3b82f6', serviceIds: [] },
  { id: 'c15', name: 'Firmament',                   slug: 'firmament',               colorPrimary: '#312e81', colorSecondary: '#6366f1', serviceIds: [] },
];

export async function GET() {
  const results = { cleaned: { companies: 0, services: 0 }, seeded: { services: 0, companies: 0 }, errors: [] as string[] };

  try {
    // ── Step 1: Remove old companies ───────────────────────────────────────
    const { data: oldCompanies } = await db
      .from('Company')
      .select('id')
      .in('slug', OLD_COMPANY_SLUGS);

    if (oldCompanies && oldCompanies.length > 0) {
      const oldIds = oldCompanies.map((c: { id: string }) => c.id);
      await db.from('CompanyService').delete().in('companyId', oldIds);
      await db.from('Company').delete().in('id', oldIds);
      results.cleaned.companies = oldIds.length;
    }

    // ── Step 2: Remove old services ────────────────────────────────────────
    const { data: oldServices } = await db
      .from('Service')
      .select('id')
      .in('slug', OLD_SERVICE_SLUGS);

    if (oldServices && oldServices.length > 0) {
      const oldSvcIds = oldServices.map((s: { id: string }) => s.id);
      await db.from('CompanyService').delete().in('serviceId', oldSvcIds);
      await db.from('Service').delete().in('id', oldSvcIds);
      results.cleaned.services = oldSvcIds.length;
    }

    // ── Step 3: Upsert canonical services ──────────────────────────────────
    for (const svc of SERVICES) {
      const { error } = await db
        .from('Service')
        .upsert({ ...svc, isActive: true }, { onConflict: 'slug' });
      if (error) results.errors.push(`Service ${svc.slug}: ${error.message}`);
      else results.seeded.services++;
    }

    // ── Step 4: Upsert canonical companies + service assignments ───────────
    for (const { serviceIds, ...company } of COMPANIES) {
      const { error: cErr } = await db
        .from('Company')
        .upsert({ ...company, isActive: true }, { onConflict: 'slug' });
      if (cErr) { results.errors.push(`Company ${company.slug}: ${cErr.message}`); continue; }
      results.seeded.companies++;

      await db.from('CompanyService').delete().eq('companyId', company.id);
      if (serviceIds.length > 0) {
        await db.from('CompanyService').insert(
          serviceIds.map(serviceId => ({ companyId: company.id, serviceId }))
        );
      }
    }

    return NextResponse.json({
      status: 'ok',
      cleaned: results.cleaned,
      seeded:  results.seeded,
      errors:  results.errors.length > 0 ? results.errors : undefined,
      message: `Seed complete — removed ${results.cleaned.companies} old companies, ${results.cleaned.services} old services; seeded ${results.seeded.services} services, ${results.seeded.companies} companies.`,
    });

  } catch (err: any) {
    console.error('[seed] Error:', err);
    return NextResponse.json(
      { status: 'error', message: err?.message ?? 'Seed failed — check server logs.' },
      { status: 500 }
    );
  }
}
