// lib/system/initSystem.ts
// Confirmed against "Company" table: quoted columns isActive, createdAt, updatedAt
import { randomUUID } from 'crypto';
export interface SystemInitResult {
  companyCreated: boolean;
  companyId:      string | null;
  error:          string | null;
}

export async function ensureSystemCompany(): Promise<SystemInitResult> {
  const result: SystemInitResult = { companyCreated: false, companyId: null, error: null };

  try {
    const { db } = await import('../db/index');

    const { data: existing } = await db
      .from('Company')
      .select('id, name, isActive')
      .ilike('name', '%rakel%')
      .maybeSingle();

    if (existing) {
      result.companyId = existing.id;
      if (!existing.isActive) {
        await db.from('Company').update({ isActive: true, updatedAt: new Date().toISOString() }).eq('id', existing.id);
        console.log(`[initSystem] Rakel company reactivated: "${existing.name}"`);
      } else {
        console.log(`[initSystem] Rakel company OK: "${existing.name}" (id: ${existing.id})`);
      }
    } else {
      const { data: created, error } = await db
        .from('Company')
        .insert({
          id:          randomUUID(),
          name:        'Rakel Investments',
          slug:        'rakel-investments',
          description: 'System operator company — staff may upload data on behalf of any company.',
          isActive:    true,
          updatedAt:   new Date().toISOString(),
        } as any)
        .select('id')
        .single();
      if (error) throw error;
      result.companyId      = created.id;
      result.companyCreated = true;
      console.log(`[initSystem] ✓ Created "Rakel Investments" (id: ${created.id})`);
    }
  } catch (err: any) {
    result.error = err?.message ?? String(err);
    console.error('[initSystem] ✗ ensureSystemCompany failed:', err);
  }

  return result;
}
