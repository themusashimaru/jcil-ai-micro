/**
 * CODE LAB PAGE
 *
 * The dedicated coding workspace - a professional environment
 * for building, debugging, and shipping code.
 *
 * Uses server-side auth like the main chat page for seamless authentication.
 */

import { getServerSession } from '@/lib/supabase/server-auth';
import { redirect } from 'next/navigation';
import { CodeLabClient } from './CodeLabClient';

export default async function CodeLabPage() {
  // Check authentication - redirect to login if not authenticated
  const session = await getServerSession();
  if (!session) {
    redirect('/login?redirect=/code-lab');
  }

  // Render Code Lab for authenticated users
  return <CodeLabClient userId={session.user.id} />;
}
