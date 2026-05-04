/**
 * One-time safe seed endpoint.
 *
 * GET /api/seed
 *
 * • Checks if "Rakel Investments" already exists.
 * • Creates it only if absent.
 * • Idempotent — safe to call multiple times.
 * • No authentication required (public startup helper).
 *
 * After the company is in the database this endpoint becomes a no-op.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic  = 'force-dynamic';

export async function GET() {
  try {
    // ── Check for any company whose name contains "Rakel" ──────────────────
    const existing = await db.company.findFirst({
      where:  { name: { contains: 'Rakel', mode: 'insensitive' } },
      select: { id: true, name: true, isActive: true },
    });

    if (existing) {
      return NextResponse.json({
        status:  'already_exists',
        message: `"${existing.name}" already exists in the database (id: ${existing.id})`,
        company: existing,
      });
    }

    // ── Insert Rakel Investments ────────────────────────────────────────────
    const created = await db.company.create({
      data: {
        name:        'Rakel Investments',
        slug:        'rakel-investments',
        description: 'System operator company — staff may upload data on behalf of any company.',
        isActive:    true,
      },
      select: { id: true, name: true, slug: true, isActive: true },
    });

    console.log('[seed] Created Rakel Investments:', created.id);

    return NextResponse.json({
      status:  'created',
      message: '"Rakel Investments" has been inserted successfully.',
      company: created,
    }, { status: 201 });

  } catch (err: any) {
    console.error('[seed] Error:', err);
    return NextResponse.json(
      { status: 'error', message: err?.message ?? 'Seed failed — check server logs.' },
      { status: 500 }
    );
  }
}
