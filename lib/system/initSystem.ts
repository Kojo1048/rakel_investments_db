/**
 * System initialiser — runs once at server startup (via instrumentation.ts).
 *
 * Responsibilities:
 *  • Ensure the "Rakel Investments" system company exists.
 *
 * Rules:
 *  • Never throws — any error is caught, logged, and the app continues.
 *  • Never modifies the database schema.
 *  • Safe to call multiple times (idempotent).
 */

export interface SystemInitResult {
  companyCreated: boolean;
  companyId:      string | null;
  error:          string | null;
}

export async function ensureSystemCompany(): Promise<SystemInitResult> {
  const result: SystemInitResult = { companyCreated: false, companyId: null, error: null };

  try {
    const { db } = await import('../db/index');

    // Check for any company whose name contains "rakel" (case-insensitive)
    const existing = await db.company.findFirst({
      where:  { name: { contains: 'Rakel', mode: 'insensitive' } },
      select: { id: true, name: true, isActive: true },
    });

    if (existing) {
      result.companyId = existing.id;

      // Ensure it is active
      if (!existing.isActive) {
        await db.company.update({
          where: { id: existing.id },
          data:  { isActive: true },
        });
        console.log(`[initSystem] Rakel company reactivated: "${existing.name}"`);
      } else {
        console.log(`[initSystem] Rakel company OK: "${existing.name}" (id: ${existing.id})`);
      }
    } else {
      // Create the system company
      const created = await db.company.create({
        data: {
          name:        'Rakel Investments',
          slug:        'rakel-investments',
          description: 'System operator company — staff may upload data on behalf of any company.',
          isActive:    true,
        },
        select: { id: true },
      });

      result.companyId    = created.id;
      result.companyCreated = true;
      console.log(`[initSystem] ✓ Created "Rakel Investments" (id: ${created.id})`);
    }
  } catch (err: any) {
    result.error = err?.message ?? String(err);
    console.error('[initSystem] ✗ ensureSystemCompany failed:', err);
    // Intentionally do NOT rethrow — startup must continue
  }

  return result;
}
