import { redirect } from 'next/navigation';

// /superadmin is not a real route — the admin dashboard lives at /admin
export default function SuperAdminRedirect() {
  redirect('/admin');
}
