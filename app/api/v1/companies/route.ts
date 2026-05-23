export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { CompanyQuerySchema, CreateCompanySchema } from '@/lib/validations/company.schema';
import { findCompanies, createCompany } from '@/lib/repositories/company.repository';
import { createAuditLog } from '@/lib/repositories/audit.repository';

export async function GET(req: NextRequest) {
  try {
    withPermission(getSessionFromRequest(req), 'companies:read');

    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = CompanyQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await findCompanies(parsed.data);
    return NextResponse.json(result, {
      headers:{
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[companies/get]', err);
    return NextResponse.json(
      { error: 'Failed to load companies'},
      { status: 500}
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'companies:write');

    const body = await req.json();
    const parsed = CreateCompanySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { serviceIds, ...companyData } = parsed.data;
    const company = await createCompany(companyData, serviceIds);

    await createAuditLog({
      userId: session.userId,
      username: session.username,
      action: 'COMPANY_CREATE',
      details: `Created company: ${company.name}`,
      targetEntity: company.slug,
    });

    return NextResponse.json({ company }, { status: 201 });
  } catch (err) {
    console.error('[companies/post]', err);
    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    );
  }
}
