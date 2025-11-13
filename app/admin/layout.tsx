/**
 * ADMIN PANEL LAYOUT
 * Main layout for admin section with dropdown navigation
 */

import { getServerSession, isServerAdmin } from '@/lib/supabase/server-auth';
import { redirect } from 'next/navigation';
import AdminLayoutClient from './AdminLayoutClient';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  // Check admin status
  const isAdmin = await isServerAdmin();
  if (!isAdmin) {
    // Not an admin, redirect to chat
    redirect('/chat');
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
