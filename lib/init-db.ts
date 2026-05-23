/**
 * Ensures built-in system accounts exist and are ACTIVE.
 * Called automatically on server startup via instrumentation.ts.
 * Safe to call multiple times — uses "insert if not exists" logic.
 */
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

interface DefaultAccount {
  username: string;
  password: string;
  role: 'SUPER_ADMIN' | 'RAKEL_ADMIN' | 'CEO';
  fullName: string;
  email: string;
}

const DEFAULT_ACCOUNTS: DefaultAccount[] = [
  {
    username: 'Admin123',
    password: 'Gideonadmin',
    role:     'SUPER_ADMIN',
    fullName: 'Gideon Johnson',
    email:    'admin@rakel.com',
  },
  {
    username: 'rakel_admin',
    password: 'Rakeladmin54321$',
    role:     'RAKEL_ADMIN',
    fullName: 'Rakel Administrator',
    email:    'rakeladmin@rakel.com',
  },
  {
    username: 'ceo_alpha',
    password: 'AlphaCEO123',
    role:     'CEO',
    fullName: 'Mr Alpha Jalloh',
    email:    'ceo@rakel.com',
  },
];

/**
 * Ensures the Rakel Investments system company exists.
 * This company allows trusted staff to upload data on behalf of any company.
 */
export async function ensureRakelInvestmentsCompany(): Promise<void> {
  const { db } = await import('./db/index');
  try {
    const existing = await db.company.findFirst({
      where: { name: { contains: 'Rakel', mode: 'insensitive' } },
      select: { id: true, name: true },
    });

    if (!existing) {
      await db.company.create({
        data: {
          name:        'Rakel Investments',
          slug:        'rakel-investments',
          description: 'System operator company — staff may upload data on behalf of any company.',
          isActive:    true,
        },
      });
      console.log('[init-db] ✓ Created Rakel Investments company');
    } else {
      console.log(`[init-db] ✓ Rakel company found: "${existing.name}"`);
    }
  } catch (err) {
    console.error('[init-db] ✗ Failed to ensure Rakel Investments company:', err);
  }
}

export async function ensureDefaultAccounts(): Promise<void> {
  // Dynamic import keeps this file server-only (db uses pg which is Node.js-only)
  const { db } = await import('./db/index');

  let created = 0;
  let fixed   = 0;
  let ok      = 0;

  for (const account of DEFAULT_ACCOUNTS) {
    try {
      const existing = await db.user.findUnique({
        where:  { username: account.username },
        select: { id: true, status: true, role: true },
      });

      if (!existing) {
        // Account missing → create with hashed password
        const passwordHash = await bcrypt.hash(account.password, BCRYPT_ROUNDS);
        await db.user.create({
          data: {
            username:     account.username,
            email:        account.email,
            passwordHash,
            role:         account.role,
            fullName:     account.fullName,
            status:       'ACTIVE',
          },
        });
        console.log(`[init-db] ✓ Created  ${account.username} (${account.role})`);
        created++;
      } else {
        // Account exists — ensure it is ACTIVE with the correct role
        const needsFix =
          existing.status !== 'ACTIVE' ||
          existing.role   !== account.role;

        if (needsFix) {
          await db.user.update({
            where: { username: account.username },
            data:  { status: 'ACTIVE', role: account.role },
          });
          console.log(`[init-db] ✓ Fixed    ${account.username} → ACTIVE / ${account.role}`);
          fixed++;
        } else {
          ok++;
        }
      }
    } catch (err) {
      // Log but don't crash the server — a missing email uniqueness conflict, etc.
      console.error(`[init-db] ✗ Failed to ensure ${account.username}:`, err);
    }
  }

  console.log(
    `[init-db] Rakel Admin account verified or created successfully.` +
    ` (created: ${created}, fixed: ${fixed}, already ok: ${ok})`
  );
}
