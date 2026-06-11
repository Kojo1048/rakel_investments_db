import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { db } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    withPermission(getSessionFromRequest(req), 'settings:write');

    const { id } = await params;
    const body = await req.json();
    const name = (body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
    }

    const description = (body.description ?? '').trim() || null;

    const { data, error } = await db
      .from('Service')
      .update({ name, description })
      .eq('id', id)
      .select('id, name, slug, icon, description, isActive')
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    return NextResponse.json({ service: data });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    withPermission(getSessionFromRequest(req), 'settings:write');

    const { id } = await params;

    // Remove all company assignments first to avoid FK constraint errors
    await db.from('CompanyService').delete().eq('serviceId', id);

    const { error } = await db.from('Service').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
