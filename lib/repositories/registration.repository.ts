import { randomUUID } from 'crypto';
import { db } from '../db';

const REG_COLS = `
  id, username, email, fullName, requestedRole,
  companyId, reason, staffModules, createdAt,
  company:Company!PendingRegistration_companyId_fkey(id, name, slug)
`.trim();

export async function findPendingRegistrations(companyId?: string) {
  let query = db.from('PendingRegistration').select(REG_COLS);
  if (companyId) query = query.eq('companyId', companyId);
  const { data, error } = await query.order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function findRegistrationById(id: string) {
  const { data, error } = await db
    .from('PendingRegistration')
    .select(`${REG_COLS}, passwordHash`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findRegistrationByUsername(username: string) {
  const { data, error } = await db
    .from('PendingRegistration')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createRegistration(data: {
  username:      string;
  email:         string;
  passwordHash:  string;
  fullName:      string;
  requestedRole: string;
  reason?:       string;
  staffModules?: unknown[] | null;
  companyId?:    string;
}) {
  const { data: reg, error } = await db
    .from('PendingRegistration')
    .insert({
      id:            randomUUID(),
      username:      data.username,
      email:         data.email,
      passwordHash:  data.passwordHash,
      fullName:      data.fullName,
      requestedRole: data.requestedRole,
      reason:        data.reason,
      staffModules:  data.staffModules,
      companyId:     data.companyId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return reg;
}

export async function deleteRegistration(id: string) {
  const { error } = await db.from('PendingRegistration').delete().eq('id', id);
  if (error) throw error;
}
