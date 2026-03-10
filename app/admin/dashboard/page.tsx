/**
 * ADMIN DASHBOARD (redirects to /admin)
 */
import { redirect } from 'next/navigation';

export default function DashboardPage() {
  redirect('/admin');
}
