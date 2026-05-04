import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth/session';

// After a successful upload the server action redirects here.
// Forward the user to the documents page that matches their role.
export const dynamic = 'force-dynamic';

export default async function DashboardDocumentsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('rakel_session')?.value;
  if (!token) redirect('/');

  const session = verifyToken(token);
  if (!session) redirect('/');

  if (session.role === 'SUPER_ADMIN' || session.role === 'RAKEL_ADMIN') {
    redirect('/admin/documents');
  }

  redirect('/company/documents');
}
