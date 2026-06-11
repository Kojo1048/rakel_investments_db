// lib/init-db.ts
// Ensures built-in system accounts exist and are ACTIVE at server startup.
// Confirmed against "User" table with columns: passwordHash, fullName, companyId, staffModules
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

const DEFAULT_ACCOUNTS = [
  { username: 'Admin123',    password: 'Gideonadmin',      role: 'SUPER_ADMIN' as const, fullName: 'Gideon Johnson',     email: 'admin@rakel.com' },
  { username: 'rakel_admin', password: 'Rakeladmin54321$', role: 'RAKEL_ADMIN' as const, fullName: 'Rakel Administrator', email: 'rakeladmin@rakel.com' },
  { username: 'ceo_alpha',   password: 'AlphaCEO123',      role: 'CEO'         as const, fullName: 'Mr Alpha Jalloh',    email: 'ceo@rakel.com' },
];

export async function ensureRakelInvestmentsCompany(): Promise<void> {
  const { db } = await import('./db/index');
  try {
    const { data: existing } = await db
      .from('Company')
      .select('id, name')
      .ilike('name', '%rakel%')
      .maybeSingle();

    if (!existing) {
      const { error } = await db.from('Company').insert({
        id:          randomUUID(),
        name:        'Rakel Investments',
        slug:        'rakel-investments',
        description: 'System operator company — staff may upload data on behalf of any company.',
        isActive:    true,
        updatedAt:   new Date().toISOString(),
      } as any);
      if (error) throw error;
      console.log('[init-db] ✓ Created Rakel Investments company');
    } else {
      console.log(`[init-db] ✓ Rakel company found: "${existing.name}"`);
    }
  } catch (err) {
    console.error('[init-db] ✗ Failed to ensure Rakel Investments company:', err);
  }
}

export async function ensureDefaultAccounts(): Promise<void> {
  const { db } = await import('./db/index');
  let created = 0, fixed = 0, ok = 0;

  for (const account of DEFAULT_ACCOUNTS) {
    try {
      const { data: existing } = await db
        .from('User')
        .select('id, status, role')
        .eq('username', account.username)
        .maybeSingle();

      if (!existing) {
        const passwordHash = await bcrypt.hash(account.password, BCRYPT_ROUNDS);
        const { error } = await db.from('User').insert({
          id:           randomUUID(),
          username:     account.username,
          email:        account.email,
          passwordHash,
          role:         account.role,
          fullName:     account.fullName,
          status:       'ACTIVE',
          updatedAt:    new Date().toISOString(),
        } as any);
        if (error) throw error;
        console.log(`[init-db] ✓ Created  ${account.username} (${account.role})`);
        created++;
      } else {
        const needsFix = existing.status !== 'ACTIVE' || existing.role !== account.role;
        if (needsFix) {
          const { error } = await db
            .from('User')
            .update({ status: 'ACTIVE', role: account.role, updatedAt: new Date().toISOString() })
            .eq('username', account.username);
          if (error) throw error;
          console.log(`[init-db] ✓ Fixed    ${account.username} → ACTIVE / ${account.role}`);
          fixed++;
        } else {
          ok++;
        }
      }
    } catch (err) {
      console.error(`[init-db] ✗ Failed to ensure ${account.username}:`, err);
    }
  }

  console.log(
    `[init-db] Rakel Admin account verified or created successfully.` +
    ` (created: ${created}, fixed: ${fixed}, already ok: ${ok})`
  );
}
