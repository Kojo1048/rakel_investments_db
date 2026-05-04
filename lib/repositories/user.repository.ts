import { db } from '../db';
import type { UserRole, UserStatus, Prisma } from '@prisma/client';

export interface UserFilters {
  role?:      UserRole;
  status?:    UserStatus;
  companyId?: string;
  search?:    string;
  page?:      number;
  limit?:     number;
}

// ── Shared SELECT shape ───────────────────────────────────────────────────────
// This is the ONLY select used for all list/write queries.
// It contains only fields that have always been in the schema — no migrations
// required.  It is declared with `satisfies` so TypeScript enforces correctness.

export const USER_SELECT = {
  id:        true,
  username:  true,
  email:     true,
  role:      true,
  status:    true,
  fullName:  true,
  companyId: true,
  createdAt: true,
  updatedAt: true,
  company:   { select: { id: true, name: true, slug: true } },
} satisfies Prisma.UserSelect;

// ── Extended select — includes staffModules ───────────────────────────────────
// Used ONLY by findUserById() (the auth/me route).
// If the staffModules column doesn't exist yet, findUserById falls back to
// USER_SELECT automatically via tryWithStaffModules().

const USER_SELECT_WITH_MODULES = {
  ...USER_SELECT,
  staffModules: true,
} as any as Prisma.UserSelect;   // `as any` bypasses stale Prisma client types

// ── Helper: detect errors that mean "column not in DB yet" ───────────────────

function isUnknownFieldError(err: unknown): boolean {
  const name = (err as any)?.name ?? '';
  const msg  = ((err as any)?.message ?? '').toLowerCase();
  const code = (err as any)?.code ?? '';
  return (
    name === 'PrismaClientValidationError'  ||  // client-side field validation
    code === 'P2022'                        ||  // column not found (runtime)
    code === '42703'                        ||  // PostgreSQL: undefined_column
    msg.includes('unknown field')           ||
    msg.includes('does not exist')          ||
    msg.includes('column not found')
  );
}

// ── findUserById — tries with staffModules, falls back gracefully ─────────────

export async function findUserById(id: string) {
  try {
    return await db.user.findUnique({
      where:  { id },
      select: USER_SELECT_WITH_MODULES,
    });
  } catch (err) {
    if (isUnknownFieldError(err)) {
      console.warn('[user.repository] staffModules not available — falling back to base select');
      return db.user.findUnique({ where: { id }, select: USER_SELECT });
    }
    throw err;
  }
}

// ── findUserByUsername / findUserByEmail — password hash included ─────────────
// These are used only by the login flow and do NOT expose the hash to callers.

export async function findUserByUsername(username: string) {
  return db.user.findUnique({ where: { username } });
}

export async function findUserByEmail(email: string) {
  return db.user.findUnique({ where: { email } });
}

// ── findUsers — list query, always uses base select ───────────────────────────
// Never includes staffModules so this query can never fail due to schema drift.

export async function findUsers(filters: UserFilters = {}) {
  const { role, status, companyId, search, page = 1, limit = 20 } = filters;

  const where: Prisma.UserWhereInput = {
    ...(role      && { role }),
    ...(status    && { status }),
    ...(companyId && { companyId }),
    ...(search && {
      OR: [
        { username: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { email:    { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select:  USER_SELECT,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    db.user.count({ where }),
  ]);

  return { users, total, page, limit, pages: Math.ceil(total / limit) };
}

// ── countUsers — lightweight total for dashboard stats ────────────────────────

export async function countUsers(filters: Pick<UserFilters, 'role' | 'status' | 'companyId'> = {}) {
  const { role, status, companyId } = filters;
  return db.user.count({
    where: {
      ...(role      && { role }),
      ...(status    && { status }),
      ...(companyId && { companyId }),
    },
  });
}

// ── createUser / updateUser — write operations, return base select ────────────

export async function createUser(data: Prisma.UserCreateInput) {
  return db.user.create({ data, select: USER_SELECT });
}

export async function updateUser(id: string, data: Prisma.UserUpdateInput) {
  return db.user.update({ where: { id }, data, select: USER_SELECT });
}

export async function deleteUser(id: string) {
  return db.user.delete({ where: { id } });
}
