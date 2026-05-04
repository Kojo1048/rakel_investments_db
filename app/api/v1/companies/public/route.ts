import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Return ALL companies — no isActive filter so system companies like
    // "Rakel Investments" always appear in the registration dropdown.
    const companies = await db.company.findMany({
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ companies });
  } catch {
    return NextResponse.json({ companies: [] });
  }
}
