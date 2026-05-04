import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { UpdateCompanySchema } from '@/lib/validations/company.schema';
import { findCompanyById, updateCompany, deleteCompany } from '@/lib/repositories/company.repository';
import { createAuditLog } from '@/lib/repositories/audit.repository';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    withPermission(getSessionFromRequest(req), 'companies:read');
    const { id } = await params;
    const company = await findCompanyById(id);
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    return NextResponse.json({ company });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'companies:write');
    const { id } = await params;

    const body = await req.json();
    const parsed = UpdateCompanySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { serviceIds, ...data } = parsed.data;
    const company = await updateCompany(id, data, serviceIds);

    await createAuditLog({
      userId: session.userId,
      username: session.username,
      action: 'COMPANY_UPDATE',
      details: `Updated company: ${company.name}`,
      targetEntity: company.slug,
    });

    return NextResponse.json({ company });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'companies:delete');
    const { id } = await params;
    await deleteCompany(id);

    await createAuditLog({
      userId: session.userId,
      username: session.username,
      action: 'COMPANY_UPDATE',
      details: `Deleted company id: ${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
