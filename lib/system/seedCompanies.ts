/**
 * Ensures at least Rakel Investments exists in the companies table.
 * Called on startup — never throws, never blocks page rendering.
 */
export async function seedCompanies(): Promise<void> {
  try {
    const { db } = await import('../db/index');

    const existing = await db.company.findMany({ select: { id: true, name: true } });

    if (existing.length === 0) {
      await db.company.create({
        data: {
          name:        'Rakel Investments',
          slug:        'rakel-investments',
          description: 'System operator company',
          isActive:    true,
        },
      });
      console.log('[seedCompanies] Created Rakel Investments (first run)');
      return;
    }

    // Table has rows — ensure Rakel Investments is among them
    const hasRakel = existing.some(c => c.name.toLowerCase().includes('rakel'));
    if (!hasRakel) {
      await db.company.create({
        data: {
          name:     'Rakel Investments',
          slug:     'rakel-investments',
          isActive: true,
        },
      });
      console.log('[seedCompanies] Added Rakel Investments to existing companies');
    }
  } catch (err) {
    console.error('[seedCompanies] Failed (non-fatal):', err);
  }
}
