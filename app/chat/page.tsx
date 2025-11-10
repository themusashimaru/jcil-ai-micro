/**
 * CHAT PAGE - Main Application
 *
 * PURPOSE:
 * - Main chat interface SPA with live search capability
 * - Display chat history, start new conversations, use tools
 * - Mobile-first black theme with glassmorphism bubbles
 *
 * PUBLIC ROUTES:
 * - /chat (requires authentication)
 *
 * FEATURES:
 * - ✅ Live web search with real-time results
 * - [ ] Regular chat completions
 * - [ ] Tool calling (Email, Essay, Research, etc.)
 * - [ ] File uploads and attachments
 * - [ ] Voice input
 *
 * SECURITY/RLS NOTES:
 * - Protected route: redirect to auth if not authenticated
 * - RLS: users can only see their own chats
 * - Rate limit per user plan (Free: 10/day, Basic: 100/day, etc.)
 *
 * DEPENDENCIES/ENVS:
 * - XAI_API_KEY (for live search)
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { ChatInterface } from '@/components/chat/ChatInterface';

export default async function ChatPage() {
  // TODO: Check authentication
  // const session = await getServerSession();
  // if (!session) redirect('/');

  return <ChatInterface />;
}
