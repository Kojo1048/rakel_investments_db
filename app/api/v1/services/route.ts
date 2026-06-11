import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    withPermission(getSessionFromRequest(req), 'companies:read');

    const { data: services, error } = await db
      .from('Service')
      .select('id, name, slug, icon, description')
      .eq('isActive', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ services: services ?? [] });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    withPermission(getSessionFromRequest(req), 'settings:write');

    const body = await req.json();
    const name = (body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);

    const description = (body.description ?? '').trim() || null;

    const { data, error } = await db
      .from('Service')
      .insert({ 
        id: randomUUID(),
        name,
        slug,
        icon: '',
        description,
        isActive: true,
      })
      .select('id, name, slug, icon, description, isActive')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A service with this name already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ service: data }, { status: 201 });
  } catch (err) {
    return handleAuthError(err);
  }
}
