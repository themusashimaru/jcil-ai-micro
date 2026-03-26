/**
 * CHAT DEEP LINK PAGE
 *
 * Loads a specific conversation by ID from the URL.
 * Enables bookmarking and sharing conversation links.
 */

import dynamic from 'next/dynamic';
import { getServerSession } from '@/lib/supabase/server-auth';
import { redirect } from 'next/navigation';
import ChatLoading from '../loading';

const ChatClient = dynamic(() => import('../ChatClient').then((m) => ({ default: m.ChatClient })), {
  loading: () => <ChatLoading />,
  ssr: false,
});

interface ChatPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatConversationPage({ params }: ChatPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  // Basic UUID validation
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(id)) {
    redirect('/chat');
  }

  return <ChatClient initialConversationId={id} />;
}
