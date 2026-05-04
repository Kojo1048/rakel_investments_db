/**
 * Prisma seed — populates the database with structural data only.
 * Analytics, documents, audit logs, and registrations start empty.
 * Run: npx prisma db seed
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter, log: ['error'] });
const BCRYPT_ROUNDS = 12;

async function hash(pw: string) {
  return bcrypt.hash(pw, BCRYPT_ROUNDS);
}

async function main() {
  console.log('🌱 Seeding database...');

  // ── Services ────────────────────────────────────────────────────────────────
  const services = await Promise.all([
    db.service.upsert({ where: { slug: 'medical-supplies' }, update: {}, create: { id: 's1', name: 'Medical Supplies & Equipment Procurement', slug: 'medical-supplies', icon: 'Stethoscope', description: 'Procurement of medical equipment and supplies' } }),
    db.service.upsert({ where: { slug: 'hospital-hygiene' }, update: {}, create: { id: 's2', name: 'Hospital Hygiene & PPE Supply', slug: 'hospital-hygiene', icon: 'Sparkles', description: 'Hospital hygiene products and PPE supplies' } }),
    db.service.upsert({ where: { slug: 'construction' }, update: {}, create: { id: 's3', name: 'Infrastructure Construction', slug: 'construction', icon: 'Building2', description: 'Public infrastructure and civil works' } }),
    db.service.upsert({ where: { slug: 'logistics-delivery' }, update: {}, create: { id: 's4', name: 'Logistics & Delivery Services', slug: 'logistics-delivery', icon: 'Truck', description: 'Delivery tracking and order fulfillment' } }),
    db.service.upsert({ where: { slug: 'general-supplies' }, update: {}, create: { id: 's5', name: 'General Supplies', slug: 'general-supplies', icon: 'Package', description: 'Inventory and supplier network management' } }),
    db.service.upsert({ where: { slug: 'water-systems' }, update: {}, create: { id: 's6', name: 'Borehole & Water Systems', slug: 'water-systems', icon: 'Droplets', description: 'Drilling, tank installation, water distribution' } }),
    db.service.upsert({ where: { slug: 'climate-monitoring' }, update: {}, create: { id: 's7', name: 'Environmental Monitoring', slug: 'climate-monitoring', icon: 'Thermometer', description: 'Mobile labs, field data, climate research' } }),
    db.service.upsert({ where: { slug: 'greenhouse' }, update: {}, create: { id: 's8', name: 'Greenhouse & Crop Production', slug: 'greenhouse', icon: 'Leaf', description: 'Greenhouse installation and vegetable production' } }),
    db.service.upsert({ where: { slug: 'solar-installation' }, update: {}, create: { id: 's9', name: 'Solar Panel Installation', slug: 'solar-installation', icon: 'Sun', description: 'Panel deployment, battery systems, commissioning' } }),
    db.service.upsert({ where: { slug: 'community-dev' }, update: {}, create: { id: 's10', name: 'Community Development', slug: 'community-dev', icon: 'Home', description: 'Renovation and community projects' } }),
  ]);
  console.log(`  ✓ ${services.length} services`);

  // ── Companies ────────────────────────────────────────────────────────────────
  const companySeedData = [
    { id: 'c1', name: 'Rakel Medical', slug: 'medical', colorPrimary: '#2563eb', colorSecondary: '#60a5fa', serviceIds: ['s1', 's2'] },
    { id: 'c2', name: 'Green Faj Agriculture', slug: 'agriculture', colorPrimary: '#16a34a', colorSecondary: '#4ade80', serviceIds: ['s8'] },
    { id: 'c3', name: 'Rakel Construction', slug: 'construction', colorPrimary: '#92400e', colorSecondary: '#d97706', serviceIds: ['s3', 's10'] },
    { id: 'c4', name: 'Logistics & General Supplies', slug: 'logistics', colorPrimary: '#1d4ed8', colorSecondary: '#93c5fd', serviceIds: ['s4', 's5'] },
    { id: 'c5', name: 'Water & Sanitation', slug: 'water', colorPrimary: '#0369a1', colorSecondary: '#38bdf8', serviceIds: ['s6'] },
    { id: 'c6', name: 'Solar Energy', slug: 'solar', colorPrimary: '#b45309', colorSecondary: '#fbbf24', serviceIds: ['s9'] },
    { id: 'c7', name: 'Smart Climate Solutions', slug: 'climate', colorPrimary: '#0d9488', colorSecondary: '#2dd4bf', serviceIds: ['s7'] },
  ];

  for (const { serviceIds, ...companyData } of companySeedData) {
    await db.company.upsert({
      where: { slug: companyData.slug },
      update: {},
      create: {
        ...companyData,
        services: {
          create: serviceIds.map(serviceId => ({ serviceId })),
        },
      },
    });
  }
  console.log(`  ✓ ${companySeedData.length} companies`);

  // ── Built-in system accounts ─────────────────────────────────────────────────
  // update: resets passwordHash + status on every re-seed so credentials always work
  const userSeedData = [
    { id: 'u1', username: 'Admin123',    password: 'Gideonadmin',      role: 'SUPER_ADMIN' as const, fullName: 'Super Administrator', email: 'admin@rakel.com',      companyId: null, status: 'ACTIVE' as const },
    { id: 'u2', username: 'rakel_admin', password: 'Rakeladmin54321$', role: 'RAKEL_ADMIN' as const, fullName: 'Rakel Administrator', email: 'rakeladmin@rakel.com', companyId: null, status: 'ACTIVE' as const },
    { id: 'u0', username: 'ceo_alpha',   password: 'AlphaCEO123',      role: 'CEO'         as const, fullName: 'Mr Alpha Jalloh',    email: 'ceo@rakel.com',        companyId: null, status: 'ACTIVE' as const },
  ];

  for (const { password, companyId, ...userData } of userSeedData) {
    const passwordHash = await hash(password);
    await db.user.upsert({
      where: { username: userData.username },
      // Always update passwordHash and status so re-seeding fixes broken credentials
      update: { passwordHash, status: userData.status, role: userData.role },
      create: {
        ...userData,
        passwordHash,
        ...(companyId ? { company: { connect: { id: companyId } } } : {}),
      },
    });
  }
  console.log(`  ✓ ${userSeedData.length} system accounts seeded`);
  console.log('    Admin123     → SUPER_ADMIN (password: Gideonadmin)');
  console.log('    rakel_admin  → RAKEL_ADMIN  (password: Rakeladmin54321$)');
  console.log('    ceo_alpha    → CEO           (password: AlphaCEO123)');

  console.log('\n✅ Seed complete. Analytics, documents, audit logs, and registrations start empty.');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
