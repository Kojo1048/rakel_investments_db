import { db } from '../db';
import type { Prisma } from '@prisma/client';

// ── Base PendingRegistration fields (always present in the original schema) ───
const CORE_FIELDS = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  requestedRole: true,
  companyId: true,
  reason: true,
  createdAt: true,
} satisfies Prisma.PendingRegistrationSelect;

// ── findPendingRegistrations ──────────────────────────────────────────────────

export async function findPendingRegistrations(companyId?: string) {
  return db.pendingRegistration.findMany({
    where:   companyId ? { companyId } : undefined,
    orderBy: { createdAt: 'desc' },
    select:  { ...CORE_FIELDS, company: { select: { id: true, name: true } } },
  });
}

// ── findRegistrationById ──────────────────────────────────────────────────────
// Tries to include staffModules; falls back to core fields if the column has
// not been added to the database yet (migration not run).

const REG_BY_ID_BASE = {
  ...CORE_FIELDS,
  passwordHash: true,
} satisfies Prisma.PendingRegistrationSelect;

export async function findRegistrationById(id: string) {
  try {
    return await db.pendingRegistration.findUnique({
      where:  { id },
      select: { ...REG_BY_ID_BASE, staffModules: true } as any,
    });
  } catch {
    // staffModules column not yet present — return without it
    return db.pendingRegistration.findUnique({
      where:  { id },
      select: REG_BY_ID_BASE,
    });
  }
}

// ── findRegistrationByUsername ────────────────────────────────────────────────

export async function findRegistrationByUsername(username: string) {
  return db.pendingRegistration.findUnique({
    where:  { username },
    select: { id: true },
  });
}

// ── createRegistration ────────────────────────────────────────────────────────
// Accepts a plain object so callers can include staffModules without TypeScript
// or Prisma's client-side validator rejecting unknown fields.
//
// Strategy:
//  1. Extract staffModules (and any other non-core field) before calling Prisma.
//  2. Pass only the schema-safe core fields to db.create().
//  3. If the staffModules column exists (migration was run), patch it via a
//     second update call.  This avoids PrismaClientValidationError entirely.

export async function createRegistration(
  data: {
    username:      string;
    email:         string;
    passwordHash:  string;
    fullName:      string;
    requestedRole: string;
    reason?:       string;
    staffModules?: string[] | null;
    company?:      { connect: { id: string } };
    companyId?:    string;
    [key: string]: unknown;
  }
) {
  // Separate the extra fields that may not be in the generated Prisma client
  const { staffModules, ...coreData } = data;

  // 1. Create the record with only core fields — always succeeds
  const created = await db.pendingRegistration.create({
    data: coreData as Prisma.PendingRegistrationCreateInput,
  });

  // 2. If staffModules were provided, attempt to persist them.
  //    The update is best-effort: if the column doesn't exist yet, we silently
  //    skip it (the approval flow will just not carry modules through).
  if (staffModules && staffModules.length > 0) {
    try {
      await db.pendingRegistration.update({
        where: { id: created.id },
        data:  { staffModules } as any,
      });
    } catch {
      // Column not present yet — safe to ignore. Run: npx prisma db push
      console.warn(
        '[registration.repository] staffModules column not found — ' +
        'run `npx prisma db push` to persist staff module selections.'
      );
    }
  }

  return created;
}

// ── deleteRegistration ────────────────────────────────────────────────────────

export async function deleteRegistration(id: string) {
  return db.pendingRegistration.delete({ where: { id } });
}
