// lib/repositories/user.repository.ts
// Confirmed against actual Supabase schema:
//   table → "User"
//   quoted columns: "passwordHash", "fullName", "companyId", "staffModules", "createdAt", "updatedAt"
//   FK: User_companyId_fkey → "Company"(id)
import { randomUUID } from 'crypto';
import { db } from '../db';
import type { UserRole, UserStatus } from '../types';

export type { UserRole, UserStatus };

export interface UserFilters {
  role?:      UserRole;
  status?:    UserStatus;
  companyId?: string;
  search?:    string;
  page?:      number;
  limit?:     number;
}

// Mirrors Prisma USER_SELECT — no passwordHash exposed
const USER_COLS = `
  id, username, email, role, status,
  fullName, companyId, createdAt, updatedAt,
  company:Company!User_companyId_fkey(id, name, slug)
`.trim();

const USER_COLS_WITH_MODULES = `
  id, username, email, role, status,
  fullName, companyId, staffModules, createdAt, updatedAt,
  company:Company!User_companyId_fkey(id, name, slug)
`.trim();

// ── findUserById ──────────────────────────────────────────────────────────────
export async function findUserById(id: string) {
  const { data, error } = await db
    .from('User')
    .select(USER_COLS_WITH_MODULES)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── findUserByUsername — used by login only, returns passwordHash ─────────────
export async function findUserByUsername(username: string) {
  const { data, error } = await db
    .from('User')
    .select('id, username, passwordHash, role, status, companyId, fullName, email, staffModules, company:Company!User_companyId_fkey(name)')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── findUserByEmail ───────────────────────────────────────────────────────────
export async function findUserByEmail(email: string) {
  const { data, error } = await db
    .from('User')
    .select('id, username, email, role, status, companyId')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── findUsers ─────────────────────────────────────────────────────────────────
export async function findUsers(filters: UserFilters = {}) {
  const { role, status, companyId, search, page = 1, limit = 20 } = filters;

  let query = db.from('User').select(USER_COLS, { count: 'exact' });

  if (role)      query = query.eq('role', role);
  if (status)    query = query.eq('status', status);
  if (companyId) query = query.eq('companyId', companyId);
  if (search) {
    query = query.or(
      `username.ilike.%${search}%,fullName.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query
    .order('createdAt', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) throw error;
  const total = count ?? 0;
  return { users: data ?? [], total, page, limit, pages: Math.ceil(total / limit) };
}

// ── countUsers ────────────────────────────────────────────────────────────────
export async function countUsers(
  filters: Pick<UserFilters, 'role' | 'status' | 'companyId'> = {}
) {
  const { role, status, companyId } = filters;
  let query = db.from('User').select('*', { count: 'exact', head: true });
  if (role)      query = query.eq('role', role);
  if (status)    query = query.eq('status', status);
  if (companyId) query = query.eq('companyId', companyId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

// ── createUser ────────────────────────────────────────────────────────────────
export async function createUser(data: {
  username:      string;
  email?:        string;
  passwordHash:  string;
  role:          UserRole;
  status?:       UserStatus;
  fullName?:     string;
  companyId?:    string;
  staffModules?: unknown;
}) {
  const { data: user, error } = await db
    .from('User')
    .insert({
      id:           randomUUID(),
      username:     data.username,
      email:        data.email,
      passwordHash: data.passwordHash,
      role:         data.role,
      status:       data.status ?? 'PENDING',
      fullName:     data.fullName,
      companyId:    data.companyId,
      staffModules: data.staffModules,
      updatedAt:    new Date().toISOString(),
    })
    .select(USER_COLS)
    .single();
  if (error) throw error;
  return user;
}

// ── updateUser ────────────────────────────────────────────────────────────────
export async function updateUser(
  id: string,
  data: Partial<{
    username:     string;
    email:        string;
    passwordHash: string;
    role:         UserRole;
    status:       UserStatus;
    fullName:     string;
    companyId:    string | null;
    staffModules: unknown;
  }>
) {
  const { data: user, error } = await db
    .from('User')
    .update({ ...data, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select(USER_COLS)
    .single();
  if (error) throw error;
  return user;
}

// ── deleteUser ────────────────────────────────────────────────────────────────
export async function deleteUser(id: string) {
  const { error } = await db.from('User').delete().eq('id', id);
  if (error) throw error;
}
