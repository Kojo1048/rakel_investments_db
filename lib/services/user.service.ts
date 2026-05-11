import { hashPassword } from './auth.service';
import { sendApprovalEmail, sendDeclineEmail } from './email.service';
import { createAuditLog } from '../repositories/audit.repository';
import * as UserRepo from '../repositories/user.repository';
import * as RegistrationRepo from '../repositories/registration.repository';
import type { CreateUserInput, UpdateUserInput } from '../validations/user.schema';
import type { SessionPayload } from '../auth/session';

export async function listUsers(filters: UserRepo.UserFilters) {
  return UserRepo.findUsers(filters);
}

export async function getUserById(id: string) {
  const user = await UserRepo.findUserById(id);
  if (!user) throw new Error('User not found');
  return user;
}

export async function createUser(input: CreateUserInput, actor: SessionPayload) {
  const passwordHash = await hashPassword(input.password);

  const user = await UserRepo.createUser({
    username: input.username,
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    role: input.role,
    status: input.status ?? 'ACTIVE',
    ...(input.companyId && { company: { connect: { id: input.companyId } } }),
  });

  await createAuditLog({
    userId: actor.userId,
    username: actor.username,
    action: 'USER_CREATE',
    details: `Created user: ${input.username}`,
    targetEntity: input.username,
    companyId: actor.companyId ?? undefined,
  });

  return user;
}

export async function updateUser(id: string, input: UpdateUserInput, actor: SessionPayload) {
  const updateData: Parameters<typeof UserRepo.updateUser>[1] = {
    ...(input.username !== undefined && { username: input.username }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.fullName !== undefined && { fullName: input.fullName }),
    ...(input.role !== undefined && { role: input.role }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.password !== undefined && { passwordHash: await hashPassword(input.password) }),
    ...(input.companyId !== undefined && {
      company: input.companyId ? { connect: { id: input.companyId } } : { disconnect: true },
    }),
  };

  const user = await UserRepo.updateUser(id, updateData);

  await createAuditLog({
    userId: actor.userId,
    username: actor.username,
    action: 'USER_UPDATE',
    details: `Updated user: ${user.username}`,
    targetEntity: user.username,
    companyId: actor.companyId ?? undefined,
  });

  return user;
}

export async function deleteUser(id: string, actor: SessionPayload) {
  const user = await UserRepo.findUserById(id);
  if (!user) throw new Error('User not found');

  await UserRepo.deleteUser(id);

  await createAuditLog({
    userId: actor.userId,
    username: actor.username,
    action: 'USER_DELETE',
    details: `Deleted user: ${user.username}`,
    targetEntity: user.username,
    companyId: actor.companyId ?? undefined,
  });
}

export async function approveRegistration(registrationId: string, actor: SessionPayload) {
  const reg = await RegistrationRepo.findRegistrationById(registrationId);
  if (!reg) throw new Error('Registration not found');

  const user = await UserRepo.createUser({
    username: reg.username,
    email: reg.email,
    passwordHash: reg.passwordHash,
    fullName: reg.fullName,
    role: reg.requestedRole,
    status: 'ACTIVE',
    ...(reg.companyId && { company: { connect: { id: reg.companyId } } }),
    // Preserve module selections made during STAFF registration
    ...((reg as any).staffModules ? { staffModules: (reg as any).staffModules } : {}),
  });

  await RegistrationRepo.deleteRegistration(registrationId);

  await Promise.all([
    createAuditLog({
      userId: actor.userId,
      username: actor.username,
      action: 'USER_APPROVE',
      details: `Approved registration for: ${reg.username}`,
      targetEntity: reg.username,
    }),
    sendApprovalEmail(reg.email, reg.fullName).catch(() => {}),
  ]);

  return user;
}

export async function declineRegistration(registrationId: string, actor: SessionPayload) {
  const reg = await RegistrationRepo.findRegistrationById(registrationId);
  if (!reg) throw new Error('Registration not found');

  await RegistrationRepo.deleteRegistration(registrationId);

  await Promise.all([
    createAuditLog({
      userId: actor.userId,
      username: actor.username,
      action: 'USER_DECLINE',
      details: `Declined registration for: ${reg.username}`,
      targetEntity: reg.username,
    }),
    sendDeclineEmail(reg.email, reg.fullName).catch(() => {}),
  ]);
}
