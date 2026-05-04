import { db } from '../db';
import type { Prisma } from '@prisma/client';

const COMPANY_WITH_SERVICES = {
  id: true,
  name: true,
  slug: true,
  description: true,
  isActive: true,
  colorPrimary: true,
  colorSecondary: true,
  createdAt: true,
  updatedAt: true,
  services: {
    select: {
      service: {
        select: { id: true, name: true, slug: true, icon: true, description: true },
      },
      assignedAt: true,
    },
  },
  _count: { select: { users: true, documents: true } },
} satisfies Prisma.CompanySelect;

export async function findCompanyById(id: string) {
  return db.company.findUnique({ where: { id }, select: COMPANY_WITH_SERVICES });
}

export async function findCompanyBySlug(slug: string) {
  return db.company.findUnique({ where: { slug }, select: COMPANY_WITH_SERVICES });
}

export async function findCompanies(filters: { isActive?: boolean; search?: string; page?: number; limit?: number } = {}) {
  const { isActive, search, page = 1, limit = 20 } = filters;

  const where: Prisma.CompanyWhereInput = {
    // Only apply isActive filter when explicitly requested — never hide companies by default
    ...(isActive !== undefined && { isActive }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [companies, total] = await Promise.all([
    db.company.findMany({
      where,
      select: COMPANY_WITH_SERVICES,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.company.count({ where }),
  ]);

  return { companies, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function createCompany(
  data: { name: string; slug: string; description?: string; colorPrimary?: string; colorSecondary?: string },
  serviceIds: string[]
) {
  return db.company.create({
    data: {
      ...data,
      services: {
        create: serviceIds.map(serviceId => ({ serviceId })),
      },
    },
    select: COMPANY_WITH_SERVICES,
  });
}

export async function updateCompany(
  id: string,
  data: Prisma.CompanyUpdateInput,
  serviceIds?: string[]
) {
  if (serviceIds !== undefined) {
    // Replace all service assignments in one transaction
    await db.$transaction([
      db.companyService.deleteMany({ where: { companyId: id } }),
      db.companyService.createMany({
        data: serviceIds.map(serviceId => ({ companyId: id, serviceId })),
      }),
    ]);
  }
  return db.company.update({ where: { id }, data, select: COMPANY_WITH_SERVICES });
}

export async function deleteCompany(id: string) {
  return db.company.delete({ where: { id } });
}
