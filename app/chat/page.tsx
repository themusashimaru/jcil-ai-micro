/**
 * CHAT PAGE - Main Application
 *
 * PURPOSE:
 * - Main chat interface SPA (sidebar, thread list, composer, streaming responses)
 * - Display chat history, start new conversations, use tools
 * - Mobile-first black theme with glassmorphism bubbles
 *
 * PUBLIC ROUTES:
 * - /chat (requires authentication)
 *
 * SERVER ACTIONS:
 * - Fetch user chat history
 * - Load specific chat thread
 * - Create new chat
 *
 * SECURITY/RLS NOTES:
 * - Protected route: redirect to auth if not authenticated
 * - RLS: users can only see their own chats
 * - Rate limit per user plan (Free: 10/day, Basic: 100/day, etc.)
 *
 * RATE LIMITS:
 * - Per-user message limits based on subscription tier
 * - Rate limit checks before sending messages
 *
 * DEPENDENCIES/ENVS:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * - User session from Supabase Auth
 *
 * TODO:
 * - [x] Implement sidebar with chat history
 * - [x] Build message composer with file upload
 * - [ ] Add streaming response handler (SSE)
 * - [x] Implement glassmorphism chat bubbles with tails
 * - [ ] Add tool launcher UI (Email, Essay, Research, etc.)
 * - [x] Show inline tool badges for function calls
 * - [x] Auto-title and auto-summary for chats
 * - [x] Add semantic search over chat history
 * - [ ] Implement export (PDF/TXT/JSON)
 * - [ ] Add voice input (Whisper STT with VAD)
 * - [x] Mobile responsive layout
 *
 * TEST PLAN:
 * - Verify auth redirect works
 * - Test message streaming with various providers
 * - Validate rate limits enforce correctly
 * - Check mobile layout and gestures
 * - Test file upload with size/type validation
 * - Verify tool calls display correctly
 */

import { ChatClient } from './ChatClient';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';

export default async function ChatPage() {
  // Check authentication
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently handle cookie errors
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login');
  }

  return <ChatClient />;
}
