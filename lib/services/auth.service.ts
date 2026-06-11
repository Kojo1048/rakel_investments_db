import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { findUserByUsername, findUserByEmail } from '../repositories/user.repository';
import { createAuditLog } from '../repositories/audit.repository';
import { signToken, type SessionPayload } from '../auth/session';
import { db } from '../db';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface LoginResult {
  token: string;
  user: SessionPayload;
}

export async function login(
  username: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<LoginResult> {
  // DEBUG — remove before shipping to production
  console.log('[auth] login attempt:', { username, ip: ipAddress });

  const user = await findUserByUsername(username);

  // DEBUG — remove before production
  console.log('[auth] user lookup:', user
    ? { id: user.id, username: user.username, role: user.role, status: user.status, hashPrefix: user.passwordHash?.slice(0, 7) }
    : 'NOT FOUND'
  );

  if (!user) {
    // DEBUG — swap back to generic message before production
    throw new Error('User not found');
  }

  const passwordMatch = await verifyPassword(password, user.passwordHash);
  // DEBUG — remove before production
  console.log('[auth] password match:', passwordMatch);

  if (!passwordMatch) {
    // DEBUG — swap back to generic message before production
    throw new Error('Password incorrect');
  }

  if (user.status !== 'ACTIVE') {
    throw new Error(`Account is ${user.status.toLowerCase()}. Contact your administrator.`);
  }

  const payload: SessionPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    companyId: user.companyId ?? null,
  };

  const token = signToken(payload);

  // Record the session server-side (token hash only — never store raw JWT)
  const tokenHash = await bcrypt.hash(token, 8);
const { error: sessionErr } = await db.from('UserSession').insert({
  id: crypto.randomUUID(),

  userId: user.id,
  tokenHash,

  expiresAt: new Date(
    Date.now() + 8 * 60 * 60 * 1000
  ).toISOString(),

  ipAddress,
  userAgent,

  createdAt: new Date().toISOString(),
});
 if (sessionErr) {
  console.error('[auth] failed to persist session:', sessionErr);
  throw new Error('Failed to persist session');
}

  // Audit log
  await createAuditLog({
    userId: user.id,
    username: user.username,
    action: 'LOGIN',
    details: 'Successful login',
    ipAddress,
    userAgent,
    companyId: user.companyId ?? undefined,
  });

  return { token, user: payload };
}

export async function logout(userId: string, username: string, tokenHash?: string): Promise<void> {
  if (tokenHash) {
    await db.from('UserSession').delete().eq('userId', userId).eq('tokenHash', tokenHash);
  } else {
    await db.from('UserSession').delete().eq('userId', userId);
  }

  await createAuditLog({
    userId,
    username,
    action: 'LOGOUT',
    details: 'User logged out',
  });
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const user = await findUserByUsername(username);
  return user === null;
}

export async function isEmailAvailable(email: string): Promise<boolean> {
  const user = await findUserByEmail(email);
  return user === null;
}
