import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, withPermission, handleAuthError } from '@/lib/auth/middleware';
import { approveRegistration, declineRegistration } from '@/lib/services/user.service';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = withPermission(getSessionFromRequest(req), 'registrations:approve');
    const { id } = await params;
    const { action } = await req.json();

    if (action === 'approve') {
      const user = await approveRegistration(id, session);
      return NextResponse.json({ user });
    } else if (action === 'decline') {
      await declineRegistration(id, session);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action. Use "approve" or "decline".' }, { status: 400 });
  } catch (err) {
    return handleAuthError(err);
  }
}
