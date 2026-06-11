import type { UserRole } from '@/lib/types';
import type { SessionPayload } from './session';

export type Permission =
  | 'companies:read'
  | 'companies:write'
  | 'companies:delete'
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'analytics:read'
  | 'analytics:export'
  | 'documents:read'
  | 'documents:upload'
  | 'documents:delete'
  | 'audit:read'
  | 'settings:read'
  | 'settings:write'
  | 'data_import:write'
  | 'registrations:read'
  | 'registrations:approve'
  | 'operations:read'
  | 'operations:write'
  | 'contracts:read'
  | 'contracts:write'
  | 'invoices:read'
  | 'invoices:write';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'companies:read', 'companies:write', 'companies:delete',
    'users:read', 'users:write', 'users:delete',
    'analytics:read', 'analytics:export',
    'documents:read',
    'audit:read',
    'settings:read', 'settings:write',
    'data_import:write',
    'registrations:read', 'registrations:approve',
    'operations:read',
    'contracts:read',
    'invoices:read',
  ],
  RAKEL_ADMIN: [
    'companies:read', 'companies:write',
    'users:read',                          // read-only view of users list
    'analytics:read', 'analytics:export',
    'documents:read', 'documents:upload', 'documents:delete',
    'audit:read',                          // required for notification bell + audit log
    'settings:read',
    'data_import:write',
    'registrations:read', 'registrations:approve',
    'operations:read', 'operations:write',
    'contracts:read', 'contracts:write',
    'invoices:read', 'invoices:write',
  ],
  CEO: [
    'companies:read',
    'users:read',
    'analytics:read', 'analytics:export',
    'documents:read',
    'settings:read',
    'operations:read',
    'contracts:read',
    'invoices:read',
  ],
  COMPANY_ADMIN: [
    'companies:read',
    'users:read', 'users:write',
    'analytics:read', 'analytics:export',
    'documents:read', 'documents:upload', 'documents:delete',
    'settings:read',
    'data_import:write',
    'operations:read', 'operations:write',
    'contracts:read', 'contracts:write',
    'invoices:read', 'invoices:write',
  ],
  STAFF: [
    'companies:read',
    'analytics:read',
    'documents:read', 'documents:upload',
    'data_import:write',
    'operations:read', 'operations:write',
    'contracts:read',  'contracts:write',
    'invoices:read',   'invoices:write',
  ],
};

export function hasPermission(session: SessionPayload, permission: Permission): boolean {
  return ROLE_PERMISSIONS[session.role]?.includes(permission) ?? false;
}

export function hasAnyPermission(session: SessionPayload, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(session, p));
}

export function requirePermission(session: SessionPayload | null, permission: Permission): void {
  if (!session) throw new AuthError('Unauthorized', 401);
  if (!hasPermission(session, permission)) throw new AuthError('Forbidden', 403);
}

export function requireRole(session: SessionPayload | null, ...roles: UserRole[]): void {
  if (!session) throw new AuthError('Unauthorized', 401);
  if (!roles.includes(session.role)) throw new AuthError('Forbidden', 403);
}

export function requireCompanyAccess(session: SessionPayload, targetCompanyId: string): void {
  if (session.role === 'SUPER_ADMIN' || session.role === 'RAKEL_ADMIN' || session.role === 'CEO') return;
  // STAFF submit data on behalf of any company they select — no company lock
  if (session.role === 'STAFF') return;
  if (session.companyId !== targetCompanyId) throw new AuthError('Forbidden', 403);
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
