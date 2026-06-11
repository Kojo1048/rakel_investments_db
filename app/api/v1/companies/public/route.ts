import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Return ALL companies — no isActive filter so system companies like
    // "Rakel Investments" always appear in the registration dropdown.
    const { data: companies, error } = await db
      .from('Company')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ companies: companies ?? [] });
  } catch {
    return NextResponse.json({ companies: [] });
  }
}
